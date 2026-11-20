"use client";

import Link from "next/link";
import { ArrowUpRight, Bug } from "lucide-react";
import { Logo, Wordmark } from "./Logo";
import { ISSUES_URL, NEW_ISSUE_URL, REPO_URL } from "@/lib/links";

export function GithubMark({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2.15c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.18 1.82 1.18 3.08 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

export interface FooterItem {
  label: string;
  href: string;
  external?: boolean;
}

export const NAVEGAR: FooterItem[] = [
  { label: "Inicio", href: "/" },
  { label: "Configurar torneo", href: "/nuevo" },
  { label: "Sorteo", href: "/sorteo" },
  { label: "Torneo", href: "/torneo" },
  { label: "Equipos", href: "/equipos" },
  { label: "Historial", href: "/historial" },
];

export const FUNCIONES: FooterItem[] = [
  { label: "Crear torneo", href: "/nuevo" },
  { label: "Modalidades de sorteo", href: "/#sorteos" },
  { label: "Clubes", href: "/equipos?cat=club-men" },
  { label: "Selecciones nacionales", href: "/equipos?cat=national-men" },
  { label: "Resultados", href: "/torneo?tab=matches" },
  { label: "Tablas de clasificación", href: "/torneo?tab=table" },
  { label: "Llaves eliminatorias", href: "/torneo?tab=table" },
  { label: "Historial de campeones", href: "/historial#campeones" },
];

export const SOBRE: FooterItem[] = [
  { label: "Acerca del proyecto", href: "/acerca" },
  { label: "Cómo funciona", href: "/acerca#como-funciona" },
  { label: "Modalidades de sorteo", href: "/acerca#modalidades" },
  { label: "Preguntas frecuentes", href: "/acerca#faq" },
  { label: "Comentarios y errores", href: NEW_ISSUE_URL, external: true },
];

export const LEGAL: FooterItem[] = [
  { label: "Privacidad y datos locales", href: "/acerca#privacidad" },
  { label: "Marcas y derechos de autor", href: "/acerca#marcas" },
  { label: "Accesibilidad", href: "/acerca#accesibilidad" },
  { label: "Créditos y fuentes", href: "/acerca#creditos" },
];

function FooterLink({ item }: { item: FooterItem }) {
  const cls = "group inline-flex items-center gap-1 text-sm text-soft transition-colors hover:text-white";
  const label = (
    <span className="relative after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-neon after:transition-transform group-hover:after:scale-x-100">{item.label}</span>
  );
  return item.external ? (
    <a href={item.href} target="_blank" rel="noopener noreferrer" className={cls}>
      {label}
      <ArrowUpRight className="size-3 opacity-60" aria-hidden />
      <span className="sr-only">(se abre en una pestaña nueva)</span>
    </a>
  ) : (
    <Link href={item.href} className={cls}>
      {label}
    </Link>
  );
}

function Column({ title, items }: { title: string; items: FooterItem[] }) {
  return (
    <nav aria-label={title}>
      <h2 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-neon">{title}</h2>
      <ul className="mt-4 space-y-2.5">
        {items.map((i) => (
          <li key={i.label + i.href}>
            <FooterLink item={i} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="no-print relative mt-20 border-t border-line bg-gradient-to-b from-transparent to-black/60" data-testid="footer">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon/60 to-transparent" />
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="max-w-sm sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2.5" aria-label="ARENA XI, inicio">
              <Logo size={40} />
              <Wordmark />
            </Link>
            <p className="display text-gradient mt-5 text-2xl font-extrabold italic">QUE GANE EL MEJOR</p>
            <p className="mt-3 text-sm text-mute">Sorteos animados de equipos y torneos de liga o eliminatorias entre amigos, con resultados, tablas, llaves y estadísticas.</p>
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Ediciones compatibles">
              {["FC 25", "FC 26", "FC 27"].map((e) => (
                <li key={e} className="rounded-md border border-neon/30 bg-neon/5 px-2 py-1 font-display text-xs font-bold uppercase tracking-wider text-neon">
                  {e}
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="footer-github"
                className="group inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-soft transition-all hover:-translate-y-0.5 hover:border-neon/60 hover:text-white hover:shadow-[0_8px_24px_-10px_#3dff8b]"
              >
                <GithubMark className="size-5 transition-transform group-hover:-rotate-6 group-hover:scale-110" /> Repositorio en GitHub
                <span className="sr-only">(se abre en una pestaña nueva)</span>
              </a>
              <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs text-mute transition-colors hover:text-white">
                <Bug className="size-3.5" /> Ver incidencias
                <span className="sr-only">(se abre en una pestaña nueva)</span>
              </a>
            </div>
          </div>
          <Column title="Navegar" items={NAVEGAR} />
          <Column title="Funciones" items={FUNCIONES} />
          <Column title="Sobre ARENA XI" items={SOBRE} />
          <Column title="Legal" items={LEGAL} />
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 text-xs text-mute sm:px-6 md:flex-row md:items-center md:justify-between">
          <p>
            © <span suppressHydrationWarning>{new Date().getFullYear()}</span> <b className="text-soft">ARENA XI</b>
          </p>
          <p className="max-w-2xl md:text-center" data-testid="footer-disclaimer">
            ARENA XI es un proyecto independiente, sin afiliación, patrocinio ni respaldo oficial de EA SPORTS o Electronic Arts. EA SPORTS FC es una marca de Electronic Arts.
          </p>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" aria-label="ARENA XI en GitHub (pestaña nueva)" className="inline-flex items-center gap-1.5 text-soft transition-colors hover:text-neon">
            <GithubMark className="size-4" /> GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
