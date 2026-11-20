// Tipos de dominio compartidos por la lógica del torneo, el sorteo y la UI.

export type TournamentFormat = "league" | "knockout";
export type DrawMode = "roulette" | "envelopes" | "machine" | "draft" | "pots";
export type MatchStatus = "pending" | "live" | "done";
export type LeagueTiebreak = "gd" | "h2h";
export type Phase = "setup" | "draw" | "playing" | "finished";
/** Categoría de equipos de un torneo. Clubes y selecciones nunca se mezclan. */
export type TeamKind = "club" | "national";
/** Edición del videojuego. Cada una tiene su propio catálogo, aislado de las demás. */
export type GameEdition = "FC25" | "FC26" | "FC27";
export type Gender = "men" | "women";
/**
 * Estado de licencia según las fuentes consultadas:
 * licensed = nombre, escudo y equipación oficiales; generic = disponible con nombre/escudo/equipación genéricos;
 * unknown = disponible pero la licencia no se ha podido verificar.
 */
export type LicenseStatus = "licensed" | "generic" | "unknown";

/** Bandera simplificada (franjas + adorno opcional) para selecciones. */
export interface FlagSpec {
  layout: "h" | "v";
  stripes: string[];
  ratios?: number[];
  emblem?: "cross" | "sun" | "star" | "checker";
  emblemColor?: string;
}

export interface Participant {
  id: string;
  name: string;
  color: string;
}

export interface Team {
  /** Único entre ediciones (los de FC 26/27 llevan prefijo de edición). */
  id: string;
  kind: TeamKind;
  /** Edición a la que pertenece el equipo. Ausente = FC25 (datos anteriores a la multiversión). */
  edition?: GameEdition;
  gender?: Gender;
  continent?: string;
  license?: LicenseStatus;
  /** Etiqueta de novedad solo cuando una fuente verifica que es nuevo en esta edición. */
  newIn?: GameEdition;
  /** Nombre tal como aparece en FC 25 (p. ej. "Lombardia FC"). */
  name: string;
  /** Nombre real del club cuando FC 25 usa un nombre sin licencia. */
  realName?: string;
  short: string;
  /** Liga (clubes) o confederación (selecciones). */
  league: string;
  country: string;
  /** Valoraciones. `null` = sin valoración verificable (nunca se inventan). */
  ovr: number | null;
  att: number | null;
  mid: number | null;
  def: number | null;
  colors: [string, string];
  flag?: FlagSpec;
  source: string;
}

export interface TournamentSettings {
  format: TournamentFormat;
  /** Categoría única de equipos del torneo. */
  category: TeamKind;
  /** Edición del videojuego del torneo. Ausente = FC25 (torneos antiguos). */
  edition?: GameEdition;
  /** Género de los equipos (clubes o selecciones). Ausente = masculino. */
  gender?: Gender;
  /** Liga: partidos a una o dos vueltas. */
  legs: 1 | 2;
  /** Eliminatorias: partido por el tercer puesto. */
  thirdPlace: boolean;
  /** Liga: criterio de desempate tras los puntos. */
  tiebreak: LeagueTiebreak;
  points: { win: number; draw: number; loss: number };
  /** Permite que varios participantes tengan el mismo equipo. */
  allowRepeatTeams: boolean;
  /** Duración de referencia del cronómetro, en minutos. */
  matchMinutes: number;
}

export interface MatchSource {
  matchId: string;
  outcome: "winner" | "loser";
}

export interface Match {
  id: string;
  round: number;
  label: string;
  homeId: string | null;
  awayId: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
  /** Penaltis, solo en eliminatorias cuando el marcador termina empatado. */
  homePens?: number | null;
  awayPens?: number | null;
  /** Ganador elegido manualmente (W.O., desconexión, acuerdo...). */
  manualWinnerId?: string | null;
  walkover?: boolean;
  status: MatchStatus;
  isBye?: boolean;
  homeSource?: MatchSource;
  awaySource?: MatchSource;
  isThirdPlace?: boolean;
  /** Orden de la llave dentro de la ronda (eliminatorias). */
  slot?: number;
  playedAt?: number;
}

export interface DrawRecord {
  participantId: string;
  teamId: string;
  mode: DrawMode;
  at: number;
  envelopeIndex?: number;
}

/** Resultado ya decidido (y guardado) que aún no se ha confirmado tras la animación. */
export interface PendingPick {
  participantId: string;
  teamId: string;
  envelopeIndex?: number;
  at: number;
}

export interface DrawState {
  /** Identificador de la sesión de sorteo (cambia al reiniciar). */
  id: string;
  mode: DrawMode;
  /** Orden aleatorio en el que participan los jugadores. */
  order: string[];
  cursor: number;
  /** Equipos disponibles (ids). */
  pool: string[];
  /** Sobres: equipo oculto en cada sobre, decidido al barajar. */
  envelopes?: (string | null)[];
  /** Draft: opciones visibles para el participante actual. */
  draftOptions?: string[];
  /** Bombos: equipos agrupados por nivel. */
  pots?: string[][];
  potIndex?: number;
  /** Sorteo decidido pendiente de confirmar: el cursor no avanza hasta "Continuar". */
  pending?: PendingPick | null;
}

export interface Tournament {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  phase: Phase;
  settings: TournamentSettings;
  participants: Participant[];
  /** Equipos habilitados para el sorteo. */
  teamPool: string[];
  /**
   * Instantánea de los equipos usados (datos y valoraciones tal como eran al crear el torneo).
   * Garantiza que actualizar un catálogo no altera torneos históricos.
   */
  snapshot?: Record<string, Team>;
  assignments: Record<string, string>;
  drawHistory: DrawRecord[];
  draw: DrawState | null;
  matches: Match[];
  championId: string | null;
  finishedAt?: number;
}
