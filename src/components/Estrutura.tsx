"use client";

import { BarChart3, ClipboardList, LogOut, Package, ShoppingCart, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { supabase, supabaseConfigurado } from "@/lib/supabase";
import { AvisosProvider } from "./Avisos";
import { Marca } from "./Marca";
import { Sino } from "./Sino";

const ABAS = [
  { href: "/venda", nome: "Venda", icone: ShoppingCart },
  { href: "/estoque", nome: "Dashboard e Estoque", curto: "Estoque", icone: BarChart3 },
  { href: "/produtos", nome: "Produtos", icone: Package },
  { href: "/reposicao", nome: "Reposição", icone: ClipboardList },
  { href: "/caixa", nome: "Caixa", icone: Wallet },
];

/** Menu lateral (computador) / barra inferior (celular) + cabeçalho com o sino. */
export function Estrutura({ children }: { children: ReactNode }) {
  const caminho = usePathname();
  const router = useRouter();
  const atual = ABAS.find((a) => caminho.startsWith(a.href));

  async function sair() {
    await supabase().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (!supabaseConfigurado) return <AvisoConfiguracao />;

  return (
    <AvisosProvider>
      <div className="flex min-h-dvh">
        {/* Menu lateral */}
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-tinta px-4 py-6 lg:flex">
          <div className="px-2 pb-8">
            <Marca escuro />
          </div>
          <nav className="flex flex-1 flex-col gap-1">
            {ABAS.map((a) => {
              const ativo = caminho.startsWith(a.href);
              return (
                <Link
                  key={a.href}
                  href={a.href}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    ativo ? "bg-marca text-tinta" : "text-white/70 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  <a.icone className="size-[18px]" />
                  {a.nome}
                </Link>
              );
            })}
          </nav>
          <button
            onClick={sair}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/60 hover:bg-white/8 hover:text-white"
          >
            <LogOut className="size-[18px]" /> Sair
          </button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Cabeçalho */}
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-borda bg-fundo/90 px-4 py-3 backdrop-blur sm:px-6">
            <div className="flex items-center gap-3">
              <span className="lg:hidden">
                <Marca compacta />
              </span>
              <h1 className="font-display text-xl font-semibold sm:text-2xl">{atual?.nome}</h1>
            </div>
            <div className="flex items-center gap-1">
              <Sino />
              <button onClick={sair} className="rounded-xl p-2.5 hover:bg-black/5 lg:hidden" aria-label="Sair">
                <LogOut className="size-5" />
              </button>
            </div>
          </header>

          <main className="flex-1 px-4 pt-5 pb-28 sm:px-6 lg:pb-8">{children}</main>
        </div>

        {/* Barra inferior no celular */}
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-white/10 bg-tinta pb-[env(safe-area-inset-bottom,0px)] lg:hidden">
          {ABAS.map((a) => {
            const ativo = caminho.startsWith(a.href);
            return (
              <Link
                key={a.href}
                href={a.href}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${ativo ? "text-marca" : "text-white/60"}`}
              >
                <a.icone className="size-5" />
                {a.curto ?? a.nome}
              </Link>
            );
          })}
        </nav>
      </div>
    </AvisosProvider>
  );
}

function AvisoConfiguracao() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="card max-w-lg p-8">
        <Marca />
        <h1 className="mt-6 font-display text-2xl font-semibold">Falta conectar o banco de dados</h1>
        <p className="mt-2 text-suave">
          Crie o arquivo <code className="rounded bg-fundo px-1.5 py-0.5">.env.local</code> na pasta do projeto com as
          chaves do Supabase (veja o arquivo <b>LEIA-ME.md</b>) e reinicie o sistema.
        </p>
      </div>
    </div>
  );
}
