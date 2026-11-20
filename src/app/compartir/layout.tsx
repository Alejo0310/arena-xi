import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Torneo compartido",
  description: "Vista de solo lectura de un torneo de ARENA XI.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
