export type Produto = {
  id: string;
  nome: string;
  codigo_barras: string | null;
  preco: number;
  custo: number;
  estoque: number;
  estoque_minimo: number;
  abaixo_minimo: boolean;
  ativo: boolean;
};

export type Caixa = {
  id: string;
  aberto_em: string;
  fechado_em: string | null;
  status: "aberto" | "fechado";
  troco_inicial: number;
  esperado_dinheiro: number | null;
  esperado_pix: number | null;
  esperado_debito: number | null;
  esperado_credito: number | null;
  contado_dinheiro: number | null;
  contado_pix: number | null;
  contado_debito: number | null;
  contado_credito: number | null;
  observacao: string | null;
};

export type ResumoCaixa = {
  troco_inicial: number;
  vendas_dinheiro: number;
  vendas_pix: number;
  vendas_debito: number;
  vendas_credito: number;
  n_dinheiro: number;
  n_pix: number;
  n_debito: number;
  n_credito: number;
  n_vendas: number;
  total_vendas: number;
  sangrias: number;
  suprimentos: number;
  esperado_dinheiro: number;
};

export type Movimento = {
  id: string;
  tipo: "sangria" | "suprimento";
  valor: number;
  descricao: string | null;
  criado_em: string;
};

export type ItemReposicao = {
  id: string;
  status: "pendente" | "comprado";
  quantidade_comprada: number | null;
  criado_em: string;
  comprado_em: string | null;
  produto: Pick<Produto, "id" | "nome" | "codigo_barras" | "estoque" | "estoque_minimo" | "custo"> | null;
};

export const CAMPOS_PRODUTO = "id,nome,codigo_barras,preco,custo,estoque,estoque_minimo,abaixo_minimo,ativo";

/** Avisa as outras partes da tela (ex.: o sino) que o estoque mudou. */
export function avisarEstoqueAlterado() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("estoque-alterado"));
}
