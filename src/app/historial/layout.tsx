import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Historial y ranking",
  description: "Torneos anteriores y ranking histórico de jugadores.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
