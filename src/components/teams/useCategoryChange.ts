"use client";

import { useTournament } from "@/store/tournament";
import { categoryLabel, editionInfo } from "@/lib/editions";
import { confirmDialog, toast } from "@/components/ui/feedback";
import type { GameEdition, Gender, TeamKind } from "@/lib/types";

/** ¿Hay algo (equipos elegidos distintos del inicial, sorteo o asignaciones) que se perdería al cambiar el ámbito? */
function hasProgress(): boolean {
  const t = useTournament.getState().current;
  return !!t && (t.phase === "draw" || Object.keys(t.assignments).length > 0);
}

/** Cambia categoría y género del torneo pidiendo confirmación si hay un sorteo que se perdería. */
export function useCategoryChange() {
  const setCategory = useTournament((s) => s.setCategory);
  return async (kind: TeamKind, gender: Gender) => {
    const t = useTournament.getState().current;
    if (!t || (t.settings.category === kind && (t.settings.gender ?? "men") === gender)) return;
    if (hasProgress()) {
      const ok = await confirmDialog({
        title: `¿Cambiar a ${categoryLabel(kind, gender).toLowerCase()}?`,
        body: "Ya hay un sorteo en curso. Clubes y selecciones (masculinos y femeninos) no se pueden mezclar, así que se borrarán las asignaciones y habrá que volver a sortear los equipos.",
        confirmLabel: "Cambiar y reiniciar sorteo",
        danger: true,
      });
      if (!ok) return;
    }
    const err = setCategory(kind, gender);
    if (err) toast.error(err);
    else toast.info(`${categoryLabel(kind, gender)}: elige los equipos del sorteo.`);
  };
}

/** Cambia la edición del juego avisando de que la selección de equipos y las asignaciones se reinician. */
export function useEditionChange() {
  const setEdition = useTournament((s) => s.setEdition);
  return async (edition: GameEdition) => {
    const t = useTournament.getState().current;
    if (!t || (t.settings.edition ?? "FC25") === edition) return;
    const customised = t.teamPool.length > 0 || hasProgress();
    if (customised) {
      const ok = await confirmDialog({
        title: `¿Cambiar a ${editionInfo(edition).label}?`,
        body: "Cada edición tiene su propio catálogo y sus propias valoraciones. Las selecciones de equipos y las asignaciones del sorteo actual se reiniciarán; los participantes se conservan.",
        confirmLabel: `Cambiar a ${editionInfo(edition).label}`,
        danger: hasProgress(),
      });
      if (!ok) return;
    }
    const err = setEdition(edition);
    if (err) toast.error(err);
    else toast.info(`Edición ${editionInfo(edition).label}: se ha cargado su catálogo.`);
  };
}
