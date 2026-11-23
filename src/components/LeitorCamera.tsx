"use client";

import { useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import { Modal } from "./Modal";

/**
 * Lê código de barras pela câmera do celular (câmera traseira).
 * Só funciona em HTTPS (no site publicado) ou em localhost.
 */
type Props = { aberto: boolean; aoFechar: () => void; aoLer: (codigo: string) => void };

export function LeitorCamera(props: Props) {
  return props.aberto ? <Leitor {...props} /> : null;
}

function Leitor({ aoFechar, aoLer }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [erro, setErro] = useState("");
  const aoLerRef = useRef(aoLer);
  useEffect(() => {
    aoLerRef.current = aoLer;
  }, [aoLer]);

  useEffect(() => {
    let controles: IScannerControls | undefined;
    let cancelado = false;

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const leitor = new BrowserMultiFormatReader();
        if (cancelado || !video.current) return;
        controles = await leitor.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          video.current,
          (resultado) => {
            if (resultado && !cancelado) {
              cancelado = true;
              controles?.stop();
              navigator.vibrate?.(80);
              aoLerRef.current(resultado.getText());
            }
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
  }, []);

  return (
    <Modal aberto titulo="Ler código pela câmera" aoFechar={aoFechar}>
      {erro ? (
        <p className="rounded-xl bg-erro-claro p-4 text-sm text-erro">{erro}</p>
      ) : (
        <div className="relative overflow-hidden rounded-2xl bg-tinta">
          <video ref={video} className="aspect-[4/3] w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-marca shadow-[0_0_12px_#f7b52c]" />
        </div>
      )}
      <p className="mt-3 text-center text-sm text-suave">Aponte a câmera para o código de barras do produto.</p>
    </Modal>
  );
}
