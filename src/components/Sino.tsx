"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Pendente = { id: string; produto: { nome: string; estoque: number; estoque_minimo: number } | null };

/** Sino de avisos: mostra os produtos que chegaram no estoque mínimo. */
export function Sino() {
  const [itens, setItens] = useState<Pendente[]>([]);
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const { data } = await supabase()
        .from("reposicao")
        .select("id, produto:produtos(nome, estoque, estoque_minimo)")
        .eq("status", "pendente")
        .order("criado_em", { ascending: false })
        .limit(50);
      if (data && ativo) setItens(data as unknown as Pendente[]);
    })();
    return () => {
      ativo = false;
    };
  }, [versao]);

  useEffect(() => {
    const atualizar = () => setVersao((v) => v + 1);
    const intervalo = setInterval(atualizar, 60_000);
    window.addEventListener("estoque-alterado", atualizar);
    return () => {
      clearInterval(intervalo);
      window.removeEventListener("estoque-alterado", atualizar);
    };
  }, []);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  const total = itens.length;

  return (
    <div className="relative" ref={caixa}>
      <button
        onClick={() => setAberto((a) => !a)}
        className="relative rounded-xl p-2.5 text-tinta hover:bg-black/5"
        aria-label={total ? `${total} produtos no estoque mínimo` : "Avisos"}
      >
        <Bell className="size-5" />
        {total > 0 && (
          <span className="num absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-erro px-1 text-[11px] font-bold text-white ring-2 ring-fundo">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-borda bg-white shadow-xl">
          <div className="border-b border-borda px-4 py-3">
            <p className="font-semibold">Estoque mínimo</p>
            <p className="text-xs text-suave">
              {total ? `${total} produto(s) precisam de reposição` : "Nenhum produto no mínimo. Tudo certo!"}
            </p>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {itens.slice(0, 8).map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 border-b border-borda px-4 py-2.5 text-sm last:border-0">
                <span className="truncate">{i.produto?.nome}</span>
                <span className={`num shrink-0 text-xs font-semibold ${(i.produto?.estoque ?? 0) <= 0 ? "text-erro" : "text-alerta"}`}>
                  {i.produto?.estoque} / mín. {i.produto?.estoque_minimo}
                </span>
              </li>
            ))}
          </ul>
          {total > 0 && (
            <Link
              href="/reposicao"
              onClick={() => setAberto(false)}
              className="block bg-fundo px-4 py-3 text-center text-sm font-semibold text-tinta hover:bg-marca-clara"
            >
              Ver lista de reposição
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
