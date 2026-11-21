import "server-only";

/**
 * Cliente da AppyPay — SÓ ambiente de testes (sandbox).
 * Usa a mesma conta de teste que os projetos, por isso consegue pagar
 * referências geradas por qualquer um deles.
 */
const cfg = {
  clientId: process.env.APPYPAY_CLIENT_ID ?? "",
  clientSecret: process.env.APPYPAY_CLIENT_SECRET ?? "",
  gpoMethod: process.env.APPYPAY_GPO_METHOD ?? "",
  refMethod: process.env.APPYPAY_REF_METHOD ?? "",
  authUrl: "https://login.microsoftonline.com/appypaydev.onmicrosoft.com/oauth2/token",
  resource: "2aed7612-de64-46b5-9e59-1f48f8902d14",
  gateway: "https://gwy-api-tst.appypay.co.ao/v2.0",
};

export const configured = () => ({
  credentials: !!(cfg.clientId && cfg.clientSecret),
  gpo: !!cfg.gpoMethod,
  ref: !!cfg.refMethod,
});

let token: { value: string; expires: number } | null = null;

async function accessToken() {
  if (token && token.expires > Date.now() + 60_000) return token.value;
  if (!cfg.clientId || !cfg.clientSecret) throw new Error("Faltam APPYPAY_CLIENT_ID / APPYPAY_CLIENT_SECRET no .env.local");
  const res = await fetch(cfg.authUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      resource: cfg.resource,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: string; error_description?: string };
  if (!res.ok || !json.access_token)
    throw new Error(`Autenticação falhou: ${(json.error_description ?? `HTTP ${res.status}`).split("\r")[0]}`);
  token = { value: json.access_token, expires: Date.now() + Number(json.expires_in ?? 3600) * 1000 };
  return token.value;
}

export type ApiResult = { http: number; body: unknown };

async function call(path: string, method = "GET", body?: unknown, timeoutMs = 90_000): Promise<ApiResult> {
  const res = await fetch(cfg.gateway + path, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {}
  return { http: res.status, body: parsed };
}

/** ID único por cobrança: alfanumérico, máx. 15 caracteres (regra da AppyPay). */
const txId = (prefix: string) => (prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)).slice(0, 15).toUpperCase();

export function chargeGpo(amount: number, phone: string, description: string) {
  return call("/charges", "POST", {
    amount,
    currency: "AOA",
    description,
    merchantTransactionId: txId("SIM"),
    paymentMethod: cfg.gpoMethod,
    paymentInfo: { phoneNumber: phone },
  });
}

export function chargeReference(amount: number, description: string, hours: number) {
  const due = new Date(Date.now() + hours * 3600_000).toISOString().slice(0, 19);
  const referenceNumber = String(100_000_000 + Math.floor(Math.random() * 900_000_000));
  return call("/charges", "POST", {
    amount,
    currency: "AOA",
    description,
    merchantTransactionId: txId("SIMR"),
    paymentMethod: cfg.refMethod,
    paymentInfo: { referenceNumber, dueDate: due },
  });
}

/** Simula o cliente a pagar uma referência (ATM / Multicaixa Express / homebanking). */
export function payReference(entity: string, referenceNumber: string) {
  return call("/mocks/referenceProcessing", "POST", { entity, referenceNumber }, 60_000);
}

export function getCharge(id: string) {
  return call(`/charges/${encodeURIComponent(id)}`, "GET", undefined, 20_000);
}
