"use client";

import { useEffect, useState, useTransition } from "react";
import {
  CheckCircle2,
  Clock,
  Hash,
  History,
  Loader2,
  Receipt,
  Search,
  Smartphone,
  Trash2,
  XCircle,
} from "lucide-react";
import { gpoAction, lookupAction, payReferenceAction, referenceAction, type Outcome } from "./actions";

type Tab = "pagar" | "express" | "gerar" | "consultar" | "historico";
type Entry = Outcome & { at: string; kind: string };

const TABS: { id: Tab; label: string; icon: typeof Receipt }[] = [
  { id: "pagar", label: "Pagar ref.", icon: Receipt },
  { id: "express", label: "Express", icon: Smartphone },
  { id: "gerar", label: "Gerar ref.", icon: Hash },
  { id: "consultar", label: "Consultar", icon: Search },
  { id: "historico", label: "Histórico", icon: History },
];

export const SCENARIOS = [
  { phone: "900000000", label: "Aprovado", tone: "text-emerald-400" },
  { phone: "900000001", label: "Saldo insuficiente", tone: "text-rose-400" },
  { phone: "900000002", label: "Tempo esgotado", tone: "text-amber-400" },
  { phone: "900000003", label: "Recusado pelo cliente", tone: "text-rose-400" },
];

const field =
  "w-full rounded-2xl bg-white/5 px-4 py-3.5 text-lg tracking-wide text-white ring-1 ring-white/10 placeholder:text-white/25 focus:ring-2 focus:ring-teal-400 focus:outline-none";
const label = "mb-1.5 block text-xs font-semibold tracking-wider text-white/50 uppercase";
const primary =
  "flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-400 py-4 font-bold text-slate-950 transition hover:bg-teal-300 disabled:opacity-50";

function load(): Entry[] {
  try {
    return JSON.parse(localStorage.getItem("mcx-sim-history") ?? "[]");
  } catch {
    return [];
  }
}

export function Simulator({ ready }: { ready: { credentials: boolean; gpo: boolean; ref: boolean } }) {
  const [tab, setTab] = useState<Tab>("pagar");
  const [result, setResult] = useState<Entry | null>(null);
  const [history, setHistory] = useState<Entry[]>([]);
  const [busy, start] = useTransition();

  useEffect(() => setHistory(load()), []); // eslint-disable-line react-hooks/set-state-in-effect -- só no cliente

  function run(kind: string, fn: () => Promise<Outcome>) {
    setResult(null);
    start(async () => {
      const out = await fn();
      const entry = { ...out, kind, at: new Date().toLocaleString("pt-PT") };
      setResult(entry);
      setHistory((h) => {
        const next = [entry, ...h].slice(0, 30);
        try {
          localStorage.setItem("mcx-sim-history", JSON.stringify(next.map((e) => ({ ...e, raw: undefined }))));
        } catch {}
        return next;
      });
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    if (tab === "pagar") run("Pagar referência", () => payReferenceAction({ entity: f.entity, reference: f.reference }));
    if (tab === "express")
      run("Multicaixa Express", () => gpoAction({ amount: Number(f.amount), phone: f.phone, description: f.description }));
    if (tab === "gerar")
      run("Gerar referência", () => referenceAction({ amount: Number(f.amount), description: f.description, hours: Number(f.hours) }));
    if (tab === "consultar") run("Consultar", () => lookupAction(f.id));
  }

  const missing = !ready.credentials || (tab === "express" && !ready.gpo) || (tab === "gerar" && !ready.ref);

  return (
    <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[400px_1fr] lg:items-start">
      {/* Telemóvel */}
      <div className="mx-auto w-full max-w-[400px] rounded-[2.75rem] bg-slate-900 p-3 shadow-2xl ring-1 shadow-teal-950/50 ring-white/10">
        <div className="flex min-h-[720px] flex-col overflow-hidden rounded-[2.2rem] bg-gradient-to-b from-slate-900 to-slate-950">
          <header className="flex items-center justify-between px-6 pt-6 pb-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-teal-300 uppercase">Simulador</p>
              <h1 className="text-2xl font-extrabold text-white">MCX Teste</h1>
            </div>
            <span className="rounded-full bg-amber-400/15 px-3 py-1 text-xs font-bold text-amber-300 ring-1 ring-amber-400/30">
              SANDBOX
            </span>
          </header>

          <main className="flex-1 space-y-5 px-6 pb-6">
            {tab === "historico" ? (
              <HistoryList items={history} onClear={() => { setHistory([]); try { localStorage.removeItem("mcx-sim-history"); } catch {} }} />
            ) : (
              <form key={tab} onSubmit={onSubmit} className="space-y-4" autoComplete="off">
                {tab === "pagar" && (
                  <>
                    <Intro text="Paga uma referência gerada por qualquer projeto que use a conta de teste da AppyPay." />
                    <div>
                      <span className={label}>Entidade</span>
                      <input name="entity" defaultValue="00348" inputMode="numeric" maxLength={5} className={field} />
                    </div>
                    <div>
                      <span className={label}>Referência</span>
                      <input name="reference" inputMode="numeric" placeholder="000 000 000" maxLength={11} required className={field} autoFocus />
                    </div>
                  </>
                )}
                {tab === "express" && (
                  <>
                    <Intro text="Cria uma cobrança Multicaixa Express na conta de teste. O número decide o resultado." />
                    <div>
                      <span className={label}>Número de teste</span>
                      <select name="phone" className={field} defaultValue="900000000">
                        {SCENARIOS.map((s) => (
                          <option key={s.phone} value={s.phone} className="bg-slate-900">
                            {s.phone} — {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Amount />
                    <Description />
                  </>
                )}
                {tab === "gerar" && (
                  <>
                    <Intro text="Gera uma referência de teste (como faria um projeto) para depois a pagares." />
                    <Amount />
                    <div>
                      <span className={label}>Validade (horas)</span>
                      <input name="hours" type="number" min={1} max={720} defaultValue={24} className={field} />
                    </div>
                    <Description />
                  </>
                )}
                {tab === "consultar" && (
                  <>
                    <Intro text="Vê o estado de qualquer transação da conta de teste pelo ID (GUID)." />
                    <div>
                      <span className={label}>ID da transação</span>
                      <input name="id" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" required className={`${field} text-sm`} />
                    </div>
                  </>
                )}

                {missing && (
                  <p className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-rose-500/20">
                    Falta configurar a AppyPay no <code>.env.local</code> (ver README).
                  </p>
                )}

                <button disabled={busy || missing} className={primary}>
                  {busy && <Loader2 className="size-5 animate-spin" />}
                  {busy ? "A processar…" : tab === "pagar" ? "Pagar" : tab === "express" ? "Cobrar" : tab === "gerar" ? "Gerar" : "Consultar"}
                </button>
              </form>
            )}

            {result && tab !== "historico" && <ResultCard r={result} onUse={(ref) => { setTab("pagar"); setResult(null); setTimeout(() => {
              const i = document.querySelector<HTMLInputElement>("input[name=reference]"); if (i) i.value = ref; }, 0); }} />}
          </main>

          <nav className="grid grid-cols-5 border-t border-white/5 bg-slate-950/80 px-2 py-2">
            {TABS.map(({ id, label: l, icon: Icon }) => (
              <button
                key={id}
                onClick={() => { setTab(id); setResult(null); }}
                aria-pressed={tab === id}
                className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold transition ${
                  tab === id ? "text-teal-300" : "text-white/40 hover:text-white/70"
                }`}
              >
                <Icon className="size-5" />
                {l}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Painel lateral */}
      <aside className="space-y-6 text-slate-300">
        <section className="rounded-3xl bg-slate-900/60 p-6 ring-1 ring-white/10">
          <h2 className="text-lg font-bold text-white">Números de teste (Multicaixa Express)</h2>
          <p className="mt-1 text-sm text-slate-400">Usa-os em qualquer projeto: a AppyPay decide o resultado pelo número.</p>
          <ul className="mt-4 divide-y divide-white/5">
            {SCENARIOS.map((s) => (
              <li key={s.phone} className="flex items-center justify-between py-2.5 font-mono text-sm">
                <span className="text-white">{s.phone}</span>
                <span className={`font-sans font-semibold ${s.tone}`}>{s.label}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl bg-slate-900/60 p-6 ring-1 ring-white/10">
          <h2 className="text-lg font-bold text-white">Como testar um projeto</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-400">
            <li>No projeto, escolhe pagar por <b className="text-slate-200">Referência</b> e copia a entidade e a referência.</li>
            <li>Aqui, em <b className="text-slate-200">Pagar ref.</b>, cola a referência e carrega em Pagar.</li>
            <li>A AppyPay avisa o webhook do projeto e o pedido passa a pago.</li>
            <li>Para Multicaixa Express, usa no projeto um dos números acima.</li>
          </ol>
        </section>

        {result?.raw && (
          <section className="rounded-3xl bg-slate-900/60 p-6 ring-1 ring-white/10">
            <h2 className="text-lg font-bold text-white">
              Resposta da API <span className="text-sm font-normal text-slate-400">HTTP {result.raw.http}</span>
            </h2>
            <pre className="mt-3 max-h-96 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-relaxed text-teal-200">
              {JSON.stringify(result.raw.body, null, 2)}
            </pre>
          </section>
        )}
      </aside>
    </div>
  );
}

function Intro({ text }: { text: string }) {
  return <p className="text-sm leading-relaxed text-white/50">{text}</p>;
}

function Amount() {
  return (
    <div>
      <span className={label}>Valor (Kz)</span>
      <input name="amount" type="number" min={1} step="any" defaultValue={1000} required className={field} />
    </div>
  );
}

function Description() {
  return (
    <div>
      <span className={label}>Descrição</span>
      <input name="description" defaultValue="Teste simulador" maxLength={100} className={field} />
    </div>
  );
}

function ResultCard({ r, onUse }: { r: Entry; onUse: (ref: string) => void }) {
  const Icon = r.ok ? CheckCircle2 : r.title.includes("pendente") ? Clock : XCircle;
  return (
    <div className={`rounded-3xl p-5 ring-1 ${r.ok ? "bg-emerald-500/10 ring-emerald-500/25" : "bg-rose-500/10 ring-rose-500/25"}`}>
      <p className={`flex items-center gap-2 text-lg font-bold ${r.ok ? "text-emerald-300" : "text-rose-300"}`}>
        <Icon className="size-6" /> {r.title}
      </p>
      {r.detail && <p className="mt-1 text-sm text-white/60">{r.detail}</p>}
      {r.data && (
        <dl className="mt-4 space-y-2 text-sm">
          {Object.entries(r.data).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt className="text-white/40">{k}</dt>
              <dd className="text-right font-mono break-all text-white">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {r.kind === "Gerar referência" && r.ok && r.data?.["Referência"] && (
        <button onClick={() => onUse(r.data!["Referência"])} className="mt-4 w-full rounded-2xl bg-white/10 py-3 text-sm font-semibold text-white hover:bg-white/15">
          Pagar esta referência agora
        </button>
      )}
    </div>
  );
}

function HistoryList({ items, onClear }: { items: Entry[]; onClear: () => void }) {
  if (!items.length) return <p className="py-16 text-center text-sm text-white/40">Ainda sem operações.</p>;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className={label}>Últimas operações</p>
        <button onClick={onClear} className="flex items-center gap-1 text-xs text-white/40 hover:text-rose-300">
          <Trash2 className="size-3.5" /> Limpar
        </button>
      </div>
      <ul className="space-y-2">
        {items.map((h, i) => (
          <li key={i} className="rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-white">{h.kind}</span>
              <span className={`text-xs font-bold ${h.ok ? "text-emerald-300" : "text-rose-300"}`}>{h.title}</span>
            </div>
            <p className="mt-1 text-xs text-white/40">
              {h.at}
              {h.data?.["Referência"] ? ` · ${h.data["Referência"]}` : ""}
              {h.data?.["Valor"] ? ` · ${h.data["Valor"]}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
