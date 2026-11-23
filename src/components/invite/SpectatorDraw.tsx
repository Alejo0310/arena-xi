"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Hourglass, PartyPopper, Radio } from "lucide-react";
import { PlayerDot } from "@/components/ui/bits";
import { TeamCrest } from "@/components/ui/TeamCrest";
import { Portal } from "@/components/ui/Portal";
import { RevealOverlay } from "@/components/draw/RevealOverlay";
import type { StageProps } from "@/components/draw/types";
import { DRAW_MODES } from "@/lib/draw";
import { loadCatalog } from "@/lib/catalog";
import { fmtRating, getTeam } from "@/lib/teams";
import { initialSpectator, spectatorEvent, spectatorSnapshot } from "@/lib/spectatorFlow";
import { championCelebration } from "@/lib/fx";
import type { DrawBroadcast } from "@/lib/roomTypes";

// Mismas mecánicas visuales que el host; se cargan solo cuando se usan.
const stageLoading = () => (
  <div className="grid h-[320px] place-items-center">
    <div className="size-10 animate-spin rounded-full border-2 border-neon/20 border-t-neon" />
  </div>
);
const Roulette = dynamic(() => import("@/components/draw/Roulette"), { loading: stageLoading });
const Machine = dynamic(() => import("@/components/draw/Machine"), { loading: stageLoading });
const Envelopes = dynamic(() => import("@/components/draw/Envelopes"), { loading: stageLoading });
const Draft = dynamic(() => import("@/components/draw/Draft"), { loading: stageLoading });
const Pots = dynamic(() => import("@/components/draw/Pots"), { loading: stageLoading });

const noop = () => {};

/**
 * El sorteo del host, visto desde la pantalla de un invitado: las mismas animaciones (ruleta, sobres, tómbola, draft
 * o bombos) y la misma revelación de cada equipo, sin controles. Cuando termina, avisa de que se espera al host.
 */
export function SpectatorDraw({ draw }: { draw: DrawBroadcast }) {
  const [ready, setReady] = useState(false);
  const [sp, setSp] = useState(initialSpectator);

  // Los equipos viajan como ids: se resuelven con el catálogo de la edición del torneo.
  useEffect(() => {
    let off = false;
    setReady(false);
    void loadCatalog(draw.edition)
      .catch(() => undefined)
      .then(() => !off && setReady(true));
    return () => {
      off = true;
    };
  }, [draw.edition]);

  useEffect(() => {
    setSp((prev) => spectatorSnapshot(prev, draw));
  }, [draw]);

  const mode = DRAW_MODES.find((m) => m.id === draw.mode)!;
  const byId = new Map(draw.participants.map((p) => [p.id, p]));
  const completed = sp.flow.phase === "completed";
  const turnId = draw.pending?.participantId ?? draw.order[draw.cursor];
  const turn = turnId ? byId.get(turnId) : undefined;
  const turnNumber = Math.min((draw.pending ? draw.cursor : draw.cursor) + 1, draw.order.length);

  const stageProps: StageProps = {
    pool: draw.pool,
    phase: sp.flow.phase,
    runId: sp.flow.runId,
    pick: draw.pending,
    locked: true, // los invitados no controlan el sorteo
    actionLabel: mode.action,
    onStart: noop,
    onAnimationDone: (runId) => setSp((p) => spectatorEvent(p, { type: "ANIMATION_DONE", runId })),
  };
  const pickParticipant = draw.pending ? byId.get(draw.pending.participantId) : undefined;
  const pickTeam = draw.pending ? getTeam(draw.pending.teamId) : undefined;
  const revealing = ready && (sp.flow.phase === "revealing" || sp.flow.phase === "assigned") && !!draw.pending && !!pickParticipant && !!pickTeam;

  return (
    <div data-testid="spectator-draw" data-draw-mode={draw.mode}>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-bold uppercase tracking-wider ${completed ? "bg-neon/15 text-neon" : "bg-blaze/15 text-blaze"}`} data-testid="spectator-badge">
          <Radio className={`size-3.5 ${completed ? "" : "animate-pulse"}`} /> {completed ? "Sorteo terminado" : "Sorteo en directo"}
        </span>
        <span className="text-soft">{mode.name}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="glass relative min-h-[420px] min-w-0 overflow-hidden p-4 sm:p-8">
          {completed ? (
            <WaitingForHost draw={draw} />
          ) : !ready ? (
            stageLoading()
          ) : (
            <>
              {turn && (
                <motion.div key={turn.id} initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mb-6 flex flex-col items-center text-center" data-testid="spectator-turn">
                  <span className="kicker">Es el turno de</span>
                  <span className="mt-1 flex items-center gap-3">
                    <PlayerDot color={turn.color} size={12} />
                    <span className="display break-words text-4xl font-black italic sm:text-5xl" data-testid="spectator-turn-name">{turn.name}</span>
                  </span>
                  <span className="num mt-1 text-xs font-semibold uppercase tracking-widest text-mute">Participante {turnNumber} de {draw.order.length}</span>
                </motion.div>
              )}
              <div className="flex justify-center overflow-hidden" data-testid="spectator-stage">
                {draw.mode === "roulette" && <Roulette {...stageProps} />}
                {draw.mode === "machine" && <Machine {...stageProps} />}
                {draw.mode === "envelopes" && draw.envelopes && <Envelopes {...stageProps} envelopes={draw.envelopes} owners={draw.owners} participants={draw.participants} />}
                {draw.mode === "draft" && <Draft {...stageProps} options={draw.draftOptions ?? []} />}
                {draw.mode === "pots" && draw.pots && <Pots {...stageProps} pots={draw.pots} method={draw.potsMethod} potIndex={draw.potIndex ?? 0} canChangePot={false} onSelectPot={noop} />}
              </div>
              <p className="mt-6 text-center text-xs text-mute">El organizador está haciendo el sorteo. Lo ves aquí en directo.</p>
            </>
          )}
        </div>

        <aside className="glass min-w-0 p-4">
          <h3 className="kicker mb-3">Orden del sorteo</h3>
          <ol className="space-y-1.5" aria-label="Orden del sorteo" data-testid="spectator-order">
            {draw.order.map((id, i) => {
              const p = byId.get(id);
              const teamId = draw.assignments[id];
              const team = ready && teamId ? getTeam(teamId) : undefined;
              const isTurn = i === draw.cursor && !completed;
              return (
                <li key={id} className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 ${isTurn ? "bg-neon/10 ring-1 ring-neon/50" : ""}`} data-assigned={team ? "true" : "false"}>
                  <span className="num w-5 text-xs font-bold text-mute">{i + 1}</span>
                  <PlayerDot color={p?.color ?? "#888"} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{p?.name ?? "—"}</span>
                  {team ? (
                    <span className="flex items-center gap-1.5 text-xs text-soft">
                      <span className="hidden truncate sm:inline">{team.short}</span>
                      <TeamCrest team={team} size={26} />
                    </span>
                  ) : (
                    <span className={`grid size-[26px] place-items-center rounded-md border border-dashed text-xs ${isTurn ? "border-neon text-neon" : "border-line text-mute"}`}>{isTurn ? "●" : "?"}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </aside>
      </div>

      <Portal>
        <AnimatePresence>
          {revealing && pickParticipant && pickTeam && (
            <RevealOverlay
              key={`spectator-turn-${draw.cursor}-${draw.pending!.participantId}`}
              participant={pickParticipant}
              team={pickTeam}
              stage={sp.flow.phase === "assigned" ? "assigned" : "revealing"}
              runId={sp.flow.runId}
              position={{ index: turnNumber, total: draw.order.length }}
              continueLabel=""
              onRevealed={(runId) => setSp((p) => spectatorEvent(p, { type: "REVEAL_DONE", runId }))}
              onContinue={noop}
              spectator
            />
          )}
        </AnimatePresence>
      </Portal>
    </div>
  );
}

/** El sorteo terminó: todos tienen equipo y se espera a que el organizador inicie el torneo. */
function WaitingForHost({ draw }: { draw: DrawBroadcast }) {
  useEffect(() => {
    championCelebration(1500);
  }, []);
  return (
    <div className="flex flex-col items-center" data-testid="spectator-complete">
      <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 160, damping: 12 }} className="mb-5 flex flex-col items-center text-center">
        <PartyPopper className="size-12 text-gold" />
        <div className="display mt-2 text-4xl font-black italic text-gold sm:text-5xl">¡Todos tienen equipo!</div>
      </motion.div>
      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-neon/40 bg-neon/10 px-5 py-3 text-center" role="status" data-testid="spectator-waiting">
        <Hourglass className="size-6 shrink-0 animate-pulse text-neon" />
        <span className="font-display text-lg font-bold uppercase tracking-wider sm:text-xl">Esperando a que el organizador inicie el torneo</span>
      </div>
      <div className="grid w-full gap-3 sm:grid-cols-2">
        {draw.order.map((id, i) => {
          const p = draw.participants.find((x) => x.id === id);
          const team = getTeam(draw.assignments[id]);
          return (
            <motion.div key={id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.04 }} className="flex min-w-0 items-center gap-3 rounded-xl border border-line bg-ink/40 p-3" style={{ boxShadow: `inset 3px 0 0 ${p?.color ?? "#888"}` }}>
              <TeamCrest team={team} size={44} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{p?.name}</div>
                <div className="truncate text-sm text-mute">{team?.name}</div>
              </div>
              <div className="display text-2xl font-black text-neon">{fmtRating(team?.ovr)}</div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
