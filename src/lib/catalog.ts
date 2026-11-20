import type { FlagSpec, GameEdition, Gender, Team, TeamKind } from "./types";
import { CONFEDERATION } from "./editions";
import { CLUBS, NATIONALS, registerTeams } from "./teams";

/*
 * Catálogos por edición, cargados bajo demanda (un JSON por edición, ~50-65 KB cada uno).
 * Generados con scripts/build-catalogs.py a partir de FIFPlay (disponibilidad, país y liga) y
 * FIFAUTeam (licencias y novedades). No contienen valoraciones: las únicas valoraciones
 * verificadas son las de los 36 equipos de FC 25 de teams.ts. Nunca se rellenan con datos de otra edición.
 */

interface RawClub { n: string; c: string; k: string; l: string; g: "m" | "w"; lic?: "licensed" | "generic"; new?: 1 }
interface RawNational { n: string; es: string; k: string; g: "m" | "w"; lic?: "licensed" | "generic"; new?: 1 }
interface RawCatalog { clubs: RawClub[]; nationals: RawNational[]; missing: { m: { n: string; es: string }[]; w: { n: string; es: string }[] } }

export interface MissingTeam {
  name: string;
  /** Nombre en español. */
  es: string;
  gender: Gender;
  /** Ediciones en las que sí está disponible (según las listas consultadas). */
  availableIn: GameEdition[];
}

export interface Catalog {
  edition: GameEdition;
  teams: Team[];
  /** Selecciones relevantes que NO están en esta edición (informativo; no jugables). */
  missing: MissingTeam[];
}

const loaders: Record<GameEdition, () => Promise<RawCatalog>> = {
  FC25: () => import("@/data/catalogs/fc25.json").then((m) => m.default as unknown as RawCatalog),
  FC26: () => import("@/data/catalogs/fc26.json").then((m) => m.default as unknown as RawCatalog),
  FC27: () => import("@/data/catalogs/fc27.json").then((m) => m.default as unknown as RawCatalog),
};

const cache = new Map<GameEdition, Catalog>();
const pending = new Map<GameEdition, Promise<Catalog>>();

export const getCatalogSync = (edition: GameEdition): Catalog | undefined => cache.get(edition);

export function loadCatalog(edition: GameEdition): Promise<Catalog> {
  const hit = cache.get(edition);
  if (hit) return Promise.resolve(hit);
  let p = pending.get(edition);
  if (!p) {
    p = loaders[edition]().then((raw) => {
      const cat = buildCatalog(edition, raw);
      cache.set(edition, cat);
      registerTeams(cat.teams);
      return cat;
    });
    pending.set(edition, p);
    p.catch(() => pending.delete(edition));
  }
  return p;
}

/** Equipos de una edición, categoría y género. Vacío si el catálogo aún no se ha cargado. */
export function teamsFor(edition: GameEdition, kind: TeamKind, gender: Gender): Team[] {
  return cache.get(edition)?.teams.filter((t) => t.kind === kind && t.gender === gender) ?? [];
}

// ---------- Construcción ----------

const STOP = /\b(fc|cf|ac|sc|sv|fk|sk|club|de|the|real)\b/g;
const slugOf = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(STOP, " ").replace(/[^a-z0-9]+/g, "");

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function hsl(h: number, s: number, l: number): string {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
/** Colores deterministas para la insignia generada (los escudos oficiales son marcas registradas). */
function colorsFor(name: string): [string, string] {
  const h = hash(name) % 360;
  return [hsl(h, 55, 36), hsl((h + 150) % 360, 70, 72)];
}
function shortOf(name: string): string {
  const words = name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter((w) => w && !/^(fc|cf|ac|sc|de|the|of|club)$/i.test(w));
  const base = words.length >= 2 ? words.slice(0, 3).map((w) => w[0]).join("") : (words[0] ?? name).slice(0, 3);
  return base.toUpperCase();
}

const stripe = (layout: "h" | "v", stripes: string[], extra?: Partial<FlagSpec>): FlagSpec => ({ layout, stripes, ...extra });
const R = "#d52b1e", W = "#ffffff", B = "#0b3d91", G = "#0a7d3b", Y = "#fcd116", K = "#111111";
/** Banderas sencillas (franjas + cruz) de selecciones sin bandera propia. Las demás usan insignia generada. */
const FLAGS: Record<string, FlagSpec> = {
  Austria: stripe("h", [R, W, R]),
  Belgium: stripe("v", [K, Y, R]),
  Cameroon: stripe("v", [G, R, Y], { emblem: "star", emblemColor: Y }),
  Colombia: stripe("h", [Y, B, R], { ratios: [2, 1, 1] }),
  Denmark: stripe("h", [R], { emblem: "cross", emblemColor: W }),
  Finland: stripe("h", [W], { emblem: "cross", emblemColor: B }),
  Sweden: stripe("h", [B], { emblem: "cross", emblemColor: Y }),
  Norway: stripe("h", [R], { emblem: "cross", emblemColor: B }),
  Iceland: stripe("h", [B], { emblem: "cross", emblemColor: W }),
  Switzerland: stripe("h", [R], { emblem: "cross", emblemColor: W }),
  Hungary: stripe("h", [R, W, G]),
  Ireland: stripe("v", [G, W, "#ff883e"]),
  Romania: stripe("v", ["#002b7f", Y, "#ce1126"]),
  Poland: stripe("h", [W, "#dc143c"]),
  Ukraine: stripe("h", ["#0057b7", "#ffd700"]),
  Egypt: stripe("h", ["#ce1126", W, K]),
  Peru: stripe("v", ["#d91023", W, "#d91023"]),
  Paraguay: stripe("h", ["#d52b1e", W, "#0038a8"]),
  Venezuela: stripe("h", [Y, "#00247d", "#cf142b"]),
  India: stripe("h", ["#ff9933", W, "#138808"]),
  Indonesia: stripe("h", ["#ce1126", W]),
  Canada: stripe("v", [R, W, R], { ratios: [1, 2, 1] }),
  "DR Congo": stripe("h", ["#007fff", "#f7d618", "#ce1021"]),
  Greece: stripe("h", ["#0d5eaf", W, "#0d5eaf", W, "#0d5eaf"]),
  Chile: stripe("h", [W, "#d52b1e"]),
  Uruguay: stripe("h", [W, "#0038a8", W, "#0038a8", W]),
  Brazil: stripe("h", [G, Y, G], { ratios: [1, 2, 1] }),
};
const NAT_COLORS: Record<string, [string, string]> = {
  Brazil: ["#009c3b", "#ffdf00"], Japan: ["#1a2a6c", "#ffffff"], "Korea Republic": ["#c60c30", "#003478"], Australia: ["#00843d", "#ffcd00"],
  "New Zealand": ["#111111", "#ffffff"], "Saudi Arabia": ["#006c35", "#ffffff"], Türkiye: ["#e30a17", "#ffffff"], Vietnam: ["#da251d", "#ffff00"],
};

function natColors(en: string): [string, string] {
  return NAT_COLORS[en] ?? (FLAGS[en] ? [FLAGS[en].stripes[0], FLAGS[en].stripes[1] ?? FLAGS[en].stripes[0]] : colorsFor(en));
}

/** Nombres con los que FIFPlay lista a clubes que en nuestros datos de FC 25 usan otro nombre. */
const STATIC_ALIAS: Record<string, string> = {
  inter: slugOf("Inter de Milán"), milan: slugOf("AC Milan"), manchesterutd: slugOf("Manchester United"),
  newcastleutd: slugOf("Newcastle United"), leverkusen: slugOf("Bayer 04 Leverkusen"), parissg: slugOf("Paris Saint-Germain"),
  marseille: slugOf("Olympique de Marseille"),
};

function buildCatalog(edition: GameEdition, raw: RawCatalog): Catalog {
  const tag = edition.toLowerCase();
  const teams: Team[] = [];
  const used = new Set<string>();
  const uniq = (id: string) => {
    let out = id;
    for (let i = 2; used.has(out); i++) out = `${id}-${i}`;
    used.add(out);
    return out;
  };

  // FC 25: reutiliza los equipos valorados y completa su licencia (los ids originales se conservan).
  const statics = edition === "FC25" ? new Map<string, Team>() : null;
  if (statics) {
    for (const t of CLUBS) {
      statics.set(`c:${slugOf(t.name)}`, t);
      if (t.realName) statics.set(`c:${slugOf(t.realName)}`, t);
    }
    for (const t of NATIONALS) statics.set(`n:${slugOf(t.name)}`, t);
  }
  const matched = new Set<Team>();

  for (const c of raw.clubs) {
    const gender: Gender = c.g === "w" ? "women" : "men";
    const hit = gender === "men" ? statics?.get(`c:${STATIC_ALIAS[slugOf(c.n)] ?? slugOf(c.n)}`) : undefined;
    if (hit) {
      if (!matched.has(hit)) {
        matched.add(hit);
        if (c.lic && !hit.license) hit.license = c.lic;
        used.add(hit.id);
        teams.push(hit);
      }
      continue;
    }
    const colors = colorsFor(c.n);
    teams.push({
      id: uniq(`${tag}:c${c.g}:${slugOf(c.n)}`),
      kind: "club",
      edition,
      gender,
      continent: c.k,
      name: c.n,
      short: shortOf(c.n),
      league: c.l,
      country: c.c,
      ovr: null, att: null, mid: null, def: null,
      colors,
      license: c.lic ?? "unknown",
      ...(c.new ? { newIn: edition } : {}),
      source: "FIFPlay / FIFAUTeam",
    });
  }
  // Los equipos valorados de FC 25 que FIFPlay no lista (p. ej. por otro nombre) se conservan: sus datos están verificados.
  if (statics) for (const t of CLUBS) if (!matched.has(t)) { used.add(t.id); teams.push(t); }

  for (const n of raw.nationals) {
    const gender: Gender = n.g === "w" ? "women" : "men";
    const hit = gender === "men" ? statics?.get(`n:${slugOf(n.es)}`) : undefined;
    if (hit) {
      if (n.lic && !hit.license) hit.license = n.lic;
      used.add(hit.id);
      teams.push(hit);
      matched.add(hit);
      continue;
    }
    const conf = CONFEDERATION[n.k] ?? "Otros";
    teams.push({
      id: uniq(`${tag}:n${n.g}:${slugOf(n.n)}`),
      kind: "national",
      edition,
      gender,
      continent: n.k,
      name: n.es,
      short: shortOf(n.es),
      league: conf,
      country: n.es,
      ovr: null, att: null, mid: null, def: null,
      colors: natColors(n.n),
      ...(FLAGS[n.n] ? { flag: FLAGS[n.n] } : {}),
      license: n.lic ?? "unknown",
      ...(n.new ? { newIn: edition } : {}),
      source: "FIFPlay / FIFAUTeam",
    });
  }
  if (statics) for (const t of NATIONALS) if (!matched.has(t)) { used.add(t.id); teams.push(t); }

  const missing: MissingTeam[] = [
    ...raw.missing.m.map((x) => ({ name: x.n, es: x.es, gender: "men" as const, availableIn: [] as GameEdition[] })),
    ...raw.missing.w.map((x) => ({ name: x.n, es: x.es, gender: "women" as const, availableIn: [] as GameEdition[] })),
  ];
  return { edition, teams, missing };
}

/** Rellena `availableIn` de las selecciones no disponibles con las otras ediciones cargadas. */
export function annotateMissing(catalogs: Catalog[]): void {
  for (const c of catalogs)
    for (const m of c.missing)
      m.availableIn = catalogs
        .filter((o) => o.edition !== c.edition && o.teams.some((t) => t.kind === "national" && t.gender === m.gender && t.country === m.es))
        .map((o) => o.edition);
}
