import type { Metadata, Viewport } from "next";
import { Inter, Saira_Semi_Condensed } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const saira = Saira_Semi_Condensed({
  variable: "--font-saira",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Ferragem da Tiane — Vendas e Estoque",
  description: "Sistema de vendas, estoque e caixa da Ferragem da Tiane",
};

export const viewport: Viewport = {
  themeColor: "#161616",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${saira.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
