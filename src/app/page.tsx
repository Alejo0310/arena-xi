"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowRight, Play, Plus, RotateCcw, Trophy, Users } from "lucide-react";
import { useTournament } from "@/store/tournament";
import { Button } from "@/components/ui/Button";
import { useHydrated } from "@/components/ui/bits";
import { confirmDialog } from "@/components/ui/feedback";
import { TeamCrest } from "@/components/ui/TeamCrest";
import { TEAMS, fmtRating } from "@/lib/teams";
import { phaseHref, PHASE_LABEL } from "@/lib/routes";
import { HeroVisual } from "@/components/hero/HeroVisual";
import { DrawSimulations } from "@/components/home/DrawSimulations";

export default function HomePage() {
  const hydrated = useHydrated();
  const current = useTournament((s) => s.current);
  const newTournament = useTournament((s) => s.newTournament);
  const router = useRouter();

  const startNew = async (keep = false) => {
    if (current && current.phase !== "setup" && current.phase !== "finished") {
      const ok = await confirmDialog({
        title: "¿Empezar un torneo nuevo?",
        body: `"${current.name}" quedará guardado en el historial y podrás retomarlo cuando quieras.`,
        confirmLabel: "Nuevo torneo",
      });
      if (!ok) return;
    }
    newTournament({ keepParticipants: keep });
    router.push("/nuevo");
  };

  const showContinue = hydrated && current && (current.phase !== "setup" || current.participants.length > 0);
  const marquee = [...TEAMS, ...TEAMS];

  return (
    <div className="space-y-16">
      <section className="relative grid items-center gap-6 pt-6 sm:pt-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-4">
        <div className="min-w-0">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="kicker flex items-center gap-2">
          <span className="size-1.5 animate-pulse-glow rounded-full bg-neon shadow-[0_0_10px_#3dff8b]" />
          ARENA XI · Torneos de EA SPORTS FC 25, 26 y 27
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="display mt-4 max-w-4xl text-[clamp(3.6rem,12vw,8.5rem)] font-black italic"
        >
          ARENA <span className="text-gradient">XI</span>
          <span className="mt-3 block text-[clamp(1.8rem,5vw,3.6rem)] text-soft">Que gane el mejor.</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-6 max-w-xl text-lg text-soft">
          Ligas y eliminatorias de clubes o selecciones, con sorteos de equipos dignos de una gala: ruletas, sobres,
          tómbolas, draft y bombos. Resultados, tablas, llaves y estadísticas en tiempo real.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mt-9 flex flex-wrap gap-3">
          {showContinue && current ? (
            <>
              <Link href={phaseHref(current.phase)}>
                <Button size="lg">
                  <Play className="size-5" /> Continuar torneo
                </Button>
              </Link>
              <Button size="lg" variant="secondary" onClick={() => startNew()}>
                <Plus className="size-5" /> Nuevo torneo
              </Button>
            </>
          ) : (
            <Button size="lg" onClick={() => startNew()}>
              <Plus className="size-5" /> Crear torneo
            </Button>
          )}
          <Link href="/equipos">
            <Button size="lg" variant="ghost">
              Ver equipos <ArrowRight className="size-5" />
            </Button>
          </Link>
        </motion.div>

        {showContinue && current && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass glass-hover mt-10 flex max-w-2xl flex-wrap items-center gap-4 p-5">
            <div className="grid size-12 place-items-center rounded-xl bg-neon/10 text-neon">
              <Trophy className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs uppercase tracking-widest text-mute">Torneo guardado · {PHASE_LABEL[current.phase]}</div>
              <div className="display truncate text-2xl font-bold">{current.name}</div>
              <div className="flex items-center gap-3 text-sm text-soft">
                <span className="flex items-center gap-1"><Users className="size-4" /> {current.participants.length}</span>
                <span>{current.settings.format === "league" ? "Liga" : "Eliminatorias"}</span>
                <span>{current.matches.filter((m) => m.status === "done" && !m.isBye).length} partidos jugados</span>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => startNew(true)} title="Nuevo torneo con los mismos participantes">
              <RotateCcw className="size-4" /> Revancha
            </Button>
          </motion.div>
        )}
        </div>

        {/* Elemento protagonista: núcleo de sorteo 3D (con versión CSS de respaldo) */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25, duration: 0.8 }} className="min-w-0">
          <HeroVisual />
        </motion.div>
      </section>

      {/* Cinta de clubes */}
      <section aria-label="Clubes disponibles" className="relative -mx-4 overflow-hidden sm:-mx-6 [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
        <div className="flex w-max animate-marquee gap-4 py-2 will-change-transform">
          {marquee.map((t, i) => (
            <div key={`${t.id}-${i}`} className="glass flex items-center gap-3 px-4 py-2.5">
              <TeamCrest team={t} size={30} />
              <span className="whitespace-nowrap font-semibold">{t.name}</span>
              <span className="display text-xl font-extrabold text-neon">{fmtRating(t.ovr)}</span>
            </div>
          ))}
        </div>
      </section>

      <DrawSimulations />

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { n: "01", t: "Configura", d: "Participantes, liga o eliminatorias, reglas y equipos del sorteo." },
          { n: "02", t: "Sortea", d: "Cada jugador recibe su club con una revelación cinematográfica." },
          { n: "03", t: "Compite", d: "Registra marcadores; tablas, llaves y estadísticas se actualizan solas." },
        ].map((s, i) => (
          <motion.div key={s.n} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="glass p-6">
            <div className="display text-6xl font-black text-white/10">{s.n}</div>
            <h3 className="display -mt-4 text-3xl font-extrabold">{s.t}</h3>
            <p className="mt-2 text-soft">{s.d}</p>
          </motion.div>
        ))}
      </section>
    </div>
  );
}
