import { Hammer, Wrench } from "lucide-react";

/** Símbolo da logo: escudo amarelo com martelo e chave cruzados. */
export function SimboloMarca({ tamanho = 40 }: { tamanho?: number }) {
  return (
    <span
      aria-hidden
      className="relative inline-flex shrink-0 items-center justify-center rounded-tl-md rounded-tr-md rounded-bl-md bg-marca"
      style={{ width: tamanho, height: tamanho, borderBottomRightRadius: tamanho * 0.45 }}
    >
      <Wrench className="absolute text-tinta" style={{ width: tamanho * 0.55, height: tamanho * 0.55 }} strokeWidth={2.6} />
      <Hammer
        className="absolute -scale-x-100 text-tinta"
        style={{ width: tamanho * 0.55, height: tamanho * 0.55 }}
        strokeWidth={2.6}
      />
    </span>
  );
}

/** Logo em texto + símbolo, para fundo escuro ou claro. */
export function Marca({ escuro = false, compacta = false }: { escuro?: boolean; compacta?: boolean }) {
  return (
    <span className="inline-flex items-center gap-3">
      {!compacta && (
        <span className="font-display leading-[0.95] tracking-wide uppercase">
          <span className="block text-[1.35rem] font-bold text-marca">Ferragem</span>
          <span className={`block text-[1.05rem] font-semibold ${escuro ? "text-white" : "text-tinta"}`}>
            da Tiane
          </span>
        </span>
      )}
      <SimboloMarca tamanho={compacta ? 34 : 40} />
    </span>
  );
}
