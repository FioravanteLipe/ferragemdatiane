const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** 12.5 -> "R$ 12,50" */
export function brl(valor: number | string | null | undefined): string {
  return moeda.format(Number(valor ?? 0));
}

/** "12,50" | "1.234,56" | "12.5" -> 12.5 (ou null se inválido) */
export function lerValor(texto: string): number | null {
  let s = texto.trim().replace(/\s|R\$/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/** Arredonda para centavos, evitando 0.1 + 0.2 = 0.30000000000000004 */
export function centavos(n: number): number {
  return Math.round(n * 100) / 100;
}

const FUSO = "America/Sao_Paulo";

export function dataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });
}

/** "2026-11-23" -> "23/11" */
export function diaCurto(dataISO: string): string {
  const [, m, d] = dataISO.split("-");
  return `${d}/${m}`;
}

export const FORMAS_PAGAMENTO = [
  { id: "dinheiro", nome: "Dinheiro" },
  { id: "pix", nome: "Pix" },
  { id: "debito", nome: "Débito" },
  { id: "credito", nome: "Crédito" },
] as const;

export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number]["id"];
