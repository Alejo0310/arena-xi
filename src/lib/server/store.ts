/*
 * Almacenamiento de las salas de invitación. Reutiliza la conexión existente de Upstash Redis (REST) y las mismas
 * variables de entorno que los enlaces cortos (KV_REST_API_URL / KV_REST_API_TOKEN, o las UPSTASH_REDIS_REST_*).
 * Solo usa comandos atómicos individuales (sin Lua ni transacciones), de modo que el comportamiento es idéntico en
 * Upstash y en el almacén en memoria que se activa únicamente con ARENA_KV_MEMORY=1 (pruebas y desarrollo local).
 */

export interface SetOpts {
  /** Solo si la clave no existe. */
  nx?: boolean;
  /** Caducidad en segundos. */
  ex?: number;
  /** Caducidad en milisegundos. */
  px?: number;
}

export interface Store {
  get(key: string): Promise<string | null>;
  /** true si se guardó (false si NX y ya existía). */
  set(key: string, value: string, opts?: SetOpts): Promise<boolean>;
  del(...keys: string[]): Promise<number>;
  incr(key: string): Promise<number>;
  decr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
  /** 1 si se creó el campo, 0 si ya existía. */
  hsetnx(key: string, field: string, value: string): Promise<number>;
  hset(key: string, field: string, value: string): Promise<void>;
  hget(key: string, field: string): Promise<string | null>;
  hdel(key: string, field: string): Promise<number>;
  hlen(key: string): Promise<number>;
  hgetall(key: string): Promise<Record<string, string>>;
}

const URL_ENV = () => process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const TOKEN_ENV = () => process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

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

const upstash: Store = {
  get: (k) => cmd<string>(["GET", k]),
  async set(k, v, o = {}) {
    const args: (string | number)[] = ["SET", k, v];
    if (o.nx) args.push("NX");
    if (o.ex) args.push("EX", o.ex);
    if (o.px) args.push("PX", o.px);
    return (await cmd<string>(args)) === "OK";
  },
  async del(...keys) {
    return Number((await cmd<number>(["DEL", ...keys])) ?? 0);
  },
  async incr(k) {
    return Number(await cmd<number>(["INCR", k]));
  },
  async decr(k) {
    return Number(await cmd<number>(["DECR", k]));
  },
  async expire(k, s) {
    await cmd(["EXPIRE", k, s]);
  },
  async hsetnx(k, f, v) {
    return Number(await cmd<number>(["HSETNX", k, f, v]));
  },
  async hset(k, f, v) {
    await cmd(["HSET", k, f, v]);
  },
  hget: (k, f) => cmd<string>(["HGET", k, f]),
  async hdel(k, f) {
    return Number((await cmd<number>(["HDEL", k, f])) ?? 0);
  },
  async hlen(k) {
    return Number((await cmd<number>(["HLEN", k])) ?? 0);
  },
  async hgetall(k) {
    const r = await cmd<string[] | Record<string, string>>(["HGETALL", k]);
    if (!r) return {};
    if (Array.isArray(r)) {
      const out: Record<string, string> = {};
      for (let i = 0; i + 1 < r.length; i += 2) out[r[i]] = r[i + 1];
      return out;
    }
    return r;
  },
};

/** Almacén en memoria (un solo proceso). Solo para pruebas y desarrollo: no es persistente. */
function memoryStore(): Store {
  const g = globalThis as unknown as { __arenaMem?: { kv: Map<string, string>; h: Map<string, Map<string, string>>; exp: Map<string, number> } };
  const m = (g.__arenaMem ??= { kv: new Map(), h: new Map(), exp: new Map() });
  const alive = (k: string) => {
    const e = m.exp.get(k);
    if (e !== undefined && e <= Date.now()) {
      m.kv.delete(k);
      m.h.delete(k);
      m.exp.delete(k);
    }
  };
  return {
    async get(k) { alive(k); return m.kv.get(k) ?? null; },
    async set(k, v, o = {}) {
      alive(k);
      if (o.nx && (m.kv.has(k) || m.h.has(k))) return false;
      m.kv.set(k, v);
      if (o.ex) m.exp.set(k, Date.now() + o.ex * 1000);
      else if (o.px) m.exp.set(k, Date.now() + o.px);
      else m.exp.delete(k);
      return true;
    },
    async del(...keys) { let n = 0; for (const k of keys) { if (m.kv.delete(k) || m.h.delete(k)) n++; m.exp.delete(k); } return n; },
    async incr(k) { alive(k); const n = Number(m.kv.get(k) ?? 0) + 1; m.kv.set(k, String(n)); return n; },
    async decr(k) { alive(k); const n = Number(m.kv.get(k) ?? 0) - 1; m.kv.set(k, String(n)); return n; },
    async expire(k, s) { m.exp.set(k, Date.now() + s * 1000); },
    async hsetnx(k, f, v) { alive(k); const h = m.h.get(k) ?? new Map(); m.h.set(k, h); if (h.has(f)) return 0; h.set(f, v); return 1; },
    async hset(k, f, v) { alive(k); const h = m.h.get(k) ?? new Map(); m.h.set(k, h); h.set(f, v); },
    async hget(k, f) { alive(k); return m.h.get(k)?.get(f) ?? null; },
    async hdel(k, f) { alive(k); return m.h.get(k)?.delete(f) ? 1 : 0; },
    async hlen(k) { alive(k); return m.h.get(k)?.size ?? 0; },
    async hgetall(k) { alive(k); return Object.fromEntries(m.h.get(k) ?? []); },
  };
}

/** Almacén de salas, o null si el servidor no tiene Redis configurado. */
export function roomStore(): Store | null {
  if (process.env.ARENA_KV_MEMORY === "1") return memoryStore();
  return URL_ENV() && TOKEN_ENV() ? upstash : null;
}
