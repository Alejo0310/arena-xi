import type { DrawState } from "./types";

/*
 * Máquina de estados del flujo visual del sorteo (común a todas las mecánicas).
 *
 *   READY ──START──▶ SPINNING ──ANIMATION_DONE──▶ REVEALING ──REVEAL_DONE──▶ ASSIGNED
 *     ▲                                                                        │
 *     └──NEXT_READY── NEXT ◀──────────────CONTINUE (quedan jugadores)──────────┤
 *                                          CONTINUE (era el último) ──▶ COMPLETED
 *
 *   READY ──PRESENT──▶ PRESENTING ──PRESENTATION_DONE──▶ COMPLETED   (sorteo completo)
 *
 * Cualquier evento que no corresponda al estado actual se ignora, y los eventos de
 * animación llevan el `runId` del giro que los originó: un evento repetido (doble
 * efecto de React, animación antigua) no puede provocar dos transiciones.
 */

export type FlowPhase = "ready" | "spinning" | "revealing" | "assigned" | "next" | "presenting" | "completed";

export interface FlowState {
  phase: FlowPhase;
  /** Se incrementa en cada giro; identifica las animaciones de ese giro. */
  runId: number;
}

export type FlowEvent =
  | { type: "START" }
  | { type: "ANIMATION_DONE"; runId: number }
  | { type: "REVEAL_DONE"; runId: number }
  | { type: "CONTINUE"; isLast: boolean }
  | { type: "NEXT_READY" }
  | { type: "PRESENT" }
  | { type: "PRESENTATION_DONE"; complete: boolean };

/** Estado inicial a partir del sorteo persistido (sirve para recargas y cambios de pantalla). */
export function initialFlow(draw: DrawState | null | undefined): FlowState {
  if (!draw) return { phase: "ready", runId: 0 };
  // Un resultado pendiente ya está decidido: se reanuda directamente en su revelación.
  if (draw.pending) return { phase: "revealing", runId: 1 };
  if (draw.cursor >= draw.order.length) return { phase: "completed", runId: 0 };
  return { phase: "ready", runId: 0 };
}

export function flowReducer(state: FlowState, event: FlowEvent): FlowState {
  switch (event.type) {
    case "START":
      return state.phase === "ready" ? { phase: "spinning", runId: state.runId + 1 } : state;
    case "ANIMATION_DONE":
      return state.phase === "spinning" && event.runId === state.runId ? { ...state, phase: "revealing" } : state;
    case "REVEAL_DONE":
      return state.phase === "revealing" && event.runId === state.runId ? { ...state, phase: "assigned" } : state;
    case "CONTINUE":
      if (state.phase !== "assigned") return state;
      return { ...state, phase: event.isLast ? "completed" : "next" };
    case "NEXT_READY":
      return state.phase === "next" ? { ...state, phase: "ready" } : state;
    case "PRESENT":
      return state.phase === "ready" || state.phase === "completed" ? { ...state, phase: "presenting" } : state;
    case "PRESENTATION_DONE":
      return state.phase === "presenting" ? { ...state, phase: event.complete ? "completed" : "ready" } : state;
  }
}

/** Mientras el flujo no está en READY no se puede iniciar otro sorteo ni avanzar. */
export function canStart(state: FlowState): boolean {
  return state.phase === "ready";
}
