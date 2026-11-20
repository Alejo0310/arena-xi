"use client";

import { useCallback, useReducer, useRef } from "react";
import { useTournament } from "@/store/tournament";
import { canStart, flowReducer, initialFlow } from "@/lib/drawFlow";
import { currentParticipant, isLastTurn, type Choice } from "@/lib/draw";
import type { DrawState } from "@/lib/types";
import { toast } from "@/components/ui/feedback";

/**
 * Controlador único del flujo de sorteo, compartido por las cinco mecánicas.
 * Une el store (qué equipo toca y cuándo se consolida) con la máquina de estados
 * visual (qué se muestra). Las mecánicas solo aportan su animación.
 */
export function useDrawController(draw: DrawState) {
  const [flow, dispatch] = useReducer(flowReducer, draw, initialFlow);
  const drawDecide = useTournament((s) => s.drawDecide);
  const drawConfirm = useTournament((s) => s.drawConfirm);
  const drawRemaining = useTournament((s) => s.drawRemaining);
  // Bloqueo síncrono: dos clics en el mismo frame no pueden iniciar dos sorteos.
  const busy = useRef(false);

  const pick = draw.pending ?? null;
  const turnId = pick?.participantId ?? currentParticipant(draw);

  const start = useCallback(
    (choice?: Choice) => {
      if (!canStart(flow) || busy.current) return;
      busy.current = true;
      const res = drawDecide(choice);
      if (res.error || !res.pending) {
        busy.current = false;
        if (res.error) toast.error(res.error);
        return;
      }
      dispatch({ type: "START" });
    },
    [flow, drawDecide],
  );

  const animationDone = useCallback((runId: number) => dispatch({ type: "ANIMATION_DONE", runId }), []);
  const revealed = useCallback((runId: number) => dispatch({ type: "REVEAL_DONE", runId }), []);

  const confirm = useCallback(() => {
    if (flow.phase !== "assigned") return;
    const last = isLastTurn(draw);
    const err = drawConfirm();
    if (err) {
      toast.error(err);
      return;
    }
    busy.current = false;
    dispatch({ type: "CONTINUE", isLast: last });
  }, [flow.phase, draw, drawConfirm]);

  const nextReady = useCallback(() => dispatch({ type: "NEXT_READY" }), []);

  /** Sorteo completo: asigna a todos los restantes y abre la presentación. */
  const drawAllRemaining = useCallback(() => {
    if (!canStart(flow) || busy.current || draw.pending) return [];
    const results = drawRemaining();
    if (results.length) dispatch({ type: "PRESENT" });
    return results;
  }, [flow, draw.pending, drawRemaining]);

  const present = useCallback(() => dispatch({ type: "PRESENT" }), []);
  const presentationDone = useCallback((complete: boolean) => dispatch({ type: "PRESENTATION_DONE", complete }), []);

  return { flow, pick, turnId, start, animationDone, revealed, confirm, nextReady, drawAllRemaining, present, presentationDone, locked: !canStart(flow) };
}
