"use client";

import { fmtRating } from "@/lib/teams";
import { motion, useAnimate } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, SkipForward } from "lucide-react";
import type { Participant, Team } from "@/lib/types";
import { TeamCrest } from "@/components/ui/TeamCrest";
import { PlayerDot, RatingBar } from "@/components/ui/bits";
import { burst, prefersReducedMotion } from "@/lib/fx";
import { play } from "@/lib/sound";

export interface RevealItem {
  participant: Participant;
  team: Team;
}

interface Props extends RevealItem {
  /** "revealing": se está animando la revelación; "assigned": esperando confirmación. */
  stage: "revealing" | "assigned";
  runId: number;
  position?: { index: number; total: number };
  continueLabel: string;
  onRevealed: (runId: number) => void;
  onContinue: () => void;
  onSkip?: () => void;
}

/**
 * Revelación cinematográfica de un participante con su equipo. La animación se
 * encadena con promesas de Motion y avisa al terminar (`onRevealed`); el botón
 * Continuar solo existe en el estado "assigned". Sin temporizadores.
 */
export function RevealOverlay({ participant, team, stage, runId, position, continueLabel, onRevealed, onContinue, onSkip }: Props) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const revealedRef = useRef(onRevealed);
  revealedRef.current = onRevealed;
  const [c1, c2] = team.colors;

  useEffect(() => {
    if (stage !== "revealing") return;
    let cancelled = false;
    const reduced = prefersReducedMotion();
    const fast = { duration: 0.01 };
    (async () => {
      play("reveal");
      burst([c1, c2, "#3dff8b", "#ffffff"]);
      await animate("[data-reveal='crest']", { scale: [0, 1], rotateY: [180, 0], opacity: [0, 1] }, reduced ? fast : { type: "spring", stiffness: 140, damping: 13 });
      await animate("[data-reveal='info']", { opacity: [0, 1], y: [20, 0] }, reduced ? fast : { duration: 0.45 });
    })().then(
      () => !cancelled && revealedRef.current(runId),
      () => !cancelled && revealedRef.current(runId),
    );
    return () => {
      cancelled = true;
    };
    // La revelación se identifica por runId (y por participante en presentaciones).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, runId, participant.id]);

  useEffect(() => {
    if (stage !== "assigned") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onContinue();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, onContinue]);

  const hidden = stage === "revealing" ? { opacity: 0 } : undefined;

  return (
    <motion.div
      className="fixed inset-0 z-[70] grid place-items-center overflow-hidden bg-ink/95 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={`${participant.name} recibe ${team.name}`}
    >
      <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(circle at 50% 50%, ${c1}55, transparent 50%)` }} />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 size-[110vmax] -translate-x-1/2 -translate-y-1/2 animate-[spin_40s_linear_infinite] opacity-25 will-change-transform"
        style={{ background: `repeating-conic-gradient(from 0deg, ${c1}20 0deg 6deg, transparent 6deg 18deg)` }}
      />

      <div ref={scope} className="relative flex w-full max-w-2xl flex-col items-center text-center">
        <div className="kicker !text-sm">{position ? `${position.index} / ${position.total} · ` : ""}Es el turno de</div>
        <div className="mt-2 flex items-center gap-3">
          <PlayerDot color={participant.color} size={16} />
          <span className="display text-5xl font-black italic sm:text-7xl" data-testid="reveal-participant">{participant.name}</span>
        </div>

        <div className="kicker mt-8 !text-gold">Resultado del sorteo</div>
        <div className="mt-4 flex flex-col items-center" key={`${participant.id}-${runId}`}>
          <div data-reveal="crest" className="relative" style={hidden}>
            <div className="absolute inset-0 -z-10 scale-150 rounded-full" style={{ background: `radial-gradient(circle, ${c1}88, transparent 70%)` }} />
            <TeamCrest team={team} size={160} />
          </div>
          <div data-reveal="info" className="flex flex-col items-center" style={hidden}>
            <h2 className="display mt-6 text-5xl font-black sm:text-6xl" data-testid="reveal-team">{team.name}</h2>
            {team.realName && <div className="text-sm text-mute">{team.realName}</div>}
            <div className="mt-5 flex w-full max-w-sm items-center gap-5">
              <div>
                <div className="display text-6xl font-black text-neon">{fmtRating(team.ovr)}</div>
                <div className="text-[0.65rem] font-bold uppercase tracking-widest text-mute">Media</div>
              </div>
              <div className="flex-1 space-y-1.5">
                <RatingBar label="ATQ" value={team.att} color="bg-blaze" />
                <RatingBar label="MED" value={team.mid} color="bg-volt" />
                <RatingBar label="DEF" value={team.def} color="bg-neon" />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex h-12 items-center gap-3">
          {stage === "assigned" && (
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={onContinue}
              className="flex items-center gap-2 rounded-lg bg-neon px-6 py-3 font-display font-bold uppercase tracking-wider text-ink hover:bg-white"
              autoFocus
            >
              {continueLabel} <ChevronRight className="size-5" />
            </motion.button>
          )}
          {onSkip && (
            <button onClick={onSkip} className="flex items-center gap-1 text-sm text-mute hover:text-white">
              <SkipForward className="size-4" /> Saltar presentación
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Presentación secuencial de varias asignaciones (sorteo completo o "presentar
 * plantillas"). Cada una pasa por revelación → confirmación, igual que un turno normal.
 */
export function Presentation({ items, onDone }: { items: RevealItem[]; onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<"revealing" | "assigned">("revealing");
  const item = items[index];
  if (!item) return null;
  const last = index >= items.length - 1;
  return (
    <RevealOverlay
      {...item}
      stage={stage}
      runId={index + 1}
      position={{ index: index + 1, total: items.length }}
      continueLabel={last ? "Ver equipos" : "Siguiente"}
      onRevealed={(id) => id === index + 1 && setStage("assigned")}
      onContinue={() => {
        if (stage !== "assigned") return;
        if (last) onDone();
        else {
          setIndex((i) => i + 1);
          setStage("revealing");
        }
      }}
      onSkip={last ? undefined : onDone}
    />
  );
}
