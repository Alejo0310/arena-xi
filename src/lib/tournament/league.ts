import type { Match, Participant, TournamentSettings } from "../types";
import { hasScore, isPlayed } from "./match";

/**
 * Calendario todos contra todos por el método del círculo.
 * Con un número impar de participantes, cada jornada descansa uno.
 */
export function generateLeague(ids: readonly string[], legs: 1 | 2): Match[] {
  if (ids.length < 2) return [];
  const list: (string | null)[] = [...ids];
  if (list.length % 2 === 1) list.push(null);
  const n = list.length;
  const rounds = n - 1;
  const first: Match[] = [];

  let rot = list;
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < n / 2; i++) {
      let home = rot[i];
      let away = rot[n - 1 - i];
      // Alterna localía para que nadie sea siempre local.
      if ((i === 0 && r % 2 === 1) || (i > 0 && i % 2 === 1)) [home, away] = [away, home];
      if (home && away) {
        first.push(emptyMatch(`L${r + 1}-${i}`, r + 1, `Jornada ${r + 1}`, home, away));
      }
    }
    rot = [rot[0], rot[n - 1], ...rot.slice(1, n - 1)];
  }

  if (legs === 1) return first;
  const second = first.map((m) =>
    emptyMatch(`L${m.round + rounds}-${m.id.split("-")[1]}`, m.round + rounds, `Jornada ${m.round + rounds}`, m.awayId!, m.homeId!),
  );
  return [...first, ...second];
}

function emptyMatch(id: string, round: number, label: string, homeId: string, awayId: string): Match {
  return { id, round, label, homeId, awayId, homeGoals: null, awayGoals: null, status: "pending" };
}

/** Participantes que descansan en una jornada (liga con número impar). */
export function restingInRound(participants: Participant[], matches: Match[], round: number): Participant[] {
  const playing = new Set(matches.filter((m) => m.round === round).flatMap((m) => [m.homeId, m.awayId]));
  return participants.filter((p) => !playing.has(p.id));
}

export interface StandingRow {
  participantId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  form: ("W" | "D" | "L")[];
}

function blankRow(id: string): StandingRow {
  return { participantId: id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0, form: [] };
}

function tally(ids: readonly string[], matches: Match[], settings: Pick<TournamentSettings, "points">): Map<string, StandingRow> {
  const rows = new Map(ids.map((id) => [id, blankRow(id)]));
  const played = matches
    .filter((m) => isPlayed(m) && hasScore(m) && m.homeId && m.awayId)
    .sort((a, b) => (a.playedAt ?? 0) - (b.playedAt ?? 0) || a.round - b.round);
  for (const m of played) {
    const h = rows.get(m.homeId!);
    const a = rows.get(m.awayId!);
    if (!h || !a) continue;
    const hg = m.homeGoals!;
    const ag = m.awayGoals!;
    h.played++; a.played++;
    h.gf += hg; h.ga += ag; a.gf += ag; a.ga += hg;
    if (hg > ag) {
      h.won++; a.lost++; h.form.push("W"); a.form.push("L");
    } else if (hg < ag) {
      a.won++; h.lost++; a.form.push("W"); h.form.push("L");
    } else {
      h.drawn++; a.drawn++; h.form.push("D"); a.form.push("D");
    }
  }
  for (const r of rows.values()) {
    r.gd = r.gf - r.ga;
    r.points = r.won * settings.points.win + r.drawn * settings.points.draw + r.lost * settings.points.loss;
  }
  return rows;
}

/**
 * Tabla de posiciones. Orden: puntos, luego el criterio elegido
 * (diferencia de goles o enfrentamiento directo), goles a favor, victorias y nombre.
 */
export function computeStandings(
  participants: Participant[],
  matches: Match[],
  settings: Pick<TournamentSettings, "points" | "tiebreak">,
): StandingRow[] {
  const ids = participants.map((p) => p.id);
  const rows = [...tally(ids, matches, settings).values()];
  const names = new Map(participants.map((p) => [p.id, p.name]));

  // Mini-liga entre empatados a puntos, para el enfrentamiento directo.
  const h2h = new Map<string, StandingRow>();
  const byPoints = new Map<number, string[]>();
  for (const r of rows) byPoints.set(r.points, [...(byPoints.get(r.points) ?? []), r.participantId]);
  for (const group of byPoints.values()) {
    if (group.length < 2) continue;
    const set = new Set(group);
    const sub = matches.filter((m) => m.homeId && m.awayId && set.has(m.homeId) && set.has(m.awayId));
    for (const [id, row] of tally(group, sub, settings)) h2h.set(id, row);
  }

  const cmp = (a: StandingRow, b: StandingRow) => {
    if (b.points !== a.points) return b.points - a.points;
    const ha = h2h.get(a.participantId);
    const hb = h2h.get(b.participantId);
    const byH2H = ha && hb ? hb.points - ha.points || hb.gd - ha.gd : 0;
    const byGD = b.gd - a.gd || b.gf - a.gf;
    const primary = settings.tiebreak === "h2h" ? byH2H || byGD : byGD || byH2H;
    if (primary) return primary;
    return b.won - a.won || (names.get(a.participantId) ?? "").localeCompare(names.get(b.participantId) ?? "");
  };
  return rows.sort(cmp);
}
