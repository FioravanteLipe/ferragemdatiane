import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export const supabaseConfigurado = Boolean(SUPABASE_URL && SUPABASE_KEY);

let cliente: SupabaseClient | null = null;

/** Cliente do Supabase no navegador (só a chave pública; a segurança vem do login + RLS). */
export function supabase(): SupabaseClient {
  if (!supabaseConfigurado) {
    throw new Error(
      "Supabase não configurado: preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY no .env.local",
    );
  }
  if (!cliente) cliente = createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
  return cliente;
}

/** Transforma erros do Supabase/Postgres em mensagens legíveis. */
export function mensagemErro(erro: unknown): string {
  if (!erro) return "Erro desconhecido.";
  const e = erro as { message?: string; code?: string };
  if (e.code === "23505") return "Já existe um produto com esse código de barras.";
  if (e.message?.includes("Failed to fetch")) return "Sem conexão com a internet. Tente de novo.";
  if (e.message?.includes("Invalid login credentials")) return "E-mail ou senha incorretos.";
  return e.message ?? String(erro);
}
