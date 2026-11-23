"use client";

import { Camera, Loader2, PackagePlus, Pencil, Search } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAvisos } from "@/components/Avisos";
import { LeitorCamera } from "@/components/LeitorCamera";
import { Modal } from "@/components/Modal";
import { brl, lerValor } from "@/lib/formato";
import { mensagemErro, supabase } from "@/lib/supabase";
import { avisarEstoqueAlterado, CAMPOS_PRODUTO, type Produto } from "@/lib/tipos";

const POR_PAGINA = 50;

export default function Produtos() {
  const [busca, setBusca] = useState("");
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState<Produto | "novo" | null>(null);

  const carregar = useCallback(
    async (deslocamento = 0) => {
      setCarregando(true);
      let q = supabase()
        .from("produtos")
        .select(CAMPOS_PRODUTO, { count: "exact" })
        .order("nome")
        .range(deslocamento, deslocamento + POR_PAGINA - 1);
      if (!mostrarInativos) q = q.eq("ativo", true);
      const t = busca.trim().replace(/[%,()]/g, " ");
      if (t) q = q.or(`nome.ilike.%${t}%,codigo_barras.eq.${t}`);
      const { data, count } = await q;
      setProdutos((atual) => (deslocamento ? [...atual, ...((data as Produto[]) ?? [])] : ((data as Produto[]) ?? [])));
      setTotal(count ?? 0);
      setCarregando(false);
    },
    [busca, mostrarInativos],
  );

  useEffect(() => {
    const t = setTimeout(() => carregar(0), 200);
    return () => clearTimeout(t);
  }, [carregar]);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-suave" />
          <input
            className="campo pl-10"
            placeholder="Buscar por nome ou código de barras"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-suave">
          <input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} className="size-4 accent-marca" />
          Mostrar desativados
        </label>
        <button onClick={() => setEditando("novo")} className="btn-marca">
          <PackagePlus className="size-4" /> Novo produto
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="tabela w-full min-w-[760px] text-sm">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Código</th>
              <th className="!text-right">Custo</th>
              <th className="!text-right">Preço</th>
              <th className="!text-right">Margem</th>
              <th className="!text-right">Estoque</th>
              <th className="!text-right">Mínimo</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {produtos.map((p) => {
              const margem = p.preco > 0 ? ((p.preco - p.custo) / p.preco) * 100 : 0;
              return (
                <tr key={p.id} className={`hover:bg-fundo/60 ${p.ativo ? "" : "opacity-50"}`}>
                  <td className="font-medium">
                    {p.nome}
                    {!p.ativo && <span className="ml-2 rounded bg-fundo px-1.5 py-0.5 text-xs text-suave">desativado</span>}
                  </td>
                  <td className="num text-suave">{p.codigo_barras ?? "—"}</td>
                  <td className="num text-right text-suave">{brl(p.custo)}</td>
                  <td className="num text-right font-semibold">{brl(p.preco)}</td>
                  <td className={`num text-right ${margem < 0 ? "text-erro" : "text-suave"}`}>{margem.toFixed(0)}%</td>
                  <td className={`num text-right font-semibold ${p.estoque <= 0 ? "text-erro" : p.abaixo_minimo ? "text-alerta" : ""}`}>
                    {p.estoque}
                  </td>
                  <td className="num text-right text-suave">{p.estoque_minimo}</td>
                  <td className="text-right">
                    <button onClick={() => setEditando(p)} className="rounded-lg p-2 text-suave hover:bg-marca-clara hover:text-tinta" aria-label={`Editar ${p.nome}`}>
                      <Pencil className="size-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!carregando && produtos.length === 0 && (
          <p className="p-10 text-center text-suave">
            {busca ? "Nenhum produto encontrado." : "Nenhum produto cadastrado ainda. Clique em “Novo produto”."}
          </p>
        )}
        {carregando && <Loader2 className="mx-auto my-6 size-6 animate-spin text-suave" />}
      </div>

      {produtos.length < total && !carregando && (
        <button onClick={() => carregar(produtos.length)} className="btn-claro mx-auto flex">
          Carregar mais ({total - produtos.length} restantes)
        </button>
      )}

      {editando && (
        <FormularioProduto
          produto={editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => {
            setEditando(null);
            carregar(0);
            avisarEstoqueAlterado();
          }}
        />
      )}
    </div>
  );
}

function FormularioProduto({
  produto,
  aoFechar,
  aoSalvar,
}: {
  produto: Produto | "novo";
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const avisar = useAvisos();
  const novo = produto === "novo";
  const [f, setF] = useState(() => {
    if (produto === "novo") return { nome: "", codigo: "", preco: "", custo: "", estoque: "0", minimo: "0", ativo: true };
    const v = (n: number) => String(n).replace(".", ",");
    return {
      nome: produto.nome,
      codigo: produto.codigo_barras ?? "",
      preco: v(produto.preco),
      custo: v(produto.custo),
      estoque: String(produto.estoque),
      minimo: String(produto.estoque_minimo),
      ativo: produto.ativo,
    };
  });
  const [salvando, setSalvando] = useState(false);
  const [camera, setCamera] = useState(false);

  const preco = lerValor(f.preco);
  const custo = lerValor(f.custo) ?? 0;
  const margem = preco ? ((preco - custo) / preco) * 100 : null;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!f.nome.trim()) return avisar("Informe o nome do produto.", "erro");
    if (preco === null) return avisar("Informe um preço de venda válido.", "erro");
    setSalvando(true);
    const dados = {
      nome: f.nome.trim(),
      codigo_barras: f.codigo.trim() || null,
      preco,
      custo,
      estoque: parseInt(f.estoque, 10) || 0,
      estoque_minimo: Math.max(0, parseInt(f.minimo, 10) || 0),
      ativo: f.ativo,
    };
    const { error } =
      produto === "novo"
        ? await supabase().from("produtos").insert(dados)
        : await supabase().from("produtos").update(dados).eq("id", produto.id);
    setSalvando(false);
    if (error) return avisar(mensagemErro(error), "erro");
    avisar(novo ? "Produto cadastrado!" : "Produto atualizado!");
    aoSalvar();
  }

  const campo = (k: keyof typeof f) => ({
    value: f[k] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value })),
  });

  return (
    <Modal aberto titulo={novo ? "Novo produto" : "Editar produto"} aoFechar={aoFechar}>
      <form onSubmit={salvar} className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="rotulo" htmlFor="nome">Nome do produto</label>
          <input id="nome" className="campo" autoFocus placeholder="Ex.: Parafuso sextavado 1/4 x 2" {...campo("nome")} />
        </div>
        <div className="col-span-2">
          <label className="rotulo" htmlFor="codigo">Código de barras</label>
          <div className="flex gap-2">
            <input
              id="codigo"
              className="campo num"
              placeholder="Passe o leitor aqui (opcional)"
              {...campo("codigo")}
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            />
            <button type="button" onClick={() => setCamera(true)} className="btn-claro" aria-label="Ler pela câmera">
              <Camera className="size-4" />
            </button>
          </div>
        </div>
        <div>
          <label className="rotulo" htmlFor="custo">Preço de custo</label>
          <input id="custo" inputMode="decimal" className="campo num" placeholder="0,00" {...campo("custo")} />
        </div>
        <div>
          <label className="rotulo" htmlFor="preco">Preço de venda</label>
          <input id="preco" inputMode="decimal" className="campo num" placeholder="0,00" {...campo("preco")} />
        </div>
        {margem !== null && (
          <p className={`col-span-2 -mt-2 text-sm ${margem < 0 ? "text-erro" : "text-suave"}`}>
            Margem de lucro: <b className="num">{margem.toFixed(1)}%</b> ({brl((preco ?? 0) - custo)} por unidade)
          </p>
        )}
        <div>
          <label className="rotulo" htmlFor="estoque">Quantidade em estoque</label>
          <input id="estoque" inputMode="numeric" className="campo num" {...campo("estoque")} />
        </div>
        <div>
          <label className="rotulo" htmlFor="minimo">Estoque mínimo</label>
          <input id="minimo" inputMode="numeric" className="campo num" {...campo("minimo")} />
        </div>
        <p className="col-span-2 -mt-2 text-xs text-suave">
          Quando o estoque chegar no mínimo, o sino avisa e o produto entra na lista de reposição. Use 0 para não avisar.
        </p>
        {!novo && (
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.ativo} onChange={(e) => setF((x) => ({ ...x, ativo: e.target.checked }))} className="size-4 accent-marca" />
            Produto ativo (desmarque para esconder da venda sem apagar o histórico)
          </label>
        )}
        <div className="col-span-2 flex justify-end gap-2 pt-2">
          <button type="button" onClick={aoFechar} className="btn-claro">Cancelar</button>
          <button type="submit" disabled={salvando} className="btn-marca">
            {salvando && <Loader2 className="size-4 animate-spin" />} Salvar
          </button>
        </div>
      </form>

      <LeitorCamera
        aberto={camera}
        aoFechar={() => setCamera(false)}
        aoLer={(c) => {
          setCamera(false);
          setF((x) => ({ ...x, codigo: c }));
        }}
      />
    </Modal>
  );
}
