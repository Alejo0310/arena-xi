"use client";

import { useAnimate } from "motion/react";
import { useMemo } from "react";
import { Dices } from "lucide-react";
import { getTeam } from "@/lib/teams";
import { play } from "@/lib/sound";
import { prefersReducedMotion } from "@/lib/fx";
import { Button } from "@/components/ui/Button";
import { useSpinAnimation, type StageProps } from "./types";

/** Tómbola: las bolas se agitan en el bombo y la ya sorteada sale por la boca. */
export default function Machine(props: StageProps) {
  const { pool, phase, locked, actionLabel, onStart } = props;
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const spinning = phase === "spinning";

  // Posiciones de reposo estables (espiral áurea), en píxeles desde el centro.
  const rest = useMemo(() => {
    const out: Record<string, { x: number; y: number }> = {};
    pool.forEach((id, i) => {
      const angle = i * 2.399963;
      const r = 38 * Math.sqrt((i + 0.5) / pool.length);
      out[id] = { x: Math.cos(angle) * r * 2.4, y: (18 + Math.abs(Math.sin(angle) * r) * 0.9) * 2.4 };
    });
    return out;
  }, [pool]);

  useSpinAnimation(props, async (pick) => {
    const root = scope.current;
    if (!root) return;
    const reduced = prefersReducedMotion();
    play("whoosh");
    const balls = [...root.querySelectorAll<HTMLElement>("[data-ball]")];
    if (!reduced) {
      // Mezcla con duración finita: la promesa se resuelve cuando todas las bolas paran.
      await Promise.all(
        balls.map((el, i) =>
          animate(
            el,
            { x: [0, jitter(i, 1), jitter(i, 2), jitter(i, 3), jitter(i, 4), 0], y: [0, jitter(i, 5), jitter(i, 6), jitter(i, 7), jitter(i, 8), 0], rotate: [0, 720] },
            { duration: 2.4, ease: "easeInOut" },
          ),
        ),
      );
    }
    const winner = root.querySelector<HTMLElement>(`[data-ball="${pick.teamId}"]`);
    const p = rest[pick.teamId];
    if (winner && p) {
      play("goal");
      await animate(winner, { x: -p.x, y: 230 - p.y, scale: 2.2, zIndex: 20 }, reduced ? { duration: 0.01 } : { type: "spring", stiffness: 90, damping: 12 });
    }
  });

  return (
    <div className="flex flex-col items-center gap-6">
      <div ref={scope} className="relative aspect-square w-[min(84vw,400px)]">
        <div className="absolute inset-0 rounded-full border-2 border-white/15 bg-[radial-gradient(circle_at_35%_30%,rgb(255_255_255/0.12),rgb(10_13_18/0.6)_60%)] shadow-[inset_0_0_60px_rgb(0_0_0/0.8)]">
          <div className="absolute inset-[8%] rounded-full border border-dashed border-white/10" />
        </div>
        <div className="absolute -bottom-5 left-1/2 h-10 w-24 -translate-x-1/2 rounded-b-2xl border-2 border-t-0 border-white/15 bg-ink/80" />
        {pool.map((id) => {
          const t = getTeam(id)!;
          const p = rest[id];
          return (
            <div
              key={id}
              data-ball={id}
              className="absolute grid size-12 place-items-center rounded-full border border-white/30 shadow-[inset_-4px_-6px_10px_rgb(0_0_0/0.35)] will-change-transform"
              style={{ left: `calc(50% + ${p.x}px - 24px)`, top: `calc(50% + ${p.y}px - 24px)`, background: `radial-gradient(circle at 32% 28%, white, ${t.colors[0]} 45%, ${t.colors[1]} 120%)` }}
              title={t.name}
            >
              <span className="display text-[0.7rem] font-black" style={{ color: "#05070a", textShadow: "0 0 3px white" }}>{t.short}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-8 text-xs uppercase tracking-widest text-mute">Tómbola · {pool.length} bolas</div>
      <Button size="lg" onClick={() => onStart()} disabled={locked || pool.length === 0} data-testid="draw-action">
        <Dices className="size-5" /> {spinning ? "Mezclando..." : actionLabel}
      </Button>
    </div>
  );
}

/** Desplazamientos deterministas por bola para la mezcla. */
function jitter(i: number, k: number) {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return (v - Math.floor(v) - 0.5) * 200;
}
