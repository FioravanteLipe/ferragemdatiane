"use client";

import { useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import { Modal } from "./Modal";

// A câmera enxerga o mesmo código várias vezes por segundo.
const INTERVALO_MESMO_CODIGO = 2000;

/**
 * Vídeo da câmera traseira lendo códigos de barras.
 * Só funciona em HTTPS (no site publicado) ou em localhost.
 * `continuo`: continua lendo depois de cada código (leitor do celular).
 */
export function VisorCamera({
  aoLer,
  continuo = false,
  className = "aspect-[4/3]",
}: {
  aoLer: (codigo: string) => void;
  continuo?: boolean;
  className?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [erro, setErro] = useState("");
  const aoLerRef = useRef(aoLer);
  useEffect(() => {
    aoLerRef.current = aoLer;
  }, [aoLer]);

  useEffect(() => {
    let controles: IScannerControls | undefined;
    let cancelado = false;
    let ultimo = { codigo: "", quando: 0 };

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const leitor = new BrowserMultiFormatReader();
        if (cancelado || !video.current) return;
        controles = await leitor.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          video.current,
          (resultado) => {
            if (!resultado || cancelado) return;
            const codigo = resultado.getText();
            if (continuo) {
              const agora = Date.now();
              if (codigo === ultimo.codigo && agora - ultimo.quando < INTERVALO_MESMO_CODIGO) return;
              ultimo = { codigo, quando: agora };
            } else {
              cancelado = true;
              controles?.stop();
              navigator.vibrate?.(80);
            }
            aoLerRef.current(codigo);
          },
        );
        if (cancelado) controles.stop();
      } catch (e) {
        const nome = (e as Error)?.name;
        setErro(
          nome === "NotAllowedError"
            ? "Permissão da câmera negada. Libere a câmera nas configurações do navegador."
            : nome === "NotFoundError"
              ? "Nenhuma câmera encontrada neste aparelho."
              : "Não foi possível abrir a câmera. Ela só funciona no site com https.",
        );
      }
    })();

    return () => {
      cancelado = true;
      controles?.stop();
    };
  }, [continuo]);

  if (erro) return <p className="rounded-xl bg-erro-claro p-4 text-sm text-erro">{erro}</p>;
  return (
    <div className="relative overflow-hidden rounded-2xl bg-tinta">
      <video ref={video} className={`w-full object-cover ${className}`} muted playsInline />
      <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-marca shadow-[0_0_12px_#f7b52c]" />
    </div>
  );
}

type Props = { aberto: boolean; aoFechar: () => void; aoLer: (codigo: string) => void };

/** Janela que lê UM código pela câmera e fecha. */
export function LeitorCamera({ aberto, aoFechar, aoLer }: Props) {
  if (!aberto) return null;
  return (
    <Modal aberto titulo="Ler código pela câmera" aoFechar={aoFechar}>
      <VisorCamera aoLer={aoLer} />
      <p className="mt-3 text-center text-sm text-suave">Aponte a câmera para o código de barras do produto.</p>
    </Modal>
  );
}
