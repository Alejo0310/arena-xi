import { describe, expect, it } from "vitest";
import { initialSpectator, isDrawComplete, spectatorEvent, spectatorSnapshot } from "../spectatorFlow";
import type { DrawBroadcast } from "../roomTypes";

const base: DrawBroadcast = {
  id: "d1", mode: "roulette", order: ["p1", "p2", "p3"], cursor: 0, pool: ["a", "b", "c", "d"], pending: null,
  assignments: {}, owners: {}, participants: [{ id: "p1", name: "Ana", color: "#fff" }, { id: "p2", name: "Beto", color: "#fff" }, { id: "p3", name: "Caro", color: "#fff" }],
  edition: "FC25", category: "club", gender: "men",
};
const pend = (d: DrawBroadcast, at: number, teamId = "a"): DrawBroadcast => ({ ...d, pending: { participantId: d.order[d.cursor], teamId, at } });

describe("flujo del sorteo para invitados", () => {
  it("empieza en READY y reproduce cada resultado pendiente una sola vez", () => {
    let s = spectatorSnapshot(initialSpectator, base);
    expect(s.flow.phase).toBe("ready");
    const spinning = pend(base, 100);
    s = spectatorSnapshot(s, spinning);
    expect(s.flow.phase).toBe("spinning");
    const run = s.flow.runId;
    // El mismo pendiente en sondeos siguientes no reinicia el giro.
    expect(spectatorSnapshot(s, spinning)).toBe(s);
    // La animación termina → revelación → asignado.
    s = spectatorEvent(s, { type: "ANIMATION_DONE", runId: run });
    expect(s.flow.phase).toBe("revealing");
    s = spectatorEvent(s, { type: "REVEAL_DONE", runId: run });
    expect(s.flow.phase).toBe("assigned");
    // Eventos de una animación antigua se ignoran.
    expect(spectatorEvent(s, { type: "ANIMATION_DONE", runId: run - 1 })).toBe(s);
  });

  it("cuando el host confirma (sin pendiente y avanza el turno) vuelve a READY y el siguiente turno gira de nuevo", () => {
    let s = spectatorSnapshot(initialSpectator, base);
    s = spectatorSnapshot(s, pend(base, 100));
    const confirmed: DrawBroadcast = { ...base, cursor: 1, assignments: { p1: "a" } };
    s = spectatorSnapshot(s, confirmed);
    expect(s.flow.phase).toBe("ready");
    s = spectatorSnapshot(s, pend(confirmed, 200, "b"));
    expect(s.flow.phase).toBe("spinning");
  });

  it("si el host termina antes de que el invitado vea el giro, no se queda atascado", () => {
    let s = spectatorSnapshot(initialSpectator, base);
    s = spectatorSnapshot(s, pend(base, 100));
    s = spectatorSnapshot(s, { ...base, cursor: 1, assignments: { p1: "a" } });
    expect(s.flow.phase).toBe("ready");
  });

  it("al terminar de asignar a todos pasa a COMPLETED (esperando al host)", () => {
    const done: DrawBroadcast = { ...base, cursor: 3, assignments: { p1: "a", p2: "b", p3: "c" } };
    expect(isDrawComplete(done)).toBe(true);
    let s = spectatorSnapshot(initialSpectator, base);
    s = spectatorSnapshot(s, done);
    expect(s.flow.phase).toBe("completed");
    // "Sorteo completo": salta directamente de READY a COMPLETED sin pendientes.
    expect(spectatorSnapshot(spectatorSnapshot(initialSpectator, base), done).flow.phase).toBe("completed");
    // Sigue completado en sondeos posteriores.
    expect(spectatorSnapshot(s, done).flow.phase).toBe("completed");
  });

  it("un invitado que llega a mitad de una revelación ve el resultado sin repetir el giro", () => {
    const s = spectatorSnapshot(initialSpectator, pend(base, 100));
    expect(s.flow.phase).toBe("assigned");
    // Y ese mismo pendiente no vuelve a girar.
    expect(spectatorSnapshot(s, pend(base, 100)).flow.phase).toBe("assigned");
  });

  it("si el host reinicia el sorteo (otro id) el invitado vuelve al principio", () => {
    let s = spectatorSnapshot(initialSpectator, { ...base, cursor: 2 });
    s = spectatorSnapshot(s, { ...base, id: "d2" });
    expect(s.flow.phase).toBe("ready");
    expect(s.drawId).toBe("d2");
  });
});
