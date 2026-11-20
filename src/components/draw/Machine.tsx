"use client";

import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { Dices } from "lucide-react";
import { getTeam } from "@/lib/teams";
import { play } from "@/lib/sound";
import { prefersReducedMotion } from "@/lib/fx";
import { Button } from "@/components/ui/Button";
import { TeamCrest } from "@/components/ui/TeamCrest";
import type { DrawResult, StageProps } from "./types";

/** Tómbola: las bolas se agitan en el bombo y la ganadora sale por la boca. */
export function Machine({ pool, decide, onRevealed, busy, title = "Tómbola", buttonLabel = "Sortear bola" }: StageProps & { title?: string; buttonLabel?: string }) {
  const [frozen, setFrozen] = useState<string[] | null>(null);
  const [phase, setPhase] = useState<"idle" | "mixing" | "out">("idle");
  const [winner, setWinner] = useState<DrawResult | null>(null);
  const balls = frozen ?? pool;

  // Posiciones de reposo pseudoaleatorias pero estables por equipo.
  const rest = useMemo(() => {
    const out: Record<string, { x: number; y: number }> = {};
    balls.forEach((id, i) => {
      const angle = i * 2.399963; // ángulo áureo
      const r = 38 * Math.sqrt((i + 0.5) / balls.length);
      out[id] = { x: Math.cos(angle) * r, y: 18 + Math.abs(Math.sin(angle) * r) * 0.9 };
    });
    return out;
  }, [balls]);

  const start = () => {
    if (busy || phase !== "idle" || pool.length === 0) return;
    const snapshot = [...pool];
    const r = decide();
    if (!r) return;
    setFrozen(snapshot);
    setWinner(r);
    setPhase("mixing");
    play("whoosh");
    const reduced = prefersReducedMotion();
    setTimeout(() => {
      setPhase("out");
      play("goal");
    }, reduced ? 200 : 2600);
    setTimeout(() => {
      onRevealed(r);
      setPhase("idle");
      setWinner(null);
      setFrozen(null);
    }, reduced ? 500 : 3900);
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative aspect-square w-[min(84vw,400px)]">
        {/* Bombo */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-white/15 bg-[radial-gradient(circle_at_35%_30%,rgb(255_255_255/0.12),rgb(10_13_18/0.6)_60%)] shadow-[inset_0_0_60px_rgb(0_0_0/0.8),0_0_80px_-20px_rgb(47_155_255/0.5)]"
          animate={phase === "mixing" ? { rotate: [0, 8, -8, 6, -6, 0] } : { rotate: 0 }}
          transition={{ duration: 0.6, repeat: phase === "mixing" ? Infinity : 0 }}
        >
          <div className="absolute inset-[8%] rounded-full border border-dashed border-white/10" />
        </motion.div>
        {/* Boca de salida */}
        <div className="absolute -bottom-5 left-1/2 h-10 w-24 -translate-x-1/2 rounded-b-2xl border-2 border-t-0 border-white/15 bg-ink/80" />
        <div className="absolute inset-0 overflow-visible">
          {balls.map((id, i) => {
            const t = getTeam(id)!;
            const p = rest[id];
            const isWinner = winner?.teamId === id;
            const mixing = phase === "mixing";
            const out = phase === "out" && isWinner;
            return (
              <motion.div
                key={id}
                className="absolute left-1/2 top-1/2 grid size-12 -ml-6 -mt-6 place-items-center rounded-full border border-white/30 shadow-[inset_-4px_-6px_10px_rgb(0_0_0/0.35),0_6px_14px_rgb(0_0_0/0.5)]"
                style={{ background: `radial-gradient(circle at 32% 28%, white, ${t.colors[0]} 45%, ${t.colors[1]} 120%)`, zIndex: out ? 20 : 1 }}
                animate={
                  out
                    ? { x: 0, y: 230, scale: 2.2 }
                    : mixing
                      ? { x: [p.x * 2.4, rnd(i, 1), rnd(i, 2), rnd(i, 3), p.x * 2.4], y: [p.y * 2.4, rnd(i, 4), rnd(i, 5), rnd(i, 6), p.y * 2.4], rotate: [0, 180, 360, 540, 720] }
                      : { x: p.x * 2.4, y: p.y * 2.4, scale: 1 }
                }
                transition={out ? { type: "spring", stiffness: 90, damping: 12 } : mixing ? { duration: 1.3, repeat: Infinity, ease: "easeInOut", delay: (i % 5) * 0.05 } : { type: "spring", stiffness: 120, damping: 14 }}
                title={t.name}
              >
                <span className="display text-[0.7rem] font-black" style={{ color: "#05070a", textShadow: "0 0 3px white" }}>{t.short}</span>
              </motion.div>
            );
          })}
        </div>
        {phase === "out" && winner && (
          <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} className="absolute -bottom-24 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap">
            <TeamCrest team={getTeam(winner.teamId)} size={30} />
            <span className="display text-xl font-bold">{getTeam(winner.teamId)?.name}</span>
          </motion.div>
        )}
      </div>
      <div className="mt-8 text-xs uppercase tracking-widest text-mute">{title} · {pool.length} bolas</div>
      <Button size="lg" onClick={start} disabled={busy || phase !== "idle" || pool.length === 0}>
        <Dices className="size-5" /> {phase === "idle" ? buttonLabel : "Mezclando..."}
      </Button>
    </div>
  );
}

/** Desplazamientos deterministas por bola para la mezcla. */
function rnd(i: number, k: number) {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return ((v - Math.floor(v)) - 0.5) * 230;
}
