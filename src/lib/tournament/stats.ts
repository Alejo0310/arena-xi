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

// ---------------------------------------------------------------------------------------------
// Informe del torneo (exportación a PNG/PDF): estadísticas ampliadas
// ---------------------------------------------------------------------------------------------

export interface ShootoutInfo {
  match: Match;
  winnerId: string;
  home: string;
  away: string;
  /** Marcador de la tanda desde el punto de vista del local, p. ej. "4-2". */
  pens: string;
}

export interface TournamentReport extends TournamentStats {
  /** Partidos decididos por penaltis (empate + tanda). */
  shootouts: ShootoutInfo[];
  /** Victorias por penaltis de cada participante. */
  penaltyWins: Map<string, number>;
  /** Partidos con la portería a cero (goles recibidos = 0) por participante. */
  cleanSheets: Map<string, number>;
  /** Mejor racha de victorias consecutivas por participante. */
  bestStreak: Map<string, number>;
  /** Participantes que no han perdido ningún partido. */
  unbeaten: string[];
  /** Goles marcados en cada ronda (eliminatorias) o jornada (liga). */
  goalsByRound: { round: number; label: string; goals: number; matches: number }[];
  /** Camino del campeón: sus partidos jugados, en orden. */
  championPath: Match[];
  podium: { first: string | null; second: string | null; third: string | null } | null;
  /** Partidos que terminaron igualados en el marcador. */
  draws: number;
  homeWins: number;
  awayWins: number;
}

const byOrder = (a: Match, b: Match) => (a.playedAt ?? 0) - (b.playedAt ?? 0) || a.round - b.round || (a.slot ?? 0) - (b.slot ?? 0);

export function computeReport(t: Tournament): TournamentReport {
  const base = computeStats(t.participants, t.matches);
  const played = t.matches.filter(isPlayed).sort(byOrder);
  const nameOf = (id: string) => t.participants.find((p) => p.id === id)?.name ?? "—";

  const shootouts: ShootoutInfo[] = [];
  const penaltyWins = new Map<string, number>();
  const cleanSheets = new Map<string, number>();
  const streak = new Map<string, number>();
  const bestStreak = new Map<string, number>();
  const losers = new Set<string>();
  let draws = 0;
  let homeWins = 0;
  let awayWins = 0;

  for (const m of played) {
    const w = matchWinner(m);
    const hasPens = m.homePens != null && m.awayPens != null && m.homeGoals === m.awayGoals;
    if (hasPens && w) {
      shootouts.push({ match: m, winnerId: w, home: nameOf(m.homeId!), away: nameOf(m.awayId!), pens: `${m.homePens}-${m.awayPens}` });
      penaltyWins.set(w, (penaltyWins.get(w) ?? 0) + 1);
    }
    if (hasScore(m) && m.homeGoals === m.awayGoals) draws++;
    if (w === m.homeId) homeWins++;
    else if (w === m.awayId) awayWins++;
    if (hasScore(m) && !m.walkover) {
      if (m.awayGoals === 0) cleanSheets.set(m.homeId!, (cleanSheets.get(m.homeId!) ?? 0) + 1);
      if (m.homeGoals === 0) cleanSheets.set(m.awayId!, (cleanSheets.get(m.awayId!) ?? 0) + 1);
    }
    for (const id of [m.homeId!, m.awayId!]) {
      if (w === id) {
        const s = (streak.get(id) ?? 0) + 1;
        streak.set(id, s);
        bestStreak.set(id, Math.max(bestStreak.get(id) ?? 0, s));
      } else {
        streak.set(id, 0);
      }
    }
    if (w) losers.add(w === m.homeId ? m.awayId! : m.homeId!);
  }
  const unbeaten = base.perParticipant.filter((s) => s.played > 0 && !losers.has(s.participantId)).map((s) => s.participantId);

  const rounds = [...new Set(t.matches.filter((m) => !m.isThirdPlace).map((m) => m.round))].sort((a, b) => a - b);
  const goalsByRound = rounds.map((r) => {
    const ms = played.filter((m) => m.round === r && hasScore(m));
    return {
      round: r,
      label: t.matches.find((m) => m.round === r)?.label ?? `Ronda ${r}`,
      goals: ms.reduce((s, m) => s + (m.homeGoals ?? 0) + (m.awayGoals ?? 0), 0),
      matches: ms.length,
    };
  });

  const podium = t.settings.format === "knockout" ? knockoutPodium(t.matches) : null;
  const championPath = t.championId ? played.filter((m) => m.homeId === t.championId || m.awayId === t.championId) : [];

  return { ...base, shootouts, penaltyWins, cleanSheets, bestStreak, unbeaten, goalsByRound, championPath, podium, draws, homeWins, awayWins };
}
