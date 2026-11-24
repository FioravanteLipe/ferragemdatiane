"use client";

import { CheckCircle2, Loader2, Smartphone, TriangleAlert } from "lucide-react";
import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import { hora } from "@/lib/formato";
import { mensagemErro, supabase } from "@/lib/supabase";
import { useAvisos } from "./Avisos";
import { Modal } from "./Modal";

export type Pareamento = {
  id: string;
  expira_em: string;
  conectado_em: string | null;
  /** Só existe logo depois de gerar: o banco guarda apenas o hash. */
  token?: string;
};

/**
 * Mantém a Venda ligada ao celular pareado: recebe cada código lido
 * pelo Realtime e chama `aoCodigo`, como se fosse o leitor USB.
 */
export function useLeitorCelular(aoCodigo: (codigo: string) => void) {
  const avisar = useAvisos();
  const [pareamento, setPareamento] = useState<Pareamento | null>(null);
  const [gerando, setGerando] = useState(false);
  const aoCodigoRef = useRef(aoCodigo);
  useEffect(() => {
    aoCodigoRef.current = aoCodigo;
  }, [aoCodigo]);

  // Ao abrir a Venda, retoma o celular que já estava conectado.
  useEffect(() => {
    (async () => {
      const { data } = await supabase()
        .from("pareamentos")
        .select("id, expira_em, conectado_em")
        .is("revogado_em", null)
        .gt("expira_em", new Date().toISOString())
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setPareamento(data as Pareamento);
    })();
  }, []);

  const id = pareamento?.id;
  const expiraEm = pareamento?.expira_em;
  const idAtual = useRef(id);
  useEffect(() => {
    idAtual.current = id;
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const canal = supabase()
      .channel(`leitor-celular-${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "leituras_celular", filter: `pareamento_id=eq.${id}` },
        (msg) => aoCodigoRef.current(String(msg.new.codigo)),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pareamentos", filter: `id=eq.${id}` },
        (msg) => {
          const novo = msg.new as Pareamento & { revogado_em: string | null };
          // Um QR novo revoga o anterior; esse aviso atrasado não pode derrubar o novo.
          if (novo.id !== idAtual.current) return;
          if (novo.revogado_em) {
            setPareamento(null);
            avisar("Celular desconectado.", "alerta");
          } else {
            setPareamento((p) => (p ? { ...p, conectado_em: novo.conectado_em } : p));
          }
        },
      )
      .subscribe();
    return () => {
      supabase().removeChannel(canal);
    };
  }, [id, avisar]);

  useEffect(() => {
    if (!expiraEm) return;
    const t = setTimeout(() => setPareamento(null), new Date(expiraEm).getTime() - Date.now());
    return () => clearTimeout(t);
  }, [expiraEm]);

  const gerar = useCallback(async () => {
    setGerando(true);
    const { data, error } = await supabase().rpc("criar_pareamento");
    setGerando(false);
    if (error) {
      avisar(mensagemErro(error), "erro");
      return false;
    }
    setPareamento({ id: data.id, token: data.token, expira_em: data.expira_em, conectado_em: null });
    return true;
  }, [avisar]);

  const desconectar = useCallback(async () => {
    if (!id) return;
    const { error } = await supabase().rpc("encerrar_pareamento", { p_id: id });
    if (error) return avisar(mensagemErro(error), "erro");
    setPareamento(null);
  }, [id, avisar]);

  return { pareamento, gerando, gerar, desconectar };
}

/** Janela com o QR code que o celular lê para virar leitor. */
export function ConectarCelular({
  pareamento,
  gerando,
  aoGerar,
  aoDesconectar,
  aoFechar,
}: {
  pareamento: Pareamento | null;
  gerando: boolean;
  aoGerar: () => void;
  aoDesconectar: () => void;
  aoFechar: () => void;
}) {
  const [qr, setQr] = useState<{ token: string; imagem: string } | null>(null);
  const token = pareamento?.token;
  const local = ["localhost", "127.0.0.1"].includes(window.location.hostname);

  useEffect(() => {
    if (!token) return;
    // O token vai depois do "#": essa parte do endereço não chega ao servidor.
    QRCode.toDataURL(`${window.location.origin}/leitor#t=${token}`, { width: 520, margin: 1 }).then((imagem) =>
      setQr({ token, imagem }),
    );
  }, [token]);

  const conectado = Boolean(pareamento?.conectado_em);

  return (
    <Modal aberto titulo="Celular como leitor" aoFechar={aoFechar}>
      {!pareamento ? (
        <div className="py-6 text-center">
          <span className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-marca-clara">
            <Smartphone className="size-8 text-marca-escura" />
          </span>
          <p className="text-suave">Gere um QR code e leia com a câmera do celular.</p>
          <button onClick={aoGerar} disabled={gerando} className="btn-marca mt-5">
            {gerando && <Loader2 className="size-4 animate-spin" />} Gerar QR code
          </button>
        </div>
      ) : (
        <>
          {token ? (
            <>
              {qr?.token === token ? (
                // eslint-disable-next-line @next/next/no-img-element -- imagem gerada no navegador (data URL)
                <img src={qr.imagem} alt="QR code para conectar o celular" className="mx-auto aspect-square w-64 rounded-xl" />
              ) : (
                <div className="mx-auto flex aspect-square w-64 items-center justify-center">
                  <Loader2 className="size-8 animate-spin text-suave" />
                </div>
              )}
              <p className="mt-3 text-center text-sm text-suave">Abra a câmera do celular e aponte para o QR code.</p>
            </>
          ) : (
            <p className="text-center text-sm text-suave">
              Este celular já foi pareado. Para conectar outro, gere um novo QR code.
            </p>
          )}

          <div
            className={`mt-4 flex items-center justify-center gap-2 rounded-2xl p-3 text-sm font-semibold ${
              conectado ? "bg-ok-claro text-ok" : "bg-fundo text-suave"
            }`}
          >
            {conectado ? <CheckCircle2 className="size-4" /> : <Loader2 className="size-4 animate-spin" />}
            {conectado ? "Celular conectado" : "Aguardando o celular…"}
            <span className="font-normal">· vale até {hora(pareamento.expira_em)}</span>
          </div>

          {local && token && (
            <p className="mt-3 flex gap-2 rounded-xl bg-alerta-claro p-3 text-sm text-alerta">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              Você está usando o sistema em localhost: o celular não consegue abrir esse endereço. Gere o QR code pelo
              site publicado.
            </p>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button onClick={aoGerar} disabled={gerando} className="btn-claro">
              {gerando && <Loader2 className="size-4 animate-spin" />} Novo QR code
            </button>
            <button onClick={aoDesconectar} className="btn-perigo">
              Desconectar
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
