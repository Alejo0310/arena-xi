import { describe, expect, it } from "vitest";
import LZString from "lz-string";
import { finishedTournament } from "../../../e2e/seed";
import { decodeTournament, encodeTournament, isTournament } from "../share";
import { computeReport } from "../tournament/stats";
import { computeStandings } from "../tournament/league";
import { matchWinner } from "../tournament/match";
import type { Tournament } from "../types";

/** Formato anterior: el torneo completo (sin sorteo) en JSON comprimido. */
const legacyLink = (t: Tournament) => LZString.compressToEncodedURIComponent(JSON.stringify({ ...t, draw: null }));

describe("enlaces para compartir", () => {
  it("el enlace compacto es mucho más corto que el anterior", async () => {
    for (const [fmt, n] of [["knockout", 8], ["knockout", 4], ["league", 6]] as const) {
      const t = finishedTournament(fmt, n);
      const oldLen = legacyLink(t).length;
      const newLen = (await encodeTournament(t)).length;
      console.log(`${fmt} ${n}: antes ${oldLen} → ahora ${newLen} caracteres (${Math.round((newLen / oldLen) * 100)}%)`);
      expect(newLen).toBeLessThan(oldLen * 0.3);
    }
  });

  it("v3: el calendario se regenera y funciona con cualquier número de participantes y formato", async () => {
    for (const fmt of ["knockout", "league"] as const) {
      for (const n of [3, 4, 5, 6, 7, 8]) {
        const t = finishedTournament(fmt, n);
        const link = await encodeTournament(t);
        expect(link.startsWith("v3."), `${fmt} ${n} debería usar v3`).toBe(true);
        const back = (await decodeTournament(link))!;
        const nm = (x: Tournament, id: string | null) => x.participants.find((p) => p.id === id)?.name ?? null;
        expect(back.matches.length).toBe(t.matches.length);
        t.matches.forEach((m, i) => {
          const b2 = back.matches[i];
          expect([nm(back, b2.homeId), nm(back, b2.awayId), b2.homeGoals, b2.awayGoals, b2.homePens ?? null, b2.status, b2.label, b2.round])
            .toEqual([nm(t, m.homeId), nm(t, m.awayId), m.homeGoals, m.awayGoals, m.homePens ?? null, m.status, m.label, m.round]);
        });
        expect(nm(back, back.championId)).toBe(nm(t, t.championId));
        expect(back.phase).toBe(t.phase);
        const full = (await encodeTournament({ ...t, matches: t.matches.map((m) => ({ ...m })) })).length;
        console.log(`v3 ${fmt} ${n}: ${full} caracteres`);
      }
    }
  });

  it("v3: un torneo a medias (partidos pendientes y uno en juego) también se conserva", async () => {
    const t = finishedTournament("knockout", 8);
    const half: Tournament = { ...t, phase: "playing", championId: null, finishedAt: undefined, matches: t.matches.map((m, i) => (m.round >= 2 ? { ...m, homeGoals: null, awayGoals: null, homePens: null, awayPens: null, status: i === 4 ? "live" : "pending", manualWinnerId: null } : m)) };
    const link = await encodeTournament(half);
    expect(link.startsWith("v3.")).toBe(true);
    const back = (await decodeTournament(link))!;
    expect(back.phase).toBe("playing");
    expect(back.matches.filter((m) => m.status === "done" && !m.isBye).length).toBe(half.matches.filter((m) => m.status === "done" && !m.isBye).length);
    expect(back.matches.find((m) => m.round === 2)?.homeId).not.toBeNull(); // los clasificados de la ronda 1 se resuelven
  });

  it("ida y vuelta: el torneo recuperado da los mismos ganadores, marcadores, penaltis y estadísticas", async () => {
    for (const fmt of ["knockout", "league"] as const) {
      const t = finishedTournament(fmt, fmt === "knockout" ? 8 : 5);
      const back = (await decodeTournament(await encodeTournament(t)))!;
      expect(isTournament(back)).toBe(true);
      expect(back.name).toBe(t.name);
      expect(back.phase).toBe("finished");
      expect(back.participants.map((p) => p.name)).toEqual(t.participants.map((p) => p.name));
      // Los ids se regeneran: se compara por nombre.
      const nm = (x: Tournament, id: string | null) => x.participants.find((p) => p.id === id)?.name ?? null;
      expect(nm(back, back.championId)).toBe(nm(t, t.championId));
      expect(back.matches.length).toBe(t.matches.length);
      t.matches.forEach((m, i) => {
        const bm = back.matches[i];
        expect([nm(back, bm.homeId), nm(back, bm.awayId), bm.homeGoals, bm.awayGoals, bm.homePens ?? null, bm.awayPens ?? null, bm.status, !!bm.isThirdPlace, !!bm.isBye])
          .toEqual([nm(t, m.homeId), nm(t, m.awayId), m.homeGoals, m.awayGoals, m.homePens ?? null, m.awayPens ?? null, m.status, !!m.isThirdPlace, !!m.isBye]);
        expect(nm(back, matchWinner(bm))).toBe(nm(t, matchWinner(m)));
      });
      // Equipos y valoraciones congelados.
      for (const p of t.participants) {
        const bp = back.participants.find((x) => x.name === p.name)!;
        const a = t.snapshot![t.assignments[p.id]];
        const c = back.snapshot![back.assignments[bp.id]];
        expect([c.name, c.ovr, c.att, c.mid, c.def, c.colors]).toEqual([a.name, a.ovr, a.att, a.mid, a.def, a.colors]);
      }
      const r1 = computeReport(t), r2 = computeReport(back);
      expect([r2.played, r2.totalGoals, r2.shootouts.length, r2.draws]).toEqual([r1.played, r1.totalGoals, r1.shootouts.length, r1.draws]);
      if (fmt === "league") {
        const s1 = computeStandings(t.participants, t.matches, t.settings).map((s) => [nm(t, s.participantId), s.points, s.gd]);
        const s2 = computeStandings(back.participants, back.matches, back.settings).map((s) => [nm(back, s.participantId), s.points, s.gd]);
        expect(s2).toEqual(s1);
      }
    }
  });

  it("los enlaces antiguos siguen abriéndose y los inválidos devuelven null", async () => {
    const t = finishedTournament("knockout", 4);
    const old = await decodeTournament(legacyLink(t));
    expect(old?.name).toBe(t.name);
    expect(old?.matches.length).toBe(t.matches.length);
    expect(await decodeTournament("v2.basura")).toBeNull();
    expect(await decodeTournament("")).toBeNull();
  });
});
