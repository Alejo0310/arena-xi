"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { LayoutGrid } from "lucide-react";
import { getTeam } from "@/lib/teams";
import { play } from "@/lib/sound";
import { prefersReducedMotion } from "@/lib/fx";
import { Button } from "@/components/ui/Button";
import { TeamCrest } from "@/components/ui/TeamCrest";
import type { StageProps } from "./types";

/**
 * Bombos: los equipos se agrupan por valoración y todos los participantes
 * reciben un club del mismo bombo, para que nadie tenga ventaja excesiva.
 */
export function Pots({ pots, potIndex, canChangePot, onSelectPot, pool, decide, onRevealed, busy }: StageProps & { pots: string[][]; potIndex: number; canChangePot: boolean; onSelectPot: (i: number) => void }) {
  const [frozen, setFrozen] = useState<string[] | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const potTeams = pots[potIndex] ?? [];
  const available = new Set(frozen ?? pool);

  const run = () => {
    if (busy || running || pool.length === 0) return;
    const snapshot = [...pool];
    const r = decide();
    if (!r) return;
    setFrozen(snapshot);
    setRunning(true);
    // Recorrido que desacelera y termina en el equipo ya sorteado.
    const steps = prefersReducedMotion() ? 1 : 22 + snapshot.length;
    const seq = Array.from({ length: steps - 1 }, (_, k) => snapshot[(k * 7 + 3) % snapshot.length]);
    seq.push(r.teamId);
    let k = 0;
    const tick = () => {
      setHighlight(seq[k]);
      play("tick");
      k++;
      if (k < seq.length) setTimeout(tick, 50 + (k / seq.length) ** 3 * 380);
      else
        setTimeout(() => {
          setRunning(false);
          setHighlight(null);
          setFrozen(null);
          onRevealed(r);
        }, 600);
    };
    tick();
  };

  return (
    <div className="w-full">
      <div className="mb-5 flex flex-wrap justify-center gap-2" role="tablist" aria-label="Bombos">
        {pots.map((p, i) => {
          const ratings = p.map((id) => getTeam(id)!.ovr);
          return (
            <button
              key={i}
              role="tab"
              aria-selected={i === potIndex}
              disabled={!canChangePot && i !== potIndex}
              onClick={() => onSelectPot(i)}
              className={`rounded-xl border px-4 py-2 text-left transition-colors disabled:opacity-30 ${i === potIndex ? "border-neon bg-neon/10" : "border-line hover:border-white/30"}`}
            >
              <div className="display text-lg font-bold">Bombo {i + 1}</div>
              <div className="num text-xs text-mute">OVR {Math.min(...ratings)}–{Math.max(...ratings)} · {p.length} clubes</div>
            </button>
          );
        })}
      </div>
      {canChangePot && pots.length > 1 && <p className="mb-4 text-center text-xs text-mute">Elige de qué bombo se sortea antes de la primera asignación. Todos recibirán un club de ese nivel.</p>}

      <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {potTeams.map((id) => {
          const t = getTeam(id)!;
          const on = highlight === id;
          const gone = !available.has(id);
          return (
            <motion.div
              key={id}
              animate={{ scale: on ? 1.08 : 1, opacity: gone ? 0.25 : 1 }}
              transition={{ duration: 0.08 }}
              className={`flex items-center gap-2 rounded-xl border p-3 ${on ? "border-gold bg-gold/15 shadow-[0_0_30px_-6px_#ffd23d]" : "border-line bg-ink/40"}`}
            >
              <TeamCrest team={t} size={34} />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{t.name}</div>
                <div className="num text-xs text-neon">{t.ovr}</div>
              </div>
            </motion.div>
          );
        })}
      </div>
      <div className="mt-6 flex justify-center">
        <Button size="lg" onClick={run} disabled={busy || running || pool.length === 0}>
          <LayoutGrid className="size-5" /> {running ? "Sorteando..." : "Sortear del bombo"}
        </Button>
      </div>
    </div>
  );
}
