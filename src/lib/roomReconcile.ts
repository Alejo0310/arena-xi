/*
 * Reconciliación entre la lista de participantes del host (local) y la de la sala (servidor).
 *   · Invitados nuevos en el servidor → se añaden a la lista local y se recuerdan como "invitados".
 *   · Invitados que el host quitó de su lista → se expulsan de la sala (si no, volverían a aparecer).
 *   · Resto de participantes locales (registro manual) → se reservan en la sala para que nadie use su nombre.
 * Es pura (sin red ni estado) para poder probarla.
 */

const key = (n: string) => n.trim().replace(/\s+/g, " ").toLowerCase();

export interface ReconcilePlan {
  /** Nombres de la sala que aún no están en la lista local. */
  add: string[];
  /** Invitados conocidos que ya no están en la lista local: hay que expulsarlos de la sala. */
  kick: string[];
  /** Participantes locales que no son invitados (registro manual). */
  manual: string[];
  /** Invitados que se mantienen (para guardar en el torneo). */
  guests: string[];
}

export function reconcile(local: string[], server: string[], knownGuests: string[]): ReconcilePlan {
  const localKeys = new Set(local.map(key));
  const serverKeys = new Set(server.map(key));
  const guestKeys = new Set(knownGuests.map(key));

  // Un invitado conocido que falta en la lista local no es "nuevo": lo quitó el host, así que se expulsa (ver kick).
  const add = server.filter((n) => !localKeys.has(key(n)) && !guestKeys.has(key(n)));
  const kick = knownGuests.filter((n) => serverKeys.has(key(n)) && !localKeys.has(key(n)));
  const kickKeys = new Set(kick.map(key));
  // Un invitado conocido que ya no está en el servidor (expulsado antes) deja de contar como invitado.
  const guests = [...knownGuests.filter((n) => serverKeys.has(key(n)) && !kickKeys.has(key(n))), ...add];
  const guestSet = new Set(guests.map(key));
  const manual = local.filter((n) => !guestSet.has(key(n)) && !guestKeys.has(key(n)));
  return { add, kick, manual, guests };
}
