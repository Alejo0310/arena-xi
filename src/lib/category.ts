import type { GameEdition, Gender, TeamKind, Tournament, TournamentSettings } from "./types";
import { getTeam } from "./teams";
import { editionOfTeam, genderOfTeam } from "./editions";

/*
 * Regla de negocio central: un torneo es de CLUBES o de SELECCIONES, nunca mixto.
 * Todas las capas (store, sorteo, motor del torneo, importación y rehidratación)
 * validan con estas funciones, así que manipular el estado a mano no sirve para mezclar.
 */

export const CATEGORY_LABEL: Record<TeamKind, string> = { club: "Clubes", national: "Selecciones" };

/** Ámbito de un torneo: categoría, edición y género. Si faltan edición/género no se comprueban. */
export interface Scope {
  kind: TeamKind;
  edition?: GameEdition;
  gender?: Gender;
}
export type ScopeLike = TeamKind | Scope;
const toScope = (s: ScopeLike): Scope => (typeof s === "string" ? { kind: s } : s);

/** Ámbito efectivo de la configuración de un torneo (los torneos antiguos son de FC 25 masculino). */
export function scopeOf(settings: Pick<TournamentSettings, "category" | "edition" | "gender">): Scope {
  return { kind: settings.category, edition: settings.edition ?? "FC25", gender: settings.gender ?? "men" };
}

export function isKind(x: unknown): x is TeamKind {
  return x === "club" || x === "national";
}

const GENDER_ES: Record<Gender, string> = { men: "masculino", women: "femenino" };
const edLabel = (e: GameEdition) => e.replace("FC", "FC ");

/** Error si algún id no existe o no pertenece a la categoría, edición y género del torneo. */
export function categoryError(teamIds: readonly (string | null | undefined)[], scopeLike: ScopeLike): string | null {
  const scope = toScope(scopeLike);
  for (const id of teamIds) {
    if (!id) continue;
    const team = getTeam(id);
    if (!team) return `Equipo desconocido: ${id}.`;
    if (team.kind !== scope.kind) {
      return scope.kind === "club"
        ? `${team.name} es una selección y este torneo es de clubes. No se pueden mezclar categorías.`
        : `${team.name} es un club y este torneo es de selecciones. No se pueden mezclar categorías.`;
    }
    if (scope.edition && editionOfTeam(team) !== scope.edition) {
      return `${team.name} pertenece a ${edLabel(editionOfTeam(team))} y este torneo es de ${edLabel(scope.edition)}. No se pueden mezclar ediciones.`;
    }
    if (scope.gender && genderOfTeam(team) !== scope.gender) {
      return `${team.name} es un equipo ${GENDER_ES[genderOfTeam(team)]} y este torneo es ${GENDER_ES[scope.gender]}. No se pueden mezclar masculinos y femeninos.`;
    }
  }
  return null;
}

export function belongsTo(teamId: string, scopeLike: ScopeLike): boolean {
  return !categoryError([teamId], scopeLike);
}

/** Elimina ids desconocidos, de otra categoría/edición/género o duplicados. */
export function sanitizePool(ids: readonly string[], scope: ScopeLike): string[] {
  return [...new Set(ids)].filter((id) => belongsTo(id, scope));
}

/** Comprueba la coherencia de categoría de todo el torneo (pool, sorteo y asignaciones). */
export function tournamentCategoryError(t: Tournament): string | null {
  const kind = t.settings?.category;
  if (!isKind(kind)) return "El torneo no tiene una categoría válida.";
  const scope = scopeOf(t.settings);
  const d = t.draw;
  return (
    categoryError(t.teamPool, scope) ??
    categoryError(Object.values(t.assignments ?? {}), scope) ??
    categoryError((t.drawHistory ?? []).map((h) => h.teamId), scope) ??
    (d
      ? categoryError(d.pool, scope) ??
        categoryError(d.envelopes ?? [], scope) ??
        categoryError(d.draftOptions ?? [], scope) ??
        categoryError((d.pots ?? []).flat(), scope) ??
        categoryError([d.pending?.teamId], scope)
      : null)
  );
}
