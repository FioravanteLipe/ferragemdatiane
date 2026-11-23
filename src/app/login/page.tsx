"use client";

import { Loader2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { mensagemErro, supabase, supabaseConfigurado } from "@/lib/supabase";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [entrando, setEntrando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setEntrando(true);
    try {
      const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password: senha });
      if (error) throw error;
      router.replace("/venda");
      router.refresh();
    } catch (err) {
      setErro(mensagemErro(err));
      setEntrando(false);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Lado da marca */}
      <div className="relative hidden overflow-hidden bg-tinta lg:block">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, #f7b52c 0 2px, transparent 2px 28px), repeating-linear-gradient(-45deg, #f7b52c 0 2px, transparent 2px 28px)",
          }}
        />
        <div className="relative flex h-full flex-col justify-end p-12">
          <div className="mb-6 h-1.5 w-16 rounded-full bg-marca" />
          <p className="font-display text-5xl leading-tight font-semibold text-white">
            Venda rápido.
            <br />
            <span className="text-marca">Estoque sempre em dia.</span>
          </p>
          <p className="mt-4 max-w-md text-white/60">
            Leitor de código de barras, controle de estoque, reposição automática e fechamento de caixa sem erro.
          </p>
        </div>
      </div>

      {/* Formulário */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 overflow-hidden rounded-2xl bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Ferragem da Tiane" className="h-28 w-full scale-[1.9] object-contain" />
          </div>
          <h1 className="font-display text-3xl font-semibold">Entrar</h1>
          <p className="mt-1 mb-6 text-suave">Acesse o sistema de vendas e estoque.</p>

          {!supabaseConfigurado && (
            <p className="mb-4 rounded-xl bg-alerta-claro p-3 text-sm text-alerta">
              Banco de dados ainda não conectado. Veja o LEIA-ME.md.
            </p>
          )}

          <form onSubmit={entrar} className="space-y-4">
            <div>
              <label className="rotulo" htmlFor="email">E-mail</label>
              <input id="email" type="email" autoComplete="email" required className="campo" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="rotulo" htmlFor="senha">Senha</label>
              <input id="senha" type="password" autoComplete="current-password" required className="campo" value={senha} onChange={(e) => setSenha(e.target.value)} />
            </div>
            {erro && <p className="rounded-xl bg-erro-claro p-3 text-sm text-erro">{erro}</p>}
            <button type="submit" disabled={entrando || !supabaseConfigurado} className="btn-marca w-full py-3 text-base">
              {entrando ? <Loader2 className="size-5 animate-spin" /> : <Lock className="size-4" />}
              Entrar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
