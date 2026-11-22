/*
 * Almacenamiento mínimo para los enlaces cortos: API REST de Upstash Redis (la que inyecta la integración de
 * Upstash/Vercel KV en el proyecto). Sin dependencias. Si no hay variables de entorno, `kvConfigured()` es false
 * y la aplicación sigue usando el enlace largo.
 */

const URL_ENV = () => process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const TOKEN_ENV = () => process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

export const kvConfigured = () => !!URL_ENV() && !!TOKEN_ENV();

async function cmd<T = unknown>(args: (string | number)[]): Promise<T | null> {
  const res = await fetch(URL_ENV()!, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN_ENV()}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`KV ${res.status}`);
  const json = (await res.json()) as { result?: T; error?: string };
  if (json.error) throw new Error(json.error);
  return json.result ?? null;
}

/** Guarda solo si la clave no existe. Devuelve true si se guardó. */
export async function kvSetNX(key: string, value: string, ttlSeconds: number): Promise<boolean> {
  return (await cmd<string>(["SET", key, value, "NX", "EX", ttlSeconds])) === "OK";
}

export async function kvGet(key: string): Promise<string | null> {
  return cmd<string>(["GET", key]);
}

/** Contador con caducidad (para limitar peticiones). Devuelve el valor tras incrementar. */
export async function kvIncr(key: string, ttlSeconds: number): Promise<number> {
  const n = Number(await cmd<number>(["INCR", key]));
  if (n === 1) await cmd(["EXPIRE", key, ttlSeconds]);
  return n;
}
