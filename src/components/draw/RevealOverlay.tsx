"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { ChevronRight, SkipForward } from "lucide-react";
import type { Participant, Team } from "@/lib/types";
import { TeamCrest } from "@/components/ui/TeamCrest";
import { PlayerDot, RatingBar } from "@/components/ui/bits";
import { burst } from "@/lib/fx";
import { play } from "@/lib/sound";

export interface RevealItem {
  participant: Participant;
  team: Team;
}

/**
 * Presentación cinematográfica de uno o varios participantes con su equipo.
 * Con `autoMs` avanza sola (presentación de plantillas / sorteo completo).
 */
export function RevealOverlay({ items, onClose, autoMs }: { items: RevealItem[]; onClose: () => void; autoMs?: number }) {
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<"intro" | "reveal">("intro");
  const item = items[index];
  const last = index >= items.length - 1;

  useEffect(() => {
    setStage("intro");
    const t = setTimeout(() => {
      setStage("reveal");
      play("reveal");
      burst([item.team.colors[0], item.team.colors[1], "#3dff8b", "#ffffff"]);
    }, autoMs ? 650 : 1100);
    return () => clearTimeout(t);
  }, [index, item, autoMs]);

  const next = () => (last ? onClose() : setIndex((i) => i + 1));

  useEffect(() => {
    if (!autoMs || stage !== "reveal") return;
    const t = setTimeout(next, autoMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, autoMs, index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if ((e.key === "Enter" || e.key === " ") && stage === "reveal") {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, index]);

  const [c1, c2] = item.team.colors;

  return (
    <motion.div
      className="fixed inset-0 z-[70] grid place-items-center overflow-hidden bg-ink/95 p-4 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={`${item.participant.name} recibe ${item.team.name}`}
      onClick={() => stage === "reveal" && next()}
    >
      {/* Haces de luz */}
      <motion.div
        key={`beams-${index}`}
        className="pointer-events-none absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: stage === "reveal" ? 1 : 0.35 }}
        transition={{ duration: 0.8 }}
        style={{ background: `radial-gradient(circle at 50% 45%, ${c1}55, transparent 45%), conic-gradient(from 0deg at 50% 45%, transparent, ${c2}22, transparent 12%, ${c1}22, transparent 25%, ${c2}22, transparent 40%)` }}
      />
      <motion.div
        className="pointer-events-none absolute left-1/2 top-[45%] size-[140vmax] -translate-x-1/2 -translate-y-1/2 opacity-30"
        style={{ background: `repeating-conic-gradient(from 0deg, ${c1}18 0deg 6deg, transparent 6deg 18deg)` }}
        animate={{ rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
      />

      <div className="relative flex w-full max-w-2xl flex-col items-center text-center">
        <AnimatePresence mode="wait">
          <motion.div key={`who-${index}`} initial={{ opacity: 0, y: -30, letterSpacing: "0.6em" }} animate={{ opacity: 1, y: 0, letterSpacing: "0.25em" }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }} className="kicker !text-sm">
            {items.length > 1 ? `${index + 1} / ${items.length} · ` : ""}Turno de
          </motion.div>
        </AnimatePresence>
        <motion.div key={`name-${index}`} initial={{ opacity: 0, scale: 1.4, filter: "blur(10px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} transition={{ duration: 0.55 }} className="mt-2 flex items-center gap-3">
          <PlayerDot color={item.participant.color} size={16} />
          <span className="display text-5xl font-black italic sm:text-7xl">{item.participant.name}</span>
        </motion.div>

        <div className="mt-8 grid h-[min(56vh,420px)] w-full place-items-center">
          <AnimatePresence mode="wait">
            {stage === "intro" ? (
              <motion.div key="q" className="relative grid size-48 place-items-center" exit={{ scale: 0, opacity: 0 }}>
                <motion.div className="absolute inset-0 rounded-full border-2 border-dashed border-neon/50" animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} />
                <motion.span className="display text-8xl font-black text-neon" animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 0.6, repeat: Infinity }}>?</motion.span>
              </motion.div>
            ) : (
              <motion.div key={`team-${index}`} className="flex flex-col items-center" initial="h" animate="s">
                <motion.div
                  variants={{ h: { scale: 0, rotateY: 180, opacity: 0 }, s: { scale: 1, rotateY: 0, opacity: 1 } }}
                  transition={{ type: "spring", stiffness: 140, damping: 13 }}
                  className="relative"
                >
                  <div className="absolute inset-0 -z-10 scale-150 rounded-full blur-3xl" style={{ background: c1, opacity: 0.45 }} />
                  <TeamCrest team={item.team} size={170} />
                </motion.div>
                <motion.h2 variants={{ h: { opacity: 0, y: 20 }, s: { opacity: 1, y: 0 } }} transition={{ delay: 0.25 }} className="display mt-6 text-5xl font-black sm:text-6xl">
                  {item.team.name}
                </motion.h2>
                {item.team.realName && <motion.div variants={{ h: { opacity: 0 }, s: { opacity: 1 } }} transition={{ delay: 0.35 }} className="text-sm text-mute">{item.team.realName}</motion.div>}
                <motion.div variants={{ h: { opacity: 0, y: 20 }, s: { opacity: 1, y: 0 } }} transition={{ delay: 0.45 }} className="mt-5 flex w-full max-w-sm items-center gap-5">
                  <div>
                    <div className="display text-6xl font-black text-neon">{item.team.ovr}</div>
                    <div className="text-[0.65rem] font-bold uppercase tracking-widest text-mute">Media</div>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <RatingBar label="ATQ" value={item.team.att} color="bg-blaze" />
                    <RatingBar label="MED" value={item.team.mid} color="bg-volt" />
                    <RatingBar label="DEF" value={item.team.def} color="bg-neon" />
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-4 flex h-12 items-center gap-3">
          {stage === "reveal" && (
            <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} onClick={(e) => { e.stopPropagation(); next(); }} className="flex items-center gap-2 rounded-lg bg-white/10 px-5 py-3 font-display font-bold uppercase tracking-wider hover:bg-white/20" autoFocus>
              {last ? "Continuar" : "Siguiente"} <ChevronRight className="size-5" />
            </motion.button>
          )}
          {items.length > 1 && !last && (
            <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="flex items-center gap-1 text-sm text-mute hover:text-white">
              <SkipForward className="size-4" /> Saltar
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
