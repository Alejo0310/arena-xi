import { handle } from "@/lib/server/http";
import { roomByCode } from "@/lib/server/rooms";

export const dynamic = "force-dynamic";

/** Información pública mínima de la sala asociada a un código (para la página de acceso). */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  return handle(req, "codigo", 3000, (s) => roomByCode(s, code), { memory: true });
}
