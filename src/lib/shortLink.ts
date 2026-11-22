/*
 * Enlaces cortos: https://…/compartir#GranPremioGalacticaSeason1-k7x9q2
 *   · la parte legible sale del nombre del torneo (sugerido) o del que elija el usuario;
 *   · el sufijo aleatorio de 6 caracteres lo pone el servidor y garantiza que dos torneos con el mismo nombre
 *     nunca compartan enlace.
 * Este módulo es puro (sin red) y lo usan el cliente y las rutas de la API.
 */

export const ID_RE = /^[A-Za-z0-9]{1,32}-[a-z0-9]{6}$/;
export const BASE_RE = /^[A-Za-z0-9]{1,32}$/;
export const MAX_BASE = 32;
/** Los datos que se guardan son siempre el formato compacto del torneo (v2/v3), nunca JSON arbitrario. */
export const DATA_RE = /^v[23]\.[A-Za-z0-9+\-_.$]+$/;
export const MAX_DATA = 12_000;

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** "Gran Premio Galáctica Season 1" → "GranPremioGalacticaSeason1" (sin acentos ni símbolos, máx. 32). */
export function suggestSlug(name: string): string {
  const words = strip(name).split(/[^A-Za-z0-9]+/).filter(Boolean);
  // Una palabra escrita toda en mayúsculas ("TORNEO") se pasa a "Torneo" para que el enlace sea legible.
  const joined = words.map((w) => w[0].toUpperCase() + (w.length > 1 && w === w.toUpperCase() && /[A-Z]/.test(w) ? w.slice(1).toLowerCase() : w.slice(1))).join("");
  return (joined || "Torneo").slice(0, MAX_BASE);
}

/** Limpia lo que escriba el usuario: mismas reglas que la sugerencia, pero respetando su mayúsculas si no usa espacios. */
export function sanitizeSlug(input: string): string {
  const cleaned = strip(input).trim();
  if (/\s/.test(cleaned)) return suggestSlug(cleaned);
  return (cleaned.replace(/[^A-Za-z0-9]/g, "").slice(0, MAX_BASE)) || "Torneo";
}

export const isShortId = (s: string) => ID_RE.test(s);

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
/** Sufijo diferenciador criptográficamente aleatorio. */
export function randomSuffix(len = 6, rnd: (n: number) => number = defaultRandom): string {
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[rnd(ALPHABET.length)];
  return out;
}
function defaultRandom(n: number): number {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / n) * n;
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return buf[0] % n;
}
