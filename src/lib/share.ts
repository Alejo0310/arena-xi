import type { FlagSpec, GameEdition, Gender, Match, Team, Tournament } from "./types";
import { PLAYER_COLORS } from "./names";
import { generateKnockout, resolveKnockout, seedOrder, bracketSize } from "./tournament/knockout";
import { generateLeague } from "./tournament/league";
import { getLiveTeam, getTeam } from "./teams";

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

// ---------------------------------------------------------------------------------------------
// Formato v3 (el más corto): el calendario / cuadro NO viaja, se regenera al abrir el enlace.
// Solo se guardan: orden de siembra, resultados y equipos (por id cuando coinciden con el catálogo).
// ---------------------------------------------------------------------------------------------

const V3 = "v3.";
type ResultC = 0 | [status: number, hg: Num, ag: Num, hp: Num, ap: Num, manual: Num, wo: number, playedAt: Num];
type CompactV3 = [name: string, created: number, finished: Num, phase: number, champion: number, settings: Num[], participants: [string, number | string][], order: number[], teams: (string | CompactTeam)[], results: ResultC[]];

/** Genera los partidos igual que buildMatches, a partir del orden de siembra. */
function regenerate(format: "league" | "knockout", order: string[], legs: 1 | 2, thirdPlace: boolean): Match[] {
  return format === "league" ? generateLeague(order, legs) : generateKnockout(order, { thirdPlace });
}

/** Recupera el orden de siembra a partir de los partidos (inverso de generateKnockout / generateLeague). */
function recoverOrder(t: Tournament): string[] | null {
  const n = t.participants.length;
  if (t.settings.format === "knockout") {
    const r1 = t.matches.filter((m) => m.round === 1 && !m.isThirdPlace).sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
    const size = bracketSize(n);
    const so = seedOrder(size);
    const order: (string | null)[] = Array(n).fill(null);
    for (let k = 0; k < size; k++) {
      const m = r1[k >> 1];
      const id = m ? (k % 2 === 0 ? m.homeId : m.awayId) : null;
      if (id && so[k] <= n) order[so[k] - 1] = id;
    }
    return order.every(Boolean) ? (order as string[]) : null;
  }
  // Liga: ronda 1 por el método del círculo (se deshace el intercambio de localía).
  const total = n % 2 ? n + 1 : n;
  const list: (string | null)[] = Array(total).fill(null);
  const m1 = t.matches.filter((m) => m.round === 1);
  const odd = n % 2 === 1;
  const used = new Set<string>();
  let mi = 0;
  for (let i = 0; i < total / 2; i++) {
    if (odd && i === 0) continue; // la pareja (rot[0], null) no genera partido
    const m = m1[mi++];
    if (!m || !m.homeId || !m.awayId) return null;
    const swapped = i > 0 && i % 2 === 1;
    list[i] = swapped ? m.awayId : m.homeId;
    list[total - 1 - i] = swapped ? m.homeId : m.awayId;
    used.add(m.homeId);
    used.add(m.awayId);
  }
  if (odd) list[0] = t.participants.find((p) => !used.has(p.id))?.id ?? null;
  const order = list.filter((x): x is string => x !== null);
  return order.length === n && new Set(order).size === n ? order : null;
}

/** Estructura de un cuadro sin resultados: lo que debe coincidir entre el torneo original y el regenerado. */
function skeleton(ms: Match[], knockout: boolean) {
  return ms.map((m) => ({
    id: m.id, round: m.round, label: m.label, bye: !!m.isBye, third: !!m.isThirdPlace,
    // En eliminatorias solo la primera ronda tiene participantes fijos; el resto depende de los resultados.
    home: !knockout || m.round === 1 ? m.homeId : null, away: !knockout || m.round === 1 ? m.awayId : null,
  }));
}

/** Representación v3, o null si el torneo no se puede reconstruir de forma idéntica (se usa entonces v2). */
export function compactV3(t: Tournament): CompactV3 | null {
  const order = recoverOrder(t);
  if (!order) return null;
  const s = t.settings;
  const knockout = s.format === "knockout";
  const regen = regenerate(s.format, order, s.legs, s.thirdPlace);
  // Comprobación de seguridad: el cuadro regenerado debe ser idéntico al original.
  if (JSON.stringify(skeleton(regen, knockout)) !== JSON.stringify(skeleton(t.matches, knockout))) return null;

  const pIdx = new Map(t.participants.map((p, i) => [p.id, i]));
  const v2 = compactTournament(t);
  const teams = t.participants.map((p, i): string | CompactTeam => {
    const id = t.assignments[p.id];
    const snap = t.snapshot?.[id];
    const live = getLiveTeam(id);
    if (live && snap && live.name === snap.name && live.ovr === snap.ovr && live.att === snap.att && live.mid === snap.mid && live.def === snap.def && live.short === snap.short) return id;
    return v2[7][v2[8].find((a) => a[0] === i)?.[1] ?? 0];
  });
  const results = t.matches.map((m): ResultC => {
    if (m.isBye || (m.status === "pending" && m.homeGoals === null && m.awayGoals === null)) return 0;
    return [m.status === "live" ? 1 : 2, m.homeGoals, m.awayGoals, m.homePens ?? null, m.awayPens ?? null, m.manualWinnerId ? (pIdx.get(m.manualWinnerId) ?? null) : null, m.walkover ? 1 : 0, m.playedAt ? Math.round((m.playedAt - t.createdAt) / 1000) : null];
  });
  return [
    t.name, t.createdAt, t.finishedAt ?? null, PHASES.indexOf(t.phase), t.championId ? (pIdx.get(t.championId) ?? -1) : -1,
    v2[5],
    t.participants.map((p) => {
      const ci = PLAYER_COLORS.indexOf(p.color);
      return [p.name, ci >= 0 ? ci : p.color] as [string, number | string];
    }),
    order.map((id) => pIdx.get(id)!),
    teams,
    results,
  ];
}

export async function expandV3(c: CompactV3): Promise<Tournament> {
  const [name, created, finished, phase, champion, st, parts, orderIdx, teamsC, resultsC] = c;
  const participants = parts.map(([n, color], i) => ({ id: `p${i}`, name: n, color: typeof color === "number" ? PLAYER_COLORS[color] : color }));
  const format = st[0] ? "knockout" : "league";
  const legs: 1 | 2 = st[4] === 2 ? 2 : 1;
  let matches = regenerate(format, orderIdx.map((i) => `p${i}`), legs, !!st[5]);

  const apply = (m: Match, r: ResultC): Match =>
    r === 0
      ? m
      : {
          ...m,
          status: r[0] === 1 ? "live" : "done", homeGoals: r[1], awayGoals: r[2],
          ...(r[3] !== null ? { homePens: r[3] } : {}), ...(r[4] !== null ? { awayPens: r[4] } : {}),
          ...(r[5] !== null ? { manualWinnerId: `p${r[5]}` } : {}), ...(r[6] ? { walkover: true } : {}),
          ...(r[7] !== null ? { playedAt: created + r[7] * 1000 } : {}),
        };

  if (format === "knockout") {
    // Ronda a ronda: primero se resuelven los participantes y luego se aplican los resultados (si no, se borrarían).
    const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
    for (const rd of rounds) {
      matches = resolveKnockout(matches);
      matches = matches.map((m, i) => (m.round === rd ? apply(m, resultsC[i]) : m));
    }
  } else {
    matches = matches.map((m, i) => apply(m, resultsC[i]));
  }

  // Equipos: por id (se resuelven con el catálogo de la edición) o completos.
  const edition = EDITIONS[st[2]!] ?? "FC25";
  const snapshot: Record<string, Team> = {};
  const assignments: Record<string, string> = {};
  if (teamsC.some((x) => typeof x === "string" && !getTeam(x))) {
    try {
      await (await import("./catalog")).loadCatalog(edition);
    } catch {
      /* se usará un marcador */
    }
  }
  teamsC.forEach((x, i) => {
    if (typeof x === "string") {
      const live = getTeam(x);
      snapshot[x] = live
        ? { ...live }
        : { id: x, kind: "club", name: x, short: x.slice(0, 3).toUpperCase(), league: "", country: "", ovr: null, att: null, mid: null, def: null, colors: ["#555555", "#999999"], source: "enlace compartido" };
      assignments[`p${i}`] = x;
    } else {
      const [id, n, short, league, country, kind, ed, g, ovr, att, mid, def, c1, c2, flag, real] = x;
      snapshot[id] = { id, kind: kind ? "national" : "club", edition: EDITIONS[ed] ?? "FC25", gender: GENDERS[g] ?? "men", name: n, short, league, country, ovr, att, mid, def, colors: [c1, c2], ...(flag ? { flag } : {}), ...(real ? { realName: real } : {}), source: "enlace compartido" };
      assignments[`p${i}`] = id;
    }
  });

  return {
    id: "shared", name, createdAt: created, updatedAt: finished ?? created, ...(finished ? { finishedAt: finished } : {}),
    phase: PHASES[phase] ?? "playing",
    settings: { format, category: st[1] ? "national" : "club", edition, gender: GENDERS[st[3]!] ?? "men", legs, thirdPlace: !!st[5], tiebreak: st[6] ? "h2h" : "gd", points: { win: st[7]!, draw: st[8]!, loss: st[9]! }, matchMinutes: st[10]!, allowRepeatTeams: !!st[11] },
    participants, teamPool: Object.keys(snapshot), snapshot, assignments, drawHistory: [], draw: null, matches, championId: champion >= 0 ? `p${champion}` : null,
  };
}

// --- Compresión: se elige la más corta entre deflate nativo (base64url) y lz-string -------------

const toB64Url = (buf: Uint8Array) => {
  let s = "";
  for (const byte of buf) s += String.fromCharCode(byte);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64Url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (ch) => ch.charCodeAt(0));

async function through(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([data as BlobPart]).stream().pipeThrough(stream as unknown as ReadableWritablePair<Uint8Array, Uint8Array>));
  return new Uint8Array(await out.arrayBuffer());
}
const hasStreams = () => typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined";

async function pack(json: string): Promise<string> {
  const lzOut = (await lz()).compressToEncodedURIComponent(json);
  if (!hasStreams()) return V3 + lzOut;
  try {
    const z = toB64Url(await through(new TextEncoder().encode(json), new CompressionStream("deflate-raw")));
    return z.length + 1 < lzOut.length ? `${V3}z${z}` : V3 + lzOut;
  } catch {
    return V3 + lzOut;
  }
}

async function unpack(body: string): Promise<string | null> {
  if (body.startsWith("z")) return new TextDecoder().decode(await through(fromB64Url(body.slice(1)), new DecompressionStream("deflate-raw")));
  return (await lz()).decompressFromEncodedURIComponent(body);
}

export async function encodeTournament(t: Tournament): Promise<string> {
  const v3 = compactV3(t);
  if (v3) return pack(JSON.stringify(v3));
  return V2 + (await lz()).compressToEncodedURIComponent(JSON.stringify(compactTournament(t)));
}

export async function decodeTournament(data: string): Promise<Tournament | null> {
  try {
    const L = await lz();
    if (data.startsWith(V3)) {
      const json = await unpack(data.slice(V3.length));
      if (!json) return null;
      const c = JSON.parse(json) as CompactV3;
      if (!Array.isArray(c) || c.length < 10) return null;
      const t = await expandV3(c);
      return isTournament(t) ? t : null;
    }
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

export type ShortLinkResult = { url: string } | { error: "no-storage" | "rate-limited" | "network" | "invalid" };

/**
 * Enlace corto: guarda el torneo en el servidor y devuelve /compartir#<NombreDelTorneo>-<sufijo>.
 * Si el servidor no tiene almacenamiento configurado (o falla), el llamador usa el enlace largo.
 */
export async function createShortLink(t: Tournament, base: string): Promise<ShortLinkResult> {
  const data = await encodeTournament(t);
  try {
    const res = await fetch("/api/compartir", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data, base }) });
    if (res.status === 501) return { error: "no-storage" };
    if (res.status === 429) return { error: "rate-limited" };
    if (!res.ok) return { error: "invalid" };
    const { id } = (await res.json()) as { id: string };
    return { url: `${window.location.origin}/compartir#${id}` };
  } catch {
    return { error: "network" };
  }
}

/** Descarga un torneo guardado con un enlace corto. */
export async function fetchShortLink(id: string): Promise<Tournament | null> {
  try {
    const res = await fetch(`/api/compartir/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const { data } = (await res.json()) as { data?: string };
    return data ? await decodeTournament(data) : null;
  } catch {
    return null;
  }
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
