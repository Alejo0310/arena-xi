import { handle, readJson } from "@/lib/server/http";
import { createRoom } from "@/lib/server/rooms";

export const dynamic = "force-dynamic";

/** Crea la sala de invitaciones de un torneo. Devuelve el token del host (se muestra una sola vez). */
export async function POST(req: Request) {
  return handle(req, "crear", 20, async (s) => createRoom(s, await readJson(req)));
}
