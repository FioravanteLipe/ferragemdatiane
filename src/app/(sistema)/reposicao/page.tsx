"use client";

import { CheckCircle2, ClipboardCopy, Loader2, PackageCheck, ShoppingBag } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useAvisos } from "@/components/Avisos";
import { Modal } from "@/components/Modal";
import { brl, dataHora, lerValor } from "@/lib/formato";
import { mensagemErro, supabase } from "@/lib/supabase";
import { avisarEstoqueAlterado, type ItemReposicao } from "@/lib/tipos";

const CAMPOS = "id,status,quantidade_comprada,criado_em,comprado_em,produto:produtos(id,nome,codigo_barras,estoque,estoque_minimo,custo)";

/** Sugestão: comprar o suficiente para ficar com o dobro do mínimo. */
function sugestao(i: ItemReposicao) {
  const p = i.produto;
  if (!p) return 1;
  return Math.max(p.estoque_minimo * 2 - p.estoque, 1);
}

export default function Reposicao() {
  const avisar = useAvisos();
  const [pendentes, setPendentes] = useState<ItemReposicao[] | null>(null);
  const [comprados, setComprados] = useState<ItemReposicao[]>([]);
  const [comprando, setComprando] = useState<ItemReposicao | null>(null);

  const [versao, setVersao] = useState(0);
  const recarregar = () => setVersao((v) => v + 1);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const [p, c] = await Promise.all([
        supabase().from("reposicao").select(CAMPOS).eq("status", "pendente").order("criado_em"),
        supabase().from("reposicao").select(CAMPOS).eq("status", "comprado").order("comprado_em", { ascending: false }).limit(15),
      ]);
      if (!ativo) return;
      setPendentes((p.data as unknown as ItemReposicao[]) ?? []);
      setComprados((c.data as unknown as ItemReposicao[]) ?? []);
    })();
    return () => {
      ativo = false;
    };
  }, [versao]);

  useEffect(() => {
    const atualizar = () => setVersao((v) => v + 1);
    window.addEventListener("estoque-alterado", atualizar);
    return () => window.removeEventListener("estoque-alterado", atualizar);
  }, []);

  async function copiarLista() {
    const texto =
      "*Lista de compras — Ferragem da Tiane*\n\n" +
      (pendentes ?? []).map((i) => `• ${i.produto?.nome} — ${sugestao(i)} un.`).join("\n");
    try {
      await navigator.clipboard.writeText(texto);
      avisar("Lista copiada! É só colar no WhatsApp do fornecedor.");
    } catch {
      avisar("Não foi possível copiar a lista.", "erro");
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Precisa comprar</h2>
          <p className="text-sm text-suave">
            Produtos entram aqui sozinhos quando o estoque chega no mínimo. Marque “Comprei” para dar entrada no estoque.
          </p>
        </div>
        {!!pendentes?.length && (
          <button onClick={copiarLista} className="btn-claro">
            <ClipboardCopy className="size-4" /> Copiar lista
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        {pendentes === null ? (
          <Loader2 className="mx-auto my-10 size-6 animate-spin text-suave" />
        ) : pendentes.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <CheckCircle2 className="mb-3 size-12 text-ok" />
            <p className="font-display text-xl font-semibold">Nada para repor</p>
            <p className="text-sm text-suave">Todos os produtos estão acima do estoque mínimo.</p>
          </div>
        ) : (
          <ul>
            {pendentes.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-4 border-b border-borda px-5 py-4 last:border-0">
                <div className="min-w-48 flex-1">
                  <p className="font-medium">{i.produto?.nome}</p>
                  <p className="text-xs text-suave">Na lista desde {dataHora(i.criado_em)}</p>
                </div>
                <div className="num text-sm">
                  <span className={`font-bold ${(i.produto?.estoque ?? 0) <= 0 ? "text-erro" : "text-alerta"}`}>
                    {i.produto?.estoque}
                  </span>
                  <span className="text-suave"> em estoque · mín. {i.produto?.estoque_minimo}</span>
                </div>
                <div className="num rounded-lg bg-marca-clara px-2.5 py-1 text-sm">
                  comprar ~<b>{sugestao(i)}</b>
                </div>
                <button onClick={() => setComprando(i)} className="btn-marca">
                  <ShoppingBag className="size-4" /> Comprei
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {comprados.length > 0 && (
        <div>
          <h2 className="mb-3 font-display text-lg font-semibold">Compras recentes</h2>
          <div className="card overflow-hidden">
            <ul>
              {comprados.map((i) => (
                <li key={i.id} className="flex items-center gap-3 border-b border-borda px-5 py-3 text-sm last:border-0">
                  <PackageCheck className="size-4 shrink-0 text-ok" />
                  <span className="flex-1 truncate">{i.produto?.nome ?? "Produto excluído"}</span>
                  <span className="num text-suave">+{i.quantidade_comprada} un.</span>
                  <span className="num w-24 text-right text-xs text-suave">{i.comprado_em && dataHora(i.comprado_em)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {comprando && (
        <RegistrarCompra
          item={comprando}
          aoFechar={() => setComprando(null)}
          aoSalvar={() => {
            setComprando(null);
            recarregar();
            avisarEstoqueAlterado();
          }}
        />
      )}
    </div>
  );
}

function RegistrarCompra({ item, aoFechar, aoSalvar }: { item: ItemReposicao; aoFechar: () => void; aoSalvar: () => void }) {
  const avisar = useAvisos();
  const [qtd, setQtd] = useState(() => String(sugestao(item)));
  const [custo, setCusto] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const n = parseInt(qtd, 10);
    if (!n || n <= 0) return avisar("Informe a quantidade comprada.", "erro");
    setSalvando(true);
    const { error } = await supabase().rpc("registrar_compra", {
      p_reposicao: item.id,
      p_quantidade: n,
      p_novo_custo: custo.trim() ? lerValor(custo) : null,
    });
    setSalvando(false);
    if (error) return avisar(mensagemErro(error), "erro");
    avisar(`Entrada de ${n} un. de "${item.produto?.nome}" registrada.`);
    aoSalvar();
  }

  return (
    <Modal aberto titulo="Registrar compra" aoFechar={aoFechar} largura="max-w-md">
      {(
        <form onSubmit={salvar} className="space-y-4">
          <p className="font-medium">{item.produto?.nome}</p>
          <div>
            <label className="rotulo" htmlFor="qtd-compra">Quantidade comprada</label>
            <input id="qtd-compra" autoFocus inputMode="numeric" className="campo num text-lg" value={qtd} onChange={(e) => setQtd(e.target.value.replace(/\D/g, ""))} />
          </div>
          <div>
            <label className="rotulo" htmlFor="custo-compra">Novo preço de custo (opcional)</label>
            <input id="custo-compra" inputMode="decimal" className="campo num" placeholder={`Atual: ${brl(item.produto?.custo)}`} value={custo} onChange={(e) => setCusto(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={aoFechar} className="btn-claro">Cancelar</button>
            <button type="submit" disabled={salvando} className="btn-marca">
              {salvando && <Loader2 className="size-4 animate-spin" />} Dar entrada no estoque
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
