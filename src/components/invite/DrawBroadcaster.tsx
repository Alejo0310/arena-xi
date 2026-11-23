"use client";

import { useEffect, useRef } from "react";
import { useTournament } from "@/store/tournament";
import { getHostToken, hostDraw } from "@/lib/roomClient";
import { buildDrawBroadcast } from "@/lib/drawBroadcast";

/**
 * Publica en la sala el estado del sorteo del host (turno, giro pendiente, asignaciones…) para que los invitados lo
 * vean en directo. No renderiza nada y solo actúa si el torneo tiene una sala y este navegador es el del host.
 * El sorteo sigue ocurriendo íntegramente en el navegador del host; los invitados solo lo reproducen.
 */
export function DrawBroadcaster() {
  const t = useTournament((s) => s.current);
  const room = t?.room;
  const isHost = !!room && !!getHostToken(room.id);
  const payload = t && isHost ? buildDrawBroadcast(t) : null;
  const sig = JSON.stringify(payload);
  const lastSent = useRef<string | undefined>(undefined);
  const roomId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!room || !isHost) return;
    if (roomId.current !== room.id) {
      roomId.current = room.id;
      lastSent.current = undefined;
    }
    if (sig === lastSent.current) return;
    let cancelled = false;
    const send = async (attempt: number) => {
      lastSent.current = sig;
      const r = await hostDraw(room.id, payload);
      if (cancelled) return;
      // Un fallo de red no debe dejar a los invitados con datos viejos: se reintenta.
      if (!r.ok && r.error !== "started" && attempt < 4) {
        lastSent.current = undefined;
        timer = setTimeout(() => void send(attempt + 1), 1500 * (attempt + 1));
      }
    };
    let timer = setTimeout(() => void send(0), 80);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // payload se deriva de sig.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, room?.id, isHost]);

  return null;
}
