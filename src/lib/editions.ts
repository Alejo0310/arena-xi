import type { GameEdition, Gender, LicenseStatus, Team, TeamKind } from "./types";

/** Identidad y metadatos de cada edición soportada. */
export interface EditionInfo {
  id: GameEdition;
  /** Nombre corto, p. ej. "FC 25". */
  label: string;
  /** Año de lanzamiento (temporada 20XX/YY). */
  year: number;
  season: string;
  /** Colores de acento propios de la edición (se combinan con la identidad ARENA XI). */
  accent: string;
  accent2: string;
  tagline: string;
}

export const EDITIONS: EditionInfo[] = [
  { id: "FC25", label: "FC 25", year: 2024, season: "2024/25", accent: "#3dff8b", accent2: "#12c4b0", tagline: "La base consolidada: valoraciones verificadas." },
  { id: "FC26", label: "FC 26", year: 2025, season: "2025/26", accent: "#22d3ee", accent2: "#3b82f6", tagline: "Nuevo catálogo de clubes y selecciones." },
  { id: "FC27", label: "FC 27", year: 2026, season: "2026/27", accent: "#a3e635", accent2: "#38bdf8", tagline: "El catálogo más amplio: 51 selecciones masculinas." },
];

export const DEFAULT_EDITION: GameEdition = "FC25";

export function isEdition(x: unknown): x is GameEdition {
  return x === "FC25" || x === "FC26" || x === "FC27";
}
export function isGender(x: unknown): x is Gender {
  return x === "men" || x === "women";
}
export function editionInfo(e: GameEdition): EditionInfo {
  return EDITIONS.find((x) => x.id === e)!;
}

/** Edición efectiva de un equipo (los datos anteriores a la multiversión son de FC 25). */
export const editionOfTeam = (t: Pick<Team, "edition">): GameEdition => t.edition ?? "FC25";
export const genderOfTeam = (t: Pick<Team, "gender">): Gender => t.gender ?? "men";

/** Las cuatro categorías de equipos de cada edición. */
export interface CategoryScope {
  kind: TeamKind;
  gender: Gender;
}
export const CATEGORIES: { id: string; kind: TeamKind; gender: Gender; label: string; short: string }[] = [
  { id: "club-men", kind: "club", gender: "men", label: "Clubes masculinos", short: "Clubes M" },
  { id: "club-women", kind: "club", gender: "women", label: "Clubes femeninos", short: "Clubes F" },
  { id: "national-men", kind: "national", gender: "men", label: "Selecciones masculinas", short: "Selecciones M" },
  { id: "national-women", kind: "national", gender: "women", label: "Selecciones femeninas", short: "Selecciones F" },
];
export const categoryLabel = (kind: TeamKind, gender: Gender) => CATEGORIES.find((c) => c.kind === kind && c.gender === gender)!.label;

export const LICENSE_LABEL: Record<LicenseStatus, string> = {
  licensed: "Licenciado",
  generic: "Genérico",
  unknown: "Sin verificar",
};

export const CONFEDERATION: Record<string, string> = {
  Europa: "UEFA",
  África: "CAF",
  Asia: "AFC",
  Norteamérica: "CONCACAF",
  Sudamérica: "CONMEBOL",
  Oceanía: "OFC",
  Mundial: "Mundial",
};
