import { NextResponse } from "next/server";
import { kvConfigured, kvGet } from "@/lib/server/kv";
import { ID_RE } from "@/lib/shortLink";

export const dynamic = "force-dynamic";

/** Devuelve los datos guardados de un enlace corto. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!ID_RE.test(id)) return NextResponse.json({ error: "invalid-id" }, { status: 400 });
  if (!kvConfigured()) return NextResponse.json({ error: "no-storage" }, { status: 501 });
  try {
    const data = await kvGet(`c:${id}`);
    if (!data) return NextResponse.json({ error: "not-found" }, { status: 404 });
    return NextResponse.json({ data }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } });
  } catch {
    return NextResponse.json({ error: "storage-error" }, { status: 502 });
  }
}
