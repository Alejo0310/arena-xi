// Tipos de dominio compartidos por la lógica del torneo, el sorteo y la UI.

export type TournamentFormat = "league" | "knockout";
export type DrawMode = "roulette" | "envelopes" | "machine" | "draft" | "pots";
export type MatchStatus = "pending" | "live" | "done";
export type LeagueTiebreak = "gd" | "h2h";
export type Phase = "setup" | "draw" | "playing" | "finished";

export interface Participant {
  id: string;
  name: string;
  color: string;
}

export interface Team {
  id: string;
  /** Nombre tal como aparece en FC 25 (p. ej. "Lombardia FC"). */
  name: string;
  /** Nombre real del club cuando FC 25 usa un nombre sin licencia. */
  realName?: string;
  short: string;
  league: string;
  country: string;
  ovr: number;
  att: number;
  mid: number;
  def: number;
  colors: [string, string];
  source: string;
}

export interface TournamentSettings {
  format: TournamentFormat;
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

export interface DrawState {
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
  assignments: Record<string, string>;
  drawHistory: DrawRecord[];
  draw: DrawState | null;
  matches: Match[];
  championId: string | null;
  finishedAt?: number;
}
