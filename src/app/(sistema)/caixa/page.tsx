"use client";

import { ArrowDownCircle, ArrowUpCircle, Banknote, Calculator, CreditCard, Loader2, Lock, QrCode, Unlock } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAvisos } from "@/components/Avisos";
import { Modal } from "@/components/Modal";
import { brl, centavos, dataHora, hora, lerValor } from "@/lib/formato";
import { mensagemErro, supabase } from "@/lib/supabase";
import type { Caixa, Movimento, ResumoCaixa } from "@/lib/tipos";

const CEDULAS = [200, 100, 50, 20, 10, 5, 2];
const MOEDAS = [1, 0.5, 0.25, 0.1, 0.05];

export default function PaginaCaixa() {
  const [caixa, setCaixa] = useState<Caixa | null | undefined>(undefined);
  const [resumo, setResumo] = useState<ResumoCaixa | null>(null);
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [historico, setHistorico] = useState<Caixa[]>([]);
  const [movimento, setMovimento] = useState<"sangria" | "suprimento" | null>(null);
  const [fechando, setFechando] = useState(false);
  const [fechado, setFechado] = useState<Caixa | null>(null);

  const [versao, setVersao] = useState(0);
  const carregar = () => setVersao((v) => v + 1);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const [{ data: aberto }, { data: hist }] = await Promise.all([
        supabase().from("caixas").select("*").eq("status", "aberto").maybeSingle(),
        supabase().from("caixas").select("*").eq("status", "fechado").order("fechado_em", { ascending: false }).limit(10),
      ]);
      let r = null;
      let m = null;
      if (aberto) {
        [{ data: r }, { data: m }] = await Promise.all([
          supabase().rpc("resumo_caixa", { p_caixa: aberto.id }),
          supabase().from("movimentos_caixa").select("*").eq("caixa_id", aberto.id).order("criado_em"),
        ]);
      }
      if (!ativo) return;
      setCaixa(aberto as Caixa | null);
      setHistorico((hist as Caixa[]) ?? []);
      setResumo(r as ResumoCaixa | null);
      setMovimentos((m as Movimento[]) ?? []);
    })();
    return () => {
      ativo = false;
    };
  }, [versao]);

  if (caixa === undefined) return <Loader2 className="mx-auto my-20 size-6 animate-spin text-suave" />;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {caixa ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-ok-claro">
                <Unlock className="size-5 text-ok" />
              </span>
              <div>
                <p className="font-display text-xl font-semibold">Caixa aberto</p>
                <p className="text-sm text-suave">
                  Desde {dataHora(caixa.aberto_em)} · troco inicial {brl(caixa.troco_inicial)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setMovimento("sangria")} className="btn-claro">
                <ArrowUpCircle className="size-4 text-erro" /> Sangria
              </button>
              <button onClick={() => setMovimento("suprimento")} className="btn-claro">
                <ArrowDownCircle className="size-4 text-ok" /> Suprimento
              </button>
              <button onClick={() => setFechando(true)} className="btn-escuro">
                <Lock className="size-4" /> Fechar caixa
              </button>
            </div>
          </div>

          {resumo && (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <CartaoForma icone={<Banknote className="size-4" />} nome="Dinheiro" valor={resumo.vendas_dinheiro} n={resumo.n_dinheiro} />
                <CartaoForma icone={<QrCode className="size-4" />} nome="Pix" valor={resumo.vendas_pix} n={resumo.n_pix} />
                <CartaoForma icone={<CreditCard className="size-4" />} nome="Débito" valor={resumo.vendas_debito} n={resumo.n_debito} />
                <CartaoForma icone={<CreditCard className="size-4" />} nome="Crédito" valor={resumo.vendas_credito} n={resumo.n_credito} />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <section className="rounded-2xl bg-tinta p-6 text-white">
                  <p className="text-sm text-white/60">Dinheiro que deve estar na gaveta</p>
                  <p className="num mt-1 font-display text-4xl font-bold text-marca">{brl(resumo.esperado_dinheiro)}</p>
                  <dl className="num mt-5 space-y-2 text-sm">
                    <Linha rotulo="Troco inicial" valor={resumo.troco_inicial} />
                    <Linha rotulo="+ Vendas em dinheiro" valor={resumo.vendas_dinheiro} />
                    <Linha rotulo="+ Suprimentos" valor={resumo.suprimentos} />
                    <Linha rotulo="− Sangrias" valor={-resumo.sangrias} />
                  </dl>
                  <div className="mt-5 flex justify-between border-t border-white/15 pt-4 text-sm">
                    <span className="text-white/60">Total vendido ({resumo.n_vendas} vendas)</span>
                    <span className="num font-semibold">{brl(resumo.total_vendas)}</span>
                  </div>
                </section>

                <section className="card p-5">
                  <h2 className="mb-3 font-display text-lg font-semibold">Sangrias e suprimentos</h2>
                  {movimentos.length === 0 ? (
                    <p className="py-6 text-center text-sm text-suave">
                      Nenhum movimento. Use <b>Sangria</b> para tirar dinheiro da gaveta e <b>Suprimento</b> para colocar.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {movimentos.map((m) => (
                        <li key={m.id} className="flex items-center gap-3 text-sm">
                          {m.tipo === "sangria" ? (
                            <ArrowUpCircle className="size-4 shrink-0 text-erro" />
                          ) : (
                            <ArrowDownCircle className="size-4 shrink-0 text-ok" />
                          )}
                          <span className="flex-1 truncate">
                            {m.tipo === "sangria" ? "Sangria" : "Suprimento"}
                            {m.descricao && <span className="text-suave"> · {m.descricao}</span>}
                          </span>
                          <span className="num text-xs text-suave">{hora(m.criado_em)}</span>
                          <span className={`num w-24 text-right font-semibold ${m.tipo === "sangria" ? "text-erro" : "text-ok"}`}>
                            {m.tipo === "sangria" ? "−" : "+"}
                            {brl(m.valor)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </>
          )}
        </>
      ) : (
        <AbrirCaixa aoAbrir={carregar} />
      )}

      <Historico caixas={historico} />

      {movimento && caixa && (
        <NovoMovimento
          tipo={movimento}
          caixaId={caixa.id}
          aoFechar={() => setMovimento(null)}
          aoSalvar={() => {
            setMovimento(null);
            carregar();
          }}
        />
      )}

      {resumo && fechando && (
        <Fechamento
          resumo={resumo}
          aoFechar={() => setFechando(false)}
          aoFechou={async (id) => {
            setFechando(false);
            const { data } = await supabase().from("caixas").select("*").eq("id", id).single();
            setFechado(data as Caixa);
            setResumo(null);
            carregar();
          }}
        />
      )}

      <Modal aberto={!!fechado} titulo="Caixa fechado" aoFechar={() => setFechado(null)}>
        {fechado && <TabelaConferencia c={fechado} />}
        <button onClick={() => setFechado(null)} className="btn-marca mt-5 w-full">Ok</button>
      </Modal>
    </div>
  );
}

function CartaoForma({ icone, nome, valor, n }: { icone: React.ReactNode; nome: string; valor: number; n: number }) {
  return (
    <div className="card p-4 sm:p-5">
      <p className="flex items-center gap-1.5 text-sm text-suave">
        {icone} {nome}
      </p>
      <p className="num mt-1 font-display text-2xl font-bold sm:text-3xl">{brl(valor)}</p>
      <p className="num text-xs text-suave">{n} {n === 1 ? "venda" : "vendas"}</p>
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-white/60">{rotulo}</dt>
      <dd>{brl(valor)}</dd>
    </div>
  );
}

function AbrirCaixa({ aoAbrir }: { aoAbrir: () => void }) {
  const avisar = useAvisos();
  const [troco, setTroco] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function abrir(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const { error } = await supabase().from("caixas").insert({ troco_inicial: lerValor(troco) ?? 0 });
    setSalvando(false);
    if (error) return avisar(mensagemErro(error), "erro");
    avisar("Caixa aberto. Boas vendas!");
    aoAbrir();
  }

  return (
    <form onSubmit={abrir} className="card mx-auto max-w-md p-6 text-center">
      <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-marca-clara">
        <Lock className="size-7 text-marca-escura" />
      </span>
      <h2 className="font-display text-2xl font-semibold">Caixa fechado</h2>
      <p className="mt-1 mb-5 text-sm text-suave">Conte o dinheiro que está na gaveta para começar o dia.</p>
      <label className="rotulo text-left" htmlFor="troco">Troco inicial</label>
      <input id="troco" autoFocus inputMode="decimal" placeholder="0,00" className="campo num mb-4 text-center text-2xl" value={troco} onChange={(e) => setTroco(e.target.value)} />
      <button type="submit" disabled={salvando} className="btn-marca w-full py-3 text-base">
        {salvando ? <Loader2 className="size-5 animate-spin" /> : <Unlock className="size-5" />} Abrir caixa
      </button>
    </form>
  );
}

function NovoMovimento({
  tipo,
  caixaId,
  aoFechar,
  aoSalvar,
}: {
  tipo: "sangria" | "suprimento";
  caixaId: string;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const avisar = useAvisos();
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const v = lerValor(valor);
    if (!v || v <= 0) return avisar("Informe o valor.", "erro");
    setSalvando(true);
    const { error } = await supabase()
      .from("movimentos_caixa")
      .insert({ caixa_id: caixaId, tipo, valor: v, descricao: descricao.trim() || null });
    setSalvando(false);
    if (error) return avisar(mensagemErro(error), "erro");
    avisar(tipo === "sangria" ? "Sangria registrada." : "Suprimento registrado.");
    aoSalvar();
  }

  return (
    <Modal aberto titulo={tipo === "sangria" ? "Sangria (tirar dinheiro)" : "Suprimento (colocar dinheiro)"} aoFechar={aoFechar} largura="max-w-md">
      <form onSubmit={salvar} className="space-y-4">
        <div>
          <label className="rotulo" htmlFor="valor-mov">Valor</label>
          <input id="valor-mov" autoFocus inputMode="decimal" className="campo num text-lg" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} />
        </div>
        <div>
          <label className="rotulo" htmlFor="desc-mov">Motivo (opcional)</label>
          <input
            id="desc-mov"
            className="campo"
            placeholder={tipo === "sangria" ? "Ex.: pagamento de fornecedor, depósito" : "Ex.: reforço de troco"}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={aoFechar} className="btn-claro">Cancelar</button>
          <button type="submit" disabled={salvando} className="btn-marca">
            {salvando && <Loader2 className="size-4 animate-spin" />} Registrar
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Fechamento: conta cédulas/moedas e confere cada forma de pagamento com o esperado. */
function Fechamento({
  resumo,
  aoFechar,
  aoFechou,
}: {
  resumo: ResumoCaixa;
  aoFechar: () => void;
  aoFechou: (id: string) => void;
}) {
  const avisar = useAvisos();
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [dinheiroTxt, setDinheiroTxt] = useState("");
  const [pix, setPix] = useState("");
  const [debito, setDebito] = useState("");
  const [credito, setCredito] = useState("");
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);

  const somaNotas = useMemo(
    () => centavos([...CEDULAS, ...MOEDAS].reduce((s, v) => s + v * (parseInt(notas[v] ?? "", 10) || 0), 0)),
    [notas],
  );
  const usouContador = Object.values(notas).some((x) => x);
  const dinheiro = usouContador ? somaNotas : lerValor(dinheiroTxt);

  const linhas = [
    { nome: "Dinheiro (gaveta)", esperado: resumo.esperado_dinheiro, contado: dinheiro },
    { nome: "Pix", esperado: resumo.vendas_pix, contado: lerValor(pix), set: setPix, txt: pix },
    { nome: "Débito", esperado: resumo.vendas_debito, contado: lerValor(debito), set: setDebito, txt: debito },
    { nome: "Crédito", esperado: resumo.vendas_credito, contado: lerValor(credito), set: setCredito, txt: credito },
  ];
  const faltaPreencher = linhas.some((l) => l.contado === null);
  const diferencaTotal = centavos(linhas.reduce((s, l) => s + ((l.contado ?? 0) - l.esperado), 0));

  async function confirmar() {
    if (faltaPreencher) return avisar("Preencha o valor conferido de todas as formas (use 0 se não houver).", "erro");
    setSalvando(true);
    const { data, error } = await supabase().rpc("fechar_caixa", {
      p_contado_dinheiro: dinheiro,
      p_contado_pix: lerValor(pix),
      p_contado_debito: lerValor(debito),
      p_contado_credito: lerValor(credito),
      p_observacao: obs,
    });
    setSalvando(false);
    if (error) return avisar(mensagemErro(error), "erro");
    aoFechou(data as string);
  }

  return (
    <Modal aberto titulo="Fechar caixa" aoFechar={aoFechar} largura="max-w-3xl">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Contador de dinheiro */}
        <section>
          <h3 className="mb-1 flex items-center gap-2 font-semibold">
            <Calculator className="size-4" /> 1. Conte o dinheiro da gaveta
          </h3>
          <p className="mb-3 text-xs text-suave">Informe quantas cédulas e moedas de cada valor. O sistema soma para você.</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {[...CEDULAS, ...MOEDAS].map((v) => (
              <label key={v} className="flex items-center gap-2 text-sm">
                <span className={`num w-16 shrink-0 rounded-md px-1.5 py-1 text-center text-xs font-semibold ${v >= 2 ? "bg-ok-claro text-ok" : "bg-marca-clara text-marca-escura"}`}>
                  {brl(v).replace(",00", "")}
                </span>
                <span className="text-suave">×</span>
                <input
                  inputMode="numeric"
                  className="campo num px-2 py-1.5 text-sm"
                  value={notas[v] ?? ""}
                  onChange={(e) => setNotas((n) => ({ ...n, [v]: e.target.value.replace(/\D/g, "") }))}
                  aria-label={`Quantidade de ${brl(v)}`}
                />
              </label>
            ))}
          </div>
          <div className="mt-3 rounded-xl bg-fundo p-3">
            {usouContador ? (
              <p className="flex justify-between text-sm">
                <span>Total contado</span> <b className="num">{brl(somaNotas)}</b>
              </p>
            ) : (
              <>
                <label className="rotulo" htmlFor="dinheiro-total">…ou digite o total contado</label>
                <input id="dinheiro-total" inputMode="decimal" className="campo num" placeholder="0,00" value={dinheiroTxt} onChange={(e) => setDinheiroTxt(e.target.value)} />
              </>
            )}
          </div>
        </section>

        {/* Conferência */}
        <section>
          <h3 className="mb-1 font-semibold">2. Confira com a maquininha e o banco</h3>
          <p className="mb-3 text-xs text-suave">Digite o que aparece no relatório da maquininha e no extrato do Pix.</p>
          <div className="space-y-3">
            {linhas.slice(1).map((l) => (
              <div key={l.nome}>
                <label className="rotulo" htmlFor={`conf-${l.nome}`}>{l.nome}</label>
                <input id={`conf-${l.nome}`} inputMode="decimal" className="campo num" placeholder="0,00" value={l.txt} onChange={(e) => l.set!(e.target.value)} />
              </div>
            ))}
            <div>
              <label className="rotulo" htmlFor="obs">Observação (opcional)</label>
              <input id="obs" className="campo" placeholder="Ex.: cliente pagou R$ 5 depois" value={obs} onChange={(e) => setObs(e.target.value)} />
            </div>
          </div>
        </section>
      </div>

      {/* Resultado */}
      <div className="mt-6 overflow-x-auto rounded-2xl border border-borda">
        <table className="tabela w-full min-w-[460px] text-sm">
          <thead>
            <tr>
              <th>Forma</th>
              <th className="!text-right">Esperado</th>
              <th className="!text-right">Conferido</th>
              <th className="!text-right">Diferença</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.nome}>
                <td className="font-medium">{l.nome}</td>
                <td className="num text-right">{brl(l.esperado)}</td>
                <td className="num text-right">{l.contado === null ? "—" : brl(l.contado)}</td>
                <td className="num text-right">{l.contado === null ? "—" : <Diferenca valor={centavos(l.contado - l.esperado)} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!faltaPreencher && (
        <p className={`mt-4 rounded-xl p-3 text-center text-sm font-semibold ${diferencaTotal === 0 ? "bg-ok-claro text-ok" : "bg-alerta-claro text-alerta"}`}>
          {diferencaTotal === 0
            ? "Tudo certo: o caixa bateu!"
            : diferencaTotal > 0
              ? `Sobrando ${brl(diferencaTotal)}. Confira antes de fechar.`
              : `Faltando ${brl(-diferencaTotal)}. Confira antes de fechar.`}
        </p>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={aoFechar} className="btn-claro">Voltar</button>
        <button onClick={confirmar} disabled={salvando || faltaPreencher} className="btn-escuro">
          {salvando ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />} Confirmar fechamento
        </button>
      </div>
    </Modal>
  );
}

function Diferenca({ valor }: { valor: number }) {
  if (valor === 0) return <span className="font-semibold text-ok">OK</span>;
  return (
    <span className={`font-semibold ${valor > 0 ? "text-alerta" : "text-erro"}`}>
      {valor > 0 ? "sobra " : "falta "}
      {brl(Math.abs(valor))}
    </span>
  );
}

function TabelaConferencia({ c }: { c: Caixa }) {
  const linhas = [
    ["Dinheiro", c.esperado_dinheiro, c.contado_dinheiro],
    ["Pix", c.esperado_pix, c.contado_pix],
    ["Débito", c.esperado_debito, c.contado_debito],
    ["Crédito", c.esperado_credito, c.contado_credito],
  ] as const;
  return (
    <table className="tabela w-full text-sm">
      <thead>
        <tr>
          <th>Forma</th>
          <th className="!text-right">Esperado</th>
          <th className="!text-right">Conferido</th>
          <th className="!text-right">Diferença</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map(([nome, e, k]) => (
          <tr key={nome}>
            <td>{nome}</td>
            <td className="num text-right">{brl(e)}</td>
            <td className="num text-right">{brl(k)}</td>
            <td className="num text-right">
              <Diferenca valor={centavos(Number(k ?? 0) - Number(e ?? 0))} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Historico({ caixas }: { caixas: Caixa[] }) {
  const [detalhe, setDetalhe] = useState<Caixa | null>(null);
  if (!caixas.length) return null;
  return (
    <section>
      <h2 className="mb-3 font-display text-lg font-semibold">Últimos fechamentos</h2>
      <div className="card overflow-x-auto">
        <table className="tabela w-full min-w-[560px] text-sm">
          <thead>
            <tr>
              <th>Aberto</th>
              <th>Fechado</th>
              <th className="!text-right">Total esperado</th>
              <th className="!text-right">Diferença</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {caixas.map((c) => {
              const esperado = [c.esperado_dinheiro, c.esperado_pix, c.esperado_debito, c.esperado_credito].reduce<number>((s, v) => s + Number(v ?? 0), 0);
              const contado = [c.contado_dinheiro, c.contado_pix, c.contado_debito, c.contado_credito].reduce<number>((s, v) => s + Number(v ?? 0), 0);
              return (
                <tr key={c.id} className="hover:bg-fundo/60">
                  <td className="num">{dataHora(c.aberto_em)}</td>
                  <td className="num">{c.fechado_em && dataHora(c.fechado_em)}</td>
                  <td className="num text-right">{brl(esperado)}</td>
                  <td className="num text-right">
                    <Diferenca valor={centavos(contado - esperado)} />
                  </td>
                  <td className="text-right">
                    <button onClick={() => setDetalhe(c)} className="text-sm font-medium text-marca-escura hover:underline">
                      Detalhes
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Modal aberto={!!detalhe} titulo="Conferência do caixa" aoFechar={() => setDetalhe(null)}>
        {detalhe && (
          <>
            <p className="mb-3 text-sm text-suave">
              {dataHora(detalhe.aberto_em)} até {detalhe.fechado_em && dataHora(detalhe.fechado_em)} · troco inicial {brl(detalhe.troco_inicial)}
            </p>
            <TabelaConferencia c={detalhe} />
            {detalhe.observacao && <p className="mt-3 rounded-xl bg-fundo p-3 text-sm">Obs.: {detalhe.observacao}</p>}
          </>
        )}
      </Modal>
    </section>
  );
}
