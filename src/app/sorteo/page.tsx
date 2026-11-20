"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Disc3, Mail, Dices, Layers, LayoutGrid, Zap, RotateCcw, Play, Clapperboard, History, ArrowLeft, Lock } from "lucide-react";
import { useTournament } from "@/store/tournament";
import { DRAW_MODES, currentParticipant, drawAll, isDrawComplete, rollTeam } from "@/lib/draw";
import { getTeam } from "@/lib/teams";
import type { DrawMode, Tournament } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { EmptyState, Loader, PlayerDot, SectionHeader, useHydrated } from "@/components/ui/bits";
import { confirmDialog, toast } from "@/components/ui/feedback";
import { TeamCrest } from "@/components/ui/TeamCrest";
import { RevealOverlay, type RevealItem } from "@/components/draw/RevealOverlay";
import { Roulette } from "@/components/draw/Roulette";
import { Machine } from "@/components/draw/Machine";
import { Envelopes } from "@/components/draw/Envelopes";
import { Draft } from "@/components/draw/Draft";
import { Pots } from "@/components/draw/Pots";
import type { DrawResult } from "@/components/draw/types";
import { Portal } from "@/components/ui/Portal";

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
  if (t.phase === "draw" && t.draw) return <DrawStage t={t} />;
  return <AssignmentsSummary t={t} />;
}

function ModePicker({ t }: { t: Tournament }) {
  const startDraw = useTournament((s) => s.startDraw);
  const pick = (m: DrawMode) => {
    const err = startDraw(m);
    if (err) toast.error(err);
  };
  return (
    <div>
      <SectionHeader kicker={`${t.name} · ${t.participants.length} jugadores · ${t.teamPool.length} equipos`} title="Elige cómo sortear">
        <Link href="/nuevo"><Button variant="ghost"><ArrowLeft className="size-4" /> Configuración</Button></Link>
      </SectionHeader>
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
              <div className="absolute -right-6 -top-6 size-32 rounded-full bg-neon/5 transition-transform duration-500 group-hover:scale-150" />
              <Icon className="relative size-10 text-neon transition-transform duration-500 group-hover:rotate-12" />
              <h3 className="display relative mt-5 text-3xl font-extrabold">{m.name}</h3>
              <p className="relative mt-1 text-soft">{m.tagline}</p>
              <div className="kicker relative mt-5 opacity-0 transition-opacity group-hover:opacity-100">Empezar →</div>
            </motion.button>
          );
        })}
      </div>
      <p className="mt-6 max-w-2xl text-sm text-mute">
        Todos los modos usan aleatoriedad criptográfica del navegador. El resultado se decide y se guarda antes de la animación,
        que solo lo revela. {t.settings.allowRepeatTeams ? "Equipos repetidos permitidos." : "Cada participante recibe un club distinto."}
      </p>
    </div>
  );
}

function DrawStage({ t }: { t: Tournament }) {
  const d = t.draw!;
  const assign = useTournament((s) => s.assign);
  const resetDraw = useTournament((s) => s.resetDraw);
  const startDraw = useTournament((s) => s.startDraw);
  const selectPot = useTournament((s) => s.selectPot);
  const startTournament = useTournament((s) => s.startTournament);
  const router = useRouter();
  const [pending, setPending] = useState<DrawResult | null>(null);
  const [reveal, setReveal] = useState<{ items: RevealItem[]; auto?: number } | null>(null);

  const byId = useMemo(() => new Map(t.participants.map((p) => [p.id, p])), [t.participants]);
  const complete = isDrawComplete(d);
  const turnId = currentParticipant(d);
  const turn = turnId ? byId.get(turnId) : undefined;
  const busy = !!pending || !!reveal;
  const modeInfo = DRAW_MODES.find((m) => m.id === d.mode)!;

  const decide = (choice?: { teamId?: string; envelopeIndex?: number }): DrawResult | null => {
    if (!turnId || busy) return null;
    let teamId: string | null | undefined;
    if (d.mode === "envelopes") teamId = choice?.envelopeIndex !== undefined ? d.envelopes?.[choice.envelopeIndex] : null;
    else if (d.mode === "draft") teamId = choice?.teamId && d.draftOptions?.includes(choice.teamId) ? choice.teamId : null;
    else teamId = d.pool.length ? rollTeam(d) : null;
    if (!teamId) return null;
    const r = { participantId: turnId, teamId, envelopeIndex: choice?.envelopeIndex };
    assign(r.participantId, r.teamId, r.envelopeIndex);
    setPending(r);
    return r;
  };

  const onRevealed = (r: DrawResult) => {
    setReveal({ items: [{ participant: byId.get(r.participantId)!, team: getTeam(r.teamId)! }] });
  };

  const closeReveal = () => {
    setReveal(null);
    setPending(null);
  };

  const fullDraw = async () => {
    const ok = await confirmDialog({
      title: "Sorteo completo",
      body: `Se asignará equipo a los ${d.order.length - d.cursor} participantes restantes de una vez, con una presentación de cada uno.`,
      confirmLabel: "Sortear todo",
    });
    if (!ok) return;
    const results = drawAll(d, t.settings.allowRepeatTeams);
    results.forEach((r) => assign(r.participantId, r.teamId, r.envelopeIndex));
    setReveal({ items: results.map((r) => ({ participant: byId.get(r.participantId)!, team: getTeam(r.teamId)! })), auto: 1700 });
  };

  const presentAll = () =>
    setReveal({ items: d.order.map((id) => ({ participant: byId.get(id)!, team: getTeam(t.assignments[id])! })), auto: 1900 });

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
    if (d.cursor > 0) {
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

  return (
    <div>
      <SectionHeader kicker={`Sorteo · ${modeInfo.name}`} title={complete ? "¡Sorteo completado!" : turn ? `Turno de ${turn.name}` : "Sorteo"}>
        <Button variant="ghost" size="sm" onClick={changeMode} disabled={busy}><ArrowLeft className="size-4" /> Modalidad</Button>
        <Button variant="secondary" size="sm" onClick={restart} disabled={busy}><RotateCcw className="size-4" /> Reiniciar</Button>
      </SectionHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="glass relative min-h-[520px] overflow-hidden p-5 sm:p-8">
          {turn && !complete && (
            <motion.div key={turn.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-6 flex items-center justify-center gap-3">
              <span className="text-sm uppercase tracking-widest text-mute">Le toca a</span>
              <PlayerDot color={turn.color} size={12} />
              <span className="display text-3xl font-black">{turn.name}</span>
              <span className="num text-sm text-mute">({d.cursor + 1}/{d.order.length})</span>
            </motion.div>
          )}

          {complete && !reveal ? (
            <CompletePanel t={t} onPresent={presentAll} onBegin={begin} />
          ) : (
            <div className="flex justify-center">
              {d.mode === "roulette" && <Roulette pool={d.pool} decide={decide} onRevealed={onRevealed} busy={busy} />}
              {d.mode === "machine" && <Machine pool={d.pool} decide={decide} onRevealed={onRevealed} busy={busy} />}
              {d.mode === "envelopes" && d.envelopes && (
                <Envelopes envelopes={d.envelopes} owners={envelopeOwners} participants={t.participants} decide={decide} onRevealed={onRevealed} busy={busy} />
              )}
              {d.mode === "draft" && <Draft options={d.draftOptions ?? []} decide={decide} onRevealed={onRevealed} busy={busy} />}
              {d.mode === "pots" && d.pots && (
                <Pots pots={d.pots} potIndex={d.potIndex ?? 0} canChangePot={d.cursor === 0} onSelectPot={selectPot} pool={d.pool} decide={decide} onRevealed={onRevealed} busy={busy} />
              )}
            </div>
          )}

          {!complete && (
            <div className="mt-8 flex justify-center border-t border-line pt-5">
              <Button variant="secondary" onClick={fullDraw} disabled={busy}>
                <Zap className="size-4" /> Sorteo completo ({d.order.length - d.cursor} restantes)
              </Button>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="glass p-4">
            <h3 className="kicker mb-3">Orden del sorteo</h3>
            <ol className="space-y-1.5">
              {d.order.map((id, i) => {
                const p = byId.get(id)!;
                const hidden = pending?.participantId === id;
                const team = hidden ? undefined : getTeam(t.assignments[id]);
                const isTurn = i === d.cursor && !complete;
                return (
                  <motion.li
                    key={id}
                    layout
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 ${isTurn ? "bg-neon/10 ring-1 ring-neon/50" : ""}`}
                  >
                    <span className="num w-5 text-xs font-bold text-mute">{i + 1}</span>
                    <PlayerDot color={p.color} />
                    <span className="flex-1 truncate font-semibold">{p.name}</span>
                    <AnimatePresence mode="wait">
                      {team ? (
                        <motion.span key="t" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-1.5 text-xs text-soft">
                          <span className="hidden truncate sm:inline">{team.short}</span>
                          <TeamCrest team={team} size={26} />
                        </motion.span>
                      ) : (
                        <motion.span key="q" className={`grid size-[26px] place-items-center rounded-md border border-dashed text-xs ${isTurn ? "border-neon text-neon" : "border-line text-mute"}`}>
                          {isTurn ? <span className="animate-pulse-glow">●</span> : "?"}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.li>
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
                {[...t.drawHistory].reverse().filter((h) => h.participantId !== pending?.participantId).map((h) => (
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

      <Portal><AnimatePresence>{reveal && <RevealOverlay items={reveal.items} autoMs={reveal.auto} onClose={closeReveal} />}</AnimatePresence></Portal>
    </div>
  );
}

function CompletePanel({ t, onPresent, onBegin }: { t: Tournament; onPresent: () => void; onBegin: () => void }) {
  const order = t.draw?.order ?? t.participants.map((p) => p.id);
  const byId = new Map(t.participants.map((p) => [p.id, p]));
  return (
    <div className="flex flex-col items-center">
      <div className="grid w-full gap-3 sm:grid-cols-2">
        {order.map((id, i) => {
          const p = byId.get(id)!;
          const team = getTeam(t.assignments[id]);
          return (
            <motion.div key={id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center gap-3 rounded-xl border border-line bg-ink/40 p-3" style={{ boxShadow: `inset 3px 0 0 ${p.color}` }}>
              <TeamCrest team={team} size={44} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{p.name}</div>
                <div className="truncate text-sm text-mute">{team?.name}</div>
              </div>
              <div className="display text-2xl font-black text-neon">{team?.ovr}</div>
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
              {team && <div className="display text-3xl font-black text-neon">{team.ovr}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
