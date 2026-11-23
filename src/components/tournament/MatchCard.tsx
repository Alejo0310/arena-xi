"use client";

import { createContext, useContext, useState } from "react";
import { motion } from "motion/react";
import { Check, Crown, Pencil, Radio, RotateCcw, Square } from "lucide-react";
import type { Match, Participant, Tournament } from "@/lib/types";
import { getTeam } from "@/lib/teams";
import { matchWinner, type ResultInput } from "@/lib/tournament/match";
import { dependentMatches } from "@/lib/tournament/knockout";
import { useTournament } from "@/store/tournament";
import { Button } from "@/components/ui/Button";
import { PlayerTag } from "@/components/ui/bits";
import { confirmDialog, toast } from "@/components/ui/feedback";
import { play } from "@/lib/sound";

const STATUS = {
  pending: { label: "Pendiente", cls: "bg-white/5 text-mute" },
  live: { label: "En juego", cls: "bg-blaze/15 text-blaze" },
  done: { label: "Finalizado", cls: "bg-neon/10 text-neon" },
};

/**
 * Acciones alternativas para el registro de resultados cuando el torneo vive en una sala (servidor): sustituyen a las
 * del almacén local. Sin este contexto, MatchCard se comporta exactamente como siempre.
 */
export interface MatchActions {
  record: (matchId: string, r: ResultInput) => Promise<string | null> | string | null;
  /** Borrar un resultado: solo el organizador. */
  reset?: (matchId: string) => Promise<string | null> | string | null;
  /** Ganador manual (W.O.): solo el organizador. */
  manualWinner?: boolean;
  /** Marcar "en juego": solo local. */
  live?: boolean;
}
export const MatchActionsContext = createContext<MatchActions | null>(null);

function parse(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
}

export function MatchCard({ t, m, readOnly = false }: { t: Tournament; m: Match; readOnly?: boolean }) {
  const record = useTournament((s) => s.recordResult);
  const reset = useTournament((s) => s.resetResult);
  const setLive = useTournament((s) => s.setLive);
  const ctx = useContext(MatchActionsContext);
  const knockout = t.settings.format === "knockout";
  const byId = new Map(t.participants.map((p) => [p.id, p]));
  const home = m.homeId ? byId.get(m.homeId) : undefined;
  const away = m.awayId ? byId.get(m.awayId) : undefined;
  const ready = !!home && !!away;
  const done = m.status === "done";

  const str = (n: number | null | undefined) => n?.toString() ?? "";
  const [editing, setEditing] = useState(false);
  const [hg, setHg] = useState(() => str(m.homeGoals));
  const [ag, setAg] = useState(() => str(m.awayGoals));
  const [hp, setHp] = useState(() => str(m.homePens));
  const [ap, setAp] = useState(() => str(m.awayPens));

  // Sincroniza los campos cuando cambia el resultado guardado (durante el render, sin efecto).
  const resultKey = [m.homeId, m.awayId, m.homeGoals, m.awayGoals, m.homePens, m.awayPens, m.status].join("|");
  const [syncedKey, setSyncedKey] = useState(resultKey);
  if (resultKey !== syncedKey) {
    setSyncedKey(resultKey);
    setHg(str(m.homeGoals));
    setAg(str(m.awayGoals));
    setHp(str(m.homePens));
    setAp(str(m.awayPens));
    setEditing(false);
  }

  if (m.isBye) {
    const p = home ?? away;
    return (
      <div className="glass flex items-center justify-between gap-3 p-4 opacity-70">
        <PlayerTag participant={p} team={getTeam(p && t.assignments[p.id])} compact />
        <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold uppercase tracking-widest text-mute">Pasa directo (BYE)</span>
      </div>
    );
  }

  const inputsOpen = ready && !readOnly && (!done || editing);
  const tiedNow = parse(hg) !== null && parse(hg) === parse(ag);
  const winner = matchWinner(m);

  const warnDependents = async (action: string): Promise<boolean> => {
    if (!knockout) return true;
    const deps = dependentMatches(t.matches, m.id).filter((x) => x.status === "done" && !x.isBye);
    if (!deps.length) return true;
    return confirmDialog({
      title: `${action} puede reiniciar fases posteriores`,
      body: `Si cambia el ganador, se reiniciarán ${deps.length} partido(s) que ya tienen resultado: ${deps.map((d) => d.label).join(", ")}.`,
      confirmLabel: "Continuar",
      danger: true,
    });
  };

  const submit = async (manualWinnerId?: string) => {
    const homeGoals = parse(hg);
    const awayGoals = parse(ag);
    if (Number.isNaN(homeGoals) || Number.isNaN(awayGoals)) return toast.error("Los goles deben ser números enteros.");
    if (done && !(await warnDependents("Editar el resultado"))) return;
    const input: ResultInput = {
      homeGoals,
      awayGoals,
      homePens: knockout && tiedNow ? parse(hp) : null,
      awayPens: knockout && tiedNow ? parse(ap) : null,
      manualWinnerId: manualWinnerId ?? null,
    };
    const err = ctx ? await ctx.record(m.id, input) : record(m.id, input);
    if (err) return toast.error(err);
    play("goal");
    toast.success(done ? "Resultado actualizado." : "Resultado registrado.");
  };

  const manual = async (p: Participant) => {
    const ok = await confirmDialog({
      title: `¿Dar la victoria a ${p.name}?`,
      body: knockout
        ? "Avanzará a la siguiente ronda. Si dejas el marcador vacío, solo se registra el ganador."
        : "Si dejas el marcador vacío se registrará como victoria por W.O. (3-0).",
      confirmLabel: "Confirmar ganador",
    });
    if (ok) await submit(p.id);
  };

  const startEdit = async () => {
    const ok = await confirmDialog({ title: "¿Editar este resultado?", body: "Las estadísticas, la tabla y las llaves se recalcularán automáticamente.", confirmLabel: "Editar" });
    if (ok) setEditing(true);
  };

  const clear = async () => {
    if (!(await warnDependents("Borrar el resultado"))) return;
    const ok = await confirmDialog({ title: "¿Borrar el resultado?", body: "El partido volverá a estado pendiente.", danger: true, confirmLabel: "Borrar" });
    if (ok) {
      const err = ctx?.reset ? await ctx.reset(m.id) : ctx ? "Solo el organizador puede borrar resultados." : (reset(m.id), null);
      if (err) return toast.error(err);
      toast.info("Resultado borrado.");
    }
  };

  const side = (p: Participant | undefined, align: "left" | "right", isWinner: boolean) => (
    <div className={`min-w-0 flex-1 ${done && winner && !isWinner ? "opacity-50" : ""}`}>
      <PlayerTag participant={p} team={getTeam(p && t.assignments[p.id])} align={align} />
      {done && isWinner && (
        <div className={`mt-1 flex items-center gap-1 text-[0.65rem] font-bold uppercase tracking-widest text-gold ${align === "right" ? "justify-end" : ""}`}>
          <Crown className="size-3" /> {m.walkover ? "Gana por W.O." : m.manualWinnerId ? "Ganador manual" : "Ganador"}
        </div>
      )}
    </div>
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass relative overflow-hidden p-4 ${m.status === "live" ? "!border-blaze/60 shadow-[0_0_40px_-12px_#ff7a1a]" : ""}`}
    >
      {m.status === "live" && <div className="absolute inset-x-0 top-0 h-0.5 animate-pulse-glow bg-blaze" />}
      <div className="mb-3 flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold uppercase tracking-widest text-mute">{m.label}</span>
        <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-bold uppercase tracking-wider ${STATUS[m.status].cls}`}>
          {m.status === "live" && <Radio className="size-3 animate-pulse" />}
          {STATUS[m.status].label}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {side(home, "left", !!winner && winner === m.homeId)}
        <div className="flex shrink-0 flex-col items-center">
          {inputsOpen ? (
            <div className="flex items-center gap-1.5">
              <input className="score-input" inputMode="numeric" type="number" min={0} max={99} value={hg} onChange={(e) => setHg(e.target.value)} aria-label={`Goles de ${home?.name}`} />
              <span className="display text-xl text-mute">:</span>
              <input className="score-input" inputMode="numeric" type="number" min={0} max={99} value={ag} onChange={(e) => setAg(e.target.value)} aria-label={`Goles de ${away?.name}`} />
            </div>
          ) : (
            <div className="display num flex items-center gap-2 text-4xl font-black">
              <span className={winner === m.homeId ? "text-white" : "text-soft"}>{m.homeGoals ?? "–"}</span>
              <span className="text-mute">:</span>
              <span className={winner === m.awayId ? "text-white" : "text-soft"}>{m.awayGoals ?? "–"}</span>
            </div>
          )}
          {inputsOpen && knockout && tiedNow && (
            <div className="mt-2 flex items-center gap-1.5 text-xs">
              <input className="score-input !h-9 !w-10 !text-lg" inputMode="numeric" type="number" min={0} max={99} value={hp} onChange={(e) => setHp(e.target.value)} aria-label="Penaltis local" />
              <span className="font-semibold uppercase text-mute">pen.</span>
              <input className="score-input !h-9 !w-10 !text-lg" inputMode="numeric" type="number" min={0} max={99} value={ap} onChange={(e) => setAp(e.target.value)} aria-label="Penaltis visitante" />
            </div>
          )}
          {!inputsOpen && m.homePens != null && m.awayPens != null && (
            <div className="num text-xs text-mute">({m.homePens}-{m.awayPens} pen.)</div>
          )}
        </div>
        {side(away, "right", !!winner && winner === m.awayId)}
      </div>

      {ready && !readOnly && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 border-t border-line pt-3">
          {inputsOpen ? (
            <>
              {!done && (!ctx || ctx.live) && (
                <Button size="sm" variant="ghost" onClick={() => setLive(m.id, m.status !== "live")}>
                  {m.status === "live" ? <><Square className="size-3.5" /> Pausar</> : <><Radio className="size-3.5" /> En juego</>}
                </Button>
              )}
              <Button size="sm" onClick={() => submit()}>
                <Check className="size-4" /> {done ? "Guardar" : "Registrar"}
              </Button>
              {(!ctx || ctx.manualWinner) && (
              <details className="relative">
                <summary className="flex h-9 cursor-pointer list-none items-center gap-1 rounded-lg px-3 font-display text-sm font-bold uppercase tracking-wider text-soft hover:bg-white/5 hover:text-white">
                  <Crown className="size-3.5" /> Ganador manual
                </summary>
                <div className="glass absolute bottom-full left-1/2 z-20 mb-2 w-48 -translate-x-1/2 p-1.5">
                  {[home!, away!].map((p) => (
                    <button key={p.id} onClick={(e) => { (e.currentTarget.closest("details") as HTMLDetailsElement).open = false; void manual(p); }} className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-white/10">
                      {p.name}
                    </button>
                  ))}
                </div>
              </details>
              )}
              {editing && <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>}
            </>
          ) : (
            <>
              <Button size="sm" variant="secondary" onClick={startEdit}><Pencil className="size-3.5" /> Editar</Button>
              {(!ctx || ctx.reset) && <Button size="sm" variant="ghost" onClick={clear}><RotateCcw className="size-3.5" /> Borrar</Button>}
            </>
          )}
        </div>
      )}
      {!ready && <p className="mt-3 text-center text-xs text-mute">Esperando a los ganadores de la ronda anterior.</p>}
    </motion.div>
  );
}
