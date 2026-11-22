import type { Match } from "../types";

export interface ResultInput {
  homeGoals: number | null;
  awayGoals: number | null;
  homePens?: number | null;
  awayPens?: number | null;
  manualWinnerId?: string | null;
}

export function isPlayed(m: Match): boolean {
  return m.status === "done" && !m.isBye;
}

export function hasScore(m: Match): m is Match & { homeGoals: number; awayGoals: number } {
  return m.homeGoals !== null && m.awayGoals !== null;
}

/** Ganador de un partido terminado, o null si no lo hay (empate de liga o pendiente). */
export function matchWinner(m: Match): string | null {
  if (m.status !== "done") return null;
  if (m.isBye) return m.homeId ?? m.awayId;
  if (m.manualWinnerId) return m.manualWinnerId;
  if (!hasScore(m)) return null;
  if (m.homeGoals > m.awayGoals) return m.homeId;
  if (m.awayGoals > m.homeGoals) return m.awayId;
  if (m.homePens != null && m.awayPens != null && m.homePens !== m.awayPens) {
    return m.homePens > m.awayPens ? m.homeId : m.awayId;
  }
  return null;
}

/** Resultado de la tanda de penaltis ("4-2") cuando el partido terminó empatado y se resolvió desde los once metros. */
export function shootoutText(m: Pick<Match, "homeGoals" | "awayGoals" | "homePens" | "awayPens">): string | null {
  if (m.homePens == null || m.awayPens == null) return null;
  if (m.homeGoals == null || m.homeGoals !== m.awayGoals) return null;
  return `${m.homePens}-${m.awayPens}`;
}

export function matchLoser(m: Match): string | null {
  if (m.isBye) return null;
  const w = matchWinner(m);
  if (!w) return null;
  return w === m.homeId ? m.awayId : m.homeId;
}

function isGoals(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 99;
}

/**
 * Valida un resultado antes de registrarlo. Devuelve un mensaje de error o null.
 * En eliminatorias un empate debe resolverse con penaltis o un ganador manual.
 */
export function validateResult(m: Match, r: ResultInput, knockout: boolean): string | null {
  if (!m.homeId || !m.awayId) return "El enfrentamiento aún no tiene a los dos participantes.";
  if (r.manualWinnerId) {
    if (r.manualWinnerId !== m.homeId && r.manualWinnerId !== m.awayId) return "El ganador no pertenece a este partido.";
    const bothNull = r.homeGoals === null && r.awayGoals === null;
    if (!bothNull && !(isGoals(r.homeGoals) && isGoals(r.awayGoals))) return "Marcador inválido.";
    if (!bothNull && r.homeGoals !== r.awayGoals) {
      const scoreWinner = r.homeGoals! > r.awayGoals! ? m.homeId : m.awayId;
      if (scoreWinner !== r.manualWinnerId) return "El ganador manual contradice el marcador. Déjalo vacío o corrígelo.";
    }
    return null;
  }
  if (!isGoals(r.homeGoals) || !isGoals(r.awayGoals)) return "Introduce los goles de ambos participantes (0–99).";
  if (knockout && r.homeGoals === r.awayGoals) {
    if (!isGoals(r.homePens) || !isGoals(r.awayPens)) return "Empate en eliminatoria: introduce la tanda de penaltis o elige el ganador manualmente.";
    if (r.homePens === r.awayPens) return "La tanda de penaltis no puede terminar empatada.";
  }
  return null;
}

/** Aplica un resultado validado; en liga un ganador manual sin marcador se registra como W.O. 3-0. */
export function applyResult(m: Match, r: ResultInput, knockout: boolean): Match {
  let { homeGoals, awayGoals } = r;
  let walkover = false;
  if (r.manualWinnerId && homeGoals === null && awayGoals === null) {
    walkover = true;
    if (!knockout) {
      homeGoals = r.manualWinnerId === m.homeId ? 3 : 0;
      awayGoals = r.manualWinnerId === m.homeId ? 0 : 3;
    }
  }
  const tied = homeGoals !== null && homeGoals === awayGoals;
  return {
    ...m,
    homeGoals,
    awayGoals,
    homePens: knockout && tied && !r.manualWinnerId ? (r.homePens ?? null) : null,
    awayPens: knockout && tied && !r.manualWinnerId ? (r.awayPens ?? null) : null,
    manualWinnerId: r.manualWinnerId ?? null,
    walkover,
    status: "done",
    playedAt: Date.now(),
  };
}

export function clearResult(m: Match): Match {
  return {
    ...m,
    homeGoals: null,
    awayGoals: null,
    homePens: null,
    awayPens: null,
    manualWinnerId: null,
    walkover: false,
    status: "pending",
    playedAt: undefined,
  };
}
