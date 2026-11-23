import type { Metadata } from "next";

export const metadata: Metadata = { title: "Unirme a un torneo", description: "Entra a un torneo de ARENA XI con un código o un QR e inscríbete con tu nombre.", robots: { index: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
