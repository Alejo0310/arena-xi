"use client";

import { motion } from "motion/react";
import { useEffect } from "react";
import { Trophy, X } from "lucide-react";
import type { Tournament } from "@/lib/types";
import { getTeam } from "@/lib/teams";
import { TeamCrest } from "@/components/ui/TeamCrest";
import { championCelebration } from "@/lib/fx";
import { play } from "@/lib/sound";

export function ChampionOverlay({ t, onClose }: { t: Tournament; onClose: () => void }) {
  const p = t.participants.find((x) => x.id === t.championId);
  const team = getTeam(p && t.assignments[p.id]);

  useEffect(() => {
    play("champion");
    championCelebration(4500);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!p) return null;
  return (
    <motion.div className="fixed inset-0 z-[75] grid place-items-center overflow-hidden bg-ink/95 p-6 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} role="dialog" aria-modal="true" aria-label={`${p.name} es el campeón`}>
      <motion.div className="pointer-events-none absolute left-1/2 top-1/2 size-[160vmax] -translate-x-1/2 -translate-y-1/2" style={{ background: "repeating-conic-gradient(from 0deg, rgb(255 210 61 / 0.09) 0deg 5deg, transparent 5deg 15deg)" }} animate={{ rotate: 360 }} transition={{ duration: 60, repeat: Infinity, ease: "linear" }} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgb(255_210_61/0.25),transparent_55%)]" />
      <button onClick={onClose} className="absolute right-5 top-5 text-mute hover:text-white" aria-label="Cerrar"><X className="size-6" /></button>
      <div className="relative flex flex-col items-center text-center">
        <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 120, damping: 10, delay: 0.2 }}>
          <Trophy className="size-28 text-gold drop-shadow-[0_0_40px_rgb(255_210_61/0.8)]" strokeWidth={1.4} />
        </motion.div>
        <motion.div initial={{ opacity: 0, letterSpacing: "1em" }} animate={{ opacity: 1, letterSpacing: "0.35em" }} transition={{ delay: 0.6, duration: 0.8 }} className="kicker mt-6 !text-base !text-gold">
          Campeón · {t.name}
        </motion.div>
        <motion.h2 initial={{ opacity: 0, scale: 1.6, filter: "blur(12px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} transition={{ delay: 0.9, duration: 0.7 }} className="display text-gold mt-3 text-7xl font-black italic sm:text-9xl">
          {p.name}
        </motion.h2>
        {team && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4 }} className="mt-6 flex items-center gap-3">
            <TeamCrest team={team} size={56} />
            <span className="display text-3xl font-bold">{team.name}</span>
          </motion.div>
        )}
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }} className="mt-10 text-sm text-mute">Toca para continuar</motion.p>
      </div>
    </motion.div>
  );
}

export function ChampionBanner({ t, onReplay }: { t: Tournament; onReplay: () => void }) {
  const p = t.participants.find((x) => x.id === t.championId);
  if (!p) return null;
  const team = getTeam(t.assignments[p.id]);
  return (
    <motion.button onClick={onReplay} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative flex w-full items-center gap-5 overflow-hidden rounded-2xl border border-gold/50 bg-gradient-to-r from-gold/20 via-gold/5 to-transparent p-5 text-left shadow-[0_0_60px_-20px_#ffd23d]" aria-label="Repetir celebración del campeón">
      <div className="absolute inset-y-0 -left-1/2 w-1/3 animate-sweep bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <Trophy className="size-12 shrink-0 text-gold" />
      <div className="min-w-0 flex-1">
        <div className="kicker !text-gold">Campeón del torneo</div>
        <div className="display text-gold truncate text-5xl font-black italic">{p.name}</div>
        {team && <div className="text-soft">{team.name}</div>}
      </div>
      <TeamCrest team={team} size={64} />
    </motion.button>
  );
}
