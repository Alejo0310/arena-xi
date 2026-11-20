import type { DrawMode, DrawRecord, DrawState, Tournament } from "./types";
import { pick, sample, shuffle } from "./random";
import { sortByRating } from "./teams";

/*
 * Lógica del sorteo, independiente de la UI. Regla clave: el resultado se decide
 * aquí con aleatoriedad criptográfica ANTES de cualquier animación; la UI solo lo revela.
 */

export const DRAW_MODES: { id: DrawMode; name: string; tagline: string }[] = [
  { id: "roulette", name: "Ruleta", tagline: "Gira la rueda y deja que el destino elija." },
  { id: "envelopes", name: "Sobres", tagline: "Elige un sobre misterioso y ábrelo." },
  { id: "machine", name: "Tómbola", tagline: "Bolas en el bombo, una sale disparada." },
  { id: "draft", name: "Draft", tagline: "Tres cartas al azar: tú eliges una." },
  { id: "pots", name: "Bombos", tagline: "Equipos del mismo nivel para todos." },
];

export const DRAFT_CHOICES = 3;

/** Agrupa los equipos por valoración en bombos de `size`; un bombo final incompleto se fusiona con el anterior. */
export function buildPots(pool: readonly string[], size: number): string[][] {
  const sorted = sortByRating(pool);
  const pots: string[][] = [];
  for (let i = 0; i < sorted.length; i += size) pots.push(sorted.slice(i, i + size));
  if (pots.length > 1 && pots[pots.length - 1].length < size) {
    const last = pots.pop()!;
    pots[pots.length - 1].push(...last);
  }
  return pots;
}

export function drawError(t: Tournament, mode: DrawMode): string | null {
  const n = t.participants.length;
  if (n < 2) return "Se necesitan al menos 2 participantes.";
  if (t.teamPool.length === 0) return "Selecciona al menos un equipo para el sorteo.";
  if (!t.settings.allowRepeatTeams && t.teamPool.length < n)
    return `Hay ${n} participantes y solo ${t.teamPool.length} equipos. Añade equipos o permite repetidos.`;
  if (mode === "draft" && !t.settings.allowRepeatTeams && t.teamPool.length < n) return "No hay suficientes equipos para el draft.";
  return null;
}

export function initDraw(t: Tournament, mode: DrawMode): DrawState {
  const order = shuffle(t.participants.map((p) => p.id));
  const state: DrawState = { mode, order, cursor: 0, pool: [...t.teamPool] };
  if (mode === "pots") {
    state.pots = buildPots(t.teamPool, t.participants.length);
    state.potIndex = 0;
    state.pool = [...state.pots[0]];
  }
  if (mode === "envelopes") state.envelopes = makeEnvelopes(state.pool, order.length, t.settings.allowRepeatTeams);
  if (mode === "draft") state.draftOptions = sample(state.pool, DRAFT_CHOICES);
  return state;
}

function makeEnvelopes(pool: string[], count: number, repeats: boolean): string[] {
  if (repeats) return Array.from({ length: count }, () => pick(pool));
  return shuffle(pool).slice(0, count);
}

/** Bombos: cambiar el bombo del que se sortea (solo antes de la primera asignación). */
export function selectPot(state: DrawState, potIndex: number): DrawState {
  if (!state.pots || state.cursor > 0) return state;
  return { ...state, potIndex, pool: [...state.pots[potIndex]] };
}

export function currentParticipant(state: DrawState): string | null {
  return state.order[state.cursor] ?? null;
}

export function isDrawComplete(state: DrawState | null): boolean {
  return !!state && state.cursor >= state.order.length;
}

/** Decide el equipo para el turno actual (ruleta, tómbola y bombos). */
export function rollTeam(state: DrawState): string {
  return pick(state.pool);
}

/** Avanza el sorteo tras revelar una asignación. */
export function commitPick(state: DrawState, teamId: string, allowRepeats: boolean, envelopeIndex?: number): DrawState {
  const pool = allowRepeats ? state.pool : state.pool.filter((id) => id !== teamId);
  const next: DrawState = { ...state, cursor: state.cursor + 1, pool };
  if (state.envelopes && envelopeIndex !== undefined) {
    next.envelopes = state.envelopes.map((e, i) => (i === envelopeIndex ? null : e));
  }
  if (state.mode === "draft") next.draftOptions = pool.length ? sample(pool, DRAFT_CHOICES) : [];
  return next;
}

/** Sorteo completo: genera de golpe una asignación válida para todos los que faltan. */
export function drawAll(state: DrawState, allowRepeats: boolean): { participantId: string; teamId: string; envelopeIndex?: number }[] {
  const pending = state.order.slice(state.cursor);
  if (state.mode === "envelopes" && state.envelopes) {
    const closed = shuffle(state.envelopes.map((e, i) => (e ? i : -1)).filter((i) => i >= 0));
    return pending.map((participantId, k) => ({ participantId, teamId: state.envelopes![closed[k]]!, envelopeIndex: closed[k] }));
  }
  if (allowRepeats) return pending.map((participantId) => ({ participantId, teamId: pick(state.pool) }));
  const teams = shuffle(state.pool);
  return pending.map((participantId, k) => ({ participantId, teamId: teams[k] }));
}

export function validateAssignments(assignments: Record<string, string>, participantIds: string[], allowRepeats: boolean): boolean {
  const teams = participantIds.map((id) => assignments[id]);
  if (teams.some((t) => !t)) return false;
  return allowRepeats || new Set(teams).size === teams.length;
}

export function record(participantId: string, teamId: string, mode: DrawMode, envelopeIndex?: number): DrawRecord {
  return { participantId, teamId, mode, at: Date.now(), ...(envelopeIndex !== undefined ? { envelopeIndex } : {}) };
}
