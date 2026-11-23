import type { Page } from "@playwright/test";
import { buildMatches, recordResult, upcomingMatches } from "../src/lib/tournament/engine";
import { DEFAULT_CLUB_POOL, snapshotOf } from "../src/lib/teams";
import type { Tournament } from "../src/lib/types";

export const NAMES = ["Nico Prueba", "Mia Prueba", "Olga Prueba", "Pau Prueba", "Ana Prueba", "Beto Prueba", "Leo Prueba", "Eva Prueba"];
const COLORS = ["#3dff8b", "#2f9bff", "#ff7a1a", "#ffd23d", "#1de9d6", "#ff4f6d", "#c084fc", "#f5f5f5"];

/** Resultados de partida deterministas: algunos empates que se deciden por penaltis (solo en eliminatorias). */
function score(i: number, knockout: boolean) {
  const table: [number, number][] = [[2, 2], [0, 3], [1, 2], [0, 0], [0, 1], [1, 1], [3, 1], [2, 0], [1, 0], [4, 2]];
  const [h, a] = table[i % table.length];
  return h === a && knockout ? { homeGoals: h, awayGoals: a, homePens: 4, awayPens: 2 + (i % 2) } : { homeGoals: h, awayGoals: a };
}

/** Torneo completo (jugado) listo para guardarse en localStorage. Se construye con el motor real. */
export function finishedTournament(format: "knockout" | "league" = "knockout", n = 8): Tournament {
  const pool = DEFAULT_CLUB_POOL.slice(0, n);
  const participants = NAMES.slice(0, n).map((name, i) => ({ id: `p${i}`, name, color: COLORS[i] }));
  const assignments = Object.fromEntries(participants.map((p, i) => [p.id, pool[i]]));
  let t: Tournament = {
    id: "t_seed", name: "GRAN PREMIO GALACTICA", createdAt: Date.UTC(2026, 10, 21, 18, 0), updatedAt: Date.now(), phase: "playing",
    settings: { format, category: "club", edition: "FC25", gender: "men", legs: 1, thirdPlace: true, tiebreak: "gd", points: { win: 3, draw: 1, loss: 0 }, allowRepeatTeams: false, matchMinutes: 12 },
    participants, teamPool: pool, snapshot: snapshotOf(pool), assignments, drawHistory: [], draw: null, matches: [], championId: null,
  };
  t = { ...t, matches: buildMatches(t) };
  for (let i = 0; i < 200; i++) {
    const next = upcomingMatches(t)[0];
    if (!next) break;
    const res = recordResult(t, next.id, score(i, format === "knockout"));
    if (res.error) throw new Error(res.error);
    t = res.tournament!;
  }
  return t;
}

export async function seed(page: Page, t: Tournament) {
  await page.goto("/");
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), ["arena-xi", JSON.stringify({ state: { current: t, history: [], sound: false }, version: 2 })]);
}
