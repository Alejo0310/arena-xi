import type { RoomErrorCode, RoomPublic } from "./roomTypes";
import type { Tournament } from "./types";
import type { ResultInput } from "./tournament/match";

/*
 * Cliente de la API de salas (solo navegador). Los tokens de host e invitado se guardan en localStorage del propio
 * navegador y se envían únicamente en la cabecera Authorization; el servidor guarda solo su hash. Nunca se incluyen
 * en el torneo, en la exportación JSON, en los enlaces ni en el QR.
 */

const HOST_KEY = "arena-xi-host";
const MEMBER_KEY = "arena-xi-member";

function read<T>(key: string): Record<string, T> {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, T>;
  } catch {
    return {};
  }
}
function write<T>(key: string, v: Record<string, T>) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* sin almacenamiento: la sesión no se podrá recuperar tras recargar */
  }
}

export const getHostToken = (roomId: string) => read<string>(HOST_KEY)[roomId] ?? null;
export const setHostToken = (roomId: string, token: string) => write(HOST_KEY, { ...read<string>(HOST_KEY), [roomId]: token });
export const getMember = (roomId: string) => read<{ token: string; name: string }>(MEMBER_KEY)[roomId] ?? null;
export const setMember = (roomId: string, m: { token: string; name: string }) => write(MEMBER_KEY, { ...read<{ token: string; name: string }>(MEMBER_KEY), [roomId]: m });

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: RoomErrorCode | "network"; detail?: string; status: number };

async function call<T>(method: "GET" | "POST", path: string, body?: unknown, token?: string | null): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method,
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as { error?: RoomErrorCode; detail?: string };
    if (!res.ok) return { ok: false, error: json.error ?? "storage", detail: json.detail, status: res.status };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: "network", status: 0 };
  }
}

export interface CodeInfo { id: string; name: string; host: string; open: boolean; started: boolean; max: number; count: number }

export const lookupCode = (code: string) => call<CodeInfo>("GET", `/api/sala/codigo/${encodeURIComponent(code)}`);
export const fetchRoom = (id: string, since?: number) => call<RoomPublic | { unchanged: true; version: number }>("GET", `/api/sala/${id}${since !== undefined ? `?since=${since}` : ""}`);
export const joinRoom = (id: string, name: string) => call<{ memberToken: string; name: string; version: number }>("POST", `/api/sala/${id}/join`, { name });

export async function createRoomRemote(input: { name: string; host?: string; max: number; names: string[] }) {
  const r = await call<{ id: string; code: string; hostToken: string }>("POST", "/api/sala", input);
  if (r.ok) setHostToken(r.data.id, r.data.hostToken);
  return r;
}

function hostCall<T>(id: string, action: string, body: unknown) {
  const token = getHostToken(id);
  if (!token) return Promise.resolve({ ok: false, error: "unauthorized", status: 401 } as ApiResult<T>);
  return call<T>("POST", `/api/sala/${id}/${action}`, body, token);
}
export const hostSetOpen = (id: string, open: boolean) => hostCall<{ version: number }>(id, "close", { open });
export const hostSync = (id: string, names: string[], max: number) => hostCall<{ conflicts: string[]; version: number }>(id, "sync", { names, max });
export const hostRemove = (id: string, name: string) => hostCall<{ version: number }>(id, "remove", { name });
export const hostStart = (id: string, tournament: Tournament) => hostCall<{ version: number }>(id, "start", { tournament });
export const hostResult = (id: string, matchId: string, result: ResultInput) => hostCall<{ version: number; tournament: Tournament }>(id, "result", { matchId, result });
export const hostClear = (id: string, matchId: string) => hostCall<{ version: number; tournament: Tournament }>(id, "clear", { matchId });

/** Registra un resultado con el token del host o, si no lo hay, con el del invitado inscrito en este navegador. */
export function submitResultRemote(id: string, matchId: string, result: ResultInput) {
  const token = getHostToken(id) ?? getMember(id)?.token ?? null;
  if (!token) return Promise.resolve({ ok: false, error: "unauthorized", status: 401 } as ApiResult<{ version: number; tournament: Tournament }>);
  return call<{ version: number; tournament: Tournament }>("POST", `/api/sala/${id}/result`, { matchId, result }, token);
}

export const hasRole = (id: string): "host" | "member" | null => (getHostToken(id) ? "host" : getMember(id) ? "member" : null);
