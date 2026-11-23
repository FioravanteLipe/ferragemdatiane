"use client";

import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Tipo = "ok" | "alerta" | "erro";
type Aviso = { id: number; tipo: Tipo; texto: string };

const Contexto = createContext<(texto: string, tipo?: Tipo) => void>(() => {});

/** Mensagens rápidas no canto da tela ("Venda concluída", "Erro ao salvar"...). */
export function AvisosProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  const avisar = useCallback((texto: string, tipo: Tipo = "ok") => {
    const id = Date.now() + Math.random();
    setAvisos((a) => [...a, { id, tipo, texto }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), tipo === "erro" ? 7000 : 4000);
  }, []);

  return (
    <Contexto.Provider value={avisar}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4 sm:top-auto sm:right-4 sm:bottom-4 sm:left-auto sm:items-end">
        {avisos.map((a) => (
          <div
            key={a.id}
            role="status"
            className={`pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${
              a.tipo === "ok"
                ? "border-ok/20 bg-ok-claro text-ok"
                : a.tipo === "alerta"
                  ? "border-alerta/20 bg-alerta-claro text-alerta"
                  : "border-erro/20 bg-erro-claro text-erro"
            }`}
          >
            {a.tipo === "ok" ? (
              <CheckCircle2 className="mt-px size-4 shrink-0" />
            ) : a.tipo === "alerta" ? (
              <AlertTriangle className="mt-px size-4 shrink-0" />
            ) : (
              <XCircle className="mt-px size-4 shrink-0" />
            )}
            <span>{a.texto}</span>
          </div>
        ))}
      </div>
    </Contexto.Provider>
  );
}

export function useAvisos() {
  return useContext(Contexto);
}
