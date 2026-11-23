import { handle, readJson } from "@/lib/server/http";
import { RoomError, clearResult, join, remove, setDraw, setOpen, start, submitResult, syncHost } from "@/lib/server/rooms";

export const dynamic = "force-dynamic";

/**
 * Acciones sobre una sala:
 *   join   (público)        inscribirse con un nombre
 *   result (host/inscrito)  registrar o actualizar un resultado
 *   close, sync, remove, start, clear, draw  (solo host, con su token)
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await ctx.params;
  const limits: Record<string, number> = { join: 150, result: 600, close: 200, sync: 800, remove: 200, start: 60, clear: 200, draw: 3000 };
  if (!(action in limits)) return handle(req, "otra", 10, async () => { throw new RoomError("not-found", 404); });
  return handle(req, action, limits[action], async (s, { token }) => {
    const body = await readJson(req);
    switch (action) {
      case "join":
        return join(s, id, body.name);
      case "result": {
        const r = await submitResult(s, id, token, body.matchId, body.result);
        return { version: r.version, tournament: r.tournament };
      }
      case "close":
        return { version: await setOpen(s, id, token, body.open) };
      case "sync":
        return syncHost(s, id, token, body.names, body.max);
      case "remove":
        return { version: await remove(s, id, token, body.name) };
      case "draw":
        return { version: await setDraw(s, id, token, body.draw ?? null) };
      case "start":
        return { version: await start(s, id, token, body.tournament) };
      case "clear": {
        const r = await clearResult(s, id, token, body.matchId);
        return { version: r.version, tournament: r.tournament };
      }
    }
  });
}
