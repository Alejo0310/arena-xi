"use client";

import { useEffect, useRef } from "react";
import { fetchRoom } from "./roomClient";
import type { RoomPublic } from "./roomTypes";

/**
 * Sondeo de la sala cada pocos segundos mientras la pestaña está visible. Usa ?since=<versión> para que el servidor
 * responda "sin cambios" (sin reenviar el torneo) y espacia los intentos si hay errores.
 * Devuelve una función para forzar una consulta inmediata.
 */
export function useRoomPoll(roomId: string | null | undefined, onData: (room: RoomPublic) => void, opts: { intervalMs?: number; enabled?: boolean } = {}) {
  const { intervalMs = 3000, enabled = true } = opts;
  const cb = useRef(onData);
  cb.current = onData;
  const version = useRef<number | undefined>(undefined);
  const nudge = useRef<() => void>(() => {});

  useEffect(() => {
    if (!roomId || !enabled) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let fails = 0;
    let quiet = 0; // sondeos seguidos sin novedades: se espacian hasta 3x
    version.current = undefined;

    const tick = async () => {
      if (stop) return;
      if (document.visibilityState === "visible") {
        const r = await fetchRoom(roomId, version.current);
        if (stop) return;
        if (r.ok) {
          fails = 0;
          if (!("unchanged" in r.data)) {
            quiet = 0;
            version.current = r.data.version;
            cb.current(r.data);
          } else quiet = Math.min(quiet + 1, 8);
        } else fails = Math.min(fails + 1, 5);
      }
      timer = setTimeout(tick, intervalMs * (1 + fails) * (1 + Math.min(2, Math.floor(quiet / 4))));
    };
    nudge.current = () => {
      if (timer) clearTimeout(timer);
      version.current = undefined;
      quiet = 0;
      void tick();
    };
    void tick();
    const onVis = () => document.visibilityState === "visible" && nudge.current();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [roomId, enabled, intervalMs]);

  return () => nudge.current();
}
