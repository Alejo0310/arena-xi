import { NextResponse } from "next/server";
import { roomStore, type Store } from "./store";
import { RoomError } from "./rooms";

/** Envoltorio común de las rutas de salas: almacenamiento, límites por IP y traducción de errores. */
const hits = new Map<string, { n: number; reset: number }>();
/** Límite por IP en memoria (sin gastar comandos de Redis): para lecturas, que se repiten con el sondeo. */
function memoryHit(key: string, limit: number): boolean {
  const now = Date.now();
  const cur = hits.get(key);
  if (!cur || cur.reset <= now) {
    if (hits.size > 5000) hits.clear();
    hits.set(key, { n: 1, reset: now + 3_600_000 });
    return true;
  }
  cur.n += 1;
  return cur.n <= limit;
}

export async function handle(
  req: Request,
  bucket: string,
  perHour: number,
  fn: (s: Store, ctx: { token: string | undefined; ip: string }) => Promise<unknown>,
  opts: { memory?: boolean } = {},
) {
  const s = roomStore();
  if (!s) return NextResponse.json({ error: "no-storage" }, { status: 501 });
  const ip = (req.headers.get("x-forwarded-for") ?? "anon").split(",")[0].trim();
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : undefined;
  try {
    if (perHour > 0 && opts.memory) {
      if (!memoryHit(`${bucket}:${ip}`, perHour)) return NextResponse.json({ error: "rate-limited" }, { status: 429 });
    } else if (perHour > 0) {
      const k = `rl:sala:${bucket}:${ip}:${Math.floor(Date.now() / 3_600_000)}`;
      const n = await s.incr(k);
      if (n === 1) await s.expire(k, 3700);
      if (n > perHour) return NextResponse.json({ error: "rate-limited" }, { status: 429 });
    }
    return NextResponse.json(await fn(s, { token, ip }), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof RoomError) return NextResponse.json({ error: e.code, ...(e.detail ? { detail: e.detail } : {}) }, { status: e.status });
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    throw new RoomError("bad-request", 400);
  }
}
