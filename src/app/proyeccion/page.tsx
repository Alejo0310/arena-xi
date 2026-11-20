"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Maximize, Radio } from "lucide-react";
import { STORAGE_KEY, useTournament } from "@/store/tournament";
import { Loader, useHydrated, useNow } from "@/components/ui/bits";
import { StandingsTable } from "@/components/tournament/StandingsTable";
import { Bracket } from "@/components/tournament/Bracket";
import { MatchTimer } from "@/components/tournament/MatchTimer";
import { TeamCrest } from "@/components/ui/TeamCrest";
import { recentResults, upcomingMatches } from "@/lib/tournament/engine";
import { getTeam } from "@/lib/teams";
import { Logo } from "@/components/layout/Logo";
import type { Match, Tournament } from "@/lib/types";

/**
 * Pantalla para proyectar durante los partidos. Se sincroniza con la pestaña de
 * administración a través del evento `storage` de localStorage.
 */
export default function ProjectionPage() {
  const hydrated = useHydrated();
  const t = useTournament((s) => s.current);
  const now = useNow(true);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) void useTournament.persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (!hydrated) return <Loader />;
  if (!t || t.matches.length === 0) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <p className="display text-4xl font-black">Sin torneo en juego</p>
          <Link href="/" className="mt-4 inline-block text-neon underline">Volver</Link>
        </div>
      </div>
    );
  }

  const upcoming = upcomingMatches(t);
  const featured = upcoming[0];
  const recent = recentResults(t, 8);
  const champion = t.participants.find((p) => p.id === t.championId);

  return (
    <div className="flex min-h-dvh flex-col p-4 sm:p-8">
      <header className="mb-6 flex items-center gap-4">
        <Logo size={44} />
        <div className="min-w-0 flex-1">
          <div className="kicker">ARENA XI · {t.settings.format === "league" ? "Liga" : "Eliminatorias"}</div>
          <h1 className="display truncate text-4xl font-black italic sm:text-6xl">{t.name}</h1>
        </div>
        <div className="display num hidden text-4xl font-bold text-soft sm:block">{new Date(now).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}</div>
        <button onClick={() => document.documentElement.requestFullscreen?.()} className="no-print grid size-11 place-items-center rounded-lg bg-white/5 hover:bg-white/10" aria-label="Pantalla completa"><Maximize className="size-5" /></button>
        <Link href="/torneo" className="no-print grid size-11 place-items-center rounded-lg bg-white/5 hover:bg-white/10" aria-label="Volver al panel"><ArrowLeft className="size-5" /></Link>
      </header>

      <div className="grid flex-1 gap-6 xl:grid-cols-[1fr_1.1fr]">
        <div className="flex flex-col gap-6">
          <AnimatePresence mode="wait">
            {champion ? (
              <motion.div key="champ" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass flex flex-1 flex-col items-center justify-center border-gold/50 p-8 text-center shadow-[0_0_80px_-20px_#ffd23d]">
                <div className="kicker !text-gold !text-lg">Campeón</div>
                <TeamCrest team={getTeam(t.assignments[champion.id])} size={140} className="my-6" />
                <div className="display text-gold text-8xl font-black italic">{champion.name}</div>
                <div className="mt-2 text-2xl text-soft">{getTeam(t.assignments[champion.id])?.name}</div>
              </motion.div>
            ) : featured ? (
              <Featured key={featured.id} t={t} m={featured} />
            ) : null}
          </AnimatePresence>
          {upcoming.length > 1 && (
            <div className="glass p-5">
              <div className="kicker mb-3">A continuación</div>
              <div className="space-y-2">
                {upcoming.slice(1, 4).map((m) => <MiniMatch key={m.id} t={t} m={m} />)}
              </div>
            </div>
          )}
        </div>
        <div className="min-w-0">{t.settings.format === "league" ? <StandingsTable t={t} /> : <Bracket t={t} />}</div>
      </div>

      {recent.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-xl border border-line bg-ink/70 [mask-image:linear-gradient(90deg,transparent,black_5%,black_95%,transparent)]">
          <div className="flex w-max animate-marquee gap-10 py-3 [animation-duration:30s] will-change-transform">
            {[...recent, ...recent].map((m, i) => <MiniMatch key={`${m.id}-${i}`} t={t} m={m} inline />)}
          </div>
        </div>
      )}
    </div>
  );
}

function Featured({ t, m }: { t: Tournament; m: Match }) {
  const byId = new Map(t.participants.map((p) => [p.id, p]));
  const h = byId.get(m.homeId!)!;
  const a = byId.get(m.awayId!)!;
  const live = m.status === "live";
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className={`glass flex flex-1 flex-col justify-center p-6 sm:p-10 ${live ? "border-blaze/60 shadow-[0_0_80px_-20px_#ff7a1a]" : ""}`}>
      <div className={`kicker mb-6 flex items-center justify-center gap-2 !text-base ${live ? "!text-blaze" : ""}`}>
        {live && <Radio className="size-4 animate-pulse" />} {live ? "En juego" : "Próximo partido"} · {m.label}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        {[h, a].map((p, i) => (
          <div key={p.id} className={`flex flex-col items-center text-center ${i === 1 ? "order-3" : ""}`}>
            <TeamCrest team={getTeam(t.assignments[p.id])} size={120} />
            <div className="display mt-4 text-4xl font-black sm:text-5xl">{p.name}</div>
            <div className="text-soft">{getTeam(t.assignments[p.id])?.name}</div>
          </div>
        ))}
        <div className="display order-2 text-6xl font-black text-mute">VS</div>
      </div>
      {live && <div className="mx-auto mt-8 w-full max-w-sm"><MatchTimer minutes={t.settings.matchMinutes} compact /></div>}
    </motion.div>
  );
}

function MiniMatch({ t, m, inline = false }: { t: Tournament; m: Match; inline?: boolean }) {
  const byId = new Map(t.participants.map((p) => [p.id, p]));
  const done = m.status === "done";
  return (
    <div className={`flex items-center gap-3 ${inline ? "whitespace-nowrap px-2" : "rounded-lg bg-white/[0.03] px-3 py-2"}`}>
      {!inline && <span className="w-24 truncate text-xs text-mute">{m.label}</span>}
      <TeamCrest team={getTeam(t.assignments[m.homeId!])} size={24} />
      <span className="font-semibold">{byId.get(m.homeId!)?.name}</span>
      <span className="display num text-xl font-black text-neon">{done ? `${m.homeGoals ?? "–"} - ${m.awayGoals ?? "–"}` : "vs"}</span>
      <span className="font-semibold">{byId.get(m.awayId!)?.name}</span>
      <TeamCrest team={getTeam(t.assignments[m.awayId!])} size={24} />
    </div>
  );
}
