import { describe, expect, it } from "vitest";
import { buildMatches, recordResult, upcomingMatches } from "../tournament/engine";
import { computeReport } from "../tournament/stats";
import { shootoutText } from "../tournament/match";
import { DEFAULT_CLUB_POOL } from "../teams";
import type { Tournament } from "../types";

function play(format: "knockout" | "league", results: { h: number; a: number; hp?: number; ap?: number }[]): Tournament {
  const ids = ["a", "b", "c", "d"];
  let t: Tournament = {
    id: "t", name: "t", createdAt: 0, updatedAt: 0, phase: "playing",
    settings: { format, category: "club", edition: "FC25", gender: "men", legs: 1, thirdPlace: false, tiebreak: "gd", points: { win: 3, draw: 1, loss: 0 }, allowRepeatTeams: false, matchMinutes: 10 },
    participants: ids.map((id) => ({ id, name: id.toUpperCase(), color: "#fff" })),
    teamPool: DEFAULT_CLUB_POOL.slice(0, 4), assignments: Object.fromEntries(ids.map((id, i) => [id, DEFAULT_CLUB_POOL[i]])),
    drawHistory: [], draw: null, matches: [], championId: null,
  };
  t = { ...t, matches: buildMatches(t) };
  let i = 0;
  while (upcomingMatches(t)[0]) {
    const r = results[i++ % results.length];
    const res = recordResult(t, upcomingMatches(t)[0].id, { homeGoals: r.h, awayGoals: r.a, homePens: r.hp ?? null, awayPens: r.ap ?? null });
    if (res.error) throw new Error(res.error);
    t = res.tournament!;
  }
  return t;
}

describe("informe del torneo", () => {
  it("shootoutText solo existe en empates resueltos por penaltis", () => {
    expect(shootoutText({ homeGoals: 1, awayGoals: 1, homePens: 4, awayPens: 3 })).toBe("4-3");
    expect(shootoutText({ homeGoals: 2, awayGoals: 1, homePens: 4, awayPens: 3 })).toBeNull();
    expect(shootoutText({ homeGoals: 1, awayGoals: 1, homePens: null, awayPens: null })).toBeNull();
  });

  it("eliminatorias: penaltis, podio, camino del campeón y goles por ronda cuadran con los partidos", () => {
    const t = play("knockout", [{ h: 2, a: 2, hp: 5, ap: 4 }, { h: 3, a: 0 }, { h: 1, a: 1, hp: 3, ap: 4 }]);
    const r = computeReport(t);
    expect(t.phase).toBe("finished");
    expect(r.podium?.first).toBe(t.championId);
    expect(r.shootouts.length).toBe(t.matches.filter((m) => m.homePens != null && m.homeGoals === m.awayGoals).length);
    expect(r.shootouts.every((s) => /^\d+-\d+$/.test(s.pens))).toBe(true);
    expect([...r.penaltyWins.values()].reduce((a, b) => a + b, 0)).toBe(r.shootouts.length);
    expect(r.goalsByRound.reduce((a, b) => a + b.goals, 0)).toBe(r.totalGoals);
    expect(r.championPath.every((m) => m.homeId === t.championId || m.awayId === t.championId)).toBe(true);
    expect(r.homeWins + r.awayWins).toBe(r.played);
  });

  it("liga: los empates se cuentan y quien no pierde figura como invicto", () => {
    const r = computeReport(play("league", [{ h: 1, a: 1 }]));
    expect(r.draws).toBe(r.played);
    expect(r.unbeaten.length).toBe(4);
    expect(r.shootouts).toHaveLength(0);
  });

  it("porterías a cero y rachas", () => {
    const r = computeReport(play("league", [{ h: 2, a: 0 }]));
    expect([...r.cleanSheets.values()].reduce((a, b) => a + b, 0)).toBe(r.played); // cada 2-0 deja una portería a cero
    expect(Math.max(...r.bestStreak.values())).toBeGreaterThanOrEqual(1);
  });
});
