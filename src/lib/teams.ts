import type { Team } from "./types";

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

export const TEAMS: Team[] = [
  { id: "real-madrid", name: "Real Madrid", short: "RMA", league: "LaLiga", country: "España", ovr: 85, att: 88, mid: 86, def: 81, colors: ["#f5f5f5", "#d4af37"], source: FI },
  { id: "man-city", name: "Manchester City", short: "MCI", league: "Premier League", country: "Inglaterra", ovr: 85, att: 86, mid: 83, def: 79, colors: ["#6cabdd", "#1c2c5b"], source: FI },
  { id: "bayern", name: "FC Bayern München", short: "FCB", league: "Bundesliga", country: "Alemania", ovr: 84, att: 90, mid: 84, def: 82, colors: ["#dc052d", "#ffffff"], source: FI },
  { id: "liverpool", name: "Liverpool", short: "LIV", league: "Premier League", country: "Inglaterra", ovr: 84, att: 82, mid: 83, def: 85, colors: ["#c8102e", "#f6eb61"], source: FI },
  { id: "lombardia", name: "Lombardia FC", realName: "Inter de Milán", short: "LOM", league: "Serie A", country: "Italia", ovr: 84, att: 86, mid: 84, def: 83, colors: ["#0068a8", "#111111"], source: "ReFIFA / CMTracker (17/7/2025)" },
  { id: "barcelona", name: "FC Barcelona", short: "BAR", league: "LaLiga", country: "España", ovr: 84, att: 85, mid: 85, def: 83, colors: ["#a50044", "#004d98"], source: FI },
  { id: "arsenal", name: "Arsenal", short: "ARS", league: "Premier League", country: "Inglaterra", ovr: 83, att: 83, mid: 85, def: 81, colors: ["#ef0107", "#ffffff"], source: FI },
  { id: "psg", name: "Paris Saint-Germain", short: "PSG", league: "Ligue 1", country: "Francia", ovr: 83, att: 83, mid: 83, def: 84, colors: ["#004170", "#da291c"], source: FI },
  { id: "leverkusen", name: "Bayer 04 Leverkusen", short: "B04", league: "Bundesliga", country: "Alemania", ovr: 83, att: 83, mid: 84, def: 83, colors: ["#e32221", "#111111"], source: FI },
  { id: "atletico", name: "Atlético de Madrid", short: "ATM", league: "LaLiga", country: "España", ovr: 82, att: 84, mid: 80, def: 81, colors: ["#cb3524", "#272e61"], source: FI },
  { id: "dortmund", name: "Borussia Dortmund", short: "BVB", league: "Bundesliga", country: "Alemania", ovr: 81, att: 82, mid: 79, def: 81, colors: ["#fde100", "#111111"], source: FI },
  { id: "tottenham", name: "Tottenham Hotspur", short: "TOT", league: "Premier League", country: "Inglaterra", ovr: 81, att: 80, mid: 83, def: 81, colors: ["#ffffff", "#132257"], source: FI },
  { id: "aston-villa", name: "Aston Villa", short: "AVL", league: "Premier League", country: "Inglaterra", ovr: 81, att: 84, mid: 80, def: 80, colors: ["#670e36", "#95bfe5"], source: FI },
  { id: "newcastle", name: "Newcastle United", short: "NEW", league: "Premier League", country: "Inglaterra", ovr: 81, att: 81, mid: 80, def: 80, colors: ["#241f20", "#ffffff"], source: "FIFACM / SoFIFA (24/6/2025)" },
  { id: "milano", name: "Milano FC", realName: "AC Milan", short: "MIL", league: "Serie A", country: "Italia", ovr: 81, att: 79, mid: 82, def: 78, colors: ["#fb090b", "#111111"], source: "FC Tools Hub / SoFIFA (17/7/2025)" },
  { id: "juventus", name: "Juventus", short: "JUV", league: "Serie A", country: "Italia", ovr: 80, att: 82, mid: 80, def: 78, colors: ["#f5f5f5", "#111111"], source: FI },
  { id: "chelsea", name: "Chelsea", short: "CHE", league: "Premier League", country: "Inglaterra", ovr: 80, att: 81, mid: 82, def: 80, colors: ["#034694", "#ffffff"], source: FI },
  { id: "man-united", name: "Manchester United", short: "MUN", league: "Premier League", country: "Inglaterra", ovr: 80, att: 77, mid: 78, def: 80, colors: ["#da291c", "#fbe122"], source: FI },
  { id: "leipzig", name: "RB Leipzig", short: "RBL", league: "Bundesliga", country: "Alemania", ovr: 80, att: 82, mid: 79, def: 80, colors: ["#ffffff", "#dd0741"], source: FI },
  { id: "fenerbahce", name: "Fenerbahçe", short: "FEN", league: "Süper Lig", country: "Turquía", ovr: 80, att: 81, mid: 80, def: 78, colors: ["#ffed00", "#163962"], source: FI },
  { id: "napoli", name: "Napoli", short: "NAP", league: "Serie A", country: "Italia", ovr: 79, att: 79, mid: 80, def: 79, colors: ["#12a0d7", "#ffffff"], source: FI },
  { id: "roma", name: "Roma", short: "ROM", league: "Serie A", country: "Italia", ovr: 79, att: 78, mid: 79, def: 79, colors: ["#8e1f2f", "#f0bc42"], source: FI },
  { id: "benfica", name: "SL Benfica", short: "SLB", league: "Liga Portugal", country: "Portugal", ovr: 79, att: 79, mid: 79, def: 78, colors: ["#e83030", "#ffffff"], source: FI },
  { id: "sporting", name: "Sporting CP", short: "SCP", league: "Liga Portugal", country: "Portugal", ovr: 79, att: 86, mid: 79, def: 78, colors: ["#008057", "#ffffff"], source: FI },
  { id: "villarreal", name: "Villarreal CF", short: "VIL", league: "LaLiga", country: "España", ovr: 78, att: 79, mid: 79, def: 77, colors: ["#ffe667", "#005187"], source: FI },
  { id: "marseille", name: "Olympique de Marseille", short: "OM", league: "Ligue 1", country: "Francia", ovr: 78, att: 76, mid: 79, def: 77, colors: ["#2faee0", "#ffffff"], source: FI },
];

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

export const LEAGUES = [...new Set(TEAMS.map((t) => t.league))];
export const COUNTRIES = [...new Set(TEAMS.map((t) => t.country))];

/** Selección inicial: los 12 grandes clubes de referencia de FC 25. */
export const DEFAULT_POOL = sortByRating([
  "real-madrid", "man-city", "bayern", "lombardia", "liverpool", "arsenal",
  "barcelona", "psg", "leverkusen", "atletico", "dortmund", "juventus",
]);
