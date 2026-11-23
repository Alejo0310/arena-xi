import { handle } from "@/lib/server/http";
import { publicState } from "@/lib/server/rooms";

export const dynamic = "force-dynamic";

/** Estado público de la sala (participantes y, si ya empezó, el torneo). Con ?since=<versión> responde "sin cambios". */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const since = new URL(req.url).searchParams.get("since");
  return handle(req, "estado", 20000, (s) => publicState(s, id, since !== null && /^\d+$/.test(since) ? Number(since) : undefined), { memory: true });
}
