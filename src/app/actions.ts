"use server";

import { z } from "zod";
import { chargeGpo, chargeReference, getCharge, payReference, type ApiResult } from "@/lib/appypay";

export type Outcome = {
  ok: boolean;
  title: string;
  detail?: string;
  data?: Record<string, string>;
  raw?: ApiResult;
};

type Status = {
  successful?: boolean;
  status?: string | null;
  code?: number;
  message?: string;
  reference?: { entity?: string; referenceNumber?: string; dueDate?: string } | null;
};
type Charge = { id?: string; responseStatus?: Status };

const fail = (e: unknown): Outcome => ({ ok: false, title: "Erro", detail: e instanceof Error ? e.message : String(e) });
const isNullId = (id?: string) => !id || /^0{8}-/.test(id);

export async function payReferenceAction(input: { entity: string; reference: string }): Promise<Outcome> {
  const p = z
    .object({ entity: z.string().regex(/^\d{5}$/, "Entidade tem 5 dígitos"), reference: z.string().regex(/^\d{9}$/, "Referência tem 9 dígitos") })
    .safeParse({ entity: input.entity.replace(/\s/g, ""), reference: input.reference.replace(/\s/g, "") });
  if (!p.success) return { ok: false, title: "Dados inválidos", detail: p.error.issues[0].message };
  try {
    const raw = await payReference(p.data.entity, p.data.reference);
    const ok = raw.http >= 200 && raw.http < 300;
    return {
      ok,
      title: ok ? "Referência paga" : "Pagamento recusado",
      detail: ok
        ? "A AppyPay marcou a cobrança como paga e vai avisar o webhook do projeto."
        : "A AppyPay não aceitou: confirma a entidade e a referência (e se já não foi paga ou expirou).",
      data: { Entidade: p.data.entity, Referência: p.data.reference },
      raw,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function gpoAction(input: { amount: number; phone: string; description: string }): Promise<Outcome> {
  const p = z
    .object({
      amount: z.number().positive("Valor tem de ser maior que zero").max(10_000_000),
      phone: z.string().regex(/^9\d{8}$/, "Número no formato 9XXXXXXXX"),
      description: z.string().regex(/^[a-zA-Z0-9 ]{0,100}$/, "Descrição: só letras, números e espaços"),
    })
    .safeParse(input);
  if (!p.success) return { ok: false, title: "Dados inválidos", detail: p.error.issues[0].message };
  try {
    const raw = await chargeGpo(p.data.amount, p.data.phone, p.data.description || "Simulador");
    const c = raw.body as Charge;
    const st = c.responseStatus;
    const ok = st?.code === 100 || st?.status === "Success";
    return {
      ok,
      title: ok ? "Pagamento aprovado" : st?.status === "Pending" ? "Pagamento pendente" : "Pagamento recusado",
      detail: st?.message,
      data: { Valor: `${p.data.amount} Kz`, Número: p.data.phone, Código: String(st?.code ?? "-"), ...(isNullId(c.id) ? {} : { "ID transação": c.id! }) },
      raw,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function referenceAction(input: { amount: number; description: string; hours: number }): Promise<Outcome> {
  const p = z
    .object({
      amount: z.number().positive().max(10_000_000),
      description: z.string().regex(/^[a-zA-Z0-9 ]{0,100}$/, "Descrição: só letras, números e espaços"),
      hours: z.number().int().min(1).max(720),
    })
    .safeParse(input);
  if (!p.success) return { ok: false, title: "Dados inválidos", detail: p.error.issues[0].message };
  try {
    const raw = await chargeReference(p.data.amount, p.data.description || "Simulador", p.data.hours);
    const c = raw.body as Charge;
    const ref = c.responseStatus?.reference;
    if (!ref?.entity || !ref.referenceNumber)
      return { ok: false, title: "Não foi possível gerar", detail: c.responseStatus?.message, raw };
    return {
      ok: true,
      title: "Referência gerada",
      detail: "Paga-a no separador «Pagar referência».",
      data: {
        Entidade: ref.entity,
        Referência: ref.referenceNumber,
        Valor: `${p.data.amount} Kz`,
        "Válida até": ref.dueDate ?? "-",
        "ID transação": c.id ?? "-",
      },
      raw,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function lookupAction(id: string): Promise<Outcome> {
  if (!/^[0-9a-f-]{36}$/i.test(id.trim())) return { ok: false, title: "ID inválido", detail: "O ID da transação é um GUID (36 caracteres)." };
  try {
    const raw = await getCharge(id.trim());
    const p = (raw.body as { payment?: Record<string, unknown> })?.payment;
    if (!p) return { ok: false, title: "Transação não encontrada", raw };
    const ref = p.reference as { entity?: string; referenceNumber?: string } | null;
    return {
      ok: p.status === "Success",
      title: `Estado: ${String(p.status)}`,
      data: {
        Método: String(p.paymentMethod),
        Valor: `${Number(p.amount)} Kz`,
        "ID do comerciante": String(p.merchantTransactionId),
        Descrição: String(p.description ?? "-"),
        ...(ref?.referenceNumber ? { Referência: `${ref.entity} / ${ref.referenceNumber}` } : {}),
        Criada: String(p.createdDate).slice(0, 19).replace("T", " "),
      },
      raw,
    };
  } catch (e) {
    return fail(e);
  }
}
