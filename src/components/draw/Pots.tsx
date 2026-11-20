"use client";

import { animate } from "motion/react";
import { useState } from "react";
import { LayoutGrid } from "lucide-react";
import { getTeam } from "@/lib/teams";
import { play } from "@/lib/sound";
import { prefersReducedMotion } from "@/lib/fx";
import { Button } from "@/components/ui/Button";
import { TeamCrest } from "@/components/ui/TeamCrest";
import { useSpinAnimation, type StageProps } from "./types";

/**
 * Bombos: los equipos se agrupan por valoración y todos los participantes
 * reciben un equipo del mismo bombo, para que nadie tenga ventaja excesiva.
 */
export default function Pots(props: StageProps & { pots: string[][]; potIndex: number; canChangePot: boolean; onSelectPot: (i: number) => void }) {
  const { pots, potIndex, canChangePot, onSelectPot, pool, phase, locked, actionLabel, onStart } = props;
  const [highlight, setHighlight] = useState<string | null>(null);
  const potTeams = pots[potIndex] ?? [];
  const available = new Set(pool);
  const spinning = phase === "spinning";

  // El resaltado recorre el bombo y se detiene en el equipo ya sorteado.
  // Lo conduce una animación de Motion (con easing) y su promesa marca el final.
  useSpinAnimation(props, async (pick) => {
    const seq = [...pool];
    if (!seq.length) return;
    const reduced = prefersReducedMotion();
    const target = Math.max(0, seq.indexOf(pick.teamId));
    const steps = reduced ? target : seq.length * 3 + target;
    let last = -1;
    await animate(0, steps, {
      duration: reduced ? 0.2 : 3.2,
      ease: [0.1, 0.6, 0.3, 1],
      onUpdate: (v) => {
        const k = Math.round(v);
        if (k !== last) {
          last = k;
          setHighlight(seq[k % seq.length]);
          play("tick");
        }
      },
    });
    setHighlight(pick.teamId);
  });

  const shown = spinning || phase === "revealing" || phase === "assigned" ? highlight : null;

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
              <div className="num text-xs text-mute">OVR {Math.min(...ratings)}–{Math.max(...ratings)} · {p.length} equipos</div>
            </button>
          );
        })}
      </div>
      {canChangePot && pots.length > 1 && <p className="mb-4 text-center text-xs text-mute">Elige de qué bombo se sortea antes de la primera asignación. Todos recibirán un equipo de ese nivel.</p>}

      <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {potTeams.map((id) => {
          const t = getTeam(id)!;
          const on = shown === id;
          const gone = !available.has(id);
          return (
            <div
              key={id}
              className={`flex items-center gap-2 rounded-xl border p-3 transition-[transform,opacity,border-color,background-color] duration-100 ${on ? "scale-105 border-gold bg-gold/15" : "border-line bg-ink/40"} ${gone ? "opacity-25" : ""}`}
            >
              <TeamCrest team={t} size={34} />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{t.name}</div>
                <div className="num text-xs text-neon">{t.ovr}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-6 flex justify-center">
        <Button size="lg" onClick={() => onStart()} disabled={locked || pool.length === 0} data-testid="draw-action">
          <LayoutGrid className="size-5" /> {spinning ? "Sorteando..." : actionLabel}
        </Button>
      </div>
    </div>
  );
}
