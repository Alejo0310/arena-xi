import type { TeamKind, Tournament } from "./types";
import { getTeam } from "./teams";

/*
 * Regla de negocio central: un torneo es de CLUBES o de SELECCIONES, nunca mixto.
 * Todas las capas (store, sorteo, motor del torneo, importación y rehidratación)
 * validan con estas funciones, así que manipular el estado a mano no sirve para mezclar.
 */

export const CATEGORY_LABEL: Record<TeamKind, string> = { club: "Clubes", national: "Selecciones" };

export function isKind(x: unknown): x is TeamKind {
  return x === "club" || x === "national";
}

/** Error si algún id no existe o no pertenece a la categoría. */
export function categoryError(teamIds: readonly (string | null | undefined)[], kind: TeamKind): string | null {
  for (const id of teamIds) {
    if (!id) continue;
    const team = getTeam(id);
    if (!team) return `Equipo desconocido: ${id}.`;
    if (team.kind !== kind) {
      return kind === "club"
        ? `${team.name} es una selección y este torneo es de clubes. No se pueden mezclar categorías.`
        : `${team.name} es un club y este torneo es de selecciones. No se pueden mezclar categorías.`;
    }
  }
  return null;
}

export function belongsTo(teamId: string, kind: TeamKind): boolean {
  return getTeam(teamId)?.kind === kind;
}

/** Elimina ids desconocidos, de otra categoría o duplicados. */
export function sanitizePool(ids: readonly string[], kind: TeamKind): string[] {
  return [...new Set(ids)].filter((id) => belongsTo(id, kind));
}

/** Comprueba la coherencia de categoría de todo el torneo (pool, sorteo y asignaciones). */
export function tournamentCategoryError(t: Tournament): string | null {
  const kind = t.settings?.category;
  if (!isKind(kind)) return "El torneo no tiene una categoría válida.";
  const d = t.draw;
  return (
    categoryError(t.teamPool, kind) ??
    categoryError(Object.values(t.assignments ?? {}), kind) ??
    categoryError((t.drawHistory ?? []).map((h) => h.teamId), kind) ??
    (d
      ? categoryError(d.pool, kind) ??
        categoryError(d.envelopes ?? [], kind) ??
        categoryError(d.draftOptions ?? [], kind) ??
        categoryError((d.pots ?? []).flat(), kind) ??
        categoryError([d.pending?.teamId], kind)
      : null)
  );
}
