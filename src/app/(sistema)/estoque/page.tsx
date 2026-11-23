"use client";

import { AlertTriangle, Boxes, Loader2, PackageX, Plus, Search, SlidersHorizontal, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useAvisos } from "@/components/Avisos";
import { GraficoBarras, type PontoDia } from "@/components/GraficoBarras";
import { Modal } from "@/components/Modal";
import { brl } from "@/lib/formato";
import { mensagemErro, supabase } from "@/lib/supabase";
import { avisarEstoqueAlterado, CAMPOS_PRODUTO, type Produto } from "@/lib/tipos";

type ResumoEstoque = {
  produtos: number;
  unidades: number;
  valor_custo: number;
  valor_venda: number;
  abaixo_minimo: number;
  zerados: number;
};
type MaisVendido = { produto_id: string; nome: string; quantidade: number; faturamento: number };

const PERIODOS = [7, 14, 30];

export default function DashboardEstoque() {
  const [periodo, setPeriodo] = useState(14);
  const [diario, setDiario] = useState<PontoDia[] | null>(null);
  const [topo, setTopo] = useState<MaisVendido[]>([]);
  const [resumo, setResumo] = useState<ResumoEstoque | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    (async () => {
      const [d, t] = await Promise.all([
        supabase().rpc("dashboard_diario", { p_dias: periodo }),
        supabase().rpc("mais_vendidos", { p_dias: periodo, p_limite: 5 }),
      ]);
      setDiario(((d.data as PontoDia[]) ?? []).map((x) => ({ ...x, faturamento: Number(x.faturamento), lucro: Number(x.lucro) })));
      setTopo((t.data as MaisVendido[]) ?? []);
    })();
  }, [periodo]);

  useEffect(() => {
    supabase()
      .rpc("resumo_estoque")
      .then(({ data }) => setResumo(data as ResumoEstoque));
  }, [versao]);

  const hoje = diario?.at(-1);
  const soma = (k: "faturamento" | "lucro" | "num_vendas") => (diario ?? []).reduce((s, x) => s + Number(x[k]), 0);
  const ticket = hoje && hoje.num_vendas ? hoje.faturamento / hoje.num_vendas : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Indicadores de hoje */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Indicador titulo="Faturamento hoje" valor={brl(hoje?.faturamento)} destaque />
        <Indicador titulo="Lucro hoje" valor={brl(hoje?.lucro)} detalhe={hoje?.faturamento ? `${((hoje.lucro / hoje.faturamento) * 100).toFixed(0)}% de margem` : undefined} />
        <Indicador titulo="Vendas hoje" valor={String(hoje?.num_vendas ?? 0)} detalhe={`ticket médio ${brl(ticket)}`} />
        <Indicador titulo={`Faturamento ${periodo} dias`} valor={brl(soma("faturamento"))} detalhe={`lucro ${brl(soma("lucro"))}`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="card p-5">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold">Faturamento por dia</h2>
              <p className="text-sm text-suave">{soma("num_vendas")} vendas no período</p>
            </div>
            <div className="flex rounded-xl border border-borda p-1">
              {PERIODOS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriodo(p)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${periodo === p ? "bg-tinta text-white" : "text-suave hover:text-tinta"}`}
                >
                  {p} dias
                </button>
              ))}
            </div>
          </div>
          {diario ? <GraficoBarras dados={diario} /> : <Loader2 className="mx-auto my-20 size-6 animate-spin text-suave" />}
        </section>

        <section className="card p-5">
          <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold">
            <TrendingUp className="size-5 text-marca-escura" /> Mais vendidos
          </h2>
          <p className="mb-4 text-sm text-suave">Últimos {periodo} dias</p>
          {topo.length === 0 ? (
            <p className="py-8 text-center text-sm text-suave">Nenhuma venda no período.</p>
          ) : (
            <ol className="space-y-3">
              {topo.map((t, i) => (
                <li key={t.produto_id ?? i} className="flex items-center gap-3">
                  <span className="num flex size-7 shrink-0 items-center justify-center rounded-lg bg-marca-clara text-sm font-bold text-marca-escura">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{t.nome}</span>
                    <span className="num text-xs text-suave">{t.quantidade} un. · {brl(t.faturamento)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {/* Estoque */}
      <h2 className="pt-2 font-display text-2xl font-semibold">Controle de estoque</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador icone={<Boxes className="size-4" />} titulo="Produtos ativos" valor={String(resumo?.produtos ?? "—")} detalhe={`${resumo?.unidades ?? 0} unidades`} />
        <Indicador titulo="Estoque a preço de custo" valor={brl(resumo?.valor_custo)} detalhe={`vale ${brl(resumo?.valor_venda)} na venda`} />
        <Indicador icone={<AlertTriangle className="size-4 text-alerta" />} titulo="No estoque mínimo" valor={String(resumo?.abaixo_minimo ?? "—")} tom="alerta" />
        <Indicador icone={<PackageX className="size-4 text-erro" />} titulo="Zerados" valor={String(resumo?.zerados ?? "—")} tom="erro" />
      </div>

      <TabelaEstoque aoMudar={() => setVersao((v) => v + 1)} />
    </div>
  );
}

function Indicador({
  titulo,
  valor,
  detalhe,
  destaque,
  icone,
  tom,
}: {
  titulo: string;
  valor: string;
  detalhe?: string;
  destaque?: boolean;
  icone?: ReactNode;
  tom?: "alerta" | "erro";
}) {
  return (
    <div className={`rounded-2xl p-4 sm:p-5 ${destaque ? "bg-tinta text-white" : "card"}`}>
      <p className={`flex items-center gap-1.5 text-sm ${destaque ? "text-white/60" : "text-suave"}`}>
        {icone}
        {titulo}
      </p>
      <p
        className={`num mt-1 font-display text-2xl font-bold sm:text-3xl ${
          destaque ? "text-marca" : tom === "alerta" ? "text-alerta" : tom === "erro" ? "text-erro" : ""
        }`}
      >
        {valor}
      </p>
      {detalhe && <p className={`num mt-0.5 text-xs ${destaque ? "text-white/60" : "text-suave"}`}>{detalhe}</p>}
    </div>
  );
}

type Filtro = "todos" | "minimo" | "zerados";

function TabelaEstoque({ aoMudar }: { aoMudar: () => void }) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busca, setBusca] = useState("");
  const [lista, setLista] = useState<Produto[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [ajuste, setAjuste] = useState<{ produto: Produto; modo: "entrada" | "ajuste" } | null>(null);

  const carregar = useCallback(
    async (deslocamento = 0) => {
      setCarregando(true);
      let q = supabase()
        .from("produtos")
        .select(CAMPOS_PRODUTO, { count: "exact" })
        .eq("ativo", true)
        .order("estoque")
        .order("nome")
        .range(deslocamento, deslocamento + 49);
      if (filtro === "minimo") q = q.eq("abaixo_minimo", true);
      if (filtro === "zerados") q = q.lte("estoque", 0);
      const t = busca.trim().replace(/[%,()]/g, " ");
      if (t) q = q.or(`nome.ilike.%${t}%,codigo_barras.eq.${t}`);
      const { data, count } = await q;
      setLista((a) => (deslocamento ? [...a, ...((data as Produto[]) ?? [])] : ((data as Produto[]) ?? [])));
      setTotal(count ?? 0);
      setCarregando(false);
    },
    [filtro, busca],
  );

  useEffect(() => {
    const t = setTimeout(() => carregar(0), 200);
    return () => clearTimeout(t);
  }, [carregar]);

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-borda p-4">
        <div className="flex rounded-xl border border-borda p-1">
          {(
            [
              ["todos", "Todos"],
              ["minimo", "No mínimo"],
              ["zerados", "Zerados"],
            ] as const
          ).map(([id, nome]) => (
            <button
              key={id}
              onClick={() => setFiltro(id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${filtro === id ? "bg-tinta text-white" : "text-suave hover:text-tinta"}`}
            >
              {nome}
            </button>
          ))}
        </div>
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-suave" />
          <input className="campo py-2 pl-10" placeholder="Buscar produto" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="tabela w-full min-w-[640px] text-sm">
          <thead>
            <tr>
              <th>Produto</th>
              <th className="!text-right">Estoque</th>
              <th className="!text-right">Mínimo</th>
              <th>Situação</th>
              <th className="!text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((p) => (
              <tr key={p.id} className="hover:bg-fundo/60">
                <td>
                  <p className="font-medium">{p.nome}</p>
                  <p className="num text-xs text-suave">{p.codigo_barras ?? "sem código"}</p>
                </td>
                <td className="num text-right text-base font-semibold">{p.estoque}</td>
                <td className="num text-right text-suave">{p.estoque_minimo}</td>
                <td>
                  <Situacao p={p} />
                </td>
                <td className="text-right whitespace-nowrap">
                  <button onClick={() => setAjuste({ produto: p, modo: "entrada" })} className="btn-claro px-3 py-1.5">
                    <Plus className="size-4" /> Entrada
                  </button>
                  <button
                    onClick={() => setAjuste({ produto: p, modo: "ajuste" })}
                    className="ml-1.5 rounded-lg p-2 text-suave hover:bg-fundo hover:text-tinta"
                    title="Corrigir quantidade (após contagem)"
                    aria-label={`Corrigir estoque de ${p.nome}`}
                  >
                    <SlidersHorizontal className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!carregando && lista.length === 0 && <p className="p-10 text-center text-suave">Nenhum produto aqui.</p>}
      {carregando && <Loader2 className="mx-auto my-6 size-6 animate-spin text-suave" />}
      {lista.length < total && !carregando && (
        <div className="border-t border-borda p-3 text-center">
          <button onClick={() => carregar(lista.length)} className="btn-claro">
            Carregar mais ({total - lista.length})
          </button>
        </div>
      )}

      {ajuste && (
        <AjusteEstoque
          ajuste={ajuste}
          aoFechar={() => setAjuste(null)}
          aoSalvar={() => {
            setAjuste(null);
            carregar(0);
            aoMudar();
            avisarEstoqueAlterado();
          }}
        />
      )}
    </section>
  );
}

function Situacao({ p }: { p: Produto }) {
  if (p.estoque <= 0)
    return <span className="rounded-full bg-erro-claro px-2.5 py-1 text-xs font-semibold text-erro">Zerado</span>;
  if (p.abaixo_minimo)
    return <span className="rounded-full bg-alerta-claro px-2.5 py-1 text-xs font-semibold text-alerta">Repor</span>;
  return <span className="rounded-full bg-ok-claro px-2.5 py-1 text-xs font-semibold text-ok">OK</span>;
}

function AjusteEstoque({
  ajuste,
  aoFechar,
  aoSalvar,
}: {
  ajuste: { produto: Produto; modo: "entrada" | "ajuste" };
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const avisar = useAvisos();
  const { produto, modo } = ajuste;
  const [qtd, setQtd] = useState(modo === "ajuste" ? String(produto.estoque) : "");
  const [salvando, setSalvando] = useState(false);
  const n = parseInt(qtd, 10);
  const novo = Number.isNaN(n) ? null : modo === "entrada" ? produto.estoque + n : n;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (novo === null || (modo === "entrada" && n <= 0)) return avisar("Informe uma quantidade válida.", "erro");
    setSalvando(true);
    // Lê o estoque atual na hora de salvar, para não perder vendas feitas enquanto a janela estava aberta.
    const { data: atual } = await supabase().from("produtos").select("estoque").eq("id", produto.id).single();
    const valor = modo === "entrada" ? (atual?.estoque ?? produto.estoque) + n : n;
    const { error } = await supabase().from("produtos").update({ estoque: valor }).eq("id", produto.id);
    setSalvando(false);
    if (error) return avisar(mensagemErro(error), "erro");
    avisar(`Estoque de "${produto.nome}" agora é ${valor}.`);
    aoSalvar();
  }

  return (
    <Modal aberto titulo={modo === "entrada" ? "Entrada de mercadoria" : "Corrigir estoque"} aoFechar={aoFechar} largura="max-w-md">
      <form onSubmit={salvar} className="space-y-4">
        <p className="font-medium">{produto.nome}</p>
        <p className="text-sm text-suave">
          Estoque atual: <b className="num text-tinta">{produto.estoque}</b>
        </p>
        <div>
          <label className="rotulo" htmlFor="qtd">{modo === "entrada" ? "Quantidade que chegou" : "Quantidade contada na prateleira"}</label>
          <input id="qtd" autoFocus inputMode="numeric" className="campo num text-lg" value={qtd} onChange={(e) => setQtd(e.target.value.replace(/[^\d-]/g, ""))} />
        </div>
        {novo !== null && (
          <p className="rounded-xl bg-fundo p-3 text-sm">
            Novo estoque: <b className="num">{novo}</b>
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={aoFechar} className="btn-claro">Cancelar</button>
          <button type="submit" disabled={salvando} className="btn-marca">
            {salvando && <Loader2 className="size-4 animate-spin" />} Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}
