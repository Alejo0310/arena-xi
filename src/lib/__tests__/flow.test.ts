import { describe, expect, it } from "vitest";
import { flowReducer, initialFlow, type FlowState } from "../drawFlow";
import { confirmPick, decidePick, initDraw, isDrawComplete, isLastTurn } from "../draw";
import { categoryError, tournamentCategoryError } from "../category";
import { recordResult, buildMatches } from "../tournament/engine";
import { DEFAULT_CLUB_POOL, DEFAULT_NATIONAL_POOL, NATIONALS, CLUBS } from "../teams";
import type { DrawMode, Tournament, TeamKind } from "../types";

function tournament(n: number, kind: TeamKind = "club"): Tournament {
  return {
    id: "t", name: "Test", createdAt: 0, updatedAt: 0, phase: "draw",
    settings: { format: "league", category: kind, legs: 1, thirdPlace: true, tiebreak: "gd", points: { win: 3, draw: 1, loss: 0 }, allowRepeatTeams: false, matchMinutes: 10 },
    participants: Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}`, color: "#fff" })),
    teamPool: kind === "club" ? [...DEFAULT_CLUB_POOL] : [...DEFAULT_NATIONAL_POOL],
    assignments: {}, drawHistory: [], draw: null, matches: [], championId: null,
  };
}

describe("máquina de estados del sorteo", () => {
  it("sigue READY → SPINNING → REVEALING → ASSIGNED → NEXT → READY", () => {
    let s: FlowState = { phase: "ready", runId: 0 };
    s = flowReducer(s, { type: "START" });
    expect(s).toEqual({ phase: "spinning", runId: 1 });
    s = flowReducer(s, { type: "ANIMATION_DONE", runId: 1 });
    expect(s.phase).toBe("revealing");
    s = flowReducer(s, { type: "REVEAL_DONE", runId: 1 });
    expect(s.phase).toBe("assigned");
    s = flowReducer(s, { type: "CONTINUE", isLast: false });
    expect(s.phase).toBe("next");
    s = flowReducer(s, { type: "NEXT_READY" });
    expect(s.phase).toBe("ready");
  });

  it("el último participante termina en COMPLETED tras pasar por todos los estados", () => {
    let s: FlowState = { phase: "ready", runId: 3 };
    const seen = [s.phase];
    for (const e of [{ type: "START" }, { type: "ANIMATION_DONE", runId: 4 }, { type: "REVEAL_DONE", runId: 4 }, { type: "CONTINUE", isLast: true }] as const) {
      s = flowReducer(s, e);
      seen.push(s.phase);
    }
    expect(seen).toEqual(["ready", "spinning", "revealing", "assigned", "completed"]);
  });

  it("ignora eventos fuera de lugar, duplicados o de giros anteriores", () => {
    const spinning: FlowState = { phase: "spinning", runId: 2 };
    expect(flowReducer(spinning, { type: "START" })).toBe(spinning); // doble clic
    expect(flowReducer(spinning, { type: "CONTINUE", isLast: false })).toBe(spinning); // avanzar mientras gira
    expect(flowReducer(spinning, { type: "ANIMATION_DONE", runId: 1 })).toBe(spinning); // animación antigua
    expect(flowReducer(spinning, { type: "REVEAL_DONE", runId: 2 })).toBe(spinning); // saltarse la animación
    const revealing = flowReducer(spinning, { type: "ANIMATION_DONE", runId: 2 });
    expect(flowReducer(revealing, { type: "ANIMATION_DONE", runId: 2 })).toBe(revealing); // efecto repetido
    expect(flowReducer({ phase: "ready", runId: 0 }, { type: "NEXT_READY" }).phase).toBe("ready");
  });

  it("reanuda en la revelación si había un resultado pendiente (recarga a mitad de giro)", () => {
    const t = tournament(4);
    const d = initDraw(t, "roulette");
    expect(initialFlow(d).phase).toBe("ready");
    const pending = decidePick(d, "club").pending!;
    expect(initialFlow({ ...d, pending }).phase).toBe("revealing");
    expect(initialFlow({ ...d, cursor: 4 }).phase).toBe("completed");
  });

  const modes: DrawMode[] = ["roulette", "envelopes", "machine", "draft", "pots"];
  for (const mode of modes) {
    it.each([1, 2, 3, 4])(`${mode}: flujo completo con %i participante(s), sin avanzar a participantes inexistentes`, (n) => {
      const t = tournament(n);
      let d = initDraw(t, mode);
      let flow = initialFlow(d);
      const assigned = new Map<string, string>();
      for (let turn = 0; turn < n; turn++) {
        const pid = d.order[d.cursor];
        expect(flow.phase).toBe("ready");
        const choice = mode === "envelopes" ? { envelopeIndex: d.envelopes!.findIndex((e) => e) } : mode === "draft" ? { teamId: d.draftOptions![0] } : {};
        const { pending, error } = decidePick(d, "club", choice);
        expect(error).toBeUndefined();
        d = { ...d, pending };
        flow = flowReducer(flow, { type: "START" });
        // Durante la animación el turno sigue siendo el mismo y el sorteo no está completo.
        expect(d.order[d.cursor]).toBe(pid);
        expect(isDrawComplete(d)).toBe(false);
        flow = flowReducer(flow, { type: "ANIMATION_DONE", runId: flow.runId });
        flow = flowReducer(flow, { type: "REVEAL_DONE", runId: flow.runId });
        expect(flow.phase).toBe("assigned");
        const last = isLastTurn(d);
        expect(last).toBe(turn === n - 1);
        const res = confirmPick(d, false)!;
        d = res.state;
        assigned.set(pid, res.record.teamId);
        flow = flowReducer(flow, { type: "CONTINUE", isLast: last });
        if (!last) flow = flowReducer(flow, { type: "NEXT_READY" });
      }
      expect(flow.phase).toBe("completed");
      expect(isDrawComplete(d)).toBe(true);
      expect(decidePick(d, "club").error).toMatch(/Todos/);
      expect(assigned.size).toBe(n);
      expect(new Set(assigned.values()).size).toBe(n);
    });
  }
});

describe("categorías: clubes y selecciones nunca se mezclan", () => {
  it("hay 10 selecciones y 26 clubes, sin solapamientos", () => {
    expect(NATIONALS).toHaveLength(10);
    expect(CLUBS).toHaveLength(26);
    expect(NATIONALS.every((t) => t.kind === "national" && t.flag)).toBe(true);
    expect(CLUBS.every((t) => t.kind === "club")).toBe(true);
  });

  it("rechaza pools mixtos", () => {
    expect(categoryError(["real-madrid", "nat-france"], "club")).toMatch(/selección/);
    expect(categoryError(["nat-spain", "barcelona"], "national")).toMatch(/club/);
    expect(categoryError(["nat-spain", "nat-italy"], "national")).toBeNull();
    expect(categoryError(["inventado"], "club")).toMatch(/desconocido/);
  });

  it("un torneo de selecciones sortea solo selecciones", () => {
    const t = tournament(4, "national");
    let d = initDraw(t, "machine");
    for (let i = 0; i < 4; i++) {
      const { pending } = decidePick(d, "national");
      expect(pending!.teamId.startsWith("nat-")).toBe(true);
      d = confirmPick({ ...d, pending }, false)!.state;
    }
  });

  it("un estado manipulado con equipos mezclados no puede jugarse", () => {
    const t = tournament(2);
    const tampered: Tournament = { ...t, phase: "playing", assignments: { p1: "real-madrid", p2: "nat-france" } };
    expect(tournamentCategoryError(tampered)).toBeTruthy();
    expect(() => buildMatches(tampered)).toThrow();
    const valid: Tournament = { ...t, phase: "playing", assignments: { p1: "real-madrid", p2: "barcelona" } };
    const withMatches = { ...valid, matches: buildMatches(valid) };
    const hacked = { ...withMatches, assignments: { p1: "real-madrid", p2: "nat-france" } };
    expect(recordResult(hacked, hacked.matches[0].id, { homeGoals: 1, awayGoals: 0 }).error).toMatch(/categor/);
  });

  it("decidePick rechaza una carta de otra categoría inyectada en el draft", () => {
    const t = tournament(2);
    const d = { ...initDraw(t, "draft"), draftOptions: ["nat-france"] };
    expect(decidePick(d, "club", { teamId: "nat-france" }).error).toMatch(/selección/);
  });
});
