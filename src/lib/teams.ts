import type { Team, TeamKind } from "./types";

/**
 * Base de datos de equipos de EA SPORTS FC 25.
 *
 * Valoraciones (OVR / ATQ / MED / DEF) de la base de datos FC 25 de FIFA Index
 * (fifaindex.com/teams/fc25), que refleja la última actualización de plantillas
 * de FC 25 (julio de 2025). Contrastadas con ReFIFA (actualización del 5/7/2025),
 * SoFIFA y FIFACM. Donde FIFA Index no fue accesible se indica la fuente usada.
 *
 * Nota: en el lanzamiento (septiembre de 2024) algunas valoraciones eran distintas
 * (p. ej. Real Madrid y Manchester City 86). No se usan datos de FC 26.
 *
 * Los escudos oficiales son marcas registradas, así que la app genera una insignia
 * propia con los colores del club en lugar de reproducirlos.
 */
export const TEAMS_SOURCE =
  "FIFA Index · base de datos FC 25 (última actualización de plantillas, julio 2025)";

const FI = "FIFA Index";

export const CLUBS: Team[] = [
  { kind: "club", id: "real-madrid", name: "Real Madrid", short: "RMA", league: "LaLiga", country: "España", ovr: 85, att: 88, mid: 86, def: 81, colors: ["#f5f5f5", "#d4af37"], source: FI },
  { kind: "club", id: "man-city", name: "Manchester City", short: "MCI", league: "Premier League", country: "Inglaterra", ovr: 85, att: 86, mid: 83, def: 79, colors: ["#6cabdd", "#1c2c5b"], source: FI },
  { kind: "club", id: "bayern", name: "FC Bayern München", short: "FCB", league: "Bundesliga", country: "Alemania", ovr: 84, att: 90, mid: 84, def: 82, colors: ["#dc052d", "#ffffff"], source: FI },
  { kind: "club", id: "liverpool", name: "Liverpool", short: "LIV", league: "Premier League", country: "Inglaterra", ovr: 84, att: 82, mid: 83, def: 85, colors: ["#c8102e", "#f6eb61"], source: FI },
  { kind: "club", id: "lombardia", name: "Lombardia FC", realName: "Inter de Milán", short: "LOM", league: "Serie A", country: "Italia", ovr: 84, att: 86, mid: 84, def: 83, colors: ["#0068a8", "#111111"], source: "ReFIFA / CMTracker (17/7/2025)" },
  { kind: "club", id: "barcelona", name: "FC Barcelona", short: "BAR", league: "LaLiga", country: "España", ovr: 84, att: 85, mid: 85, def: 83, colors: ["#a50044", "#004d98"], source: FI },
  { kind: "club", id: "arsenal", name: "Arsenal", short: "ARS", league: "Premier League", country: "Inglaterra", ovr: 83, att: 83, mid: 85, def: 81, colors: ["#ef0107", "#ffffff"], source: FI },
  { kind: "club", id: "psg", name: "Paris Saint-Germain", short: "PSG", league: "Ligue 1", country: "Francia", ovr: 83, att: 83, mid: 83, def: 84, colors: ["#004170", "#da291c"], source: FI },
  { kind: "club", id: "leverkusen", name: "Bayer 04 Leverkusen", short: "B04", league: "Bundesliga", country: "Alemania", ovr: 83, att: 83, mid: 84, def: 83, colors: ["#e32221", "#111111"], source: FI },
  { kind: "club", id: "atletico", name: "Atlético de Madrid", short: "ATM", league: "LaLiga", country: "España", ovr: 82, att: 84, mid: 80, def: 81, colors: ["#cb3524", "#272e61"], source: FI },
  { kind: "club", id: "dortmund", name: "Borussia Dortmund", short: "BVB", league: "Bundesliga", country: "Alemania", ovr: 81, att: 82, mid: 79, def: 81, colors: ["#fde100", "#111111"], source: FI },
  { kind: "club", id: "tottenham", name: "Tottenham Hotspur", short: "TOT", league: "Premier League", country: "Inglaterra", ovr: 81, att: 80, mid: 83, def: 81, colors: ["#ffffff", "#132257"], source: FI },
  { kind: "club", id: "aston-villa", name: "Aston Villa", short: "AVL", league: "Premier League", country: "Inglaterra", ovr: 81, att: 84, mid: 80, def: 80, colors: ["#670e36", "#95bfe5"], source: FI },
  { kind: "club", id: "newcastle", name: "Newcastle United", short: "NEW", league: "Premier League", country: "Inglaterra", ovr: 81, att: 81, mid: 80, def: 80, colors: ["#241f20", "#ffffff"], source: "FIFACM / SoFIFA (24/6/2025)" },
  { kind: "club", id: "milano", name: "Milano FC", realName: "AC Milan", short: "MIL", league: "Serie A", country: "Italia", ovr: 81, att: 79, mid: 82, def: 78, colors: ["#fb090b", "#111111"], source: "FC Tools Hub / SoFIFA (17/7/2025)" },
  { kind: "club", id: "juventus", name: "Juventus", short: "JUV", league: "Serie A", country: "Italia", ovr: 80, att: 82, mid: 80, def: 78, colors: ["#f5f5f5", "#111111"], source: FI },
  { kind: "club", id: "chelsea", name: "Chelsea", short: "CHE", league: "Premier League", country: "Inglaterra", ovr: 80, att: 81, mid: 82, def: 80, colors: ["#034694", "#ffffff"], source: FI },
  { kind: "club", id: "man-united", name: "Manchester United", short: "MUN", league: "Premier League", country: "Inglaterra", ovr: 80, att: 77, mid: 78, def: 80, colors: ["#da291c", "#fbe122"], source: FI },
  { kind: "club", id: "leipzig", name: "RB Leipzig", short: "RBL", league: "Bundesliga", country: "Alemania", ovr: 80, att: 82, mid: 79, def: 80, colors: ["#ffffff", "#dd0741"], source: FI },
  { kind: "club", id: "fenerbahce", name: "Fenerbahçe", short: "FEN", league: "Süper Lig", country: "Turquía", ovr: 80, att: 81, mid: 80, def: 78, colors: ["#ffed00", "#163962"], source: FI },
  { kind: "club", id: "napoli", name: "Napoli", short: "NAP", league: "Serie A", country: "Italia", ovr: 79, att: 79, mid: 80, def: 79, colors: ["#12a0d7", "#ffffff"], source: FI },
  { kind: "club", id: "roma", name: "Roma", short: "ROM", league: "Serie A", country: "Italia", ovr: 79, att: 78, mid: 79, def: 79, colors: ["#8e1f2f", "#f0bc42"], source: FI },
  { kind: "club", id: "benfica", name: "SL Benfica", short: "SLB", league: "Liga Portugal", country: "Portugal", ovr: 79, att: 79, mid: 79, def: 78, colors: ["#e83030", "#ffffff"], source: FI },
  { kind: "club", id: "sporting", name: "Sporting CP", short: "SCP", league: "Liga Portugal", country: "Portugal", ovr: 79, att: 86, mid: 79, def: 78, colors: ["#008057", "#ffffff"], source: FI },
  { kind: "club", id: "villarreal", name: "Villarreal CF", short: "VIL", league: "LaLiga", country: "España", ovr: 78, att: 79, mid: 79, def: 77, colors: ["#ffe667", "#005187"], source: FI },
  { kind: "club", id: "marseille", name: "Olympique de Marseille", short: "OM", league: "Ligue 1", country: "Francia", ovr: 78, att: 76, mid: 79, def: 77, colors: ["#2faee0", "#ffffff"], source: FI },
];

/**
 * Selecciones nacionales masculinas disponibles en FC 25 con valoraciones verificadas.
 * Media y líneas de FIFA Index (FC 25) cuando fue posible; si no, la instantánea
 * de SoFIFA/FIFACM indicada en `source`. Brasil y Uruguay no tienen licencia en FC 25,
 * por eso no aparecen. Bélgica existe en el juego, pero no se encontraron valoraciones
 * de FC 25 verificables y se omite hasta confirmarlas.
 */
export const NATIONALS: Team[] = [
  { kind: "national", id: "nat-france", name: "Francia", short: "FRA", league: "UEFA", country: "Francia", ovr: 85, att: 86, mid: 83, def: 85, colors: ["#0055a4", "#ef4135"], flag: { layout: "v", stripes: ["#0055a4", "#ffffff", "#ef4135"] }, source: FI },
  { kind: "national", id: "nat-spain", name: "España", short: "ESP", league: "UEFA", country: "España", ovr: 84, att: 84, mid: 84, def: 82, colors: ["#aa151b", "#f1bf00"], flag: { layout: "h", stripes: ["#aa151b", "#f1bf00", "#aa151b"], ratios: [1, 2, 1] }, source: "FIFACM (FC 25)" },
  { kind: "national", id: "nat-germany", name: "Alemania", short: "GER", league: "UEFA", country: "Alemania", ovr: 84, att: 81, mid: 84, def: 84, colors: ["#111111", "#dd0000"], flag: { layout: "h", stripes: ["#111111", "#dd0000", "#ffce00"] }, source: "SoFIFA (17/7/2025)" },
  { kind: "national", id: "nat-england", name: "Inglaterra", short: "ENG", league: "UEFA", country: "Inglaterra", ovr: 84, att: 85, mid: 86, def: 82, colors: ["#ffffff", "#ce1124"], flag: { layout: "h", stripes: ["#ffffff"], emblem: "cross", emblemColor: "#ce1124" }, source: "SoFIFA (20/3/2025)" },
  { kind: "national", id: "nat-portugal", name: "Portugal", short: "POR", league: "UEFA", country: "Portugal", ovr: 83, att: 83, mid: 84, def: 82, colors: ["#da291c", "#046a38"], flag: { layout: "v", stripes: ["#046a38", "#da291c"], ratios: [2, 3] }, source: "SoFIFA (17/7/2025)" },
  { kind: "national", id: "nat-argentina", name: "Argentina", short: "ARG", league: "CONMEBOL", country: "Argentina", ovr: 83, att: 87, mid: 84, def: 81, colors: ["#74acdf", "#ffffff"], flag: { layout: "h", stripes: ["#74acdf", "#ffffff", "#74acdf"], emblem: "sun", emblemColor: "#f6b40e" }, source: FI },
  { kind: "national", id: "nat-netherlands", name: "Países Bajos", short: "NED", league: "UEFA", country: "Países Bajos", ovr: 83, att: 83, mid: 83, def: 82, colors: ["#f36c21", "#21468b"], flag: { layout: "h", stripes: ["#ae1c28", "#ffffff", "#21468b"] }, source: FI },
  { kind: "national", id: "nat-italy", name: "Italia", short: "ITA", league: "UEFA", country: "Italia", ovr: 82, att: 79, mid: 83, def: 82, colors: ["#0064aa", "#ffffff"], flag: { layout: "v", stripes: ["#009246", "#ffffff", "#ce2b37"] }, source: "SoFIFA (marzo 2025) / CMTracker" },
  { kind: "national", id: "nat-croatia", name: "Croacia", short: "CRO", league: "UEFA", country: "Croacia", ovr: 79, att: 80, mid: 80, def: 78, colors: ["#ff0000", "#ffffff"], flag: { layout: "h", stripes: ["#ff0000", "#ffffff", "#171796"], emblem: "checker", emblemColor: "#ff0000" }, source: "SoFIFA (4/7/2025)" },
  { kind: "national", id: "nat-morocco", name: "Marruecos", short: "MAR", league: "CAF", country: "Marruecos", ovr: 79, att: 81, mid: 77, def: 81, colors: ["#c1272d", "#006233"], flag: { layout: "h", stripes: ["#c1272d"], emblem: "star", emblemColor: "#006233" }, source: "SoFIFA (17/7/2025)" },
];

export const TEAMS: Team[] = [...CLUBS, ...NATIONALS];

const BY_ID = new Map(TEAMS.map((t) => [t.id, t]));

export function getTeam(id: string | null | undefined): Team | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function sortByRating(ids: readonly string[]): string[] {
  return [...ids].sort((a, b) => {
    const ta = BY_ID.get(a)!;
    const tb = BY_ID.get(b)!;
    return tb.ovr - ta.ovr || tb.att + tb.mid + tb.def - (ta.att + ta.mid + ta.def) || ta.name.localeCompare(tb.name);
  });
}

export function teamsOf(kind: TeamKind): Team[] {
  return kind === "club" ? CLUBS : NATIONALS;
}

/** Selección inicial de clubes: los 12 grandes de referencia de FC 25. */
export const DEFAULT_CLUB_POOL = sortByRating([
  "real-madrid", "man-city", "bayern", "lombardia", "liverpool", "arsenal",
  "barcelona", "psg", "leverkusen", "atletico", "dortmund", "juventus",
]);

/** Selección inicial de selecciones: todas las disponibles. */
export const DEFAULT_NATIONAL_POOL = sortByRating(NATIONALS.map((t) => t.id));

export function defaultPool(kind: TeamKind): string[] {
  return kind === "club" ? [...DEFAULT_CLUB_POOL] : [...DEFAULT_NATIONAL_POOL];
}
