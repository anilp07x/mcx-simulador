"use client";

import { useEffect, useState, useTransition } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  FlaskConical,
  Hash,
  History,
  ListChecks,
  Loader2,
  Menu,
  Nfc,
  Receipt,
  Search,
  Smartphone,
  Trash2,
  XCircle,
} from "lucide-react";
import { gpoAction, lookupAction, payReferenceAction, referenceAction, type Outcome } from "./actions";

type Screen = "home" | "pagar" | "express" | "gerar" | "consultar" | "historico" | "numeros";
type Entry = Outcome & { at: string; kind: string };

const TILES: { id: Exclude<Screen, "home">; label: string; icon: typeof Receipt }[] = [
  { id: "pagar", label: "Pagar referência", icon: Receipt },
  { id: "express", label: "Pagamento por telemóvel", icon: Smartphone },
  { id: "gerar", label: "Gerar referência", icon: Hash },
  { id: "consultar", label: "Consultar transação", icon: Search },
  { id: "historico", label: "Histórico", icon: History },
  { id: "numeros", label: "Números de teste", icon: ListChecks },
];

const TITLES: Record<Exclude<Screen, "home">, string> = {
  pagar: "Pagamento por referência",
  express: "Pagamento por telemóvel",
  gerar: "Gerar referência",
  consultar: "Consultar transação",
  historico: "Histórico",
  numeros: "Números de teste",
};

export const SCENARIOS = [
  { phone: "900000000", label: "Aprovado", code: 100, ok: true },
  { phone: "900000001", label: "Saldo insuficiente", code: 216, ok: false },
  { phone: "900000002", label: "Tempo esgotado (90 s)", code: 211, ok: false },
  { phone: "900000003", label: "Recusado pelo cliente", code: 231, ok: false },
];

const field =
  "w-full border-0 border-b-2 border-neutral-200 bg-transparent px-1 py-2.5 text-lg text-neutral-800 placeholder:text-neutral-300 focus:border-orange-500 focus:ring-0 focus:outline-none";
const label = "block text-xs font-semibold tracking-wide text-orange-600 uppercase";
const primary =
  "flex w-full items-center justify-center gap-2 rounded-md bg-orange-500 py-3.5 font-bold tracking-wide text-white uppercase shadow-md shadow-orange-500/30 transition hover:bg-orange-600 disabled:opacity-50";

function load(): Entry[] {
  try {
    return JSON.parse(localStorage.getItem("mcx-sim-history") ?? "[]");
  } catch {
    return [];
  }
}

export function Simulator({ ready }: { ready: { credentials: boolean; gpo: boolean; ref: boolean } }) {
  const [screen, setScreen] = useState<Screen>("home");
  const [result, setResult] = useState<Entry | null>(null);
  const [history, setHistory] = useState<Entry[]>([]);
  const [prefill, setPrefill] = useState("");
  const [busy, start] = useTransition();

  useEffect(() => setHistory(load()), []); // eslint-disable-line react-hooks/set-state-in-effect -- só no cliente

  function go(s: Screen) {
    setScreen(s);
    setResult(null);
  }

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
    if (screen === "pagar") run("Pagar referência", () => payReferenceAction({ entity: f.entity, reference: f.reference }));
    if (screen === "express")
      run("Pagamento por telemóvel", () => gpoAction({ amount: Number(f.amount), phone: f.phone, description: f.description }));
    if (screen === "gerar")
      run("Gerar referência", () => referenceAction({ amount: Number(f.amount), description: f.description, hours: Number(f.hours) }));
    if (screen === "consultar") run("Consultar", () => lookupAction(f.id));
  }

  const missing = !ready.credentials || (screen === "express" && !ready.gpo) || (screen === "gerar" && !ready.ref);
  const isForm = screen === "pagar" || screen === "express" || screen === "gerar" || screen === "consultar";

  return (
    <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[390px_1fr] lg:items-start">
      {/* Telemóvel */}
      <div className="mx-auto w-full max-w-[390px] rounded-[2.6rem] bg-neutral-900 p-3 shadow-2xl shadow-black/40">
        <div className="flex h-[760px] flex-col overflow-hidden rounded-[2rem] bg-neutral-50">
          {/* barra de estado */}
          <div className="flex items-center justify-between bg-orange-600 px-5 pt-2 pb-1 text-[11px] font-semibold text-white/90">
            <span>09:41</span>
            <span className="flex items-center gap-1">
              <FlaskConical className="size-3" /> AMBIENTE DE TESTE
            </span>
          </div>

          {/* cabeçalho */}
          <header className="flex items-center gap-3 bg-orange-500 px-4 py-3.5 text-white shadow-md">
            {screen === "home" ? (
              <Menu className="size-6" />
            ) : (
              <button onClick={() => go("home")} aria-label="Voltar" className="-m-1 rounded-full p-1 hover:bg-white/15">
                <ArrowLeft className="size-6" />
              </button>
            )}
            <div className="flex flex-1 items-center justify-center gap-2 pr-6">
              <span className="grid size-7 place-items-center rounded-full bg-white text-orange-500">
                <Nfc className="size-4" />
              </span>
              <span className="text-xl font-black tracking-tight italic">simulador</span>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            {screen === "home" ? (
              <Home onOpen={go} lastOk={history[0]} />
            ) : (
              <div>
                <h2 className="bg-white py-3 text-center text-sm font-bold tracking-wide text-orange-600 uppercase shadow-sm">
                  {TITLES[screen]}
                </h2>
                <div className="space-y-5 p-5">
                  {isForm && (
                    <form key={screen + prefill} onSubmit={onSubmit} className="space-y-5 rounded-lg bg-white p-5 shadow-sm" autoComplete="off">
                      {screen === "pagar" && (
                        <>
                          <Hint text="Paga uma referência gerada por qualquer projeto que use a conta de teste da AppyPay." />
                          <label className="block">
                            <span className={label}>Entidade</span>
                            <input name="entity" defaultValue="00348" inputMode="numeric" maxLength={5} className={field} />
                          </label>
                          <label className="block">
                            <span className={label}>Referência</span>
                            <input name="reference" defaultValue={prefill} inputMode="numeric" placeholder="000 000 000" maxLength={11} required className={field} autoFocus />
                          </label>
                        </>
                      )}
                      {screen === "express" && (
                        <>
                          <Hint text="Cria uma cobrança por telemóvel (GPO) na conta de teste. O número decide o resultado." />
                          <label className="block">
                            <span className={label}>Número de teste</span>
                            <select name="phone" className={field} defaultValue="900000000">
                              {SCENARIOS.map((s) => (
                                <option key={s.phone} value={s.phone}>
                                  {s.phone} — {s.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <Amount />
                          <Description />
                        </>
                      )}
                      {screen === "gerar" && (
                        <>
                          <Hint text="Gera uma referência de teste (como faria um projeto) para depois a pagares." />
                          <Amount />
                          <label className="block">
                            <span className={label}>Validade (horas)</span>
                            <input name="hours" type="number" min={1} max={720} defaultValue={24} className={field} />
                          </label>
                          <Description />
                        </>
                      )}
                      {screen === "consultar" && (
                        <>
                          <Hint text="Vê o estado de qualquer transação da conta de teste pelo ID (GUID)." />
                          <label className="block">
                            <span className={label}>ID da transação</span>
                            <input name="id" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" required className={`${field} text-sm`} />
                          </label>
                        </>
                      )}

                      {missing && (
                        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                          Falta configurar a AppyPay no <code>.env.local</code> (ver README).
                        </p>
                      )}

                      <button disabled={busy || missing} className={primary}>
                        {busy && <Loader2 className="size-5 animate-spin" />}
                        {busy ? "A processar…" : screen === "pagar" ? "Pagar" : screen === "express" ? "Cobrar" : screen === "gerar" ? "Gerar" : "Consultar"}
                      </button>
                    </form>
                  )}

                  {screen === "historico" && (
                    <HistoryList
                      items={history}
                      onClear={() => {
                        setHistory([]);
                        try {
                          localStorage.removeItem("mcx-sim-history");
                        } catch {}
                      }}
                    />
                  )}
                  {screen === "numeros" && <Scenarios />}

                  {result && isForm && (
                    <ResultCard
                      r={result}
                      onPay={(ref) => {
                        setPrefill(ref);
                        go("pagar");
                      }}
                    />
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Painel lateral */}
      <aside className="space-y-6">
        <section className="rounded-2xl bg-white/95 p-6 text-neutral-700 shadow-lg">
          <h2 className="text-lg font-bold text-neutral-900">Simulador de pagamentos · AppyPay sandbox</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Ferramenta de testes para programadores. Só funciona no ambiente de testes da AppyPay e não movimenta dinheiro real.
            Não é a app oficial nem tem ligação à EMIS ou à AppyPay.
          </p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
            <li>No teu projeto, paga por <b>Referência</b> e copia a entidade e a referência.</li>
            <li>Aqui, em <b>Pagar referência</b>, cola-a e carrega em Pagar.</li>
            <li>A AppyPay avisa o webhook do projeto e o pedido passa a pago.</li>
            <li>Para pagamento por telemóvel, usa no projeto um dos números de teste.</li>
          </ol>
        </section>

        {result?.raw && (
          <section className="rounded-2xl bg-neutral-900 p-6 shadow-lg">
            <h2 className="text-lg font-bold text-white">
              Resposta da API <span className="text-sm font-normal text-neutral-400">HTTP {result.raw.http}</span>
            </h2>
            <pre className="mt-3 max-h-96 overflow-auto rounded-xl bg-black/40 p-4 text-xs leading-relaxed text-orange-200">
              {JSON.stringify(result.raw.body, null, 2)}
            </pre>
          </section>
        )}
      </aside>
    </div>
  );
}

function Home({ onOpen, lastOk }: { onOpen: (s: Screen) => void; lastOk?: Entry }) {
  return (
    <div className="p-5">
      <h2 className="text-center text-sm font-bold tracking-wide text-orange-600 uppercase">Pagamentos de teste</h2>

      {/* cartão de teste */}
      <div className="relative mt-4 overflow-hidden rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 p-5 text-white shadow-lg shadow-orange-500/30">
        <div className="absolute -top-10 -right-10 size-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-14 -left-6 size-40 rounded-full bg-white/10" />
        <div className="relative flex items-start justify-between">
          <div className="h-8 w-11 rounded-md bg-gradient-to-br from-yellow-200 to-yellow-500" />
          <span className="rounded bg-white/20 px-2 py-0.5 text-[10px] font-bold tracking-widest">SANDBOX</span>
        </div>
        <p className="relative mt-6 font-mono text-lg tracking-[0.2em]">9000 •••• •••• 0000</p>
        <div className="relative mt-3 flex justify-between text-xs text-white/85">
          <span>CARTÃO DE TESTE</span>
          <span>12/99</span>
        </div>
      </div>
      <p className="mt-3 text-center text-sm text-neutral-400">
        {lastOk ? `Última operação: ${lastOk.title.toLowerCase()}` : "Cartão de teste"}
      </p>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {TILES.map(({ id, label: l, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onOpen(id)}
            className="flex flex-col items-center gap-2 rounded-lg bg-white p-3 text-center shadow-sm ring-1 ring-neutral-100 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="grid size-11 place-items-center rounded-lg border-2 border-orange-200 text-orange-500">
              <Icon className="size-6" />
            </span>
            <span className="text-[11px] leading-tight font-semibold text-neutral-600 uppercase">{l}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Hint({ text }: { text: string }) {
  return <p className="text-sm leading-relaxed text-neutral-500">{text}</p>;
}

function Amount() {
  return (
    <label className="block">
      <span className={label}>Valor (Kz)</span>
      <input name="amount" type="number" min={1} step="any" defaultValue={1000} required className={field} />
    </label>
  );
}

function Description() {
  return (
    <label className="block">
      <span className={label}>Descrição</span>
      <input name="description" defaultValue="Teste simulador" maxLength={100} className={field} />
    </label>
  );
}

function ResultCard({ r, onPay }: { r: Entry; onPay: (ref: string) => void }) {
  const Icon = r.ok ? CheckCircle2 : r.title.includes("pendente") ? Clock : XCircle;
  return (
    <div className="rounded-lg bg-white p-5 shadow-sm">
      <p className={`flex items-center gap-2 text-lg font-bold ${r.ok ? "text-green-600" : "text-red-600"}`}>
        <Icon className="size-6" /> {r.title}
      </p>
      {r.detail && <p className="mt-1 text-sm text-neutral-500">{r.detail}</p>}
      {r.data && (
        <dl className="mt-4 divide-y divide-neutral-100 text-sm">
          {Object.entries(r.data).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 py-2">
              <dt className="text-neutral-400">{k}</dt>
              <dd className="text-right font-mono break-all text-neutral-800">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {r.kind === "Gerar referência" && r.ok && r.data?.["Referência"] && (
        <button onClick={() => onPay(r.data!["Referência"])} className={`${primary} mt-4`}>
          Pagar esta referência
        </button>
      )}
    </div>
  );
}

function Scenarios() {
  return (
    <div className="rounded-lg bg-white shadow-sm">
      <p className="px-5 pt-4 text-sm text-neutral-500">
        Usa estes números em qualquer projeto: a AppyPay decide o resultado do pagamento por telemóvel pelo número.
      </p>
      <ul className="mt-2 divide-y divide-neutral-100">
        {SCENARIOS.map((s) => (
          <li key={s.phone} className="flex items-center justify-between px-5 py-3">
            <span className="font-mono text-neutral-800">{s.phone}</span>
            <span className={`text-right text-sm font-semibold ${s.ok ? "text-green-600" : "text-red-600"}`}>
              {s.label}
              <span className="block text-xs font-normal text-neutral-400">código {s.code}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HistoryList({ items, onClear }: { items: Entry[]; onClear: () => void }) {
  if (!items.length) return <p className="rounded-lg bg-white py-14 text-center text-sm text-neutral-400 shadow-sm">Ainda sem operações.</p>;
  return (
    <div className="rounded-lg bg-white shadow-sm">
      <div className="flex items-center justify-between px-5 pt-4">
        <p className={label}>Últimas operações</p>
        <button onClick={onClear} className="flex items-center gap-1 text-xs text-neutral-400 hover:text-red-600">
          <Trash2 className="size-3.5" /> Limpar
        </button>
      </div>
      <ul className="mt-2 divide-y divide-neutral-100">
        {items.map((h, i) => (
          <li key={i} className="px-5 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-neutral-800">{h.kind}</span>
              <span className={`text-xs font-bold ${h.ok ? "text-green-600" : "text-red-600"}`}>{h.title}</span>
            </div>
            <p className="mt-0.5 text-xs text-neutral-400">
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
