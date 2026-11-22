import type { FlagSpec, GameEdition, Gender, Match, Team, Tournament } from "./types";

/*
 * Compartir sin servidor: el torneo viaja dentro del propio enlace (fragmento #, que nunca se envía al
 * servidor). Es una instantánea de solo lectura.
 *
 * Para que el enlace sea corto no se serializa el torneo entero: se usa un formato COMPACTO (v2) con arrays
 * posicionales, índices en lugar de ids, solo los equipos realmente asignados y solo los campos necesarios
 * para ver el torneo. Después se comprime con lz-string. Los enlaces antiguos (JSON completo comprimido)
 * siguen funcionando.
 */

// lz-string se carga solo al compartir o abrir un enlace compartido.
type LZ = typeof import("lz-string");
const lz = async (): Promise<LZ> => {
  const m = (await import("lz-string")) as LZ & { default?: LZ };
  return m.default ?? m; // según el entorno (navegador o Node) el módulo CJS llega como default o como espacio de nombres
};

const V2 = "v2.";
const EDITIONS: GameEdition[] = ["FC25", "FC26", "FC27"];
const GENDERS: Gender[] = ["men", "women"];
const PHASES = ["setup", "draw", "playing", "finished"] as const;

type Num = number | null;
type CompactTeam = [id: string, name: string, short: string, league: string, country: string, kind: 0 | 1, edition: number, gender: number, ovr: Num, att: Num, mid: Num, def: Num, c1: string, c2: string, flag: FlagSpec | 0, realName: string | 0];
type CompactMatch = [round: number, label: string, home: Num, away: Num, hg: Num, ag: Num, hp: Num, ap: Num, status: number, flags: number, slot: Num, hs: [number, number] | 0, as: [number, number] | 0, manual: Num, playedAt: Num];
type Compact = [name: string, created: number, finished: Num, phase: number, champion: number, settings: Num[], participants: [string, string][], teams: CompactTeam[], assign: [number, number][], matches: CompactMatch[]];

const b = (x: boolean | undefined) => (x ? 1 : 0);

/** Convierte un torneo en su representación compacta (sin sorteo, historial de sorteo ni equipos no asignados). */
export function compactTournament(t: Tournament): Compact {
  const pIdx = new Map(t.participants.map((p, i) => [p.id, i]));
  const mIdx = new Map(t.matches.map((m, i) => [m.id, i]));
  const teamIds = [...new Set(Object.values(t.assignments))];
  const tIdx = new Map(teamIds.map((id, i) => [id, i]));
  const s = t.settings;
  const teams: CompactTeam[] = teamIds.map((id) => {
    const x = t.snapshot?.[id];
    return x
      ? [id, x.name, x.short, x.league, x.country, x.kind === "national" ? 1 : 0, Math.max(0, EDITIONS.indexOf(x.edition ?? "FC25")), Math.max(0, GENDERS.indexOf(x.gender ?? "men")), x.ovr, x.att, x.mid, x.def, x.colors[0], x.colors[1], x.flag ?? 0, x.realName ?? 0]
      : [id, id, id.slice(0, 3).toUpperCase(), "", "", 0, 0, 0, null, null, null, null, "#555555", "#999999", 0, 0];
  });
  const base = t.createdAt;
  return [
    t.name,
    base,
    t.finishedAt ?? null,
    PHASES.indexOf(t.phase),
    t.championId ? (pIdx.get(t.championId) ?? -1) : -1,
    [s.format === "league" ? 0 : 1, s.category === "club" ? 0 : 1, Math.max(0, EDITIONS.indexOf(s.edition ?? "FC25")), Math.max(0, GENDERS.indexOf(s.gender ?? "men")), s.legs, b(s.thirdPlace), s.tiebreak === "gd" ? 0 : 1, s.points.win, s.points.draw, s.points.loss, s.matchMinutes, b(s.allowRepeatTeams)],
    t.participants.map((p) => [p.name, p.color]),
    teams,
    t.participants.flatMap((p, i) => (t.assignments[p.id] && tIdx.has(t.assignments[p.id]) ? [[i, tIdx.get(t.assignments[p.id])!] as [number, number]] : [])),
    t.matches.map((m): CompactMatch => [
      m.round, m.label,
      m.homeId ? (pIdx.get(m.homeId) ?? null) : null, m.awayId ? (pIdx.get(m.awayId) ?? null) : null,
      m.homeGoals, m.awayGoals, m.homePens ?? null, m.awayPens ?? null,
      m.status === "pending" ? 0 : m.status === "live" ? 1 : 2,
      b(m.isBye) | (b(m.isThirdPlace) << 1) | (b(m.walkover) << 2),
      m.slot ?? null,
      m.homeSource && mIdx.has(m.homeSource.matchId) ? [mIdx.get(m.homeSource.matchId)!, m.homeSource.outcome === "winner" ? 0 : 1] : 0,
      m.awaySource && mIdx.has(m.awaySource.matchId) ? [mIdx.get(m.awaySource.matchId)!, m.awaySource.outcome === "winner" ? 0 : 1] : 0,
      m.manualWinnerId ? (pIdx.get(m.manualWinnerId) ?? null) : null,
      m.playedAt ? Math.round((m.playedAt - base) / 1000) : null,
    ]),
  ];
}

/** Reconstruye un torneo de solo lectura a partir de su representación compacta. */
export function expandTournament(c: Compact): Tournament {
  const [name, created, finished, phase, champion, st, parts, teamsC, assign, matchesC] = c;
  const participants = parts.map(([n, color], i) => ({ id: `p${i}`, name: n, color }));
  const snapshot: Record<string, Team> = {};
  for (const [id, n, short, league, country, kind, ed, g, ovr, att, mid, def, c1, c2, flag, real] of teamsC) {
    snapshot[id] = { id, kind: kind ? "national" : "club", edition: EDITIONS[ed] ?? "FC25", gender: GENDERS[g] ?? "men", name: n, short, league, country, ovr, att, mid, def, colors: [c1, c2], ...(flag ? { flag } : {}), ...(real ? { realName: real } : {}), source: "enlace compartido" };
  }
  const teamIds = teamsC.map((x) => x[0]);
  const assignments: Record<string, string> = {};
  for (const [pi, ti] of assign) assignments[`p${pi}`] = teamIds[ti];
  const matches: Match[] = matchesC.map(([round, label, h, a, hg, ag, hp, ap, status, flags, slot, hs, as, manual, played], i) => ({
    id: `m${i}`, round, label,
    homeId: h === null ? null : `p${h}`, awayId: a === null ? null : `p${a}`,
    homeGoals: hg, awayGoals: ag, ...(hp !== null ? { homePens: hp } : {}), ...(ap !== null ? { awayPens: ap } : {}),
    status: status === 2 ? "done" : status === 1 ? "live" : "pending",
    ...(flags & 1 ? { isBye: true } : {}), ...(flags & 2 ? { isThirdPlace: true } : {}), ...(flags & 4 ? { walkover: true } : {}),
    ...(slot !== null ? { slot } : {}),
    ...(hs ? { homeSource: { matchId: `m${hs[0]}`, outcome: hs[1] ? "loser" as const : "winner" as const } } : {}),
    ...(as ? { awaySource: { matchId: `m${as[0]}`, outcome: as[1] ? "loser" as const : "winner" as const } } : {}),
    ...(manual !== null ? { manualWinnerId: `p${manual}` } : {}),
    ...(played !== null ? { playedAt: created + played * 1000 } : {}),
  }));
  return {
    id: "shared", name, createdAt: created, updatedAt: finished ?? created, ...(finished ? { finishedAt: finished } : {}),
    phase: PHASES[phase] ?? "playing",
    settings: {
      format: st[0] ? "knockout" : "league", category: st[1] ? "national" : "club", edition: EDITIONS[st[2]!] ?? "FC25", gender: GENDERS[st[3]!] ?? "men",
      legs: st[4] === 2 ? 2 : 1, thirdPlace: !!st[5], tiebreak: st[6] ? "h2h" : "gd", points: { win: st[7]!, draw: st[8]!, loss: st[9]! }, matchMinutes: st[10]!, allowRepeatTeams: !!st[11],
    },
    participants, teamPool: teamIds, snapshot, assignments, drawHistory: [], draw: null, matches, championId: champion >= 0 ? `p${champion}` : null,
  };
}

export async function encodeTournament(t: Tournament): Promise<string> {
  return V2 + (await lz()).compressToEncodedURIComponent(JSON.stringify(compactTournament(t)));
}

export async function decodeTournament(data: string): Promise<Tournament | null> {
  try {
    const L = await lz();
    if (data.startsWith(V2)) {
      const json = L.decompressFromEncodedURIComponent(data.slice(V2.length));
      if (!json) return null;
      const c = JSON.parse(json) as Compact;
      if (!Array.isArray(c) || c.length < 10) return null;
      const t = expandTournament(c);
      return isTournament(t) ? t : null;
    }
    // Enlaces antiguos: el torneo completo en JSON comprimido.
    const json = L.decompressFromEncodedURIComponent(data);
    if (!json) return null;
    const t = JSON.parse(json) as Tournament;
    return isTournament(t) ? t : null;
  } catch {
    return null;
  }
}

export function isTournament(x: unknown): x is Tournament {
  const t = x as Tournament;
  return !!t && typeof t.id === "string" && typeof t.name === "string" && Array.isArray(t.participants) && Array.isArray(t.matches) && !!t.settings;
}

export async function shareUrl(t: Tournament): Promise<string> {
  return `${window.location.origin}/compartir#${await encodeTournament(t)}`;
}

export function downloadJson(t: Tournament) {
  const blob = new Blob([JSON.stringify(t, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${slug(t.name)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function slug(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "torneo";
}
