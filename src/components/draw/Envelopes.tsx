"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { getTeam } from "@/lib/teams";
import { play } from "@/lib/sound";
import { TeamCrest } from "@/components/ui/TeamCrest";
import type { Participant } from "@/lib/types";
import type { StageProps } from "./types";

/**
 * Sobres: el contenido de cada sobre quedó fijado al barajar (initDraw).
 * Elegir un sobre no cambia probabilidades; solo decide cuál se abre.
 */
export function Envelopes({ envelopes, owners, decide, onRevealed, busy, participants }: Omit<StageProps, "pool"> & { envelopes: (string | null)[]; owners: Record<number, string>; participants: Participant[] }) {
  const [opening, setOpening] = useState<number | null>(null);
  const [revealTeam, setRevealTeam] = useState<string | null>(null);

  const open = (i: number) => {
    if (busy || opening !== null || envelopes[i] === null) return;
    const r = decide({ envelopeIndex: i });
    if (!r) return;
    setOpening(i);
    setRevealTeam(r.teamId);
    play("whoosh");
    setTimeout(() => {
      onRevealed(r);
      setOpening(null);
      setRevealTeam(null);
    }, 1500);
  };

  return (
    <div className="w-full">
      <p className="mb-5 text-center text-soft">Elige un sobre. Cada uno esconde un club distinto, sellado antes de empezar.</p>
      <div className="mx-auto grid max-w-3xl grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        {envelopes.map((teamId, i) => {
          const isOpening = opening === i;
          const opened = teamId === null && !isOpening;
          const owner = participants.find((p) => p.id === owners[i]);
          const shownTeam = isOpening ? revealTeam : null;
          return (
            <motion.button
              key={i}
              onClick={() => open(i)}
              disabled={busy || opened || opening !== null}
              initial={{ opacity: 0, y: 30, rotate: -6 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={{ delay: i * 0.04 }}
              whileHover={!opened ? { y: -8, rotate: i % 2 ? 2 : -2 } : undefined}
              whileTap={!opened ? { scale: 0.95 } : undefined}
              className="group relative aspect-[3/4] [perspective:800px] disabled:cursor-default"
              aria-label={opened ? `Sobre ${i + 1}, ya abierto${owner ? ` por ${owner.name}` : ""}` : `Abrir sobre ${i + 1}`}
            >
              <motion.div
                className="relative size-full [transform-style:preserve-3d]"
                animate={{ rotateY: isOpening ? 180 : 0, scale: isOpening ? 1.12 : 1 }}
                transition={{ duration: 0.7, delay: isOpening ? 0.35 : 0 }}
              >
                {/* Frente: sobre cerrado */}
                <div className={`absolute inset-0 overflow-hidden rounded-xl border [backface-visibility:hidden] ${opened ? "border-line bg-graphite/40 opacity-40" : "border-neon/30 bg-gradient-to-br from-slate via-graphite to-ink shadow-[0_10px_30px_-10px_rgb(61_255_139/0.4)]"}`}>
                  <svg viewBox="0 0 100 133" className="absolute inset-0 size-full" aria-hidden>
                    <motion.path d="M0 0 L50 48 L100 0" fill="none" stroke={opened ? "#333" : "#3dff8b"} strokeOpacity="0.5" strokeWidth="1.5" animate={isOpening ? { d: "M0 0 L50 -40 L100 0" } : undefined} transition={{ duration: 0.35 }} />
                  </svg>
                  <div className="absolute inset-0 grid place-items-center">
                    {opened ? (
                      <span className="px-1 text-center text-[0.7rem] font-semibold text-mute">{owner?.name ?? "Abierto"}</span>
                    ) : (
                      <span className="display text-4xl font-black text-white/80 group-hover:text-neon">{i + 1}</span>
                    )}
                  </div>
                  {!opened && <div className="absolute inset-y-0 -left-1/2 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-sweep" style={{ animationDelay: `${i * 0.3}s` }} />}
                </div>
                {/* Reverso: equipo */}
                <div className="absolute inset-0 grid place-items-center rounded-xl border border-gold/60 bg-gradient-to-b from-gold/20 to-ink [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  {shownTeam && <TeamCrest team={getTeam(shownTeam)} size={56} />}
                </div>
              </motion.div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
