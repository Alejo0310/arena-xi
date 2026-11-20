import type { Tournament } from "./types";

/*
 * Compartir sin servidor: el torneo se comprime dentro del propio enlace
 * (fragmento #, que nunca se envía al servidor). Es una instantánea de solo lectura.
 */

// lz-string se carga solo al compartir o abrir un enlace compartido.
const lz = () => import("lz-string");

export async function encodeTournament(t: Tournament): Promise<string> {
  // Solo viajan los equipos realmente asignados: mantiene el enlace corto y conserva sus valoraciones.
  const used = new Set(Object.values(t.assignments));
  const snap = t.snapshot ? Object.fromEntries(Object.entries(t.snapshot).filter(([id]) => used.has(id))) : undefined;
  const snapshot: Tournament = { ...t, draw: null, snapshot: snap };
  return (await lz()).compressToEncodedURIComponent(JSON.stringify(snapshot));
}

export async function decodeTournament(data: string): Promise<Tournament | null> {
  try {
    const json = (await lz()).decompressFromEncodedURIComponent(data);
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

export async function shareUrl(t: Tournament): Promise<string> {
  return `${window.location.origin}/compartir#${await encodeTournament(t)}`;
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
