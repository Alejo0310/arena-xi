"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowRight, Disc3, Mail, Dices, LayoutGrid, Layers, Play, Plus, RotateCcw, Trophy, Users } from "lucide-react";
import { useTournament } from "@/store/tournament";
import { Button } from "@/components/ui/Button";
import { useHydrated } from "@/components/ui/bits";
import { confirmDialog } from "@/components/ui/feedback";
import { TeamCrest } from "@/components/ui/TeamCrest";
import { TEAMS } from "@/lib/teams";
import { phaseHref, PHASE_LABEL } from "@/lib/routes";

const MODES = [
  { icon: Disc3, name: "Ruleta", text: "La rueda gira, frena y anuncia tu club." },
  { icon: Mail, name: "Sobres", text: "Cartas misteriosas que se abren con estilo." },
  { icon: Dices, name: "Tómbola", text: "Bolas en el bombo y salida cinematográfica." },
  { icon: Layers, name: "Draft", text: "Tres opciones al azar, tú decides." },
  { icon: LayoutGrid, name: "Bombos", text: "Equipos del mismo nivel para un duelo justo." },
];

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
      <section className="relative pt-6 sm:pt-12">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="kicker flex items-center gap-2">
          <span className="size-1.5 animate-pulse-glow rounded-full bg-neon shadow-[0_0_10px_#3dff8b]" />
          EA SPORTS FC 25 · Torneos entre amigos
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="display mt-4 max-w-4xl text-[clamp(3rem,9vw,7.5rem)] font-black italic"
        >
          Sortea. Compite.
          <br />
          <span className="text-gradient">Levanta la copa.</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-6 max-w-xl text-lg text-soft">
          Ligas y eliminatorias con sorteos de equipos dignos de una gala: ruletas, sobres, tómbolas, draft y bombos.
          Resultados, tablas, llaves y estadísticas en tiempo real.
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
      </section>

      {/* Cinta de clubes */}
      <section aria-label="Clubes disponibles" className="relative -mx-4 overflow-hidden sm:-mx-6 [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
        <motion.div
          className="flex w-max gap-4 py-2"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 60, ease: "linear", repeat: Infinity }}
        >
          {marquee.map((t, i) => (
            <div key={`${t.id}-${i}`} className="glass flex items-center gap-3 px-4 py-2.5">
              <TeamCrest team={t} size={30} />
              <span className="whitespace-nowrap font-semibold">{t.name}</span>
              <span className="display text-xl font-extrabold text-neon">{t.ovr}</span>
            </div>
          ))}
        </motion.div>
      </section>

      <section>
        <div className="kicker mb-2">La estrella del show</div>
        <h2 className="display mb-6 text-4xl font-extrabold">5 formas de sortear equipos</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {MODES.map((m, i) => (
            <motion.div
              key={m.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              whileHover={{ y: -6 }}
              className="glass glass-hover group relative overflow-hidden p-5"
            >
              <div className="absolute inset-y-0 -left-1/2 w-1/3 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:animate-sweep group-hover:opacity-100" />
              <m.icon className="size-8 text-neon" />
              <h3 className="display mt-4 text-2xl font-bold">{m.name}</h3>
              <p className="mt-1 text-sm text-soft">{m.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

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
