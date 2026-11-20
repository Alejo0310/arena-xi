"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MotionConfig, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Database, History, Home, Maximize, Minimize, MonitorPlay, Shuffle, Trophy, Volume2, VolumeX, Menu, X } from "lucide-react";
import { useTournament } from "@/store/tournament";
import { ConfirmHost, Toaster } from "@/components/ui/feedback";
import { BackgroundFX } from "./BackgroundFX";
import { Logo, Wordmark } from "./Logo";
import { Footer } from "./Footer";
import { useHydrated } from "@/components/ui/bits";

const NAV = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/nuevo", label: "Configurar", icon: Trophy },
  { href: "/sorteo", label: "Sorteo", icon: Shuffle },
  { href: "/torneo", label: "Torneo", icon: MonitorPlay },
  { href: "/equipos", label: "Equipos", icon: Database },
  { href: "/historial", label: "Historial", icon: History },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = pathname.startsWith("/proyeccion");
  return (
    <MotionConfig reducedMotion="user">
      <BackgroundFX />
      {!bare && <Header pathname={pathname} />}
      <motion.main
        key={pathname}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className={bare ? "" : "mx-auto w-full max-w-7xl px-4 pb-24 pt-6 sm:px-6"}
      >
        {children}
      </motion.main>
      {!bare && <Footer />}
      <Toaster />
      <ConfirmHost />
    </MotionConfig>
  );
}

function Header({ pathname }: { pathname: string }) {
  const sound = useTournament((s) => s.sound);
  const toggleSound = useTournament((s) => s.toggleSound);
  const hydrated = useHydrated();
  const [fs, setFs] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const on = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  useEffect(() => setOpen(false), [pathname]);

  const toggleFs = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  };

  return (
    <header className="no-print sticky top-0 z-50 border-b border-line bg-ink/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="ARENA XI, inicio">
          <Logo className="transition-transform duration-500 group-hover:scale-110" />
          <Wordmark />
        </Link>

        <nav className="ml-6 hidden items-center gap-1 lg:flex" aria-label="Principal">
          {NAV.map((n) => (
            <NavLink key={n.href} {...n} active={isActive(pathname, n.href)} />
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <IconBtn label={hydrated && sound ? "Desactivar sonido" : "Activar sonido"} onClick={toggleSound} pressed={hydrated && sound}>
            {hydrated && sound ? <Volume2 className="size-5 text-neon" /> : <VolumeX className="size-5" />}
          </IconBtn>
          <IconBtn label={fs ? "Salir de pantalla completa" : "Pantalla completa"} onClick={toggleFs}>
            {fs ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
          </IconBtn>
          <IconBtn label="Menú" onClick={() => setOpen((o) => !o)} className="lg:hidden" pressed={open}>
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </IconBtn>
        </div>
      </div>
      {open && (
        <motion.nav
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="grid grid-cols-2 gap-1 border-t border-line px-4 py-3 sm:grid-cols-3 lg:hidden"
          aria-label="Principal móvil"
        >
          {NAV.map((n) => (
            <NavLink key={n.href} {...n} active={isActive(pathname, n.href)} />
          ))}
        </motion.nav>
      )}
    </header>
  );
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function NavLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof Home; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative flex items-center gap-2 rounded-lg px-3 py-2 font-display text-sm font-semibold uppercase tracking-wider transition-colors ${active ? "text-white" : "text-mute hover:text-white"}`}
    >
      <Icon className={`size-4 ${active ? "text-neon" : ""}`} />
      {label}
      {active && <motion.span layoutId="nav-underline" className="absolute inset-x-3 -bottom-[9px] hidden h-0.5 rounded-full bg-neon shadow-[0_0_12px_#3dff8b] lg:block" />}
    </Link>
  );
}

function IconBtn({ label, onClick, children, className = "", pressed }: { label: string; onClick: () => void; children: React.ReactNode; className?: string; pressed?: boolean }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} aria-pressed={pressed} className={`grid size-10 place-items-center rounded-lg text-soft transition-colors hover:bg-white/5 hover:text-white ${className}`}>
      {children}
    </button>
  );
}
