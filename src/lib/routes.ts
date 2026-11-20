import type { Phase } from "./types";

export const PHASE_LABEL: Record<Phase, string> = {
  setup: "Configuración",
  draw: "Sorteo",
  playing: "En juego",
  finished: "Finalizado",
};

export function phaseHref(phase: Phase): string {
  switch (phase) {
    case "setup": return "/nuevo";
    case "draw": return "/sorteo";
    default: return "/torneo";
  }
}
