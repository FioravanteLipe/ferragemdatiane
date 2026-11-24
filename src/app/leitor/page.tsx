import type { Metadata } from "next";
import { LeitorCelular } from "./LeitorCelular";

export const metadata: Metadata = {
  title: "Leitor · Ferragem da Tiane",
  robots: { index: false, follow: false },
};

export default function PaginaLeitor() {
  return <LeitorCelular />;
}
