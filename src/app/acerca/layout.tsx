import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acerca de ARENA XI",
  description: "Qué es ARENA XI, cómo funciona, qué ediciones de EA SPORTS FC admite, preguntas frecuentes, privacidad, marcas y créditos.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
