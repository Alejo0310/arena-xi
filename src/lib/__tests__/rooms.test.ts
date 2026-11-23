import { beforeEach, describe, expect, it } from "vitest";
import { roomStore } from "../server/store";
import { RoomError, clearResult, createRoom, join, publicState, remove, requestTurn, roomByCode, setDraw, setOpen, start, submitResult, syncHost } from "../server/rooms";
import { buildMatches } from "../tournament/engine";
import { DEFAULT_CLUB_POOL, snapshotOf } from "../teams";
import type { Tournament } from "../types";

process.env.ARENA_KV_MEMORY = "1";
const store = () => roomStore()!;

async function expectError(p: Promise<unknown>, code: string) {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(RoomError);
    expect((e as RoomError).code).toBe(code);
    return e as RoomError;
  }
  throw new Error(`se esperaba el error ${code}`);
}

function playing(names: string[], format: "knockout" | "league" = "knockout"): Tournament {
  const pool = DEFAULT_CLUB_POOL.slice(0, names.length);
  const participants = names.map((name, i) => ({ id: `p${i}`, name, color: "#3dff8b" }));
  const t: Tournament = {
    id: "t", name: "Copa Sala", createdAt: 1, updatedAt: 1, phase: "playing",
    settings: { format, category: "club", edition: "FC25", gender: "men", legs: 1, thirdPlace: false, tiebreak: "gd", points: { win: 3, draw: 1, loss: 0 }, allowRepeatTeams: false, matchMinutes: 10 },
    participants, teamPool: pool, snapshot: snapshotOf(pool), assignments: Object.fromEntries(participants.map((p, i) => [p.id, pool[i]])),
    drawHistory: [], draw: null, matches: [], championId: null,
  };
  return { ...t, matches: buildMatches(t) };
}

beforeEach(() => {
  (globalThis as unknown as { __arenaMem?: unknown }).__arenaMem = undefined; // almacén limpio en cada prueba
});

describe("salas: creación y códigos", () => {
  it("genera un código de 6 dígitos único y lo asocia a la sala correcta", async () => {
    const s = store();
    const codes = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const r = await createRoom(s, { name: `Torneo ${i}`, max: 8 });
      expect(r.code).toMatch(/^\d{6}$/);
      expect(r.hostToken).toHaveLength(64);
      codes.add(r.code);
      expect((await roomByCode(s, r.code)).id).toBe(r.id);
    }
    expect(codes.size).toBe(60);
  });

  it("un código inexistente o mal formado no da acceso", async () => {
    const s = store();
    await expectError(roomByCode(s, "000000"), "not-found");
    await expectError(roomByCode(s, "12ab56"), "not-found");
    await expectError(publicState(s, "nosuchroom1"), "not-found");
  });

  it("el estado público nunca expone tokens ni hashes", async () => {
    const s = store();
    const r = await createRoom(s, { name: "Copa", max: 4 });
    const j = await join(s, r.id, "Ana");
    const json = JSON.stringify(await publicState(s, r.id));
    expect(json).not.toContain(r.hostToken);
    expect(json).not.toContain(j.memberToken);
    expect(json).not.toMatch(/[0-9a-f]{64}/);
  });
});

describe("salas: inscripción", () => {
  it("inscribe, bloquea duplicados (sin distinguir mayúsculas ni espacios) y valida nombres", async () => {
    const s = store();
    const r = await createRoom(s, { name: "Copa", max: 8 });
    const a = await join(s, r.id, "  Ana   Pérez ");
    expect(a.name).toBe("Ana Pérez");
    await expectError(join(s, r.id, "ana pérez"), "duplicate");
    await expectError(join(s, r.id, ""), "invalid-name");
    await expectError(join(s, r.id, "x".repeat(25)), "invalid-name");
    await expectError(join(s, r.id, 42), "invalid-name");
    expect(((await publicState(s, r.id)) as { participants: string[] }).participants).toEqual(["Ana Pérez"]);
  });

  it("respeta el cupo máximo aunque haya 25 inscripciones simultáneas", async () => {
    const s = store();
    const r = await createRoom(s, { name: "Copa", max: 6 });
    const res = await Promise.allSettled(Array.from({ length: 25 }, (_, i) => join(s, r.id, `Jugador ${i}`)));
    expect(res.filter((x) => x.status === "fulfilled")).toHaveLength(6);
    const rejected = res.filter((x) => x.status === "rejected") as PromiseRejectedResult[];
    expect(rejected.every((x) => (x.reason as RoomError).code === "full")).toBe(true);
    expect(await s.hlen(`room:${r.id}:participants`)).toBe(6);
    expect(await s.get(`room:${r.id}:count`)).toBe("6");
  });

  it("el mismo nombre enviado a la vez solo entra una vez", async () => {
    const s = store();
    const r = await createRoom(s, { name: "Copa", max: 8 });
    const res = await Promise.allSettled(Array.from({ length: 12 }, () => join(s, r.id, "Leo")));
    expect(res.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(await s.hlen(`room:${r.id}:participants`)).toBe(1);
    expect(await s.get(`room:${r.id}:count`)).toBe("1");
  });

  it("el cierre de inscripciones persiste y solo lo hace el host", async () => {
    const s = store();
    const r = await createRoom(s, { name: "Copa", max: 8 });
    const g = await join(s, r.id, "Ana");
    await expectError(setOpen(s, r.id, g.memberToken, false), "forbidden"); // un invitado no puede cerrar
    await expectError(setOpen(s, r.id, "x".repeat(64), false), "forbidden");
    await expectError(setOpen(s, r.id, undefined, false), "unauthorized");
    await setOpen(s, r.id, r.hostToken, false);
    await expectError(join(s, r.id, "Beto"), "closed");
    expect((await roomByCode(s, r.code)).open).toBe(false);
    await setOpen(s, r.id, r.hostToken, true);
    await join(s, r.id, "Beto");
  });

  it("los nombres del registro manual del host reservan su sitio y el host puede expulsar a un invitado", async () => {
    const s = store();
    const r = await createRoom(s, { name: "Copa", max: 6, names: ["Host Uno"] });
    await expectError(join(s, r.id, "host uno"), "duplicate");
    const g = await join(s, r.id, "Ana");
    // Un invitado no puede expulsar; el host sí.
    await expectError(remove(s, r.id, g.memberToken, "Ana"), "forbidden");
    await remove(s, r.id, r.hostToken, "Ana");
    expect(await s.get(`room:${r.id}:count`)).toBe("1");
    await join(s, r.id, "Ana"); // el nombre queda libre
    // Si el host añade a mano un nombre que ya usa un invitado, se informa del conflicto.
    const sync = await syncHost(s, r.id, r.hostToken, ["Host Uno", "ana"], 6);
    expect(sync.conflicts).toEqual(["ana"]);
  });
});

describe("salas: inicio del torneo y permisos", () => {
  it("solo el host inicia; tras iniciar el registro se cierra de forma permanente", async () => {
    const s = store();
    const r = await createRoom(s, { name: "Copa", max: 4 });
    const a = await join(s, r.id, "Ana");
    await join(s, r.id, "Beto");
    const t = playing(["Ana", "Beto", "Caro", "Dani"]);
    await syncHost(s, r.id, r.hostToken, ["Caro", "Dani"], 4);

    await expectError(start(s, r.id, a.memberToken, t), "forbidden"); // un invitado no puede iniciar
    await expectError(start(s, r.id, undefined, t), "unauthorized");
    await expectError(start(s, r.id, "0".repeat(64), t), "forbidden");
    expect(((await publicState(s, r.id)) as { started: boolean }).started).toBe(false);

    await start(s, r.id, r.hostToken, t);
    const st = (await publicState(s, r.id)) as { started: boolean; open: boolean; tournament: Tournament };
    expect(st.started).toBe(true);
    expect(st.open).toBe(false);
    expect(st.tournament.participants).toHaveLength(4);
    await expectError(join(s, r.id, "Eva"), "started");
    await expectError(setOpen(s, r.id, r.hostToken, true), "started");
    await expectError(start(s, r.id, r.hostToken, t), "started");
    expect((await roomByCode(s, r.code)).started).toBe(true);
  });

  it("no inicia si alguien de la sala no está en el torneo (y no deja la sala bloqueada)", async () => {
    const s = store();
    const r = await createRoom(s, { name: "Copa", max: 4 });
    await join(s, r.id, "Ana");
    await join(s, r.id, "Beto");
    await join(s, r.id, "Rezagado");
    const t = playing(["Ana", "Beto"]);
    await expectError(start(s, r.id, r.hostToken, t), "participants-changed");
    await join(s, r.id, "Otro"); // el registro sigue abierto
  });

  it("rechaza torneos manipulados (categoría mezclada, tamaño, estructura)", async () => {
    const s = store();
    const r = await createRoom(s, { name: "Copa", max: 4 });
    await join(s, r.id, "Ana");
    await join(s, r.id, "Beto");
    const t = playing(["Ana", "Beto"]);
    await expectError(start(s, r.id, r.hostToken, { ...t, assignments: { p0: "nat-france", p1: DEFAULT_CLUB_POOL[1] } }), "invalid");
    await expectError(start(s, r.id, r.hostToken, { ...t, phase: "finished" }), "invalid");
    await expectError(start(s, r.id, r.hostToken, { nope: 1 }), "invalid");
    await expectError(start(s, r.id, r.hostToken, null), "invalid");
    expect(((await publicState(s, r.id)) as { started: boolean }).started).toBe(false);
  });

  it("un token de una sala no sirve en otra", async () => {
    const s = store();
    const a = await createRoom(s, { name: "A", max: 4 });
    const b = await createRoom(s, { name: "B", max: 4 });
    await join(s, a.id, "Ana");
    await join(s, a.id, "Beto");
    await join(s, b.id, "Ana");
    await join(s, b.id, "Beto");
    const t = playing(["Ana", "Beto"]);
    await expectError(start(s, b.id, a.hostToken, t), "forbidden");
    await start(s, a.id, a.hostToken, t);
    const g = await join(s, b.id, "Caro").catch(() => null);
    expect(g).not.toBeNull();
    await expectError(submitResult(s, a.id, g!.memberToken, "K1-0", { homeGoals: 1, awayGoals: 0 }), "unauthorized");
  });
});

/** Partido de la primera ronda en el que juega el participante con ese nombre. */
const matchOf = (t: Tournament, name: string, round = 1) => {
  const p = t.participants.find((x) => x.name === name)!;
  return t.matches.find((m) => m.round === round && (m.homeId === p.id || m.awayId === p.id))!;
};

describe("salas: resultados", () => {
  async function started(names: string[], format: "knockout" | "league" = "knockout") {
    const s = store();
    const r = await createRoom(s, { name: "Copa", max: names.length });
    const tokens: Record<string, string> = {};
    for (const n of names.slice(0, 2)) tokens[n] = (await join(s, r.id, n)).memberToken;
    await syncHost(s, r.id, r.hostToken, names.slice(2), names.length);
    const t = playing(names, format);
    await start(s, r.id, r.hostToken, t);
    return { s, r, t, tokens };
  }

  it("un invitado y el host registran resultados; se actualizan las llaves y se conservan", async () => {
    const { s, r, t, tokens } = await started(["Ana", "Beto", "Caro", "Dani"]);
    const m0 = matchOf(t, "Ana");
    const m1 = t.matches.find((m) => m.round === 1 && m.id !== m0.id)!;
    const r1 = await submitResult(s, r.id, tokens["Ana"], m0.id, { homeGoals: 2, awayGoals: 1 });
    expect(r1.tournament.matches.find((m) => m.id === m0.id)?.status).toBe("done");
    await submitResult(s, r.id, r.hostToken, m1.id, { homeGoals: 0, awayGoals: 3 });
    const final = (await publicState(s, r.id)) as { tournament: Tournament; version: number };
    const fin = final.tournament.matches.find((m) => m.round === 2)!;
    expect(fin.homeId && fin.awayId).toBeTruthy(); // los ganadores avanzan a la final
    // Un jugador de ese partido actualiza un resultado ya registrado.
    const upd = await submitResult(s, r.id, tokens["Ana"], m0.id, { homeGoals: 1, awayGoals: 4 });
    expect(upd.tournament.matches.find((m) => m.id === m0.id)?.homeGoals).toBe(1);
    // Terminar el torneo fija al campeón y persiste.
    await submitResult(s, r.id, r.hostToken, fin.id, { homeGoals: 1, awayGoals: 0 });
    const done = (await publicState(s, r.id)) as { tournament: Tournament };
    expect(done.tournament.phase).toBe("finished");
    expect(done.tournament.championId).toBeTruthy();
  });

  it("solo con credenciales válidas; los invitados no pueden dar ganador manual ni borrar resultados", async () => {
    const { s, r, t, tokens } = await started(["Ana", "Beto", "Caro", "Dani"]);
    const m0 = t.matches.find((m) => m.round === 1)!;
    await expectError(submitResult(s, r.id, undefined, m0.id, { homeGoals: 1, awayGoals: 0 }), "unauthorized");
    await expectError(submitResult(s, r.id, "f".repeat(64), m0.id, { homeGoals: 1, awayGoals: 0 }), "unauthorized");
    await expectError(submitResult(s, r.id, tokens["Ana"], m0.id, { homeGoals: 1, awayGoals: 1, manualWinnerId: m0.homeId }), "forbidden");
    await submitResult(s, r.id, r.hostToken, m0.id, { homeGoals: 1, awayGoals: 0 });
    await expectError(clearResult(s, r.id, tokens["Ana"], m0.id), "forbidden");
    const cleared = await clearResult(s, r.id, r.hostToken, m0.id);
    expect(cleared.tournament.matches.find((m) => m.id === m0.id)?.status).toBe("pending");
  });

  it("aplica las reglas de la competición (empate en eliminatoria sin penaltis, goles inválidos)", async () => {
    const { s, r, t, tokens } = await started(["Ana", "Beto", "Caro", "Dani"]);
    const m0 = matchOf(t, "Ana");
    const e = await expectError(submitResult(s, r.id, tokens["Ana"], m0.id, { homeGoals: 1, awayGoals: 1 }), "invalid");
    expect(e.detail).toBeTruthy();
    await expectError(submitResult(s, r.id, tokens["Ana"], m0.id, { homeGoals: -1, awayGoals: 0 }), "invalid");
    await expectError(submitResult(s, r.id, tokens["Ana"], m0.id, { homeGoals: 1.5, awayGoals: 0 }), "invalid");
    await expectError(submitResult(s, r.id, tokens["Ana"], m0.id, { homeGoals: "1", awayGoals: 0 }), "invalid");
    await expectError(submitResult(s, r.id, tokens["Ana"], "NOPE", { homeGoals: 1, awayGoals: 0 }), "invalid");
    await submitResult(s, r.id, tokens["Ana"], m0.id, { homeGoals: 1, awayGoals: 1, homePens: 5, awayPens: 4 });
  });

  it("resultados simultáneos de partidos distintos se guardan todos", async () => {
    const { s, r, t, tokens } = await started(["Ana", "Beto", "Caro", "Dani", "Eva", "Fran", "Gus", "Hugo"]);
    const r1 = t.matches.filter((m) => m.round === 1);
    expect(r1).toHaveLength(4);
    await Promise.all(r1.map((m, i) => submitResult(s, r.id, m.homeId === "p0" || m.awayId === "p0" ? tokens["Ana"] : r.hostToken, m.id, { homeGoals: i + 1, awayGoals: 0 })));
    const st = (await publicState(s, r.id)) as { tournament: Tournament };
    expect(st.tournament.matches.filter((m) => m.round === 1 && m.status === "done")).toHaveLength(4);
  });

  it("cada jugador solo registra los resultados de SUS partidos; el host, todos", async () => {
    const { s, r, t, tokens } = await started(["Ana", "Beto", "Caro", "Dani"]);
    const mine = matchOf(t, "Ana");
    const notMine = t.matches.find((m) => m.round === 1 && m.id !== mine.id)!;
    await expectError(submitResult(s, r.id, tokens["Ana"], notMine.id, { homeGoals: 1, awayGoals: 0 }), "forbidden");
    await submitResult(s, r.id, tokens["Ana"], mine.id, { homeGoals: 1, awayGoals: 0 });
    // Ni siquiera con el partido de otro ya terminado puede sobrescribirlo.
    await submitResult(s, r.id, r.hostToken, notMine.id, { homeGoals: 2, awayGoals: 0 });
    await expectError(submitResult(s, r.id, tokens["Ana"], notMine.id, { homeGoals: 0, awayGoals: 9 }), "forbidden");
    // El host sí puede corregir cualquier partido.
    const fixed = await submitResult(s, r.id, r.hostToken, mine.id, { homeGoals: 0, awayGoals: 5 });
    expect(fixed.tournament.matches.find((m) => m.id === mine.id)?.awayGoals).toBe(5);
  });

  it("no se registran resultados antes de que el host inicie el torneo", async () => {
    const s = store();
    const r = await createRoom(s, { name: "Copa", max: 4 });
    const g = await join(s, r.id, "Ana");
    await expectError(submitResult(s, r.id, g.memberToken, "K1-0", { homeGoals: 1, awayGoals: 0 }), "conflict");
  });

  it("la versión sube con cada cambio y 'since' evita reenviar el torneo", async () => {
    const { s, r, t, tokens } = await started(["Ana", "Beto", "Caro", "Dani"]);
    const v0 = ((await publicState(s, r.id)) as { version: number }).version;
    expect(await publicState(s, r.id, v0)).toEqual({ unchanged: true, version: v0 });
    await submitResult(s, r.id, tokens["Ana"], matchOf(t, "Ana").id, { homeGoals: 3, awayGoals: 2 });
    const st = (await publicState(s, r.id, v0)) as { version: number; tournament: Tournament };
    expect(st.version).toBeGreaterThan(v0);
    expect(st.tournament).toBeTruthy();
  });
});

describe("salas: sorteo en directo", () => {
  async function drawState(mode: "roulette" | "envelopes" | "machine" | "draft" | "pots") {
    const { initDraw } = await import("../draw");
    const { buildDrawBroadcast } = await import("../drawBroadcast");
    const t = { ...playing(["Ana", "Beto", "Caro", "Dani"], "league"), phase: "draw" as const, matches: [] };
    return buildDrawBroadcast({ ...t, draw: initDraw(t, mode, mode === "pots" ? { method: "rating" } : undefined) })!;
  }

  it("el host publica el sorteo y todos lo ven en el estado público; los invitados no pueden publicarlo", async () => {
    const s = store();
    const r = await createRoom(s, { name: "Copa", max: 4 });
    const g = await join(s, r.id, "Ana");
    const d = await drawState("roulette");
    await expectError(setDraw(s, r.id, g.memberToken, d), "forbidden");
    await expectError(setDraw(s, r.id, undefined, d), "unauthorized");
    const v0 = ((await publicState(s, r.id)) as { version: number }).version;
    await setDraw(s, r.id, r.hostToken, d);
    const st = (await publicState(s, r.id, v0)) as { draw: { mode: string; id: string; pending: unknown; cursor: number } | null; version: number };
    expect(st.version).toBeGreaterThan(v0);
    expect(st.draw?.mode).toBe("roulette");
    expect(st.draw?.id).toBe(d.id);
    // Cada cambio del host (turno decidido, asignación) llega con una versión nueva.
    const withPending = { ...d, pending: { participantId: d.order[0], teamId: d.pool[0], at: 5 } };
    await setDraw(s, r.id, r.hostToken, withPending);
    expect(((await publicState(s, r.id)) as { draw: { pending: { teamId: string } } }).draw.pending.teamId).toBe(d.pool[0]);
  });

  it("acepta el estado de las cinco mecánicas y rechaza datos mal formados", async () => {
    const s = store();
    const r = await createRoom(s, { name: "Copa", max: 4 });
    for (const m of ["roulette", "envelopes", "machine", "draft", "pots"] as const) await setDraw(s, r.id, r.hostToken, await drawState(m));
    const ok = await drawState("roulette");
    await expectError(setDraw(s, r.id, r.hostToken, { ...ok, mode: "otra" }), "invalid");
    await expectError(setDraw(s, r.id, r.hostToken, { ...ok, edition: "FC99" }), "invalid");
    await expectError(setDraw(s, r.id, r.hostToken, { ...ok, pool: new Array(900).fill("x") }), "invalid");
    await expectError(setDraw(s, r.id, r.hostToken, { ...ok, order: [1, 2] }), "invalid");
    await expectError(setDraw(s, r.id, r.hostToken, { ...ok, participants: "no" }), "invalid");
    await expectError(setDraw(s, r.id, r.hostToken, { ...ok, assignments: { p0: 5 } }), "invalid");
    await expectError(setDraw(s, r.id, r.hostToken, "texto"), "invalid");
    await expectError(setDraw(s, r.id, r.hostToken, { ...ok, junk: "x".repeat(100_000) }), "invalid");
  });

  it("borrar el sorteo lo quita; al iniciar el torneo desaparece y ya no se puede publicar", async () => {
    const s = store();
    const r = await createRoom(s, { name: "Copa", max: 4 });
    await join(s, r.id, "Ana");
    await join(s, r.id, "Beto");
    await setDraw(s, r.id, r.hostToken, await drawState("draft"));
    expect(((await publicState(s, r.id)) as { draw: unknown }).draw).not.toBeNull();
    await setDraw(s, r.id, r.hostToken, null);
    expect(((await publicState(s, r.id)) as { draw: unknown }).draw).toBeNull();
    await setDraw(s, r.id, r.hostToken, await drawState("machine"));
    await start(s, r.id, r.hostToken, playing(["Ana", "Beto"]));
    expect(((await publicState(s, r.id)) as { draw: unknown; started: boolean }).draw).toBeNull();
    await expectError(setDraw(s, r.id, r.hostToken, await drawState("machine")), "started");
  });
});

describe("salas: turnos del sorteo desde el móvil del jugador", () => {
  async function setup() {
    const { initDraw } = await import("../draw");
    const { buildDrawBroadcast } = await import("../drawBroadcast");
    const s = store();
    const r = await createRoom(s, { name: "Copa", max: 4 });
    const tokens: Record<string, string> = {};
    for (const n of ["Ana", "Beto"]) tokens[n] = (await join(s, r.id, n)).memberToken;
    const t = { ...playing(["Ana", "Beto", "Caro", "Dani"], "league"), phase: "draw" as const, matches: [] };
    const bc = buildDrawBroadcast({ ...t, draw: initDraw(t, "envelopes") })!;
    // Ana es la primera en el orden.
    const d0 = { ...bc, order: ["p0", ...bc.order.filter((x) => x !== "p0")] };
    await setDraw(s, r.id, r.hostToken, d0);
    return { s, r, tokens, d0 };
  }
  const intentOf = async (s: ReturnType<typeof store>, id: string) =>
    ((await publicState(s, id)) as { intent: { kind: string; participantId: string; choice?: { envelopeIndex?: number } } | null }).intent;

  it("solo el jugador al que le toca puede pedir girar y la petición llega al estado público", async () => {
    const { s, r, tokens } = await setup();
    await expectError(requestTurn(s, r.id, tokens["Beto"], "spin", {}), "forbidden"); // no es su turno
    await expectError(requestTurn(s, r.id, r.hostToken, "spin", {}), "forbidden"); // el host usa su propio flujo
    await expectError(requestTurn(s, r.id, undefined, "spin", {}), "unauthorized");
    await expectError(requestTurn(s, r.id, tokens["Ana"], "otra", {}), "invalid");
    await expectError(requestTurn(s, r.id, tokens["Ana"], "confirm", {}), "conflict"); // aún no hay equipo que confirmar
    await requestTurn(s, r.id, tokens["Ana"], "spin", { envelopeIndex: 2, junk: "x" });
    const it = await intentOf(s, r.id);
    expect(it?.kind).toBe("spin");
    expect(it?.participantId).toBe("p0");
    expect(it?.choice).toEqual({ envelopeIndex: 2 });
  });

  it("es idempotente y el host la descarta al ejecutarla (aparece el giro pendiente)", async () => {
    const { s, r, tokens, d0 } = await setup();
    const v1 = await requestTurn(s, r.id, tokens["Ana"], "spin", {});
    const v2 = await requestTurn(s, r.id, tokens["Ana"], "spin", {});
    expect(v2).toBe(v1);
    // El host decide y publica: la petición ya está cumplida.
    await setDraw(s, r.id, r.hostToken, { ...d0, pending: { participantId: "p0", teamId: d0.pool[0], at: 9 } });
    expect(await intentOf(s, r.id)).toBeNull();
    // Ahora Ana puede continuar, pero no volver a girar.
    await expectError(requestTurn(s, r.id, tokens["Ana"], "spin", {}), "conflict");
    await requestTurn(s, r.id, tokens["Ana"], "confirm");
    expect((await intentOf(s, r.id))?.kind).toBe("confirm");
    await expectError(requestTurn(s, r.id, tokens["Beto"], "confirm"), "forbidden");
    // El turno avanza y la petición de continuar desaparece.
    await setDraw(s, r.id, r.hostToken, { ...d0, cursor: 1, assignments: { p0: d0.pool[0] } });
    expect(await intentOf(s, r.id)).toBeNull();
  });

  it("sin sorteo en curso o con el torneo iniciado no hay turnos", async () => {
    const s = store();
    const r = await createRoom(s, { name: "Copa", max: 2 });
    const g = await join(s, r.id, "Ana");
    await expectError(requestTurn(s, r.id, g.memberToken, "spin", {}), "conflict");
    await syncHost(s, r.id, r.hostToken, ["Beto"], 2);
    await start(s, r.id, r.hostToken, playing(["Ana", "Beto"]));
    await expectError(requestTurn(s, r.id, g.memberToken, "spin", {}), "started");
  });
});
