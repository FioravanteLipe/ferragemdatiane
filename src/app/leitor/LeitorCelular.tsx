"use client";

import { CheckCircle2, Loader2, LogOut, ScanBarcode, TriangleAlert, XCircle } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { VisorCamera } from "@/components/LeitorCamera";
import { Marca } from "@/components/Marca";
import { brl, hora } from "@/lib/formato";
import { mensagemErro, supabase, supabaseConfigurado } from "@/lib/supabase";

type Leitura = { id: number; codigo: string; nome: string | null; preco: number | null };
type Estado = "inicio" | "conectando" | "lendo" | "desconectado";

const QR_INVALIDO =
  "Este QR code não vale mais: ele expirou, foi desconectado ou o caixa foi fechado. Gere um novo na tela de Venda.";

// O token vem depois do "#" (#t=...), que o navegador não envia ao servidor.
const lerToken = () => new URLSearchParams(window.location.hash.slice(1)).get("t") ?? "";
const assinarHash = (aviso: () => void) => {
  window.addEventListener("hashchange", aviso);
  return () => window.removeEventListener("hashchange", aviso);
};

function bipe(som: AudioContext | null, frequencia: number, duracao: number, atraso = 0) {
  if (!som) return;
  const oscilador = som.createOscillator();
  const volume = som.createGain();
  oscilador.type = "square";
  oscilador.frequency.value = frequencia;
  volume.gain.value = 0.12;
  oscilador.connect(volume).connect(som.destination);
  const inicio = som.currentTime + atraso;
  oscilador.start(inicio);
  oscilador.stop(inicio + duracao);
}

/** Celular como leitor de código de barras da tela de Venda. */
export function LeitorCelular() {
  const token = useSyncExternalStore(assinarHash, lerToken, () => null);
  const [estado, setEstado] = useState<Estado>("inicio");
  const [motivo, setMotivo] = useState("");
  const [aviso, setAviso] = useState("");
  const [expiraEm, setExpiraEm] = useState<string | null>(null);
  const [leituras, setLeituras] = useState<Leitura[]>([]);
  const som = useRef<AudioContext | null>(null);
  const contador = useRef(0);

  // Não deixa a tela apagar enquanto está lendo.
  useEffect(() => {
    if (estado !== "lendo" || !("wakeLock" in navigator)) return;
    let ativo = true;
    let trava: WakeLockSentinel | undefined;
    navigator.wakeLock
      .request("screen")
      .then((t) => {
        if (ativo) trava = t;
        else t.release();
      })
      .catch(() => {});
    return () => {
      ativo = false;
      trava?.release();
    };
  }, [estado]);

  function encerrar(texto: string) {
    setMotivo(texto);
    setEstado("desconectado");
  }

  function bipeErro() {
    bipe(som.current, 330, 0.14);
    bipe(som.current, 330, 0.14, 0.2);
    navigator.vibrate?.([90, 60, 90]);
  }

  async function iniciar() {
    // Som e câmera só podem ser liberados por um toque na tela.
    try {
      som.current ??= new AudioContext();
      await som.current.resume();
    } catch {}
    setAviso("");
    setEstado("conectando");
    const { data, error } = await supabase().rpc("conectar_leitor", { p_token: token });
    if (error) {
      if (error.message.includes("desconectado")) return encerrar(QR_INVALIDO);
      setAviso(mensagemErro(error));
      return setEstado("inicio");
    }
    setExpiraEm(data.expira_em);
    setEstado("lendo");
  }

  async function aoLer(codigo: string) {
    const { data, error } = await supabase().rpc("enviar_leitura", { p_token: token, p_codigo: codigo });
    if (error) {
      if (error.message.includes("desconectado")) return encerrar(QR_INVALIDO);
      bipeErro();
      return setAviso(mensagemErro(error));
    }
    if (data.nome) {
      bipe(som.current, 1760, 0.09);
      navigator.vibrate?.(70);
    } else {
      bipeErro();
    }
    setAviso("");
    const preco = data.preco === null ? null : Number(data.preco);
    setLeituras((l) => [{ id: ++contador.current, codigo, nome: data.nome, preco }, ...l].slice(0, 15));
  }

  async function desconectar() {
    await supabase().rpc("desconectar_leitor", { p_token: token });
    encerrar("Você desconectou este celular. Para voltar, leia de novo o QR code na tela de Venda.");
  }

  return (
    <main className="min-h-dvh bg-tinta px-4 py-5 text-white">
      <div className="mx-auto flex max-w-md flex-col gap-5">
        <header className="flex items-center justify-between">
          <Marca escuro />
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-white/70 uppercase">
            Leitor
          </span>
        </header>

        {!supabaseConfigurado ? (
          <Mensagem texto="O sistema ainda não está ligado ao banco de dados." />
        ) : token === null ? (
          <Loader2 className="mx-auto mt-16 size-8 animate-spin text-white/50" />
        ) : !token ? (
          <Mensagem texto="Abra esta página lendo o QR code do botão Celular, na tela de Venda." />
        ) : estado === "desconectado" ? (
          <Mensagem texto={motivo} />
        ) : estado !== "lendo" ? (
          <div className="mt-6 flex flex-col items-center text-center">
            <span className="mb-5 flex size-20 items-center justify-center rounded-3xl bg-marca">
              <ScanBarcode className="size-10 text-tinta" />
            </span>
            <h1 className="font-display text-2xl font-semibold">Celular como leitor</h1>
            <p className="mt-2 text-white/60">
              Cada código lido entra direto na venda aberta no computador.
            </p>
            <button onClick={iniciar} disabled={estado === "conectando"} className="btn-marca mt-8 w-full py-4 text-lg">
              {estado === "conectando" && <Loader2 className="size-5 animate-spin" />} Iniciar leitura
            </button>
            {aviso && <p className="mt-4 text-sm text-marca">{aviso}</p>}
          </div>
        ) : (
          <>
            <VisorCamera continuo aoLer={aoLer} className="aspect-[3/4]" />

            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-white/70">
                <span className="size-2 rounded-full bg-marca" /> Conectado
                {expiraEm && <span className="text-white/50">· até {hora(expiraEm)}</span>}
              </span>
              <button onClick={desconectar} className="btn px-3 py-1.5 text-white/70 hover:bg-white/10">
                <LogOut className="size-4" /> Desconectar
              </button>
            </div>

            {aviso && (
              <p className="flex items-center gap-2 rounded-xl bg-marca/15 px-4 py-3 text-sm text-marca">
                <TriangleAlert className="size-4 shrink-0" /> {aviso}
              </p>
            )}

            {leituras.length === 0 ? (
              <p className="text-center text-sm text-white/50">Aponte a câmera para o código de barras.</p>
            ) : (
              <ul className="space-y-2">
                {leituras.map((l, i) => (
                  <li
                    key={l.id}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 ${i === 0 ? "bg-white/12 ring-1 ring-marca/60" : "bg-white/5"}`}
                  >
                    {l.nome ? (
                      <CheckCircle2 className="size-5 shrink-0 text-marca" />
                    ) : (
                      <XCircle className="size-5 shrink-0 text-erro" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{l.nome ?? "Código não cadastrado"}</span>
                      <span className="block text-xs text-white/50">{l.codigo}</span>
                    </span>
                    {l.preco !== null && <span className="num shrink-0 font-semibold">{brl(l.preco)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Mensagem({ texto }: { texto: string }) {
  return (
    <div className="mt-6 flex flex-col items-center text-center">
      <span className="mb-5 flex size-20 items-center justify-center rounded-3xl bg-white/10">
        <XCircle className="size-10 text-marca" />
      </span>
      <p className="text-white/80">{texto}</p>
    </div>
  );
}
