import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sorteo de equipos",
  description: "Ruleta, sobres, tómbola, draft y bombos para repartir los equipos.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
