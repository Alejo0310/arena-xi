import { NextResponse } from "next/server";
import { kvConfigured, kvIncr, kvSetNX } from "@/lib/server/kv";
import { BASE_RE, DATA_RE, MAX_DATA, randomSuffix } from "@/lib/shortLink";

export const dynamic = "force-dynamic";

const TTL = 60 * 60 * 24 * 365; // los enlaces duran un año
const HOURLY_LIMIT = 20; // enlaces nuevos por IP y hora

/** Crea un enlace corto: guarda el torneo (formato compacto) y devuelve su identificador. */
export async function POST(req: Request) {
  if (!kvConfigured()) return NextResponse.json({ error: "no-storage" }, { status: 501 });

  let body: { data?: unknown; base?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }
  const { data, base } = body;
  if (typeof data !== "string" || data.length > MAX_DATA || !DATA_RE.test(data)) return NextResponse.json({ error: "invalid-data" }, { status: 400 });
  if (typeof base !== "string" || !BASE_RE.test(base)) return NextResponse.json({ error: "invalid-name" }, { status: 400 });

  try {
    const ip = (req.headers.get("x-forwarded-for") ?? "anon").split(",")[0].trim();
    const hour = Math.floor(Date.now() / 3_600_000);
    if ((await kvIncr(`rl:${ip}:${hour}`, 3700)) > HOURLY_LIMIT) return NextResponse.json({ error: "rate-limited" }, { status: 429 });

    // El sufijo aleatorio evita colisiones entre torneos con el mismo nombre; SET NX lo garantiza.
    for (let i = 0; i < 6; i++) {
      const id = `${base}-${randomSuffix()}`;
      if (await kvSetNX(`c:${id}`, data, TTL)) return NextResponse.json({ id });
    }
    return NextResponse.json({ error: "busy" }, { status: 503 });
  } catch {
    return NextResponse.json({ error: "storage-error" }, { status: 502 });
  }
}
