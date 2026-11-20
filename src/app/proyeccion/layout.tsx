import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Proyección",
  description: "Pantalla para proyectar el torneo durante los partidos.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
