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

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000";
const description = "ARENA XI: sorteos de equipos animados y torneos de EA SPORTS FC 25 entre amigos. Ligas, eliminatorias, clubes y selecciones. Que gane el mejor.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "ARENA XI · Que gane el mejor", template: "%s · ARENA XI" },
  description,
  applicationName: "ARENA XI",
  keywords: ["EA SPORTS FC 25", "torneo", "sorteo de equipos", "liga", "eliminatorias", "FIFA", "ARENA XI"],
  openGraph: {
    type: "website",
    siteName: "ARENA XI",
    title: "ARENA XI · Que gane el mejor",
    description,
    locale: "es_ES",
  },
  twitter: { card: "summary_large_image", title: "ARENA XI · Que gane el mejor", description },
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
