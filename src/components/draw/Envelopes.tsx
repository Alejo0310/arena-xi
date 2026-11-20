"use client";

import { motion, useAnimate } from "motion/react";
import { getTeam } from "@/lib/teams";
import { play } from "@/lib/sound";
import { prefersReducedMotion } from "@/lib/fx";
import { TeamCrest } from "@/components/ui/TeamCrest";
import type { Participant } from "@/lib/types";
import { useSpinAnimation, type StageProps } from "./types";

/**
 * Sobres: el contenido de cada sobre quedó fijado al barajar (initDraw).
 * Elegir un sobre no cambia probabilidades; solo decide cuál se abre.
 */
export default function Envelopes(props: StageProps & { envelopes: (string | null)[]; owners: Record<number, string>; participants: Participant[] }) {
  const { envelopes, owners, participants, pick, locked, onStart } = props;
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const openingIndex = pick?.envelopeIndex;

  useSpinAnimation(props, async (p) => {
    const card = scope.current?.querySelector<HTMLElement>(`[data-envelope="${p.envelopeIndex}"]`);
    if (!card) return;
    play("whoosh");
    const reduced = prefersReducedMotion();
    await animate(card, { rotateY: 180, scale: 1.12 }, reduced ? { duration: 0.01 } : { duration: 0.9, ease: [0.3, 0.7, 0.2, 1] });
  });

  return (
    <div className="w-full">
      <p className="mb-5 text-center text-soft">Elige un sobre. Cada uno esconde un equipo distinto, sellado antes de empezar.</p>
      <div ref={scope} className="mx-auto grid max-w-3xl grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        {envelopes.map((teamId, i) => {
          const isOpening = openingIndex === i;
          const opened = teamId === null;
          const owner = participants.find((p) => p.id === owners[i]);
          return (
            <motion.button
              key={i}
              onClick={() => onStart({ envelopeIndex: i })}
              disabled={locked || opened}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.4) }}
              className="group relative aspect-[3/4] transition-transform duration-200 [perspective:800px] enabled:hover:-translate-y-2 disabled:cursor-default"
              aria-label={opened ? `Sobre ${i + 1}, ya abierto${owner ? ` por ${owner.name}` : ""}` : `Abrir sobre ${i + 1}`}
            >
              {/* La key fuerza un estado visual limpio al cambiar de cerrado a abierto. */}
              <div key={opened ? "o" : "c"} data-envelope={i} className="relative size-full [transform-style:preserve-3d] will-change-transform">
                <div className={`absolute inset-0 overflow-hidden rounded-xl border [backface-visibility:hidden] ${opened ? "border-line bg-graphite/40 opacity-40" : "border-neon/30 bg-gradient-to-br from-slate via-graphite to-ink shadow-[0_10px_30px_-10px_rgb(61_255_139/0.4)]"}`}>
                  <svg viewBox="0 0 100 133" className="absolute inset-0 size-full" aria-hidden>
                    <path d="M0 0 L50 48 L100 0" fill="none" stroke={opened ? "#333" : "#3dff8b"} strokeOpacity="0.5" strokeWidth="1.5" />
                  </svg>
                  <div className="absolute inset-0 grid place-items-center">
                    {opened ? (
                      <span className="px-1 text-center text-[0.7rem] font-semibold text-mute">{owner?.name ?? "Abierto"}</span>
                    ) : (
                      <span className="display text-4xl font-black text-white/80 group-hover:text-neon">{i + 1}</span>
                    )}
                  </div>
                </div>
                <div className="absolute inset-0 grid place-items-center rounded-xl border border-gold/60 bg-gradient-to-b from-gold/20 to-ink [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  {isOpening && pick && <TeamCrest team={getTeam(pick.teamId)} size={56} />}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
