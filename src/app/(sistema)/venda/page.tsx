"use client";

import {
  AlertTriangle,
  Banknote,
  Camera,
  CreditCard,
  Loader2,
  Minus,
  Plus,
  QrCode,
  ScanBarcode,
  ShoppingCart,
  Trash2,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useAvisos } from "@/components/Avisos";
import { LeitorCamera } from "@/components/LeitorCamera";
import { Modal } from "@/components/Modal";
import { brl, centavos, FORMAS_PAGAMENTO, lerValor, type FormaPagamento } from "@/lib/formato";
import { mensagemErro, supabase } from "@/lib/supabase";
import { avisarEstoqueAlterado, CAMPOS_PRODUTO, type Produto } from "@/lib/tipos";

type ItemCarrinho = {
  produto_id: string;
  nome: string;
  codigo_barras: string | null;
  preco: number;
  estoque: number;
  quantidade: number;
};

type VendaConcluida = { numero: number; total: number; troco: number; forma: FormaPagamento };

const CHAVE_CARRINHO = "pdv-carrinho";
const ICONES_PAGAMENTO = { dinheiro: Banknote, pix: QrCode, debito: CreditCard, credito: CreditCard };

/** "3*789123" -> { quantidade: 3, termo: "789123" } */
function lerMultiplicador(texto: string) {
  const m = texto.match(/^\s*(\d{1,4})\s*[*xX]\s*(.+)$/);
  if (m) return { quantidade: Math.max(1, Number(m[1])), termo: m[2].trim() };
  return { quantidade: 1, termo: texto.trim() };
}

export default function Venda() {
  const avisar = useAvisos();
  const busca = useRef<HTMLInputElement>(null);

  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [texto, setTexto] = useState("");
  const [encontrados, setEncontrados] = useState<Produto[]>([]);
  const [selecionado, setSelecionado] = useState(0);
  const [buscando, setBuscando] = useState(false);
  const [camera, setCamera] = useState(false);
  const [pagando, setPagando] = useState(false);
  const [ultimaVenda, setUltimaVenda] = useState<VendaConcluida | null>(null);
  const [caixaAberto, setCaixaAberto] = useState<boolean | null>(null);

  // Carrinho sobrevive a um recarregamento da página.
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_CARRINHO);
      // Só dá para ler o localStorage depois que a página abre no navegador.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (salvo) setCarrinho(JSON.parse(salvo));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_CARRINHO, JSON.stringify(carrinho));
    } catch {}
  }, [carrinho]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase().from("caixas").select("id").eq("status", "aberto").maybeSingle();
      setCaixaAberto(Boolean(data));
    })();
  }, []);

  const focarBusca = () => setTimeout(() => busca.current?.focus(), 0);

  // Busca por nome ou código enquanto digita.
  const termoBusca = lerMultiplicador(texto).termo;
  const resultados = termoBusca.length >= 2 ? encontrados : [];
  useEffect(() => {
    const termo = termoBusca;
    if (termo.length < 2) return;
    const t = setTimeout(async () => {
      setBuscando(true);
      const seguro = termo.replace(/[%,()]/g, " ");
      const { data } = await supabase()
        .from("produtos")
        .select(CAMPOS_PRODUTO)
        .eq("ativo", true)
        .or(`nome.ilike.%${seguro}%,codigo_barras.eq.${seguro}`)
        .order("nome")
        .limit(8);
      setEncontrados((data as Produto[]) ?? []);
      setSelecionado(0);
      setBuscando(false);
    }, 180);
    return () => clearTimeout(t);
  }, [termoBusca]);

  const carrinhoAtual = useRef(carrinho);
  useEffect(() => {
    carrinhoAtual.current = carrinho;
  }, [carrinho]);

  const adicionar = useCallback(
    (p: Produto, quantidade = 1) => {
      const jaTem = carrinhoAtual.current.find((i) => i.produto_id === p.id)?.quantidade ?? 0;
      if (jaTem + quantidade > p.estoque) avisar(`Atenção: "${p.nome}" tem só ${p.estoque} no estoque.`, "alerta");
      setCarrinho((c) =>
        c.some((i) => i.produto_id === p.id)
          ? c.map((i) =>
              i.produto_id === p.id ? { ...i, quantidade: i.quantidade + quantidade, preco: Number(p.preco), estoque: p.estoque } : i,
            )
          : [
              ...c,
              { produto_id: p.id, nome: p.nome, codigo_barras: p.codigo_barras, preco: Number(p.preco), estoque: p.estoque, quantidade },
            ],
      );
      setUltimaVenda(null);
      setTexto("");
      setEncontrados([]);
      focarBusca();
    },
    [avisar],
  );

  /** Código lido (leitor USB, câmera ou Enter no campo). */
  const buscarCodigo = useCallback(
    async (codigo: string, quantidade = 1) => {
      const { data, error } = await supabase()
        .from("produtos")
        .select(CAMPOS_PRODUTO)
        .eq("codigo_barras", codigo)
        .eq("ativo", true)
        .maybeSingle();
      if (error) return avisar(mensagemErro(error), "erro");
      if (data) return adicionar(data as Produto, quantidade);
      return null;
    },
    [adicionar, avisar],
  );

  async function aoTeclar(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelecionado((s) => Math.min(s + 1, resultados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelecionado((s) => Math.max(s - 1, 0));
    } else if (e.key === "Escape") {
      setTexto("");
      setEncontrados([]);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const { quantidade, termo } = lerMultiplicador(texto);
      if (!termo) {
        if (carrinho.length) setPagando(true);
        return;
      }
      // Leitor USB digita o código e aperta Enter: tenta o código exato primeiro.
      const r = await buscarCodigo(termo, quantidade);
      if (r === null) {
        if (resultados[selecionado]) adicionar(resultados[selecionado], quantidade);
        else avisar(`Produto "${termo}" não encontrado.`, "erro");
      }
    }
  }

  // F2 finaliza a venda de qualquer lugar da tela.
  useEffect(() => {
    const tecla = (e: globalThis.KeyboardEvent) => {
      if (e.key === "F2" && carrinho.length && !pagando) {
        e.preventDefault();
        setPagando(true);
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [carrinho.length, pagando]);

  const mudarQuantidade = (id: string, qtd: number) =>
    setCarrinho((c) => c.map((i) => (i.produto_id === id ? { ...i, quantidade: Math.max(1, qtd) } : i)));
  const remover = (id: string) => {
    setCarrinho((c) => c.filter((i) => i.produto_id !== id));
    focarBusca();
  };

  const total = useMemo(() => centavos(carrinho.reduce((s, i) => s + i.preco * i.quantidade, 0)), [carrinho]);
  const unidades = carrinho.reduce((s, i) => s + i.quantidade, 0);

  function vendaConcluida(v: VendaConcluida) {
    setUltimaVenda(v);
    setCarrinho([]);
    setPagando(false);
    avisarEstoqueAlterado();
    avisar(`Venda nº ${v.numero} concluída!`);
    focarBusca();
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[1fr_380px]">
      <section className="min-w-0 space-y-4">
        {caixaAberto === false && <AbrirCaixaRapido aoAbrir={() => setCaixaAberto(true)} />}

        {/* Campo de leitura / busca */}
        <div className="card relative p-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <ScanBarcode className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-suave" />
              <input
                ref={busca}
                autoFocus
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={aoTeclar}
                placeholder="Passe o leitor ou digite o nome do produto"
                className="campo py-3.5 pl-11 text-lg"
                autoComplete="off"
                aria-label="Código de barras ou nome do produto"
              />
              {buscando && <Loader2 className="absolute top-1/2 right-3.5 size-5 -translate-y-1/2 animate-spin text-suave" />}
            </div>
            <button onClick={() => setCamera(true)} className="btn-escuro px-4" aria-label="Ler pela câmera" title="Ler pela câmera">
              <Camera className="size-5" />
              <span className="hidden sm:inline">Câmera</span>
            </button>
          </div>
          <p className="mt-2 px-1 text-xs text-suave">
            Dica: digite <b>3*</b> antes do código para lançar 3 unidades. <b>Enter</b> adiciona, <b>F2</b> finaliza.
          </p>

          {resultados.length > 0 && (
            <ul className="absolute inset-x-3 top-[4.6rem] z-20 overflow-hidden rounded-2xl border border-borda bg-white shadow-xl">
              {resultados.map((p, idx) => (
                <li key={p.id}>
                  <button
                    onMouseEnter={() => setSelecionado(idx)}
                    onClick={() => adicionar(p, lerMultiplicador(texto).quantidade)}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left ${idx === selecionado ? "bg-marca-clara" : ""}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{p.nome}</span>
                      <span className="block text-xs text-suave">
                        {p.codigo_barras ?? "sem código"} ·{" "}
                        <span className={p.estoque <= 0 ? "font-semibold text-erro" : ""}>estoque {p.estoque}</span>
                      </span>
                    </span>
                    <span className="num shrink-0 font-semibold">{brl(p.preco)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Itens */}
        <div className="card overflow-hidden">
          {carrinho.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <span className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-marca-clara">
                <ShoppingCart className="size-8 text-marca-escura" />
              </span>
              <p className="font-display text-xl font-semibold">Nenhum item na venda</p>
              <p className="mt-1 text-sm text-suave">Leia o código de barras ou busque pelo nome para começar.</p>
            </div>
          ) : (
            <ul>
              {carrinho.map((i, idx) => {
                const faltando = i.quantidade > i.estoque;
                return (
                  <li key={i.produto_id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-borda px-4 py-3 last:border-0 sm:flex-nowrap">
                    <span className="num hidden w-6 text-sm text-suave sm:block">{idx + 1}</span>
                    <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                      <p className="truncate font-medium">{i.nome}</p>
                      <p className="num text-xs text-suave">
                        {brl(i.preco)} un.
                        {faltando && (
                          <span className="ml-2 inline-flex items-center gap-1 font-semibold text-alerta">
                            <AlertTriangle className="size-3" /> estoque: {i.estoque}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center rounded-xl border border-borda">
                      <button onClick={() => mudarQuantidade(i.produto_id, i.quantidade - 1)} className="p-2 hover:bg-fundo" aria-label="Diminuir">
                        <Minus className="size-4" />
                      </button>
                      <input
                        value={i.quantidade}
                        onChange={(e) => mudarQuantidade(i.produto_id, Number(e.target.value.replace(/\D/g, "")) || 1)}
                        className="num w-12 bg-transparent text-center font-semibold outline-none"
                        inputMode="numeric"
                        aria-label={`Quantidade de ${i.nome}`}
                      />
                      <button onClick={() => mudarQuantidade(i.produto_id, i.quantidade + 1)} className="p-2 hover:bg-fundo" aria-label="Aumentar">
                        <Plus className="size-4" />
                      </button>
                    </div>
                    <span className="num ml-auto w-28 text-right text-lg font-semibold">{brl(i.preco * i.quantidade)}</span>
                    <button onClick={() => remover(i.produto_id)} className="rounded-lg p-2 text-suave hover:bg-erro-claro hover:text-erro" aria-label={`Remover ${i.nome}`}>
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Total */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="overflow-hidden rounded-2xl bg-tinta text-white shadow-lg">
          <div className="p-6">
            <p className="text-sm text-white/60">Total da venda</p>
            <p className="num mt-1 font-display text-5xl font-bold text-marca">{brl(total)}</p>
            <p className="num mt-2 text-sm text-white/60">
              {carrinho.length} {carrinho.length === 1 ? "produto" : "produtos"} · {unidades} {unidades === 1 ? "unidade" : "unidades"}
            </p>
          </div>
          <div className="space-y-2 border-t border-white/10 p-4">
            <button
              onClick={() => setPagando(true)}
              disabled={!carrinho.length || caixaAberto === false}
              className="btn-marca w-full py-4 text-lg"
            >
              Finalizar venda <kbd className="rounded bg-tinta/15 px-1.5 text-xs">F2</kbd>
            </button>
            <button
              onClick={() => {
                setCarrinho([]);
                focarBusca();
              }}
              disabled={!carrinho.length}
              className="btn w-full text-white/70 hover:bg-white/10"
            >
              Cancelar venda
            </button>
          </div>
        </div>

        {ultimaVenda && (
          <div className="card mt-4 border-ok/30 bg-ok-claro p-5">
            <p className="text-sm font-semibold text-ok">Venda nº {ultimaVenda.numero} concluída</p>
            <p className="num mt-1 text-sm">
              Total {brl(ultimaVenda.total)} · {FORMAS_PAGAMENTO.find((f) => f.id === ultimaVenda.forma)?.nome}
            </p>
            {ultimaVenda.troco > 0 && (
              <p className="num mt-2 font-display text-3xl font-bold">Troco: {brl(ultimaVenda.troco)}</p>
            )}
          </div>
        )}
      </aside>

      <LeitorCamera
        aberto={camera}
        aoFechar={() => {
          setCamera(false);
          focarBusca();
        }}
        aoLer={async (codigo) => {
          setCamera(false);
          const r = await buscarCodigo(codigo);
          if (r === null) avisar(`Código ${codigo} não cadastrado.`, "erro");
        }}
      />

      {pagando && (
      <Pagamento
        total={total}
        itens={carrinho}
        aoFechar={() => {
          setPagando(false);
          focarBusca();
        }}
        aoConcluir={vendaConcluida}
        aoCaixaFechado={() => setCaixaAberto(false)}
      />
      )}
    </div>
  );
}

function Pagamento({
  total,
  itens,
  aoFechar,
  aoConcluir,
  aoCaixaFechado,
}: {
  total: number;
  itens: ItemCarrinho[];
  aoFechar: () => void;
  aoConcluir: (v: VendaConcluida) => void;
  aoCaixaFechado: () => void;
}) {
  const avisar = useAvisos();
  const [forma, setForma] = useState<FormaPagamento>("dinheiro");
  const [recebidoTxt, setRecebidoTxt] = useState("");
  const [salvando, setSalvando] = useState(false);
  const campoRecebido = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => campoRecebido.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const recebido = lerValor(recebidoTxt);
  const troco = forma === "dinheiro" && recebido !== null ? centavos(recebido - total) : 0;
  const faltaDinheiro = forma === "dinheiro" && recebido !== null && recebido < total;

  async function confirmar() {
    if (salvando || faltaDinheiro) return;
    setSalvando(true);
    const { data, error } = await supabase().rpc("finalizar_venda", {
      p_itens: itens.map((i) => ({ produto_id: i.produto_id, quantidade: i.quantidade })),
      p_forma_pagamento: forma,
      p_valor_recebido: forma === "dinheiro" ? (recebido ?? total) : null,
    });
    setSalvando(false);
    if (error) {
      if (error.message.includes("caixa está fechado")) aoCaixaFechado();
      return avisar(mensagemErro(error), "erro");
    }
    aoConcluir({ numero: data.numero, total: Number(data.total), troco: Number(data.troco), forma });
  }

  // Atalhos: 1-4 escolhem a forma de pagamento, Enter confirma.
  function aoTeclar(e: KeyboardEvent<HTMLDivElement>) {
    const alvo = e.target as HTMLElement;
    if (["1", "2", "3", "4"].includes(e.key) && alvo.tagName !== "INPUT") {
      setForma(FORMAS_PAGAMENTO[Number(e.key) - 1].id);
    } else if (e.key === "Enter") {
      e.preventDefault();
      confirmar();
    }
  }

  return (
    <Modal aberto titulo="Pagamento" aoFechar={aoFechar}>
      <div onKeyDown={aoTeclar}>
        <div className="mb-5 rounded-2xl bg-fundo p-4 text-center">
          <p className="text-sm text-suave">Total a pagar</p>
          <p className="num font-display text-4xl font-bold">{brl(total)}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {FORMAS_PAGAMENTO.map((f, idx) => {
            const Icone = ICONES_PAGAMENTO[f.id];
            const ativo = forma === f.id;
            return (
              <button
                key={f.id}
                onClick={() => {
                  setForma(f.id);
                  if (f.id === "dinheiro") setTimeout(() => campoRecebido.current?.focus(), 0);
                }}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 p-3 text-sm font-semibold transition ${
                  ativo ? "border-marca bg-marca-clara" : "border-borda hover:border-marca/50"
                }`}
              >
                <Icone className="size-6" />
                {f.nome}
                <span className="text-[10px] font-normal text-suave">tecla {idx + 1}</span>
              </button>
            );
          })}
        </div>

        {forma === "dinheiro" && (
          <div className="mt-5">
            <label className="rotulo" htmlFor="recebido">Valor recebido</label>
            <input
              id="recebido"
              ref={campoRecebido}
              inputMode="decimal"
              placeholder={brl(total)}
              className="campo num text-xl"
              value={recebidoTxt}
              onChange={(e) => setRecebidoTxt(e.target.value)}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {[10, 20, 50, 100, 200].filter((v) => v >= total).slice(0, 4).map((v) => (
                <button key={v} onClick={() => setRecebidoTxt(String(v))} className="btn-claro num px-3 py-1.5">
                  {brl(v)}
                </button>
              ))}
              <button onClick={() => setRecebidoTxt(total.toFixed(2).replace(".", ","))} className="btn-claro px-3 py-1.5">
                Valor exato
              </button>
            </div>
            <div className={`mt-4 flex items-center justify-between rounded-2xl p-4 ${faltaDinheiro ? "bg-erro-claro text-erro" : "bg-ok-claro text-ok"}`}>
              <span className="font-semibold">{faltaDinheiro ? "Falta" : "Troco"}</span>
              <span className="num font-display text-3xl font-bold">{brl(Math.abs(troco))}</span>
            </div>
          </div>
        )}

        <button onClick={confirmar} disabled={salvando || faltaDinheiro} className="btn-marca mt-5 w-full py-4 text-lg">
          {salvando ? <Loader2 className="size-5 animate-spin" /> : <Wallet className="size-5" />}
          Confirmar pagamento
        </button>
      </div>
    </Modal>
  );
}

function AbrirCaixaRapido({ aoAbrir }: { aoAbrir: () => void }) {
  const avisar = useAvisos();
  const [troco, setTroco] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function abrir() {
    setSalvando(true);
    const { error } = await supabase().from("caixas").insert({ troco_inicial: lerValor(troco) ?? 0 });
    setSalvando(false);
    if (error) return avisar(mensagemErro(error), "erro");
    avisar("Caixa aberto. Boas vendas!");
    aoAbrir();
  }

  return (
    <div className="card flex flex-wrap items-end gap-3 border-marca bg-marca-clara p-4">
      <div className="min-w-48 flex-1">
        <p className="font-semibold">O caixa está fechado</p>
        <p className="text-sm text-suave">
          Abra o caixa informando o troco que está na gaveta. Detalhes na aba <Link href="/caixa" className="underline">Caixa</Link>.
        </p>
      </div>
      <input
        inputMode="decimal"
        placeholder="Troco inicial (R$)"
        className="campo w-44"
        value={troco}
        onChange={(e) => setTroco(e.target.value)}
        aria-label="Troco inicial"
      />
      <button onClick={abrir} disabled={salvando} className="btn-escuro">
        {salvando && <Loader2 className="size-4 animate-spin" />} Abrir caixa
      </button>
    </div>
  );
}
