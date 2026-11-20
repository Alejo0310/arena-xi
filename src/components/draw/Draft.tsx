"use client";

import { motion, useAnimate } from "motion/react";
import { getTeam } from "@/lib/teams";
import { prefersReducedMotion } from "@/lib/fx";
import { play } from "@/lib/sound";
import { TeamCrest } from "@/components/ui/TeamCrest";
import { RatingBar } from "@/components/ui/bits";
import { useSpinAnimation, type StageProps } from "./types";

/** Draft: se reparten opciones al azar y el participante elige una carta. */
export default function Draft(props: StageProps & { options: string[] }) {
  const { options, locked, onStart } = props;
  const [scope, animate] = useAnimate<HTMLDivElement>();

  useSpinAnimation(props, async (p) => {
    const root = scope.current;
    if (!root) return;
    const reduced = prefersReducedMotion();
    const chosen = root.querySelector<HTMLElement>(`[data-card="${p.teamId}"]`);
    const others = [...root.querySelectorAll<HTMLElement>("[data-card]")].filter((el) => el !== chosen);
    play("whoosh");
    const opts = reduced ? { duration: 0.01 } : { duration: 0.6, ease: [0.3, 0.7, 0.2, 1] as const };
    await Promise.all([
      chosen ? animate(chosen, { y: -18, scale: 1.08, borderColor: "#ffd23d" }, opts) : Promise.resolve(),
      ...others.map((el) => animate(el, { opacity: 0.25, scale: 0.92 }, opts)),
    ]);
  });

  return (
    <div className="w-full">
      <p className="mb-6 text-center text-soft">Se han repartido {options.length} cartas al azar. Elige tu equipo: las demás vuelven al mazo.</p>
      {/* La key de grupo reinicia las cartas en cada reparto. */}
      <div ref={scope} key={options.join()} className="mx-auto flex max-w-4xl flex-wrap justify-center gap-4">
        {options.map((id, i) => {
          const t = getTeam(id)!;
          return (
            <motion.div key={id} initial={{ opacity: 0, y: -60, rotate: (i - 1) * 8 }} animate={{ opacity: 1, y: 0, rotate: 0 }} whileHover={locked ? undefined : { y: -8 }} transition={{ delay: 0.1 + i * 0.12, type: "spring", stiffness: 120, damping: 15 }}>
              <button
                data-card={id}
                onClick={() => onStart({ teamId: id })}
                disabled={locked}
                className="relative w-[200px] overflow-hidden rounded-2xl border-2 p-5 text-left will-change-transform"
                style={{ borderColor: `${t.colors[0]}88`, background: `linear-gradient(160deg, ${t.colors[0]}33, #0b0e13 55%)` }}
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
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
