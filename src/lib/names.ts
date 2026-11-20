import { pick } from "./random";

const PREFIX = ["Copa", "Liga", "Torneo", "Supercopa", "Champions", "Trofeo", "Clásico", "Gran Premio"];
const CORE = ["de los Cracks", "del Sofá", "Neón", "Galáctica", "de la Medianoche", "del Barrio", "de Leyendas", "Relámpago", "del Mando", "Ultra", "Titanes", "de Campeones"];
const SUFFIX = ["25", "Edición Élite", "Season 1", "Pro", "Max", "Gold", "Night Edition", ""];

export function generateTournamentName(): string {
  return [pick(PREFIX), pick(CORE), pick(SUFFIX)].filter(Boolean).join(" ");
}

/** Colores de identificación para participantes, con buen contraste sobre fondo oscuro. */
export const PLAYER_COLORS = [
  "#3dff8b", "#2f9bff", "#ff7a1a", "#ff3d71", "#b46bff", "#ffd23d",
  "#2ee6d6", "#ff5cd6", "#9bff3d", "#ff9a8a", "#6b8cff", "#e6e6e6",
  "#00c2ff", "#ffb03d", "#7dffb8", "#ff4f4f",
];
