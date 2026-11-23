import { Estrutura } from "@/components/Estrutura";

export default function LayoutSistema({ children }: LayoutProps<"/">) {
  return <Estrutura>{children}</Estrutura>;
}
