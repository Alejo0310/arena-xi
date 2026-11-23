import { flowReducer, type FlowEvent, type FlowState } from "./drawFlow";
import type { DrawBroadcast } from "./roomTypes";

/*
 * Flujo visual del sorteo desde la pantalla de un invitado. El host decide y anima; el invitado solo reproduce:
 *   - llega un resultado pendiente nuevo  → empieza el giro (SPINNING) con el mismo equipo que verá el host;
 *   - su animación termina y se revela    → ANIMATION_DONE / REVEAL_DONE (la misma máquina de estados del host);
 *   - el host confirma ("Continuar")      → desaparece el pendiente y se vuelve a READY;
 *   - se asignó a todos                   → COMPLETED ("esperando a que el host inicie el torneo").
 * Es pura para poder probarla.
 */

export interface SpectatorState {
  flow: FlowState;
  drawId: string | null;
  /** Clave del último resultado pendiente ya reproducido (evita repetir la animación en cada sondeo). */
  lastKey: string | null;
}

export const initialSpectator: SpectatorState = { flow: { phase: "ready", runId: 0 }, drawId: null, lastKey: null };

export const pendingKey = (d: DrawBroadcast): string | null => (d.pending ? `${d.cursor}:${d.pending.participantId}:${d.pending.at}` : null);
export const isDrawComplete = (d: DrawBroadcast) => d.cursor >= d.order.length && !d.pending;

/** Aplica una nueva instantánea publicada por el host. */
export function spectatorSnapshot(prev: SpectatorState, d: DrawBroadcast): SpectatorState {
  const key = pendingKey(d);
  if (prev.drawId !== d.id) {
    // Primera instantánea (o sorteo reiniciado): si el host ya está revelando, se muestra el resultado sin repetir el giro.
    const runId = prev.flow.runId + 1;
    if (key) return { drawId: d.id, lastKey: key, flow: { phase: "assigned", runId } };
    return { drawId: d.id, lastKey: null, flow: { phase: isDrawComplete(d) ? "completed" : "ready", runId } };
  }
  if (key && key !== prev.lastKey) return { ...prev, lastKey: key, flow: { phase: "spinning", runId: prev.flow.runId + 1 } };
  if (!key) {
    if (isDrawComplete(d)) return { ...prev, lastKey: null, flow: { ...prev.flow, phase: "completed" } };
    if (prev.flow.phase === "spinning" || prev.flow.phase === "revealing" || prev.flow.phase === "assigned" || prev.flow.phase === "completed") {
      return { ...prev, lastKey: null, flow: { ...prev.flow, phase: "ready" } };
    }
    return { ...prev, lastKey: null };
  }
  return prev;
}

export function spectatorEvent(prev: SpectatorState, e: FlowEvent): SpectatorState {
  const flow = flowReducer(prev.flow, e);
  return flow === prev.flow ? prev : { ...prev, flow };
}
