"use client";

import { useState } from "react";
import { brl, diaCurto } from "@/lib/formato";

export type PontoDia = { dia: string; faturamento: number; lucro: number; num_vendas: number };

/** Escala "bonita" para o eixo: 0, 250, 500, 750... */
function teto(max: number) {
  if (max <= 0) return 100;
  const passo = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * passo >= max) return m * passo;
  return 10 * passo;
}

/** Faturamento por dia: barras com dica ao passar o mouse/tocar. */
export function GraficoBarras({ dados }: { dados: PontoDia[] }) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const max = teto(Math.max(0, ...dados.map((d) => d.faturamento)));
  const linhas = [1, 0.5, 0];
  const passoRotulo = dados.length > 16 ? 5 : dados.length > 8 ? 2 : 1;
  const d = ativo !== null ? dados[ativo] : null;

  return (
    <div className="relative">
      <div className="relative ml-14 h-56">
        {/* Grade */}
        {linhas.map((l) => (
          <div key={l} className="absolute inset-x-0 border-t border-borda" style={{ bottom: `${l * 100}%` }}>
            <span className="num absolute -top-2 -left-14 w-12 text-right text-[11px] text-suave">
              {(max * l).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
            </span>
          </div>
        ))}
        {/* Barras */}
        <div className="absolute inset-0 flex items-end gap-[2px]" onMouseLeave={() => setAtivo(null)}>
          {dados.map((p, i) => (
            <button
              key={p.dia}
              type="button"
              onMouseEnter={() => setAtivo(i)}
              onFocus={() => setAtivo(i)}
              onClick={() => setAtivo(i)}
              className="group flex h-full flex-1 items-end"
              aria-label={`${diaCurto(p.dia)}: ${brl(p.faturamento)}`}
            >
              <span
                className={`w-full rounded-t-[4px] transition-colors ${ativo === i ? "bg-tinta" : "bg-marca-escura"}`}
                style={{ height: `${(p.faturamento / max) * 100}%`, minHeight: p.faturamento > 0 ? 2 : 0 }}
              />
            </button>
          ))}
        </div>
        {/* Dica */}
        {d && ativo !== null && (
          <div
            className="pointer-events-none absolute -top-2 z-10 w-44 -translate-x-1/2 -translate-y-full rounded-xl border border-borda bg-white p-3 text-xs shadow-lg"
            style={{ left: `clamp(5.5rem, ${((ativo + 0.5) / dados.length) * 100}%, calc(100% - 5.5rem))` }}
          >
            <p className="mb-1.5 font-semibold">{diaCurto(d.dia)}</p>
            <p className="num flex justify-between"><span className="text-suave">Faturamento</span> <b>{brl(d.faturamento)}</b></p>
            <p className="num flex justify-between"><span className="text-suave">Lucro</span> <b>{brl(d.lucro)}</b></p>
            <p className="num flex justify-between"><span className="text-suave">Vendas</span> <b>{d.num_vendas}</b></p>
          </div>
        )}
      </div>
      {/* Eixo dos dias */}
      <div className="ml-14 mt-1.5 flex gap-[2px]">
        {dados.map((p, i) => (
          <span key={p.dia} className="num flex-1 text-center text-[10px] text-suave">
            {(dados.length - 1 - i) % passoRotulo === 0 ? diaCurto(p.dia) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
