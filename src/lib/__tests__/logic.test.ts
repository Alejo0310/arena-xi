import { describe, expect, it } from "vitest";
import { generateLeague, computeStandings, restingInRound } from "../tournament/league";
import { bracketSize, generateKnockout, seedOrder, dependentMatches } from "../tournament/knockout";
import { recordResult, resetResult, buildMatches } from "../tournament/engine";
import { computeStats, historicalRanking } from "../tournament/stats";
import { buildPots, confirmPick, decidePick, drawAll, drawError, initDraw, validateAssignments } from "../draw";
import { CLUBS, DEFAULT_CLUB_POOL } from "../teams";
import type { Participant, Tournament, TournamentSettings } from "../types";

const settings: TournamentSettings = {
  format: "league", category: "club", legs: 1, thirdPlace: true, tiebreak: "gd",
  points: { win: 3, draw: 1, loss: 0 }, allowRepeatTeams: false, matchMinutes: 12,
};

function people(n: number): Participant[] {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `Jugador ${i + 1}`, color: "#fff" }));
}

function tournament(n: number, over: Partial<TournamentSettings> = {}): Tournament {
  const t: Tournament = {
    id: "t", name: "Test", createdAt: 0, updatedAt: 0, phase: "playing",
    settings: { ...settings, ...over }, participants: people(n), teamPool: [...DEFAULT_CLUB_POOL],
    assignments: {}, drawHistory: [], draw: null, matches: [], championId: null,
  };
  return { ...t, matches: buildMatches(t) };
}

function pairKey(a: string | null, b: string | null) {
  return [a, b].sort().join("|");
}

describe("liga", () => {
  it.each([2, 3, 4, 5, 6, 7, 8, 10])("todos contra todos una vez con %i participantes", (n) => {
    const ids = people(n).map((p) => p.id);
    const ms = generateLeague(ids, 1);
    expect(ms).toHaveLength((n * (n - 1)) / 2);
    expect(new Set(ms.map((m) => pairKey(m.homeId, m.awayId))).size).toBe(ms.length);
    expect(new Set(ms.map((m) => m.id)).size).toBe(ms.length);
    // Nadie juega dos veces en la misma jornada.
    const rounds = new Set(ms.map((m) => m.round));
    for (const r of rounds) {
      const ps = ms.filter((m) => m.round === r).flatMap((m) => [m.homeId, m.awayId]);
      expect(new Set(ps).size).toBe(ps.length);
    }
  });

  it("con número impar descansa exactamente uno por jornada", () => {
    const ps = people(5);
    const ms = generateLeague(ps.map((p) => p.id), 1);
    for (let r = 1; r <= 5; r++) expect(restingInRound(ps, ms, r)).toHaveLength(1);
  });

  it("a dos vueltas invierte la localía", () => {
    const ms = generateLeague(people(4).map((p) => p.id), 2);
    expect(ms).toHaveLength(12);
    const ordered = new Set(ms.map((m) => `${m.homeId}>${m.awayId}`));
    expect(ordered.size).toBe(12);
  });

  it("calcula puntos, diferencia de goles y orden", () => {
    let t = tournament(3);
    const find = (a: string, b: string) => t.matches.find((m) => pairKey(m.homeId, m.awayId) === pairKey(a, b))!;
    const score = (a: string, b: string, ga: number, gb: number) => {
      const m = find(a, b);
      const home = m.homeId === a;
      t = recordResult(t, m.id, { homeGoals: home ? ga : gb, awayGoals: home ? gb : ga }).tournament!;
    };
    score("p1", "p2", 3, 0);
    score("p2", "p3", 1, 1);
    score("p1", "p3", 0, 1);
    const table = computeStandings(t.participants, t.matches, t.settings);
    // p1: 3 pts (+2), p3: 4 pts (+1), p2: 1 pt (-3)
    expect(table.map((r) => r.participantId)).toEqual(["p3", "p1", "p2"]);
    expect(table[0]).toMatchObject({ points: 4, won: 1, drawn: 1, lost: 0, gf: 2, ga: 1, gd: 1 });
    expect(t.phase).toBe("finished");
    expect(t.championId).toBe("p3");
  });

  it("desempata por enfrentamiento directo cuando se elige", () => {
    // p1 y p2 empatan a puntos; p2 tiene mejor DG pero p1 ganó el directo.
    let t = tournament(4, { tiebreak: "h2h" });
    const set = (a: string, b: string, ga: number, gb: number) => {
      const m = t.matches.find((x) => pairKey(x.homeId, x.awayId) === pairKey(a, b))!;
      const home = m.homeId === a;
      t = recordResult(t, m.id, { homeGoals: home ? ga : gb, awayGoals: home ? gb : ga }).tournament!;
    };
    set("p1", "p2", 1, 0);
    set("p1", "p3", 0, 1);
    set("p1", "p4", 1, 0);
    set("p2", "p3", 5, 0);
    set("p2", "p4", 5, 0);
    set("p4", "p3", 1, 0);
    expect(computeStandings(t.participants, t.matches, t.settings)[0].participantId).toBe("p1");
    expect(computeStandings(t.participants, t.matches, { ...t.settings, tiebreak: "gd" })[0].participantId).toBe("p2");
  });

  it("W.O. manual en liga cuenta como 3-0", () => {
    let t = tournament(2);
    const m = t.matches[0];
    t = recordResult(t, m.id, { homeGoals: null, awayGoals: null, manualWinnerId: m.awayId }).tournament!;
    const done = t.matches[0];
    expect([done.homeGoals, done.awayGoals]).toEqual([0, 3]);
    expect(done.walkover).toBe(true);
  });

  it("rechaza marcadores inválidos", () => {
    const t = tournament(2);
    expect(recordResult(t, t.matches[0].id, { homeGoals: -1, awayGoals: 2 }).error).toBeTruthy();
    expect(recordResult(t, t.matches[0].id, { homeGoals: null, awayGoals: 2 }).error).toBeTruthy();
  });
});

describe("eliminatorias", () => {
  it("siembra estándar", () => {
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    expect(bracketSize(5)).toBe(8);
    expect(bracketSize(2)).toBe(2);
  });

  it.each([2, 3, 5, 6, 7, 8, 9, 12, 16])("genera llaves válidas con BYE para %i participantes", (n) => {
    const ids = people(n).map((p) => p.id);
    const ms = generateKnockout(ids, { thirdPlace: false });
    const size = bracketSize(n);
    expect(ms).toHaveLength(size - 1);
    const first = ms.filter((m) => m.round === 1);
    const byes = first.filter((m) => m.isBye);
    expect(byes).toHaveLength(size - n);
    // Ningún partido con dos BYE y todos los jugadores aparecen una vez en la ronda 1.
    expect(first.every((m) => m.homeId || m.awayId)).toBe(true);
    expect(new Set(first.flatMap((m) => [m.homeId, m.awayId]).filter(Boolean)).size).toBe(n);
  });

  it("avanza ganadores, resuelve penaltis y corona campeón", () => {
    let t = tournament(4, { format: "knockout" });
    const semis = t.matches.filter((m) => m.round === 1);
    expect(t.matches.some((m) => m.isThirdPlace)).toBe(true);
    // Empate sin penaltis: error.
    expect(recordResult(t, semis[0].id, { homeGoals: 1, awayGoals: 1 }).error).toMatch(/penaltis/);
    t = recordResult(t, semis[0].id, { homeGoals: 1, awayGoals: 1, homePens: 4, awayPens: 3 }).tournament!;
    t = recordResult(t, semis[1].id, { homeGoals: 0, awayGoals: 2 }).tournament!;
    const final = t.matches.find((m) => m.round === 2 && !m.isThirdPlace)!;
    expect(final.homeId).toBe(semis[0].homeId);
    expect(final.awayId).toBe(semis[1].awayId);
    const third = t.matches.find((m) => m.isThirdPlace)!;
    expect(third.homeId).toBe(semis[0].awayId);
    t = recordResult(t, final.id, { homeGoals: 2, awayGoals: 0 }).tournament!;
    expect(t.phase).toBe("playing");
    t = recordResult(t, third.id, { homeGoals: null, awayGoals: null, manualWinnerId: third.awayId }).tournament!;
    expect(t.phase).toBe("finished");
    expect(t.championId).toBe(semis[0].homeId);
  });

  it("editar un resultado previo reinicia las fases dependientes", () => {
    let t = tournament(4, { format: "knockout", thirdPlace: false });
    const [s1, s2] = t.matches.filter((m) => m.round === 1);
    t = recordResult(t, s1.id, { homeGoals: 2, awayGoals: 0 }).tournament!;
    t = recordResult(t, s2.id, { homeGoals: 2, awayGoals: 0 }).tournament!;
    const finalId = t.matches.find((m) => m.round === 2)!.id;
    t = recordResult(t, finalId, { homeGoals: 1, awayGoals: 0 }).tournament!;
    expect(t.championId).toBe(s1.homeId);
    expect(dependentMatches(t.matches, s1.id).map((m) => m.id)).toEqual([finalId]);
    // Cambia el ganador de la semifinal 1.
    t = recordResult(t, s1.id, { homeGoals: 0, awayGoals: 3 }).tournament!;
    const final = t.matches.find((m) => m.id === finalId)!;
    expect(final.homeId).toBe(s1.awayId);
    expect(final.status).toBe("pending");
    expect(t.championId).toBeNull();
    expect(t.phase).toBe("playing");
    // Reiniciar un resultado también libera la final.
    t = resetResult(t, s2.id);
    expect(t.matches.find((m) => m.id === finalId)!.awayId).toBeNull();
  });

  it("con BYE el cabeza de serie pasa directo", () => {
    const t = tournament(3, { format: "knockout" });
    const bye = t.matches.find((m) => m.isBye)!;
    const final = t.matches.find((m) => m.round === 2)!;
    expect(bye.status).toBe("done");
    expect([final.homeId, final.awayId]).toContain(bye.homeId ?? bye.awayId);
    expect(t.matches.some((m) => m.isThirdPlace)).toBe(false);
  });
});

describe("sorteo", () => {
  const base = (n: number, over: Partial<TournamentSettings> = {}) => tournament(n, over);

  it("detecta equipos insuficientes", () => {
    const t = { ...base(4), teamPool: ["real-madrid", "bayern"] };
    expect(drawError(t, "roulette")).toBeTruthy();
    expect(drawError({ ...t, settings: { ...t.settings, allowRepeatTeams: true } }, "roulette")).toBeNull();
  });

  it.each(["roulette", "envelopes", "machine", "draft", "pots"] as const)("modo %s asigna equipos sin repetir", (mode) => {
    for (let run = 0; run < 50; run++) {
      const t = base(8);
      let s = initDraw(t, mode);
      const assignments: Record<string, string> = {};
      // Mitad uno a uno (decidir → confirmar), el resto con sorteo completo.
      for (let k = 0; k < 4; k++) {
        const pid = s.order[s.cursor];
        const choice = mode === "envelopes" ? { envelopeIndex: s.envelopes!.findIndex((e) => e) } : mode === "draft" ? { teamId: s.draftOptions![0] } : {};
        const { pending } = decidePick(s, "club", choice);
        expect(pending?.participantId).toBe(pid);
        s = { ...s, pending };
        // Mientras hay un pendiente, el turno no cambia y no se puede volver a sortear.
        expect(s.order[s.cursor]).toBe(pid);
        expect(decidePick(s, "club", choice).error).toBeTruthy();
        assignments[pid] = pending!.teamId;
        s = confirmPick(s, false)!.state;
      }
      for (const a of drawAll(s, false)) assignments[a.participantId] = a.teamId;
      expect(validateAssignments(assignments, t.participants.map((p) => p.id), false, "club")).toBe(true);
    }
  });

  it("bombos agrupan por nivel y fusionan el bombo incompleto", () => {
    const pots = buildPots(CLUBS.map((t) => t.id), 8);
    expect(pots.map((p) => p.length)).toEqual([8, 8, 10]);
    expect(pots[0][0]).toBe("real-madrid");
  });

  it("el orden de los participantes en el sorteo es aleatorio", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) seen.add(initDraw(base(4), "roulette").order.join());
    expect(seen.size).toBeGreaterThan(5);
  });
});

describe("estadísticas", () => {
  it("máximo goleador, mayor goleada y ranking histórico", () => {
    let t = tournament(3);
    const [a, b, c] = t.matches;
    t = recordResult(t, a.id, { homeGoals: 5, awayGoals: 0 }).tournament!;
    t = recordResult(t, b.id, { homeGoals: 2, awayGoals: 2 }).tournament!;
    t = recordResult(t, c.id, { homeGoals: 1, awayGoals: 0 }).tournament!;
    const s = computeStats(t.participants, t.matches);
    expect(s.played).toBe(3);
    expect(s.totalGoals).toBe(10);
    expect(s.biggestWin?.id).toBe(a.id);
    const rank = historicalRanking([t, { ...t, id: "t2" }]);
    expect(rank[0].titles).toBe(2);
    expect(rank.reduce((n, r) => n + r.tournaments, 0)).toBe(6);
  });
});
