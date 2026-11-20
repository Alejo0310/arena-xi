"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Dices, Disc3, LayoutGrid, Layers, Mail, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DraftSim, EnvelopesSim, MachineSim, PotsSim, RouletteSim, type SimProps } from "./sims";
import { useDemoTeams } from "./useDemoTeams";

type Mode = "roulette" | "envelopes" | "machine" | "draft" | "pots";

const MODES: { id: Mode; icon: typeof Disc3; name: string; text: string; how: string; Sim: (p: SimProps) => React.ReactNode }[] = [
  { id: "roulette", icon: Disc3, name: "Ruleta", text: "La rueda gira, frena y anuncia tu club.", how: "Cada equipo ocupa un sector. La rueda gira, desacelera y se detiene sobre el equipo sorteado: el sector bajo el puntero es siempre el resultado.", Sim: RouletteSim },
  { id: "envelopes", icon: Mail, name: "Sobres", text: "Cartas misteriosas que se abren con estilo.", how: "Cada sobre esconde un equipo distinto. Elige uno, ábrelo y descubre tu club.", Sim: EnvelopesSim },
  { id: "machine", icon: Dices, name: "Tómbola", text: "Bolas en el bombo y salida cinematográfica.", how: "Las bolas se mezclan en la máquina y una sale por la boca de extracción. Cada bola corresponde a un equipo.", Sim: MachineSim },
  { id: "draft", icon: Layers, name: "Draft", text: "Tres opciones al azar, tú decides.", how: "Se te presentan tres equipos al azar con su valoración. Tú eliges con cuál te quedas.", Sim: DraftSim },
  { id: "pots", icon: LayoutGrid, name: "Bombos", text: "Equipos del mismo nivel para un duelo justo.", how: "Los equipos se agrupan por valoración en bombos de nivel similar. Se extrae un equipo de dos bombos distintos para formar un enfrentamiento.", Sim: PotsSim },
];

/** “5 formas de sortear equipos”: tarjetas que despliegan una demostración interactiva e independiente de los torneos reales. */
export function DrawSimulations() {
  const [active, setActive] = useState<Mode | null>(null);
  const [run, setRun] = useState(0); // cambiar la clave desmonta la demostración y la reinicia
  const demo = useDemoTeams();
  const mode = MODES.find((m) => m.id === active);

  const select = (id: Mode) => {
    setActive((cur) => (cur === id ? cur : id));
    setRun((r) => r + 1);
  };

  return (
    <section id="sorteos" className="scroll-mt-24" aria-labelledby="sorteos-title">
      <div className="kicker mb-2">La estrella del show</div>
      <h2 id="sorteos-title" className="display mb-6 text-4xl font-extrabold">5 formas de sortear equipos</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5" role="group" aria-label="Modalidades de sorteo">
        {MODES.map((m, i) => {
          const on = m.id === active;
          return (
            <motion.button
              key={m.id}
              type="button"
              data-sim-card={m.id}
              aria-expanded={on}
              aria-controls="sim-panel"
              onClick={() => select(m.id)}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              whileHover={{ y: -6 }}
              className={`glass glass-hover group relative overflow-hidden p-5 text-left ${on ? "!border-neon shadow-[0_0_40px_-12px_#3dff8b]" : ""}`}
            >
              <div className="absolute inset-y-0 -left-1/2 w-1/3 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:animate-sweep group-hover:opacity-100" />
              <m.icon className="size-8 text-neon" />
              <h3 className="display mt-4 text-2xl font-bold">{m.name}</h3>
              <p className="mt-1 text-sm text-soft">{m.text}</p>
              <span className={`mt-3 inline-block text-xs font-bold uppercase tracking-widest ${on ? "text-neon" : "text-mute group-hover:text-neon"}`}>{on ? "Demostración abierta" : "Ver demostración"}</span>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence initial={false} mode="wait">
        {mode && (
          <motion.div
            key={mode.id}
            id="sim-panel"
            role="region"
            aria-label={`Demostración de ${mode.name}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
            data-testid="sim-panel"
          >
            <div className="glass mt-4 border-neon/30 p-5 sm:p-7">
              <div className="mb-5 flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="kicker">Demostración · no afecta a ningún torneo</div>
                  <h3 className="display text-3xl font-extrabold">{mode.name}</h3>
                  <p className="mt-1 max-w-2xl text-sm text-soft">{mode.how}</p>
                  <p className="mt-2 inline-block rounded-md bg-white/5 px-2 py-1 text-xs text-mute" data-testid="sim-data-label">{mode.id === "pots" ? demo.potsLabel : demo.label}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setRun((r) => r + 1)} data-testid="sim-repeat"><RotateCcw className="size-4" /> Repetir</Button>
                  <Button variant="ghost" size="sm" onClick={() => setActive(null)} aria-label="Cerrar demostración" data-testid="sim-close"><X className="size-4" /> Cerrar</Button>
                </div>
              </div>
              <mode.Sim key={`${mode.id}-${run}-${demo.edition}`} teams={demo.pool} rated={demo.potsPool} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
