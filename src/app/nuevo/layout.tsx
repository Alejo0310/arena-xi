import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Configurar torneo",
  description: "Participantes, modalidad, reglas y equipos del torneo.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
