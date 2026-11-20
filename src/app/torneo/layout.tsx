import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Torneo en juego",
  description: "Resultados, tabla, llaves y estadísticas del torneo.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
