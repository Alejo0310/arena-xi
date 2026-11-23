import { useTournament } from "@/store/tournament";
import { fetchRoom, getHostToken, hostRemove, hostSetOpen, hostStart, hostSync } from "./roomClient";
import { reconcile } from "./roomReconcile";
import { ROOM_ERROR_TEXT, type RoomErrorCode } from "./roomTypes";

/** Mensaje legible para un código de error de la API. */
export const roomErrorText = (e: RoomErrorCode | "network") => (e === "network" ? ROOM_ERROR_TEXT.storage : (ROOM_ERROR_TEXT[e] ?? ROOM_ERROR_TEXT.storage));

/**
 * Aplica el plan de reconciliación entre la lista local y la de la sala:
 * añade a los invitados nuevos, expulsa a los que el host quitó y reserva en la sala los nombres del registro manual.
 * Devuelve la firma de lo sincronizado y los nombres en conflicto con invitados.
 */
export async function reconcileNow(serverNames: string[], capacity: number, lastSig: string): Promise<{ sig: string; conflicts: string[]; addErrors: string[] }> {
  const cur = useTournament.getState().current;
  const room = cur?.room;
  if (!cur || !room || !getHostToken(room.id)) return { sig: lastSig, conflicts: [], addErrors: [] };
  const plan = reconcile(cur.participants.map((p) => p.name), serverNames, room.guests ?? []);
  const accepted: string[] = [];
  const addErrors: string[] = [];
  for (const nm of plan.add) {
    const err = useTournament.getState().addParticipant(nm);
    if (!err) accepted.push(nm);
    else if (!/ya está inscrito/.test(err)) addErrors.push(`${nm}: ${err}`);
  }
  for (const nm of plan.kick) await hostRemove(room.id, nm);
  const guests = plan.guests.filter((g) => !plan.add.includes(g) || accepted.includes(g));
  if (JSON.stringify(guests) !== JSON.stringify(room.guests ?? [])) useTournament.getState().patchRoom({ guests });
  const after = useTournament.getState().current!;
  const manual = after.participants.map((p) => p.name).filter((n) => !guests.some((g) => g.toLowerCase() === n.toLowerCase()));
  const sig = JSON.stringify([manual, capacity]);
  let conflicts: string[] = [];
  if (sig !== lastSig) {
    const r = await hostSync(room.id, manual, capacity);
    if (r.ok) conflicts = r.data.conflicts;
  }
  return { sig, conflicts, addErrors };
}

/**
 * Al pasar al sorteo: sincroniza por última vez la lista y cierra las inscripciones (el cierre persiste en el servidor),
 * para que el sorteo se haga con la lista definitiva. Devuelve un mensaje de error o null si todo fue bien.
 */
export async function finalizeInvitations(): Promise<string | null> {
  const cur = useTournament.getState().current;
  const room = cur?.room;
  if (!cur || !room || !getHostToken(room.id)) return null;
  const r = await fetchRoom(room.id);
  if (!r.ok) return roomErrorText(r.error);
  if ("unchanged" in r.data) return null;
  if (r.data.started) return null;
  const capacity = Math.min(32, Math.max(2, r.data.max, cur.participants.length));
  await reconcileNow(r.data.participants, capacity, "");
  const c = await hostSetOpen(room.id, false);
  return c.ok ? null : roomErrorText(c.error);
}

/** El host publica el torneo iniciado: el servidor valida su token, guarda el cuadro y cierra el registro para siempre. */
export async function publishTournament(): Promise<{ ok: true } | { ok: false; message: string; code: RoomErrorCode | "network" }> {
  const cur = useTournament.getState().current;
  const room = cur?.room;
  if (!cur || !room) return { ok: false, message: "Este torneo no tiene sala.", code: "not-found" };
  if (cur.phase !== "playing" && cur.phase !== "finished") return { ok: false, message: "El torneo aún no ha empezado.", code: "conflict" };
  // Antes de publicar: la sala debe contener exactamente a los invitados que siguen en la lista local.
  const state = await fetchRoom(room.id);
  if (state.ok && !("unchanged" in state.data) && !state.data.started) {
    await reconcileNow(state.data.participants, Math.min(32, Math.max(2, state.data.max, cur.participants.length)), "");
  }
  const fresh = useTournament.getState().current!;
  const { room: _drop, ...payload } = fresh;
  void _drop;
  const r = await hostStart(room.id, { ...payload, draw: null } as typeof fresh);
  if (!r.ok) return { ok: false, message: roomErrorText(r.error), code: r.error };
  useTournament.getState().patchRoom({ published: true, version: r.data.version });
  return { ok: true };
}
