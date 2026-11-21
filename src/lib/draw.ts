import type { DrawMode, DrawRecord, DrawState, PendingPick, PotsConfig, PotsMethod, Tournament } from "./types";
import { pick, sample, shuffle, uid } from "./random";
import { getTeam, isRated, sortByRating } from "./teams";
import { categoryError, sanitizePool, scopeOf, CATEGORY_LABEL, type ScopeLike } from "./category";

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

/** Equipos de un conjunto con y sin valoración completa. Un null nunca se trata como 0. */
export function ratingSplit(ids: readonly string[]): { rated: string[]; unrated: string[] } {
  const rated: string[] = [];
  const unrated: string[] = [];
  for (const id of ids) (isRated(getTeam(id)) ? rated : unrated).push(id);
  return { rated, unrated };
}

/** Bombos aleatorios equilibrados: reparte todos los equipos al azar en k bombos de tamaño casi igual (cada uno con al menos `size`). */
export function buildBalancedPots(pool: readonly string[], size: number): string[][] {
  const k = Math.max(1, Math.floor(pool.length / Math.max(1, size)));
  const pots: string[][] = Array.from({ length: k }, () => []);
  shuffle(pool).forEach((id, i) => pots[i % k].push(id));
  return pots;
}

/** Número de bombos por defecto: los que permiten que cada uno tenga al menos `size` equipos. */
export const defaultPotCount = (teams: number, size: number) => Math.max(1, Math.floor(teams / Math.max(1, size)));

/** Valida un reparto manual: todos los equipos del sorteo, una sola vez, sin bombos vacíos o demasiado pequeños. */
export function manualPotsError(pool: readonly string[], pots: readonly (readonly string[])[], participants: number, allowRepeats: boolean): string | null {
  const flat = pots.flat();
  if (new Set(flat).size !== flat.length) return "Hay equipos repetidos entre los bombos.";
  const inPool = new Set(pool);
  if (flat.some((id) => !inPool.has(id))) return "Hay equipos que no forman parte del sorteo.";
  const missing = pool.filter((id) => !flat.includes(id));
  if (missing.length) return `Faltan ${missing.length} equipos por asignar a un bombo.`;
  const need = allowRepeats ? 1 : participants;
  const bad = pots.findIndex((p) => p.length < need);
  if (bad >= 0) return `El bombo ${bad + 1} tiene ${pots[bad].length} equipos y se necesitan al menos ${need}.`;
  return null;
}

/** Comprueba que el método elegido puede aplicarse a los equipos del sorteo. */
export function potsConfigError(pool: readonly string[], cfg: PotsConfig, participants: number, allowRepeats: boolean, edition = "FC25"): string | null {
  if (cfg.method === "rating") {
    const { unrated } = ratingSplit(pool);
    if (unrated.length) return `${unrated.length} equipos no tienen valoración verificada en ${edition.replace("FC", "FC ")}: no se pueden clasificar por valoración. Usa bombos manuales o aleatorios equilibrados.`;
    return null;
  }
  if (cfg.method === "manual") return manualPotsError(pool, cfg.manualPots ?? [], participants, allowRepeats);
  if (cfg.method === "balanced") return null;
  return "Método de bombos desconocido.";
}

export function buildPotsBy(cfg: PotsConfig, pool: readonly string[], participants: number): string[][] {
  if (cfg.method === "rating") return buildPots(pool, participants);
  if (cfg.method === "manual") return (cfg.manualPots ?? []).map((p) => [...p]);
  return buildBalancedPots(pool, participants);
}

export const POTS_METHOD_LABEL: Record<PotsMethod, string> = {
  rating: "Por valoración verificada",
  manual: "Clasificación manual",
  balanced: "Aleatorios equilibrados",
};

export function drawError(t: Tournament, mode: DrawMode, pots?: PotsConfig): string | null {
  const n = t.participants.length;
  const kind = t.settings.category;
  const scope = scopeOf(t.settings);
  if (n < 2) return "Se necesitan al menos 2 participantes.";
  const catErr = categoryError(t.teamPool, scope);
  if (catErr) return catErr;
  if (t.teamPool.length === 0) return `Selecciona al menos un equipo (${CATEGORY_LABEL[kind].toLowerCase()}) para el sorteo.`;
  if (!t.settings.allowRepeatTeams && t.teamPool.length < n)
    return `Hay ${n} participantes y solo ${t.teamPool.length} equipos. Añade equipos o permite repetidos.`;
  if (!DRAW_MODES.some((m) => m.id === mode)) return "Modalidad de sorteo desconocida.";
  if (mode === "pots") {
    const cfg = pots ?? t.potsConfig;
    if (!cfg) return "Elige cómo formar los bombos.";
    const err = potsConfigError(t.teamPool, cfg, n, t.settings.allowRepeatTeams, t.settings.edition ?? "FC25");
    if (err) return err;
  }
  return null;
}

export function initDraw(t: Tournament, mode: DrawMode, potsCfg?: PotsConfig): DrawState {
  const order = shuffle(t.participants.map((p) => p.id));
  const pool = sanitizePool(t.teamPool, scopeOf(t.settings));
  const state: DrawState = { id: uid("d"), mode, order, cursor: 0, pool, pending: null };
  if (mode === "pots") {
    const cfg = potsCfg ?? t.potsConfig ?? { method: ratingSplit(pool).unrated.length ? ("balanced" as const) : ("rating" as const) };
    state.pots = buildPotsBy(cfg, pool, t.participants.length);
    state.potsMethod = cfg.method;
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
export function decidePick(state: DrawState, kind: ScopeLike, choice: Choice = {}): { pending?: PendingPick; error?: string } {
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
export function validateAssignments(assignments: Record<string, string>, participantIds: string[], allowRepeats: boolean, kind: ScopeLike): boolean {
  const teams = participantIds.map((id) => assignments[id]);
  if (teams.some((t) => !t)) return false;
  if (categoryError(teams, kind)) return false;
  return allowRepeats || new Set(teams).size === teams.length;
}

export function record(participantId: string, teamId: string, mode: DrawMode, envelopeIndex?: number): DrawRecord {
  return { participantId, teamId, mode, at: Date.now(), ...(envelopeIndex !== undefined ? { envelopeIndex } : {}) };
}
