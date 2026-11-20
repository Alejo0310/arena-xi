import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import type { Tournament } from "./types";

/*
 * Compartir sin servidor: el torneo se comprime dentro del propio enlace
 * (fragmento #, que nunca se envía al servidor). Es una instantánea de solo lectura.
 */

export function encodeTournament(t: Tournament): string {
  const snapshot: Tournament = { ...t, draw: null };
  return compressToEncodedURIComponent(JSON.stringify(snapshot));
}

export function decodeTournament(data: string): Tournament | null {
  try {
    const json = decompressFromEncodedURIComponent(data);
    if (!json) return null;
    const t = JSON.parse(json) as Tournament;
    return isTournament(t) ? t : null;
  } catch {
    return null;
  }
}

export function isTournament(x: unknown): x is Tournament {
  const t = x as Tournament;
  return !!t && typeof t.id === "string" && typeof t.name === "string" && Array.isArray(t.participants) && Array.isArray(t.matches) && !!t.settings;
}

export function shareUrl(t: Tournament): string {
  return `${window.location.origin}/compartir#${encodeTournament(t)}`;
}

export function downloadJson(t: Tournament) {
  const blob = new Blob([JSON.stringify(t, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${slug(t.name)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function slug(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "torneo";
}
