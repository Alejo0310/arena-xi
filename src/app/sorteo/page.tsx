"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Disc3, Mail, Dices, Layers, LayoutGrid, Zap, RotateCcw, Play, Clapperboard, History, ArrowLeft, Lock, PartyPopper, Shield, Globe2 } from "lucide-react";
import { useTournament } from "@/store/tournament";
import { DRAW_MODES } from "@/lib/draw";
import { CATEGORY_LABEL } from "@/lib/category";
import { getTeam, fmtRating } from "@/lib/teams";
import type { DrawMode, Tournament } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { EmptyState, Loader, PlayerDot, SectionHeader, useHydrated } from "@/components/ui/bits";
import { confirmDialog, toast } from "@/components/ui/feedback";
import { TeamCrest } from "@/components/ui/TeamCrest";
import { Portal } from "@/components/ui/Portal";
import { Presentation, RevealOverlay, type RevealItem } from "@/components/draw/RevealOverlay";
import { PotsSetup } from "@/components/draw/PotsSetup";
import { useDrawController } from "@/components/draw/useDrawController";
import type { StageProps } from "@/components/draw/types";
import { championCelebration } from "@/lib/fx";
import { play } from "@/lib/sound";

// Cada mecánica se carga solo cuando se usa.
const stageLoading = () => <div className="grid h-[420px] place-items-center"><div className="size-10 animate-spin rounded-full border-2 border-neon/20 border-t-neon" /></div>;
const Roulette = dynamic(() => import("@/components/draw/Roulette"), { loading: stageLoading });
const Machine = dynamic(() => import("@/components/draw/Machine"), { loading: stageLoading });
const Envelopes = dynamic(() => import("@/components/draw/Envelopes"), { loading: stageLoading });
const Draft = dynamic(() => import("@/components/draw/Draft"), { loading: stageLoading });
const Pots = dynamic(() => import("@/components/draw/Pots"), { loading: stageLoading });

const MODE_ICON: Record<DrawMode, typeof Disc3> = { roulette: Disc3, envelopes: Mail, machine: Dices, draft: Layers, pots: LayoutGrid };

export default function DrawPage() {
  const hydrated = useHydrated();
  const t = useTournament((s) => s.current);

  if (!hydrated) return <Loader label="Calentando el bombo" />;
  if (!t || t.participants.length < 2) {
    return (
      <EmptyState
        icon={<Dices className="size-8" />}
        title="Aún no hay torneo"
        body="Configura los participantes y los equipos antes de sortear."
        action={<Link href="/nuevo"><Button>Configurar torneo</Button></Link>}
      />
    );
  }
  if (t.phase === "setup") return <ModePicker t={t} />;
  // La key reinicia por completo el controlador al empezar un sorteo nuevo.
  if (t.phase === "draw" && t.draw) return <DrawStage key={t.draw.id} t={t} />;
  return <AssignmentsSummary t={t} />;
}

function ModePicker({ t }: { t: Tournament }) {
  const startDraw = useTournament((s) => s.startDraw);
  const [potsSetup, setPotsSetup] = useState(false);
  const pick = (m: DrawMode) => {
    if (m === "pots") return setPotsSetup(true); // los bombos piden antes elegir el método
    const err = startDraw(m);
    if (err) toast.error(err);
  };
  const CatIcon = t.settings.category === "club" ? Shield : Globe2;
  if (potsSetup) return <PotsSetup t={t} onBack={() => setPotsSetup(false)} />;
  return (
    <div>
      <SectionHeader kicker={`${t.name} · ${t.participants.length} jugadores · ${t.teamPool.length} ${CATEGORY_LABEL[t.settings.category].toLowerCase()}`} title="Elige cómo sortear">
        <Link href="/nuevo"><Button variant="ghost"><ArrowLeft className="size-4" /> Configuración</Button></Link>
      </SectionHeader>
      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-neon/30 bg-neon/10 px-4 py-1.5 text-sm font-semibold">
        <CatIcon className="size-4 text-neon" /> Torneo de {CATEGORY_LABEL[t.settings.category].toLowerCase()}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DRAW_MODES.map((m, i) => {
          const Icon = MODE_ICON[m.id];
          return (
            <motion.button
              key={m.id}
              onClick={() => pick(m.id)}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              whileHover={{ y: -6 }}
              whileTap={{ scale: 0.98 }}
              className="glass glass-hover group relative overflow-hidden p-6 text-left"
            >
              <Icon className="relative size-10 text-neon transition-transform duration-500 group-hover:rotate-12" />
              <h3 className="display relative mt-5 text-3xl font-extrabold">{m.name}</h3>
              <p className="relative mt-1 text-soft">{m.tagline}</p>
            </motion.button>
          );
        })}
      </div>
      <p className="mt-6 max-w-2xl text-sm text-mute">
        Todos los modos usan aleatoriedad criptográfica del navegador. El resultado se decide y se guarda antes de la animación,
        que solo lo revela. {t.settings.allowRepeatTeams ? "Equipos repetidos permitidos." : "Cada participante recibe un equipo distinto."}
      </p>
    </div>
  );
}

function DrawStage({ t }: { t: Tournament }) {
  const d = t.draw!;
  const resetDraw = useTournament((s) => s.resetDraw);
  const startDraw = useTournament((s) => s.startDraw);
  const selectPot = useTournament((s) => s.selectPot);
  const startTournament = useTournament((s) => s.startTournament);
  const router = useRouter();
  const ctl = useDrawController(d);
  const { flow, pick } = ctl;
  const [presentation, setPresentation] = useState<RevealItem[] | null>(null);

  const byId = useMemo(() => new Map(t.participants.map((p) => [p.id, p])), [t.participants]);
  const turn = ctl.turnId ? byId.get(ctl.turnId) : undefined;
  const modeInfo = DRAW_MODES.find((m) => m.id === d.mode)!;
  const completed = flow.phase === "completed";
  const turnNumber = Math.min(d.cursor + 1, d.order.length);
  const canEditDraw = flow.phase === "ready" || flow.phase === "completed" || flow.phase === "assigned";

  const fullDraw = async () => {
    const ok = await confirmDialog({
      title: "Sorteo completo",
      body: `Se asignará equipo a los ${d.order.length - d.cursor} participantes restantes de una vez y se presentará cada uno.`,
      confirmLabel: "Sortear todo",
    });
    if (!ok) return;
    const results = ctl.drawAllRemaining();
    if (results.length) setPresentation(results.map((r) => ({ participant: byId.get(r.participantId)!, team: getTeam(r.teamId)! })));
  };

  const presentAll = () => {
    setPresentation(d.order.map((id) => ({ participant: byId.get(id)!, team: getTeam(t.assignments[id])! })));
    ctl.present();
  };

  const restart = async () => {
    const ok = await confirmDialog({ title: "¿Reiniciar el sorteo?", body: "Se borrarán todas las asignaciones y se barajará de nuevo.", danger: true, confirmLabel: "Reiniciar" });
    if (!ok) return;
    const mode = d.mode;
    resetDraw();
    const err = startDraw(mode);
    if (err) toast.error(err);
    else toast.info("Sorteo reiniciado.");
  };

  const changeMode = async () => {
    if (d.cursor > 0 || d.pending) {
      const ok = await confirmDialog({ title: "¿Cambiar de modalidad?", body: "Se perderán las asignaciones ya hechas.", danger: true, confirmLabel: "Cambiar" });
      if (!ok) return;
    }
    resetDraw();
  };

  const begin = () => {
    const err = startTournament();
    if (err) return toast.error(err);
    toast.success("¡Que ruede el balón! Calendario generado.");
    router.push("/torneo");
  };

  const envelopeOwners = Object.fromEntries(t.drawHistory.filter((h) => h.envelopeIndex !== undefined).map((h) => [h.envelopeIndex!, h.participantId]));
  const stageProps: StageProps = {
    pool: d.pool,
    phase: flow.phase,
    runId: flow.runId,
    pick,
    locked: ctl.locked,
    actionLabel: modeInfo.action,
    onStart: ctl.start,
    onAnimationDone: ctl.animationDone,
  };
  const revealing = (flow.phase === "revealing" || flow.phase === "assigned") && pick;
  const pickParticipant = pick ? byId.get(pick.participantId) : undefined;
  const pickTeam = pick ? getTeam(pick.teamId) : undefined;

  return (
    <div>
      <SectionHeader kicker={`Sorteo · ${modeInfo.name} · ${CATEGORY_LABEL[t.settings.category]}`} title={completed ? "¡Todos tienen equipo!" : "Sorteo de equipos"}>
        <Button variant="ghost" size="sm" onClick={changeMode} disabled={!canEditDraw}><ArrowLeft className="size-4" /> Modalidad</Button>
        <Button variant="secondary" size="sm" onClick={restart} disabled={!canEditDraw}><RotateCcw className="size-4" /> Reiniciar</Button>
      </SectionHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="glass relative min-h-[520px] overflow-hidden p-5 sm:p-8">
          {completed ? (
            <CompletePanel t={t} onPresent={presentAll} onBegin={begin} />
          ) : (
            <>
              {turn && <TurnBanner key={turn.id} name={turn.name} color={turn.color} index={turnNumber} total={d.order.length} onShown={flow.phase === "next" ? ctl.nextReady : undefined} />}
              <div className="flex justify-center">
                {d.mode === "roulette" && <Roulette {...stageProps} />}
                {d.mode === "machine" && <Machine {...stageProps} />}
                {d.mode === "envelopes" && d.envelopes && <Envelopes {...stageProps} envelopes={d.envelopes} owners={envelopeOwners} participants={t.participants} />}
                {d.mode === "draft" && <Draft {...stageProps} options={d.draftOptions ?? []} />}
                {d.mode === "pots" && d.pots && <Pots {...stageProps} pots={d.pots} method={d.potsMethod} potIndex={d.potIndex ?? 0} canChangePot={d.cursor === 0 && !d.pending && !ctl.locked} onSelectPot={selectPot} />}
              </div>
              <div className="mt-8 flex justify-center border-t border-line pt-5">
                <Button variant="secondary" onClick={fullDraw} disabled={ctl.locked || !!d.pending}>
                  <Zap className="size-4" /> Sorteo completo ({d.order.length - d.cursor} restantes)
                </Button>
              </div>
            </>
          )}
        </div>

        <aside className="space-y-4">
          <div className="glass p-4">
            <h3 className="kicker mb-3">Orden del sorteo</h3>
            <ol className="space-y-1.5" aria-label="Orden del sorteo">
              {d.order.map((id, i) => {
                const p = byId.get(id)!;
                const team = getTeam(t.assignments[id]);
                const isTurn = i === d.cursor && !completed;
                return (
                  <li key={id} className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 ${isTurn ? "bg-neon/10 ring-1 ring-neon/50" : ""}`} data-assigned={team ? "true" : "false"}>
                    <span className="num w-5 text-xs font-bold text-mute">{i + 1}</span>
                    <PlayerDot color={p.color} />
                    <span className="flex-1 truncate font-semibold">{p.name}</span>
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
          </div>

          <div className="glass p-4">
            <h3 className="kicker mb-3 flex items-center gap-2"><History className="size-3.5" /> Historial</h3>
            {t.drawHistory.length === 0 ? (
              <p className="text-sm text-mute">Las asignaciones aparecerán aquí.</p>
            ) : (
              <ul className="max-h-60 space-y-1 overflow-y-auto pr-1 text-sm scrollbar-thin">
                {[...t.drawHistory].reverse().map((h) => (
                  <li key={h.participantId + h.at} className="flex justify-between gap-2 text-soft">
                    <span className="truncate"><b className="text-white">{byId.get(h.participantId)?.name}</b> → {getTeam(h.teamId)?.name}</span>
                    <time className="num shrink-0 text-xs text-mute">{new Date(h.at).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      <Portal>
        <AnimatePresence>
          {revealing && pickParticipant && pickTeam && (
            <RevealOverlay
              key={`turn-${pick.participantId}`}
              participant={pickParticipant}
              team={pickTeam}
              stage={flow.phase === "assigned" ? "assigned" : "revealing"}
              runId={flow.runId}
              position={{ index: turnNumber, total: d.order.length }}
              continueLabel="Continuar"
              onRevealed={ctl.revealed}
              onContinue={ctl.confirm}
            />
          )}
          {flow.phase === "presenting" && presentation && (
            <Presentation
              key="presentation"
              items={presentation}
              onDone={() => {
                setPresentation(null);
                ctl.presentationDone(true);
              }}
            />
          )}
        </AnimatePresence>
      </Portal>
    </div>
  );
}

/** Presentación del turno. Su animación de entrada completa el paso NEXT → READY. */
function TurnBanner({ name, color, index, total, onShown }: { name: string; color: string; index: number; total: number; onShown?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      onAnimationComplete={() => onShown?.()}
      className="mb-6 flex flex-col items-center text-center"
      data-testid="turn-banner"
    >
      <span className="kicker">Es el turno de</span>
      <span className="mt-1 flex items-center gap-3">
        <PlayerDot color={color} size={12} />
        <span className="display text-4xl font-black italic sm:text-5xl" data-testid="turn-name">{name}</span>
      </span>
      <span className="num mt-1 text-xs font-semibold uppercase tracking-widest text-mute" data-testid="turn-count">Participante {index} de {total}</span>
    </motion.div>
  );
}

function CompletePanel({ t, onPresent, onBegin }: { t: Tournament; onPresent: () => void; onBegin: () => void }) {
  const order = t.draw?.order ?? t.participants.map((p) => p.id);
  const byId = new Map(t.participants.map((p) => [p.id, p]));
  useEffect(() => {
    play("champion");
    championCelebration(1800);
  }, []);
  return (
    <div className="flex flex-col items-center">
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 160, damping: 12 }} className="mb-6 flex flex-col items-center text-center">
        <PartyPopper className="size-12 text-gold" />
        <div className="display text-gold mt-2 text-4xl font-black italic sm:text-5xl" data-testid="draw-complete">¡Todos tienen equipo!</div>
        <p className="mt-1 text-sm text-soft">Que gane el mejor.</p>
      </motion.div>
      <div className="grid w-full gap-3 sm:grid-cols-2">
        {order.map((id, i) => {
          const p = byId.get(id)!;
          const team = getTeam(t.assignments[id]);
          return (
            <motion.div key={id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.05 }} className="flex items-center gap-3 rounded-xl border border-line bg-ink/40 p-3" style={{ boxShadow: `inset 3px 0 0 ${p.color}` }}>
              <TeamCrest team={team} size={44} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{p.name}</div>
                <div className="truncate text-sm text-mute">{team?.name}</div>
              </div>
              <div className="display text-2xl font-black text-neon">{fmtRating(team?.ovr)}</div>
            </motion.div>
          );
        })}
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button variant="secondary" size="lg" onClick={onPresent}><Clapperboard className="size-5" /> Presentar plantillas</Button>
        <Button size="lg" onClick={onBegin}><Play className="size-5" /> Comenzar torneo</Button>
      </div>
    </div>
  );
}

function AssignmentsSummary({ t }: { t: Tournament }) {
  return (
    <div>
      <SectionHeader kicker={t.name} title="Equipos asignados">
        <Link href="/torneo"><Button>Ir al torneo</Button></Link>
      </SectionHeader>
      <div className="glass mb-4 flex items-center gap-3 p-4 text-sm text-soft">
        <Lock className="size-4 text-mute" /> El torneo ya comenzó: el sorteo queda cerrado para mantener los resultados coherentes.
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {t.participants.map((p) => {
          const team = getTeam(t.assignments[p.id]);
          return (
            <div key={p.id} className="glass flex items-center gap-3 p-4" style={{ boxShadow: `inset 3px 0 0 ${p.color}` }}>
              <TeamCrest team={team} size={48} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{p.name}</div>
                <div className="truncate text-sm text-mute">{team?.name ?? "Sin equipo"}</div>
              </div>
              {team && <div className="display text-3xl font-black text-neon">{fmtRating(team.ovr)}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
