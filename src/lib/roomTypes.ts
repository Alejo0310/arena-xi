import type { DrawMode, GameEdition, Gender, PendingPick, PotsMethod, TeamKind, Tournament } from "./types";

/** Tipos compartidos entre las rutas de la API de salas y el cliente. */

export interface RoomMeta {
  name: string;
  /** Nombre del organizador (opcional, lo escribe el propio host). */
  host: string;
  max: number;
  /** Registro abierto o cerrado por el host. */
  open: boolean;
  /** El torneo ya empezó: el registro queda cerrado de forma permanente. */
  started: boolean;
  createdAt: number;
  code: string;
}

/**
 * Estado del sorteo que el host publica para que los invitados lo vean en directo. Solo lleva ids de equipos y de
 * participantes (los equipos se resuelven con el catálogo de la edición), por lo que es pequeño.
 */
export interface DrawBroadcast {
  /** Identificador de la sesión de sorteo (cambia al reiniciarlo). */
  id: string;
  mode: DrawMode;
  order: string[];
  cursor: number;
  pool: string[];
  /** Resultado ya decidido que se está animando / revelando en el host. */
  pending: PendingPick | null;
  envelopes?: (string | null)[];
  draftOptions?: string[];
  pots?: string[][];
  potIndex?: number;
  potsMethod?: PotsMethod;
  assignments: Record<string, string>;
  /** Sobre abierto → participante (para mostrar quién abrió cada uno). */
  owners: Record<number, string>;
  participants: { id: string; name: string; color: string }[];
  edition: GameEdition;
  category: TeamKind;
  gender: Gender;
}

/**
 * Petición de un jugador desde su móvil durante el sorteo. El resultado lo sigue decidiendo el navegador del host
 * (como siempre); el servidor solo comprueba que sea el turno de ese jugador y guarda la petición hasta que el host la ejecuta.
 */
export interface DrawIntent {
  kind: "spin" | "confirm";
  drawId: string;
  cursor: number;
  participantId: string;
  /** Elección del jugador (sobre abierto o carta del draft). */
  choice?: { envelopeIndex?: number; teamId?: string };
  at: number;
}

export interface RoomPublic {
  id: string;
  name: string;
  host: string;
  max: number;
  open: boolean;
  started: boolean;
  version: number;
  participants: string[];
  /** Solo cuando el host ha iniciado el torneo. */
  tournament: Tournament | null;
  /** Sorteo en curso (antes de que el host inicie el torneo). */
  draw: DrawBroadcast | null;
  /** Petición pendiente del jugador al que le toca (antes de iniciar el torneo). */
  intent: DrawIntent | null;
}

export type RoomErrorCode =
  | "not-found" | "closed" | "started" | "full" | "duplicate" | "invalid-name" | "invalid"
  | "unauthorized" | "forbidden" | "conflict" | "rate-limited" | "storage" | "no-storage"
  | "participants-changed" | "bad-request";

/** Referencia a la sala guardada dentro de un torneo del host (no contiene ningún secreto). */
export interface RoomLink {
  id: string;
  code: string;
  /** El torneo iniciado ya está publicado en la sala. */
  published?: boolean;
  /** Última versión de la sala aplicada localmente. */
  version?: number;
  /** Participantes que entraron por invitación (para distinguirlos del registro manual). */
  guests?: string[];
}

export const ROOM_ERROR_TEXT: Record<RoomErrorCode, string> = {
  "not-found": "No existe ningún torneo con ese código. Revisa los números o pide uno nuevo al organizador.",
  closed: "El organizador ha cerrado las inscripciones. Pídele que las reabra.",
  started: "El torneo ya ha comenzado y las inscripciones están cerradas.",
  full: "El torneo ya está completo: se alcanzó el número máximo de participantes.",
  duplicate: "Ya hay un participante con ese nombre en el torneo. Añade un apellido o un número para diferenciarte.",
  "invalid-name": "Escribe un nombre válido (1 a 24 caracteres).",
  invalid: "Los datos enviados no son válidos.",
  unauthorized: "No tienes permiso para hacer esto.",
  forbidden: "Solo el organizador puede hacer esto.",
  conflict: "Hubo un cambio al mismo tiempo. Inténtalo de nuevo.",
  "rate-limited": "Demasiados intentos en poco tiempo. Espera un momento e inténtalo otra vez.",
  storage: "No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.",
  "no-storage": "Las invitaciones aún no están activadas en este servidor.",
  "participants-changed": "Alguien se unió justo ahora. Revisa la lista de participantes y vuelve a intentarlo.",
  "bad-request": "Solicitud no válida.",
};
