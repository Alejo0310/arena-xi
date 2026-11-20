"use client";

import { useTournament } from "@/store/tournament";
import { CATEGORY_LABEL } from "@/lib/category";
import { confirmDialog, toast } from "@/components/ui/feedback";
import type { TeamKind } from "@/lib/types";

/** Cambia la categoría del torneo pidiendo confirmación si hay un sorteo que se perdería. */
export function useCategoryChange() {
  const setCategory = useTournament((s) => s.setCategory);
  return async (kind: TeamKind) => {
    const t = useTournament.getState().current;
    if (!t || t.settings.category === kind) return;
    const drawStarted = t.phase === "draw" || Object.keys(t.assignments).length > 0;
    if (drawStarted) {
      const ok = await confirmDialog({
        title: `¿Cambiar a ${CATEGORY_LABEL[kind].toLowerCase()}?`,
        body: "Ya hay un sorteo en curso. Clubes y selecciones no se pueden mezclar, así que se borrarán las asignaciones y habrá que volver a sortear los equipos.",
        confirmLabel: "Cambiar y reiniciar sorteo",
        danger: true,
      });
      if (!ok) return;
    }
    const err = setCategory(kind);
    if (err) toast.error(err);
    else toast.info(`Torneo de ${CATEGORY_LABEL[kind].toLowerCase()}: se ha cargado la selección de equipos por defecto.`);
  };
}
