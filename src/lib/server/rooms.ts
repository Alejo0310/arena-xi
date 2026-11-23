import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { Tournament } from "../types";
import type { DrawBroadcast, DrawIntent, RoomErrorCode, RoomMeta, RoomPublic } from "../roomTypes";
import { tournamentCategoryError } from "../category";
import { recordResult as engineRecord, resetResult as engineReset } from "../tournament/engine";
import type { ResultInput } from "../tournament/match";
import { setActiveSnapshot } from "../teams";
import type { Store } from "./store";
import { ID_RE, CODE_RE } from "../roomIds";

/*
 * Salas de invitación (QR + código numérico) sobre Upstash Redis.
 *
 * Claves (todas con prefijo por sala y caducidad de 30 días):
 *   invitation:code:{codigo}      → id de la sala (SET NX: un código nunca apunta a dos salas)
 *   room:{id}:meta                → JSON {name, host, max, open, started, createdAt, code}
 *   room:{id}:host                → SHA-256 del token del host (el token solo lo conoce el navegador del host)
 *   room:{id}:participants        → HASH nombre-normalizado → JSON {name, src: "host"|"guest"}
 *   room:{id}:members             → HASH SHA-256(token de invitado) → nombre-normalizado
 *   room:{id}:count               → contador atómico de plazas ocupadas (control del cupo)
 *   room:{id}:started             → bandera que cierra el registro de forma permanente
 *   room:{id}:tournament / :ver   → torneo iniciado (JSON) y su versión
 *   room:{id}:draw                → estado del sorteo en curso (para que los invitados lo vean en directo)
 *   room:{id}:intent              → petición del jugador al que le toca (girar, elegir sobre/carta, continuar)
 *   room:{id}:lock                → cerrojo corto para actualizar resultados sin pisarse
 */

export const TTL = 60 * 60 * 24 * 30;
export const MAX_NAME = 24;
export const MAX_PARTICIPANTS = 32;
const MAX_TOURNAMENT_BYTES = 250_000;

export class RoomError extends Error {
  constructor(public code: RoomErrorCode, public status: number, public detail?: string) {
    super(code);
  }
}
const fail = (code: RoomErrorCode, status = 400): never => {
  throw new RoomError(code, status);
};

const key = {
  code: (c: string) => `invitation:code:${c}`,
  meta: (id: string) => `room:${id}:meta`,
  host: (id: string) => `room:${id}:host`,
  parts: (id: string) => `room:${id}:participants`,
  members: (id: string) => `room:${id}:members`,
  count: (id: string) => `room:${id}:count`,
  started: (id: string) => `room:${id}:started`,
  tour: (id: string) => `room:${id}:tournament`,
  draw: (id: string) => `room:${id}:draw`,
  intent: (id: string) => `room:${id}:intent`,
  ver: (id: string) => `room:${id}:ver`,
  lock: (id: string) => `room:${id}:lock`,
};

export { ID_RE, CODE_RE };

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const newToken = () => randomBytes(32).toString("hex");
const newId = () => Array.from({ length: 10 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[randomInt(36)]).join("");

/** Nombre mostrado: sin espacios sobrantes ni caracteres de control. */
export function cleanName(raw: unknown): string {
  if (typeof raw !== "string") return fail("invalid-name");
  const n = raw.replace(/[\u0000-\u001f\u007f<>]/g, "").trim().replace(/\s+/g, " ");
  if (!n || n.length > MAX_NAME) return fail("invalid-name");
  return n;
}
/** Clave de comparación: dos nombres que solo difieren en mayúsculas o espacios son el mismo. */
export const norm = (name: string) => name.toLowerCase();

async function touch(s: Store, id: string) {
  await Promise.all(Object.values(key).map((kf) => (kf === key.code ? Promise.resolve() : s.expire(kf(id), TTL))));
}
async function bump(s: Store, id: string): Promise<number> {
  const v = await s.incr(key.ver(id));
  await s.expire(key.ver(id), TTL);
  return v;
}

async function readMeta(s: Store, id: string): Promise<RoomMeta> {
  if (!ID_RE.test(id)) return fail("not-found", 404);
  const raw = await s.get(key.meta(id));
  if (!raw) return fail("not-found", 404);
  return JSON.parse(raw) as RoomMeta;
}
const writeMeta = (s: Store, id: string, m: RoomMeta) => s.set(key.meta(id), JSON.stringify(m), { ex: TTL });

/** Comprueba el token del host contra el hash guardado (comparación en tiempo constante). */
async function requireHost(s: Store, id: string, token: unknown): Promise<void> {
  if (typeof token !== "string" || token.length < 32) return fail("unauthorized", 401);
  const stored = await s.get(key.host(id));
  if (!stored) return fail("not-found", 404);
  const a = Buffer.from(sha(token), "hex");
  const b = Buffer.from(stored, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return fail("forbidden", 403);
}

/** Identifica a quien registra resultados: host o participante inscrito (token propio). */
async function whoIs(s: Store, id: string, token: unknown): Promise<{ role: "host" | "member"; name?: string }> {
  if (typeof token !== "string" || token.length < 32) return fail("unauthorized", 401);
  const h = sha(token);
  const stored = await s.get(key.host(id));
  if (stored) {
    const a = Buffer.from(h, "hex");
    const b = Buffer.from(stored, "hex");
    if (a.length === b.length && timingSafeEqual(a, b)) return { role: "host" };
  }
  const name = await s.hget(key.members(id), h);
  if (name) return { role: "member", name };
  return fail("unauthorized", 401);
}

// ------------------------------------------------------------------------------------------------

export async function createRoom(s: Store, input: { name?: unknown; host?: unknown; max?: unknown; names?: unknown }) {
  const name = typeof input.name === "string" ? input.name.replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, 60) : "";
  if (!name) return fail("invalid");
  const host = typeof input.host === "string" ? input.host.replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, 40) : "";
  const max = Math.max(2, Math.min(MAX_PARTICIPANTS, Number.isInteger(input.max) ? (input.max as number) : MAX_PARTICIPANTS));
  const id = newId();

  // Código de 6 dígitos único: SET NX garantiza que nunca apunte a dos salas.
  let code = "";
  for (let i = 0; i < 12 && !code; i++) {
    const c = String(randomInt(100000, 1000000));
    if (await s.set(key.code(c), id, { nx: true, ex: TTL })) code = c;
  }
  if (!code) return fail("conflict", 503);

  const token = newToken();
  const meta: RoomMeta = { name, host, max, open: true, started: false, createdAt: Date.now(), code };
  await writeMeta(s, id, meta);
  await s.set(key.host(id), sha(token), { ex: TTL });
  await s.set(key.count(id), "0", { ex: TTL });
  await bump(s, id);
  const names = Array.isArray(input.names) ? input.names : [];
  if (names.length) await syncNames(s, id, names, max);
  return { id, code, hostToken: token };
}

export async function roomByCode(s: Store, code: string): Promise<{ id: string; name: string; host: string; open: boolean; started: boolean; max: number; count: number }> {
  if (!CODE_RE.test(code)) return fail("not-found", 404);
  const id = await s.get(key.code(code));
  if (!id) return fail("not-found", 404);
  const meta = await readMeta(s, id);
  const started = meta.started || !!(await s.get(key.started(id)));
  return { id, name: meta.name, host: meta.host, open: meta.open, started, max: meta.max, count: await s.hlen(key.parts(id)) };
}

export async function publicState(s: Store, id: string, since?: number): Promise<RoomPublic | { unchanged: true; version: number }> {
  if (!ID_RE.test(id)) return fail("not-found", 404);
  const verRaw = await s.get(key.ver(id)); // un solo comando cuando no hay cambios (el sondeo es la lectura más frecuente)
  if (verRaw === null) return fail("not-found", 404);
  const version = Number(verRaw);
  if (since !== undefined && since === version) return { unchanged: true, version };
  const meta = await readMeta(s, id);
  const all = await s.hgetall(key.parts(id));
  const participants = Object.values(all).map((v) => (JSON.parse(v) as { name: string }).name);
  const raw = meta.started ? await s.get(key.tour(id)) : null;
  const drawRaw = meta.started ? null : await s.get(key.draw(id));
  const intentRaw = meta.started ? null : await s.get(key.intent(id));
  return {
    id, name: meta.name, host: meta.host, max: meta.max, open: meta.open, started: meta.started, version, participants,
    tournament: raw ? (JSON.parse(raw) as Tournament) : null,
    draw: drawRaw ? (JSON.parse(drawRaw) as DrawBroadcast) : null,
    intent: intentRaw ? (JSON.parse(intentRaw) as DrawIntent) : null,
  };
}

/** Un invitado se inscribe. Atómico respecto al cupo y a los nombres duplicados. */
export async function join(s: Store, id: string, rawName: unknown): Promise<{ memberToken: string; name: string; version: number }> {
  const name = cleanName(rawName);
  const meta = await readMeta(s, id);
  if (meta.started || (await s.get(key.started(id)))) return fail("started", 409);
  if (!meta.open) return fail("closed", 409);

  // 1) El nombre es único: HSETNX decide quién llega primero, aunque lleguen a la vez.
  if (!(await s.hsetnx(key.parts(id), norm(name), JSON.stringify({ name, src: "guest" })))) return fail("duplicate", 409);
  const rollback = async () => {
    await s.hdel(key.parts(id), norm(name));
    await s.decr(key.count(id));
  };
  // 2) El cupo es exacto: INCR es atómico, así que solo las primeras `max` inscripciones lo superan.
  const n = await s.incr(key.count(id));
  if (n > meta.max) {
    await rollback();
    return fail("full", 409);
  }
  // 3) Si mientras tanto el host cerró o inició, se deshace (el inicio se comprueba después de insertar a propósito).
  const again = await readMeta(s, id);
  if (again.started || again.open === false || (await s.get(key.started(id)))) {
    await rollback();
    return fail(again.open === false && !again.started ? "closed" : "started", 409);
  }
  const memberToken = newToken();
  await s.hset(key.members(id), sha(memberToken), norm(name));
  await touch(s, id);
  return { memberToken, name, version: await bump(s, id) };
}

/** El host abre o cierra las inscripciones (el cierre persiste). No se puede reabrir un torneo iniciado. */
export async function setOpen(s: Store, id: string, token: unknown, open: unknown): Promise<number> {
  await requireHost(s, id, token);
  const meta = await readMeta(s, id);
  if (meta.started) return fail("started", 409);
  await writeMeta(s, id, { ...meta, open: open === true });
  return bump(s, id);
}

/** Sincroniza los nombres del registro manual del host y el cupo. Devuelve los nombres en conflicto con invitados. */
async function syncNames(s: Store, id: string, names: unknown[], max?: number): Promise<string[]> {
  const conflicts: string[] = [];
  const wanted = new Map<string, string>();
  for (const n of names) {
    if (typeof n !== "string") continue;
    try {
      const c = cleanName(n);
      wanted.set(norm(c), c);
    } catch {
      /* se ignora un nombre inválido */
    }
  }
  const current = await s.hgetall(key.parts(id));
  for (const [k, raw] of Object.entries(current)) {
    const v = JSON.parse(raw) as { src: string };
    if (v.src === "host" && !wanted.has(k)) {
      await s.hdel(key.parts(id), k);
      await s.decr(key.count(id));
    }
  }
  for (const [k, display] of wanted) {
    if (await s.hsetnx(key.parts(id), k, JSON.stringify({ name: display, src: "host" }))) {
      await s.incr(key.count(id));
      continue;
    }
    // Ya existía: si es de un invitado, el host debe diferenciar su nombre.
    const existing = current[k] ?? (await s.hget(key.parts(id), k));
    if ((JSON.parse(existing ?? "{}") as { src?: string }).src !== "host") conflicts.push(display);
  }
  if (max !== undefined) {
    const meta = await readMeta(s, id);
    await writeMeta(s, id, { ...meta, max: Math.max(2, Math.min(MAX_PARTICIPANTS, max)) });
  }
  return conflicts;
}

export async function syncHost(s: Store, id: string, token: unknown, names: unknown, max: unknown): Promise<{ conflicts: string[]; version: number }> {
  await requireHost(s, id, token);
  const meta = await readMeta(s, id);
  if (meta.started) return fail("started", 409);
  const conflicts = await syncNames(s, id, Array.isArray(names) ? names : [], Number.isInteger(max) ? (max as number) : undefined);
  return { conflicts, version: await bump(s, id) };
}

/** El host expulsa a un invitado (también invalida su token). */
export async function remove(s: Store, id: string, token: unknown, rawName: unknown): Promise<number> {
  await requireHost(s, id, token);
  const meta = await readMeta(s, id);
  if (meta.started) return fail("started", 409);
  const k = norm(cleanName(rawName));
  if (await s.hdel(key.parts(id), k)) await s.decr(key.count(id));
  const members = await s.hgetall(key.members(id));
  for (const [h, nm] of Object.entries(members)) if (nm === k) await s.hdel(key.members(id), h);
  return bump(s, id);
}

// ------------------------------------------------------------------------------------------------

/** Valida el torneo que publica el host y lo normaliza para guardarlo. */
function sanitizeTournament(raw: unknown, roomNames: string[]): Tournament {
  const json = JSON.stringify(raw ?? null);
  if (!raw || typeof raw !== "object" || json.length > MAX_TOURNAMENT_BYTES) return fail("invalid");
  const t = raw as Tournament;
  if (typeof t.id !== "string" || typeof t.name !== "string" || !t.settings || !Array.isArray(t.participants) || !Array.isArray(t.matches)) return fail("invalid");
  if (t.phase !== "playing" || t.participants.length < 2 || t.participants.length > MAX_PARTICIPANTS || t.matches.length === 0) return fail("invalid");
  for (const p of t.participants) if (!p || typeof p.id !== "string" || typeof p.name !== "string" || p.name.length > MAX_NAME) return fail("invalid");
  const have = new Set(t.participants.map((p) => norm(p.name.trim().replace(/\s+/g, " "))));
  if (have.size !== t.participants.length) return fail("invalid");
  // Todos los inscritos en la sala deben estar en el torneo (si no, alguien se quedaría fuera).
  if (roomNames.some((n) => !have.has(n))) return fail("participants-changed", 409);
  setActiveSnapshot(t.snapshot);
  try {
    if (tournamentCategoryError(t)) return fail("invalid");
  } finally {
    setActiveSnapshot(undefined);
  }
  return { ...t, draw: null, room: undefined } as Tournament;
}

/** Solo el host inicia el torneo: publica el cuadro y cierra el registro de forma permanente. */
export async function start(s: Store, id: string, token: unknown, tournament: unknown): Promise<number> {
  await requireHost(s, id, token);
  const meta = await readMeta(s, id);
  if (meta.started) return fail("started", 409);
  // La bandera se pone ANTES de leer la lista: quien se inscriba después se deshace solo.
  if (!(await s.set(key.started(id), "1", { nx: true, ex: TTL }))) return fail("conflict", 409);
  try {
    const roomNames = Object.keys(await s.hgetall(key.parts(id)));
    const t = sanitizeTournament(tournament, roomNames);
    await s.set(key.tour(id), JSON.stringify(t), { ex: TTL });
    await s.del(key.draw(id), key.intent(id)); // el sorteo termina: ya no hay nada que ver en directo
    await writeMeta(s, id, { ...meta, started: true, open: false });
  } catch (e) {
    await s.del(key.started(id));
    throw e;
  }
  await touch(s, id);
  return bump(s, id);
}

// ------------------------------------------------------------------------------------------------

const MODES = ["roulette", "envelopes", "machine", "draft", "pots"] as const;
const EDITIONS = ["FC25", "FC26", "FC27"] as const;
const MAX_DRAW_BYTES = 90_000;

const isStr = (v: unknown, max = 80): v is string => typeof v === "string" && v.length > 0 && v.length <= max;
function strArr(v: unknown, max: number): string[] {
  if (!Array.isArray(v) || v.length > max || !v.every((x) => isStr(x))) return fail("invalid");
  return v as string[];
}
const int = (v: unknown, min = 0, max = 100_000): number => (typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : (fail("invalid") as never));

/** Valida y reconstruye el estado del sorteo que publica el host (solo campos conocidos, tamaños acotados). */
export function sanitizeDraw(raw: unknown): DrawBroadcast {
  if (!raw || typeof raw !== "object" || JSON.stringify(raw).length > MAX_DRAW_BYTES) return fail("invalid");
  const d = raw as Record<string, unknown>;
  if (!isStr(d.id, 40) || !(MODES as readonly unknown[]).includes(d.mode) || !(EDITIONS as readonly unknown[]).includes(d.edition)) return fail("invalid");
  if (d.category !== "club" && d.category !== "national") return fail("invalid");
  if (d.gender !== "men" && d.gender !== "women") return fail("invalid");
  const order = strArr(d.order, MAX_PARTICIPANTS);
  const participants = Array.isArray(d.participants) && d.participants.length <= MAX_PARTICIPANTS
    ? d.participants.map((p) => {
        const o = p as Record<string, unknown>;
        if (!p || !isStr(o.id, 40) || !isStr(o.name, MAX_NAME) || !isStr(o.color, 20)) return fail("invalid");
        return { id: o.id as string, name: (o.name as string).replace(/[<>]/g, ""), color: o.color as string };
      })
    : fail("invalid");
  const assignments: Record<string, string> = {};
  if (!d.assignments || typeof d.assignments !== "object") return fail("invalid");
  for (const [k, v] of Object.entries(d.assignments as Record<string, unknown>)) {
    if (!isStr(k, 40) || !isStr(v)) return fail("invalid");
    assignments[k] = v;
  }
  const owners: Record<number, string> = {};
  for (const [k, v] of Object.entries((d.owners ?? {}) as Record<string, unknown>)) {
    if (!/^\d{1,3}$/.test(k) || !isStr(v, 40)) return fail("invalid");
    owners[Number(k)] = v;
  }
  let pending: DrawBroadcast["pending"] = null;
  if (d.pending) {
    const p = d.pending as Record<string, unknown>;
    if (!isStr(p.participantId, 40) || !isStr(p.teamId) || typeof p.at !== "number") return fail("invalid");
    pending = { participantId: p.participantId as string, teamId: p.teamId as string, at: p.at as number, ...(typeof p.envelopeIndex === "number" ? { envelopeIndex: int(p.envelopeIndex, 0, 200) } : {}) };
  }
  return {
    id: d.id as string,
    mode: d.mode as DrawBroadcast["mode"],
    order,
    cursor: int(d.cursor, 0, MAX_PARTICIPANTS),
    pool: strArr(d.pool, 800),
    pending,
    ...(Array.isArray(d.envelopes) ? { envelopes: (d.envelopes as unknown[]).slice(0, 80).map((e) => (e === null ? null : isStr(e) ? e : (fail("invalid") as never))) } : {}),
    ...(Array.isArray(d.draftOptions) ? { draftOptions: strArr(d.draftOptions, 10) } : {}),
    ...(Array.isArray(d.pots) ? { pots: (d.pots as unknown[]).slice(0, 80).map((p) => strArr(p, 800)) } : {}),
    ...(typeof d.potIndex === "number" ? { potIndex: int(d.potIndex, 0, 80) } : {}),
    ...(d.potsMethod === "rating" || d.potsMethod === "manual" || d.potsMethod === "balanced" ? { potsMethod: d.potsMethod } : {}),
    assignments,
    owners,
    participants,
    edition: d.edition as DrawBroadcast["edition"],
    category: d.category,
    gender: d.gender,
  };
}

/** El host publica (o borra, con null) el estado del sorteo en curso. Solo antes de iniciar el torneo. */
export async function setDraw(s: Store, id: string, token: unknown, draw: unknown): Promise<number> {
  await requireHost(s, id, token);
  const meta = await readMeta(s, id);
  if (meta.started) return fail("started", 409);
  if (draw === null) {
    await s.del(key.draw(id), key.intent(id));
  } else {
    const clean = sanitizeDraw(draw);
    await s.set(key.draw(id), JSON.stringify(clean), { ex: TTL });
    // La petición del jugador ya se ejecutó (hay un giro pendiente o el turno avanzó) o es de otro sorteo: se descarta.
    const raw = await s.get(key.intent(id));
    if (raw) {
      const it = JSON.parse(raw) as DrawIntent;
      const done = it.drawId !== clean.id || it.cursor !== clean.cursor || (it.kind === "spin" ? !!clean.pending : !clean.pending);
      if (done) await s.del(key.intent(id));
    }
  }
  return bump(s, id);
}

// ------------------------------------------------------------------------------------------------

function sanitizeResult(raw: unknown, host: boolean): ResultInput {
  if (!raw || typeof raw !== "object") return fail("invalid");
  const r = raw as Record<string, unknown>;
  const num = (v: unknown) => (v === null || v === undefined ? null : typeof v === "number" && Number.isInteger(v) ? v : (fail("invalid") as never));
  const out: ResultInput = { homeGoals: num(r.homeGoals), awayGoals: num(r.awayGoals), homePens: num(r.homePens), awayPens: num(r.awayPens), manualWinnerId: null };
  if (r.manualWinnerId) {
    if (!host) return fail("forbidden", 403); // el ganador manual (W.O.) es una decisión del organizador
    if (typeof r.manualWinnerId !== "string") return fail("invalid");
    out.manualWinnerId = r.manualWinnerId;
  }
  return out;
}

/** Cerrojo corto para que dos actualizaciones simultáneas no se pisen. */
async function withLock<T>(s: Store, id: string, fn: () => Promise<T>): Promise<T> {
  const mine = newToken();
  let got = false;
  for (let i = 0; i < 40 && !got; i++) {
    got = await s.set(key.lock(id), mine, { nx: true, px: 5000 });
    if (!got) await new Promise((r) => setTimeout(r, 40 + (i % 5) * 20));
  }
  if (!got) return fail("conflict", 503);
  try {
    return await fn();
  } finally {
    if ((await s.get(key.lock(id))) === mine) await s.del(key.lock(id));
  }
}

async function mutateTournament(s: Store, id: string, apply: (t: Tournament) => { tournament?: Tournament; error?: string }): Promise<{ tournament: Tournament; version: number }> {
  return withLock(s, id, async () => {
    const raw = await s.get(key.tour(id));
    if (!raw) return fail("conflict", 409);
    const current = JSON.parse(raw) as Tournament;
    setActiveSnapshot(current.snapshot);
    let res: { tournament?: Tournament; error?: string };
    try {
      res = apply(current);
    } finally {
      setActiveSnapshot(undefined);
    }
    if (res.error || !res.tournament) throw new RoomError("invalid", 422, res.error);
    await s.set(key.tour(id), JSON.stringify(res.tournament), { ex: TTL });
    return { tournament: res.tournament, version: await bump(s, id) };
  });
}

/**
 * El jugador al que le toca (en el sorteo) pide girar / abrir un sobre / elegir carta, o continuar tras ver su equipo.
 * Solo se guarda la petición: la ejecuta el navegador del host, que sigue siendo quien decide el azar.
 */
export async function requestTurn(s: Store, id: string, token: unknown, rawKind: unknown, rawChoice?: unknown): Promise<number> {
  const who = await whoIs(s, id, token);
  if (who.role !== "member") return fail("forbidden", 403);
  const meta = await readMeta(s, id);
  if (meta.started) return fail("started", 409);
  if (rawKind !== "spin" && rawKind !== "confirm") return fail("invalid");
  const raw = await s.get(key.draw(id));
  if (!raw) return fail("conflict", 409);
  const draw = JSON.parse(raw) as DrawBroadcast;
  const turnId = draw.pending?.participantId ?? draw.order[draw.cursor];
  const me = draw.participants.find((p) => norm(p.name.trim().replace(/\s+/g, " ")) === who.name);
  if (!me || me.id !== turnId) return fail("forbidden", 403);
  if (rawKind === "spin" ? !!draw.pending : !draw.pending) return fail("conflict", 409);
  const c = (rawChoice ?? {}) as { envelopeIndex?: unknown; teamId?: unknown };
  const choice: DrawIntent["choice"] = {};
  if (Number.isInteger(c.envelopeIndex) && (c.envelopeIndex as number) >= 0 && (c.envelopeIndex as number) < 1000) choice.envelopeIndex = c.envelopeIndex as number;
  if (typeof c.teamId === "string" && c.teamId.length <= 80) choice.teamId = c.teamId;
  const prev = await s.get(key.intent(id));
  if (prev) {
    const p = JSON.parse(prev) as DrawIntent;
    if (p.drawId === draw.id && p.cursor === draw.cursor && p.kind === rawKind) return (await s.get(key.ver(id)).then((v) => Number(v))) || 0; // idempotente
  }
  const intent: DrawIntent = { kind: rawKind, drawId: draw.id, cursor: draw.cursor, participantId: me.id, choice, at: Date.now() };
  await s.set(key.intent(id), JSON.stringify(intent), { ex: TTL });
  return bump(s, id);
}

/** Registra (o actualiza) el resultado de un partido. Pueden hacerlo el host y los inscritos, una vez iniciado el torneo. */
export async function submitResult(s: Store, id: string, token: unknown, matchId: unknown, rawResult: unknown) {
  const who = await whoIs(s, id, token);
  const meta = await readMeta(s, id);
  if (!meta.started) return fail("conflict", 409);
  if (typeof matchId !== "string") return fail("invalid");
  const input = sanitizeResult(rawResult, who.role === "host");
  return mutateTournament(s, id, (t) => {
    // Un jugador solo registra los resultados de SUS partidos; el organizador puede registrar cualquiera.
    if (who.role === "member") {
      const me = t.participants.find((p) => norm(p.name.trim().replace(/\s+/g, " ")) === who.name);
      const m = t.matches.find((x) => x.id === matchId);
      if (!me || !m) return { error: "Partido no encontrado." };
      if (m.homeId !== me.id && m.awayId !== me.id) throw new RoomError("forbidden", 403);
    }
    return engineRecord(t, matchId, input);
  });
}

/** Borrar un resultado cambia el estado de la competición: solo el host. */
export async function clearResult(s: Store, id: string, token: unknown, matchId: unknown) {
  await requireHost(s, id, token);
  if (typeof matchId !== "string") return fail("invalid");
  return mutateTournament(s, id, (t) => (t.matches.some((m) => m.id === matchId) ? { tournament: engineReset(t, matchId) } : { error: "Partido no encontrado." }));
}
