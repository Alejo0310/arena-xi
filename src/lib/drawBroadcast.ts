import type { DrawBroadcast } from "./roomTypes";
import type { Tournament } from "./types";

/** Estado del sorteo en curso del host, listo para publicarlo en la sala (null si no hay sorteo en curso). */
export function buildDrawBroadcast(t: Tournament): DrawBroadcast | null {
  const d = t.draw;
  if (t.phase !== "draw" || !d) return null;
  const owners: Record<number, string> = {};
  for (const h of t.drawHistory) if (h.envelopeIndex !== undefined) owners[h.envelopeIndex] = h.participantId;
  return {
    id: d.id,
    mode: d.mode,
    order: d.order,
    cursor: d.cursor,
    pool: d.pool,
    pending: d.pending ?? null,
    ...(d.envelopes ? { envelopes: d.envelopes } : {}),
    ...(d.draftOptions ? { draftOptions: d.draftOptions } : {}),
    ...(d.pots ? { pots: d.pots } : {}),
    ...(d.potIndex !== undefined ? { potIndex: d.potIndex } : {}),
    ...(d.potsMethod ? { potsMethod: d.potsMethod } : {}),
    assignments: t.assignments,
    owners,
    participants: t.participants.map((p) => ({ id: p.id, name: p.name, color: p.color })),
    edition: t.settings.edition ?? "FC25",
    category: t.settings.category,
    gender: t.settings.gender ?? "men",
  };
}
