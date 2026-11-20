import type { Match, Tournament } from "../types";
import { shuffle } from "../random";
import { generateLeague, computeStandings } from "./league";
import { generateKnockout, knockoutChampion, resolveKnockout } from "./knockout";
import { applyResult, clearResult, type ResultInput, validateResult } from "./match";

/** Genera los partidos según la modalidad. El orden de siembra/calendario es aleatorio. */
export function buildMatches(t: Tournament): Match[] {
  const ids = shuffle(t.participants.map((p) => p.id));
  return t.settings.format === "league"
    ? generateLeague(ids, t.settings.legs)
    : generateKnockout(ids, { thirdPlace: t.settings.thirdPlace });
}

export function isComplete(t: Tournament): boolean {
  return t.matches.length > 0 && t.matches.every((m) => m.status === "done");
}

export function computeChampion(t: Tournament): string | null {
  if (!isComplete(t)) return null;
  if (t.settings.format === "knockout") return knockoutChampion(t.matches);
  return computeStandings(t.participants, t.matches, t.settings)[0]?.participantId ?? null;
}

/** Recalcula fase y campeón tras cualquier cambio en los partidos. */
export function settle(t: Tournament): Tournament {
  const matches = t.settings.format === "knockout" ? resolveKnockout(t.matches) : t.matches;
  const next = { ...t, matches };
  const champion = computeChampion(next);
  return {
    ...next,
    championId: champion,
    phase: champion ? "finished" : "playing",
    finishedAt: champion ? (t.finishedAt ?? Date.now()) : undefined,
    updatedAt: Date.now(),
  };
}

export function recordResult(t: Tournament, matchId: string, r: ResultInput): { tournament?: Tournament; error?: string } {
  const knockout = t.settings.format === "knockout";
  const m = t.matches.find((x) => x.id === matchId);
  if (!m) return { error: "Partido no encontrado." };
  if (m.isBye) return { error: "Los descansos no admiten resultado." };
  const err = validateResult(m, r, knockout);
  if (err) return { error: err };
  const matches = t.matches.map((x) => (x.id === matchId ? applyResult(x, r, knockout) : x));
  return { tournament: settle({ ...t, matches }) };
}

export function resetResult(t: Tournament, matchId: string): Tournament {
  return settle({ ...t, matches: t.matches.map((x) => (x.id === matchId && !x.isBye ? clearResult(x) : x)) });
}

export function setLive(t: Tournament, matchId: string, live: boolean): Tournament {
  return {
    ...t,
    updatedAt: Date.now(),
    matches: t.matches.map((x) => {
      if (x.id === matchId && x.status !== "done") return { ...x, status: live ? "live" : "pending" };
      // Solo un partido en juego a la vez.
      if (live && x.status === "live" && x.id !== matchId) return { ...x, status: "pending" };
      return x;
    }),
  };
}

/** Partidos jugables (con ambos participantes) que aún no han terminado, en orden. */
export function upcomingMatches(t: Tournament): Match[] {
  return t.matches
    .filter((m) => m.status !== "done" && m.homeId && m.awayId)
    .sort((a, b) => Number(b.status === "live") - Number(a.status === "live") || a.round - b.round || (a.slot ?? 0) - (b.slot ?? 0));
}

export function recentResults(t: Tournament, limit = 5): Match[] {
  return t.matches
    .filter((m) => m.status === "done" && !m.isBye)
    .sort((a, b) => (b.playedAt ?? 0) - (a.playedAt ?? 0))
    .slice(0, limit);
}
