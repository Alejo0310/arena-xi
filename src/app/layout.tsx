import type { Metadata, Viewport } from "next";
import { Barlow, Saira_Condensed } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";

const saira = Saira_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  variable: "--font-saira",
  display: "swap",
});

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FC 25 Tournament Manager · Sorteos y torneos entre amigos",
  description:
    "Organiza ligas y eliminatorias de EA SPORTS FC 25: sorteos de equipos animados, resultados, tablas, llaves y estadísticas.",
  applicationName: "FC 25 Tournament Manager",
};

export const viewport: Viewport = {
  themeColor: "#05070a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${saira.variable} ${barlow.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
