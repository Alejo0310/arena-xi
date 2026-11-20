"use client";

import { useEffect, useRef } from "react";
import type { PendingPick } from "@/lib/types";
import type { FlowPhase } from "@/lib/drawFlow";
import type { Choice } from "@/lib/draw";

/**
 * Contrato común de las mecánicas de sorteo. Los componentes visuales NO deciden
 * ni avanzan nada: piden iniciar (`onStart`), reciben el resultado ya decidido
 * (`pick`) y avisan cuando su animación termina de verdad (`onAnimationDone`).
 */
export interface StageProps {
  pool: string[];
  phase: FlowPhase;
  runId: number;
  pick: PendingPick | null;
  /** true cuando el controlador no admite iniciar un sorteo. */
  locked: boolean;
  actionLabel: string;
  onStart: (choice?: Choice) => void;
  onAnimationDone: (runId: number) => void;
}

/**
 * Ejecuta la animación de un giro y notifica su final una sola vez.
 * - Se dispara solo en SPINNING y una vez por `runId`.
 * - Si el componente se desmonta o el efecto se repite (StrictMode), la ejecución
 *   anterior queda cancelada y su promesa ya no puede emitir el evento.
 */
export function useSpinAnimation(props: Pick<StageProps, "phase" | "runId" | "pick" | "onAnimationDone">, run: (pick: PendingPick) => PromiseLike<unknown>) {
  const { phase, runId, pick, onAnimationDone } = props;
  const runRef = useRef(run);
  runRef.current = run;
  const doneRef = useRef(onAnimationDone);
  doneRef.current = onAnimationDone;
  const active = phase === "spinning" && !!pick;

  useEffect(() => {
    if (!active || !pick) return;
    let cancelled = false;
    Promise.resolve(runRef.current(pick)).then(
      () => !cancelled && doneRef.current(runId),
      () => !cancelled && doneRef.current(runId),
    );
    return () => {
      cancelled = true;
    };
    // pick cambia de identidad con cada render del store; el giro se identifica por runId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, runId]);
}
