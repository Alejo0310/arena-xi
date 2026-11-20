import type { Match, Participant, Tournament } from "../types";
import { hasScore, isPlayed, matchWinner } from "./match";
import { knockoutPodium } from "./knockout";
import { computeStandings } from "./league";

export interface ParticipantStats {
  participantId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  winRate: number;
}

export interface TournamentStats {
  played: number;
  pending: number;
  totalGoals: number;
  avgGoals: number;
  perParticipant: ParticipantStats[];
  topScorer?: ParticipantStats;
  mostWins?: ParticipantStats;
  bestGD?: ParticipantStats;
  bestDefense?: ParticipantStats;
  biggestWin?: Match;
  highestScoring?: Match;
}

/** Estadísticas a partir de los partidos con marcador (sirve para liga y eliminatorias). */
export function computeStats(participants: Participant[], matches: Match[]): TournamentStats {
  const map = new Map<string, ParticipantStats>(
    participants.map((p) => [p.id, { participantId: p.id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, winRate: 0 }]),
  );
  const played = matches.filter(isPlayed);
  const scored = played.filter(hasScore);
  let totalGoals = 0;

  for (const m of played) {
    const h = map.get(m.homeId!);
    const a = map.get(m.awayId!);
    if (!h || !a) continue;
    h.played++; a.played++;
    if (hasScore(m)) {
      h.gf += m.homeGoals; h.ga += m.awayGoals;
      a.gf += m.awayGoals; a.ga += m.homeGoals;
      totalGoals += m.homeGoals + m.awayGoals;
    }
    const w = matchWinner(m);
    if (w === m.homeId) { h.won++; a.lost++; }
    else if (w === m.awayId) { a.won++; h.lost++; }
    else { h.drawn++; a.drawn++; }
  }
  const per = [...map.values()].map((s) => ({ ...s, gd: s.gf - s.ga, winRate: s.played ? s.won / s.played : 0 }));
  const withGames = per.filter((s) => s.played > 0);
  const best = (score: (s: ParticipantStats) => number) =>
    withGames.length ? [...withGames].sort((a, b) => score(b) - score(a))[0] : undefined;

  const margin = (m: Match) => Math.abs((m.homeGoals ?? 0) - (m.awayGoals ?? 0));
  const goals = (m: Match) => (m.homeGoals ?? 0) + (m.awayGoals ?? 0);
  const realScored = scored.filter((m) => !m.walkover);

  return {
    played: played.length,
    pending: matches.filter((m) => m.status !== "done").length,
    totalGoals,
    avgGoals: scored.length ? totalGoals / scored.length : 0,
    perParticipant: per.sort((a, b) => b.won - a.won || b.gd - a.gd || b.gf - a.gf),
    topScorer: best((s) => s.gf * 1000 + s.gd),
    mostWins: best((s) => s.won * 1000 + s.gd),
    bestGD: best((s) => s.gd * 1000 + s.gf),
    bestDefense: best((s) => -(s.played ? s.ga / s.played : 99) * 1000 + s.played),
    biggestWin: [...realScored].sort((a, b) => margin(b) - margin(a) || goals(b) - goals(a)).find((m) => margin(m) > 0),
    highestScoring: [...realScored].sort((a, b) => goals(b) - goals(a))[0],
  };
}

export interface HistoricalRow {
  name: string;
  color: string;
  tournaments: number;
  titles: number;
  podiums: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
}

/** Ranking histórico acumulado entre torneos finalizados, agrupando por nombre. */
export function historicalRanking(tournaments: Tournament[]): HistoricalRow[] {
  const rows = new Map<string, HistoricalRow>();
  for (const t of tournaments) {
    if (t.phase !== "finished") continue;
    const podium = t.settings.format === "knockout"
      ? Object.values(knockoutPodium(t.matches))
      : computeStandings(t.participants, t.matches, t.settings).slice(0, 3).map((r) => r.participantId);
    const stats = computeStats(t.participants, t.matches);
    for (const p of t.participants) {
      const key = p.name.trim().toLowerCase();
      const row = rows.get(key) ?? { name: p.name, color: p.color, tournaments: 0, titles: 0, podiums: 0, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0 };
      const s = stats.perParticipant.find((x) => x.participantId === p.id)!;
      row.tournaments++;
      if (t.championId === p.id) row.titles++;
      if (podium.includes(p.id)) row.podiums++;
      row.played += s.played; row.won += s.won; row.drawn += s.drawn; row.lost += s.lost;
      row.gf += s.gf; row.ga += s.ga;
      rows.set(key, row);
    }
  }
  return [...rows.values()].sort((a, b) => b.titles - a.titles || b.podiums - a.podiums || b.won - a.won || (b.gf - b.ga) - (a.gf - a.ga));
}
