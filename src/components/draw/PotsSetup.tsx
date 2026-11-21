"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Dices, LayoutGrid, ListChecks, Scale, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TeamCrest } from "@/components/ui/TeamCrest";
import { toast } from "@/components/ui/feedback";
import { defaultPotCount, potsConfigError, ratingSplit, POTS_METHOD_LABEL } from "@/lib/draw";
import { shuffle } from "@/lib/random";
import { getTeam, sortByRating } from "@/lib/teams";
import { useTournament } from "@/store/tournament";
import type { PotsMethod, Tournament } from "@/lib/types";

const OPTIONS: { id: PotsMethod; icon: typeof Scale; title: string; text: string }[] = [
  { id: "rating", icon: Scale, title: "Por valoración", text: "Clasificación automática según la valoración general verificada." },
  { id: "manual", icon: ListChecks, title: "Clasificación manual", text: "Tú decides en qué bombo va cada equipo, sin depender de valoraciones." },
  { id: "balanced", icon: Shuffle, title: "Aleatorios equilibrados", text: "Todos los equipos se reparten al azar en bombos de tamaño similar." },
];

/** Paso previo al sorteo por bombos: informa de las valoraciones que faltan y deja elegir el método. */
export function PotsSetup({ t, onBack }: { t: Tournament; onBack: () => void }) {
  const startDraw = useTournament((s) => s.startDraw);
  const n = t.participants.length;
  const repeats = t.settings.allowRepeatTeams;
  const { rated, unrated } = useMemo(() => ratingSplit(t.teamPool), [t.teamPool]);
  const canRate = unrated.length === 0;
  const [method, setMethod] = useState<PotsMethod>(canRate ? "rating" : "balanced");

  const maxPots = Math.max(1, Math.floor(t.teamPool.length / (repeats ? 1 : n)));
  const [count, setCount] = useState(() => Math.min(maxPots, Math.max(1, defaultPotCount(t.teamPool.length, n))));
  // Reparto manual: id → índice de bombo (0-based). Parte de la configuración guardada, si existe.
  const [assign, setAssign] = useState<Record<string, number>>(() => {
    const saved = t.potsConfig?.method === "manual" ? t.potsConfig.manualPots : undefined;
    const out: Record<string, number> = {};
    saved?.forEach((p, i) => p.forEach((id) => (out[id] = i)));
    return out;
  });

  const ordered = useMemo(() => sortByRating(t.teamPool), [t.teamPool]);
  const manualPots = useMemo(() => {
    const pots: string[][] = Array.from({ length: count }, () => []);
    for (const id of t.teamPool) if (assign[id] !== undefined && assign[id] < count) pots[assign[id]].push(id);
    return pots;
  }, [t.teamPool, assign, count]);
  const unassigned = t.teamPool.filter((id) => assign[id] === undefined || assign[id] >= count);

  const config = method === "manual" ? { method, manualPots: manualPots } : { method };
  const error = potsConfigError(t.teamPool, config, n, repeats, t.settings.edition ?? "FC25");

  const randomFill = () => {
    const next: Record<string, number> = {};
    shuffle(t.teamPool).forEach((id, i) => (next[id] = i % count)); // reparto por turnos: tamaños casi iguales
    setAssign(next);
  };

  const start = () => {
    const err = startDraw("pots", config);
    if (err) toast.error(err);
  };

  return (
    <div data-testid="pots-setup">
      <div className="mb-4 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="size-4" /> Modalidades</Button>
      </div>
      <div className="kicker flex items-center gap-2"><LayoutGrid className="size-4" /> Bombos</div>
      <h2 className="display mt-1 text-4xl font-extrabold">¿Cómo formamos los bombos?</h2>

      {unrated.length > 0 ? (
        <div className="glass mt-4 flex items-start gap-3 border-blaze/40 p-4 text-sm" role="note" data-testid="pots-unrated-note">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-blaze" />
          <p>
            Se encontraron <b>{unrated.length} equipos sin valoración verificada</b>
            {rated.length > 0 ? ` (y ${rated.length} con valoración)` : ""}. Puedes utilizar bombos manuales o una distribución aleatoria equilibrada.
            No se mezclan equipos con y sin valoración usando valores ficticios.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-mute">Los {rated.length} equipos del sorteo tienen valoración verificada: puedes clasificarlos automáticamente.</p>
      )}

      <div className="mt-5 grid gap-3 md:grid-cols-3" role="radiogroup" aria-label="Método de bombos">
        {OPTIONS.map((o) => {
          const disabled = o.id === "rating" && !canRate;
          const active = method === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              data-pots-method={o.id}
              onClick={() => setMethod(o.id)}
              className={`glass p-5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${active ? "!border-neon shadow-[0_0_40px_-12px_#3dff8b]" : "glass-hover"}`}
            >
              <o.icon className="size-7 text-neon" />
              <div className="display mt-3 text-2xl font-extrabold">{o.title}</div>
              <p className="mt-1 text-sm text-soft">{o.text}</p>
              {disabled && <p className="mt-2 text-xs text-blaze">No disponible: hay equipos sin valoración.</p>}
            </button>
          );
        })}
      </div>

      {method === "manual" && (
        <div className="glass mt-5 p-4" data-testid="pots-manual">
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              Número de bombos
              <input type="number" min={1} max={maxPots} value={count} onChange={(e) => setCount(Math.max(1, Math.min(maxPots, +e.target.value || 1)))} className="field !w-20 !py-1.5" aria-label="Número de bombos" />
            </label>
            <Button variant="secondary" size="sm" onClick={randomFill}><Dices className="size-4" /> Prellenar al azar</Button>
            <span className="text-mute">{unassigned.length ? `${unassigned.length} sin asignar` : "Todos asignados"}</span>
          </div>
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            {manualPots.map((p, i) => (
              <span key={i} className={`rounded-full border px-2.5 py-1 ${p.length >= (repeats ? 1 : n) ? "border-neon/40 text-neon" : "border-blaze/40 text-blaze"}`}>Bombo {i + 1}: {p.length}</span>
            ))}
          </div>
          <ul className="grid max-h-[420px] gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
            {ordered.map((id) => {
              const team = getTeam(id)!;
              return (
                <li key={id} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2 py-1.5 text-sm">
                  <TeamCrest team={team} size={24} />
                  <span className="min-w-0 flex-1 truncate">{team.name}</span>
                  <select className="field !w-24 !py-1" value={assign[id] !== undefined && assign[id] < count ? assign[id] : ""} onChange={(e) => setAssign((a) => { const { [id]: _drop, ...rest } = a; void _drop; return e.target.value === "" ? rest : { ...rest, [id]: +e.target.value }; })} aria-label={`Bombo de ${team.name}`}>
                    <option value="">—</option>
                    {Array.from({ length: count }, (_, i) => <option key={i} value={i}>Bombo {i + 1}</option>)}
                  </select>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {method === "balanced" && (
        <p className="mt-4 text-sm text-soft">
          Se formarán {defaultPotCount(t.teamPool.length, repeats ? 1 : n)} bombo(s) con unos {Math.floor(t.teamPool.length / defaultPotCount(t.teamPool.length, repeats ? 1 : n))} equipos cada uno, sin duplicados, y todos los equipos quedan asignados.
        </p>
      )}
      {method === "rating" && <p className="mt-4 text-sm text-soft">Los equipos se ordenan por valoración general y se agrupan en bombos de nivel similar.</p>}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button size="lg" onClick={start} disabled={!!error} data-testid="pots-start">Iniciar bombos · {POTS_METHOD_LABEL[method]}</Button>
        {error && <span className="text-sm text-blaze" role="alert">{error}</span>}
      </div>
    </div>
  );
}
