import type { DrawMode, DrawRecord, DrawState, PendingPick, TeamKind, Tournament } from "./types";
import { pick, sample, shuffle, uid } from "./random";
import { sortByRating } from "./teams";
import { categoryError, sanitizePool, CATEGORY_LABEL } from "./category";

/*
 * Lógica del sorteo, independiente de la UI.
 *  1. `decidePick` decide el equipo con aleatoriedad criptográfica y lo deja PENDIENTE.
 *  2. La UI anima y revela ese resultado (el cursor no cambia mientras tanto).
 *  3. `confirmPick` lo consolida y avanza al siguiente participante.
 * Así el nombre mostrado y el resultado animado nunca se desincronizan, y recargar
 * la página a mitad de animación no permite volver a sortear.
 */

export const DRAW_MODES: { id: DrawMode; name: string; tagline: string; action: string }[] = [
  { id: "roulette", name: "Ruleta", tagline: "Gira la rueda y deja que el destino elija.", action: "Girar ruleta" },
  { id: "envelopes", name: "Sobres", tagline: "Elige un sobre misterioso y ábrelo.", action: "Abrir sobre" },
  { id: "machine", name: "Tómbola", tagline: "Bolas en el bombo, una sale disparada.", action: "Sortear bola" },
  { id: "draft", name: "Draft", tagline: "Tres cartas al azar: tú eliges una.", action: "Elegir carta" },
  { id: "pots", name: "Bombos", tagline: "Equipos del mismo nivel para todos.", action: "Sortear del bombo" },
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
  const kind = t.settings.category;
  if (n < 2) return "Se necesitan al menos 2 participantes.";
  const catErr = categoryError(t.teamPool, kind);
  if (catErr) return catErr;
  if (t.teamPool.length === 0) return `Selecciona al menos un equipo (${CATEGORY_LABEL[kind].toLowerCase()}) para el sorteo.`;
  if (!t.settings.allowRepeatTeams && t.teamPool.length < n)
    return `Hay ${n} participantes y solo ${t.teamPool.length} equipos. Añade equipos o permite repetidos.`;
  if (!DRAW_MODES.some((m) => m.id === mode)) return "Modalidad de sorteo desconocida.";
  return null;
}

export function initDraw(t: Tournament, mode: DrawMode): DrawState {
  const order = shuffle(t.participants.map((p) => p.id));
  const pool = sanitizePool(t.teamPool, t.settings.category);
  const state: DrawState = { id: uid("d"), mode, order, cursor: 0, pool, pending: null };
  if (mode === "pots") {
    state.pots = buildPots(pool, t.participants.length);
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
  if (!state.pots || state.cursor > 0 || state.pending || !state.pots[potIndex]) return state;
  return { ...state, potIndex, pool: [...state.pots[potIndex]] };
}

export function currentParticipant(state: DrawState): string | null {
  return state.order[state.cursor] ?? null;
}

export function isDrawComplete(state: DrawState | null): boolean {
  return !!state && state.cursor >= state.order.length && !state.pending;
}

export function isLastTurn(state: DrawState): boolean {
  return state.cursor === state.order.length - 1;
}

export interface Choice {
  teamId?: string;
  envelopeIndex?: number;
}

/**
 * Decide el equipo del turno actual sin avanzar el cursor.
 * Valida la elección (sobre cerrado, carta repartida) y la categoría.
 */
export function decidePick(state: DrawState, kind: TeamKind, choice: Choice = {}): { pending?: PendingPick; error?: string } {
  if (state.pending) return { error: "Ya hay un sorteo en curso." };
  const participantId = currentParticipant(state);
  if (!participantId) return { error: "Todos los participantes ya tienen equipo." };

  let teamId: string | null | undefined;
  let envelopeIndex: number | undefined;
  if (state.mode === "envelopes") {
    envelopeIndex = choice.envelopeIndex;
    if (envelopeIndex === undefined || !state.envelopes?.[envelopeIndex]) return { error: "Ese sobre no está disponible." };
    teamId = state.envelopes[envelopeIndex];
  } else if (state.mode === "draft") {
    if (!choice.teamId || !state.draftOptions?.includes(choice.teamId)) return { error: "Esa carta no está en el reparto." };
    teamId = choice.teamId;
  } else {
    if (!state.pool.length) return { error: "No quedan equipos disponibles." };
    teamId = pick(state.pool);
  }
  const err = categoryError([teamId], kind);
  if (err) return { error: err };
  return { pending: { participantId, teamId: teamId!, envelopeIndex, at: Date.now() } };
}

/** Consolida el resultado pendiente y avanza al siguiente participante. */
export function confirmPick(state: DrawState, allowRepeats: boolean): { state: DrawState; record: DrawRecord } | null {
  const p = state.pending;
  if (!p || currentParticipant(state) !== p.participantId) return null;
  const pool = allowRepeats ? state.pool : state.pool.filter((id) => id !== p.teamId);
  const next: DrawState = { ...state, cursor: state.cursor + 1, pool, pending: null };
  if (state.envelopes && p.envelopeIndex !== undefined) {
    next.envelopes = state.envelopes.map((e, i) => (i === p.envelopeIndex ? null : e));
  }
  if (state.mode === "draft") next.draftOptions = pool.length ? sample(pool, DRAFT_CHOICES) : [];
  return { state: next, record: record(p.participantId, p.teamId, state.mode, p.envelopeIndex) };
}

/** Sorteo completo: genera de golpe una asignación válida para todos los que faltan. */
export function drawAll(state: DrawState, allowRepeats: boolean): { participantId: string; teamId: string; envelopeIndex?: number }[] {
  if (state.pending) return [];
  const pending = state.order.slice(state.cursor);
  if (state.mode === "envelopes" && state.envelopes) {
    const closed = shuffle(state.envelopes.map((e, i) => (e ? i : -1)).filter((i) => i >= 0));
    return pending.map((participantId, k) => ({ participantId, teamId: state.envelopes![closed[k]]!, envelopeIndex: closed[k] }));
  }
  if (allowRepeats) return pending.map((participantId) => ({ participantId, teamId: pick(state.pool) }));
  const teams = shuffle(state.pool);
  return pending.map((participantId, k) => ({ participantId, teamId: teams[k] }));
}

/** Asignaciones completas, sin repetidos (salvo permiso) y todas de la misma categoría. */
export function validateAssignments(assignments: Record<string, string>, participantIds: string[], allowRepeats: boolean, kind: TeamKind): boolean {
  const teams = participantIds.map((id) => assignments[id]);
  if (teams.some((t) => !t)) return false;
  if (categoryError(teams, kind)) return false;
  return allowRepeats || new Set(teams).size === teams.length;
}

export function record(participantId: string, teamId: string, mode: DrawMode, envelopeIndex?: number): DrawRecord {
  return { participantId, teamId, mode, at: Date.now(), ...(envelopeIndex !== undefined ? { envelopeIndex } : {}) };
}
