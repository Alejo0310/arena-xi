"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { getTeam } from "@/lib/teams";
import { TeamCrest } from "@/components/ui/TeamCrest";
import { RatingBar } from "@/components/ui/bits";
import type { StageProps } from "./types";

/** Draft: se reparten opciones al azar y el participante elige una carta. */
export function Draft({ options, decide, onRevealed, busy }: Omit<StageProps, "pool"> & { options: string[] }) {
  const [picked, setPicked] = useState<string | null>(null);
  // Congela las cartas mientras se anima la elección (el store ya repartió las siguientes).
  const [frozen, setFrozen] = useState<string[] | null>(null);
  const shown = frozen ?? options;

  const choose = (teamId: string) => {
    if (busy || picked) return;
    const r = decide({ teamId });
    if (!r) return;
    setFrozen(options);
    setPicked(teamId);
    setTimeout(() => {
      onRevealed(r);
      setPicked(null);
      setFrozen(null);
    }, 900);
  };

  return (
    <div className="w-full">
      <p className="mb-6 text-center text-soft">Se han repartido {shown.length} cartas al azar. Elige tu club: las demás vuelven al mazo.</p>
      <div className="mx-auto flex max-w-4xl flex-wrap justify-center gap-4">
        <AnimatePresence mode="popLayout">
          {shown.map((id, i) => {
            const t = getTeam(id)!;
            const isPicked = picked === id;
            const dimmed = picked && !isPicked;
            return (
              <motion.button
                key={`${id}-${shown.join()}`}
                layout
                onClick={() => choose(id)}
                disabled={busy || !!picked}
                initial={{ opacity: 0, y: -80, rotateY: 180, rotate: (i - 1) * 8 }}
                animate={{ opacity: dimmed ? 0.25 : 1, y: isPicked ? -16 : 0, rotateY: 0, rotate: 0, scale: isPicked ? 1.08 : dimmed ? 0.92 : 1 }}
                exit={{ opacity: 0, y: 60 }}
                transition={{ delay: picked ? 0 : 0.15 + i * 0.15, type: "spring", stiffness: 120, damping: 15 }}
                whileHover={!picked ? { y: -10, rotate: (i - 1) * 2 } : undefined}
                className="relative w-[200px] overflow-hidden rounded-2xl border-2 p-5 text-left [perspective:800px]"
                style={{ borderColor: isPicked ? "#ffd23d" : `${t.colors[0]}88`, background: `linear-gradient(160deg, ${t.colors[0]}33, #0b0e13 55%)` }}
                aria-label={`Elegir ${t.name}, media ${t.ovr}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="display text-5xl font-black leading-none">{t.ovr}</div>
                    <div className="text-[0.6rem] font-bold uppercase tracking-widest text-mute">Media</div>
                  </div>
                  <TeamCrest team={t} size={52} />
                </div>
                <div className="display mt-6 text-2xl font-extrabold leading-tight">{t.name}</div>
                <div className="mb-4 text-xs text-mute">{t.league}</div>
                <div className="space-y-1.5">
                  <RatingBar label="ATQ" value={t.att} color="bg-blaze" />
                  <RatingBar label="MED" value={t.mid} color="bg-volt" />
                  <RatingBar label="DEF" value={t.def} color="bg-neon" />
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
