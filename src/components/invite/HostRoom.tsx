"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Radio, RefreshCw, Users } from "lucide-react";
import { useTournament } from "@/store/tournament";
import { Button } from "@/components/ui/Button";
import { MatchActionsContext, type MatchActions } from "@/components/tournament/MatchCard";
import { fetchRoom, getHostToken, hostClear, hostResult } from "@/lib/roomClient";
import { publishTournament, roomErrorText } from "@/lib/roomSync";
import { useRoomPoll } from "@/lib/useRoomPoll";
import { useEffect, useRef } from "react";

/** Trae el estado de la sala y lo aplica al torneo local (sirve para corregir cualquier desajuste). */
async function pullFromRoom(roomId: string): Promise<void> {
  const r = await fetchRoom(roomId);
  if (r.ok && !("unchanged" in r.data) && r.data.tournament) useTournament.getState().applyRemote(r.data.tournament, r.data.version);
}

/**
 * Puente del host con la sala: publica el torneo al iniciarse (el servidor valida su token) y recibe los resultados
 * que registran los invitados. Solo actúa si el torneo tiene una sala; si no, no hace nada.
 */
export function HostRoomBanner() {
  const t = useTournament((s) => s.current);
  const room = t?.room;
  const isHost = !!room && !!getHostToken(room.id);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const publishing = useRef(false);

  const publish = async () => {
    if (publishing.current) return;
    publishing.current = true;
    setBusy(true);
    const r = await publishTournament();
    setBusy(false);
    publishing.current = false;
    if (r.ok) return setProblem(null);
    if (r.code === "started" && room) {
      // Ya estaba publicado (p. ej. se recargó la página justo después): se adopta el estado del servidor.
      await pullFromRoom(room.id);
      useTournament.getState().patchRoom({ published: true });
      return setProblem(null);
    }
    setProblem(r.message);
  };

  // Al llegar al torneo ya iniciado, se publica automáticamente (una vez).
  const tried = useRef(false);
  useEffect(() => {
    if (!room || !isHost || room.published || tried.current || !t || t.phase === "setup" || t.phase === "draw") return;
    tried.current = true;
    void publish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, room?.published, isHost, t?.phase]);

  useRoomPoll(
    room?.id,
    (data) => {
      setCount(data.participants.length);
      const cur = useTournament.getState().current;
      if (data.tournament && cur?.room && data.version !== cur.room.version) useTournament.getState().applyRemote(data.tournament, data.version);
    },
    { enabled: !!room && isHost && !!room.published, intervalMs: 3000 },
  );

  if (!t || !room) return null;
  return (
    <div className="glass no-print mb-6 flex flex-wrap items-center gap-3 border-neon/30 p-3 text-sm" data-testid="host-room-banner">
      <Radio className="size-5 shrink-0 text-neon" />
      <div className="min-w-0 flex-1">
        <b>Sala en vivo</b> · código <span className="display num text-lg font-black text-neon">{room.code}</span>
        {count !== null && <span className="ml-2 inline-flex items-center gap-1 text-soft"><Users className="size-3.5" /> {count}</span>}
        <span className="ml-2 text-mute">{room.published ? "Los invitados pueden registrar resultados." : busy ? "Publicando el torneo…" : "Torneo sin publicar."}</span>
        {problem && <div className="mt-1 text-blaze" role="alert" data-testid="host-room-problem">{problem}</div>}
        {!isHost && <div className="mt-1 text-blaze">Este navegador no tiene los permisos de organizador de la sala.</div>}
      </div>
      {isHost && !room.published && t.phase !== "setup" && t.phase !== "draw" && (
        <Button size="sm" variant="secondary" onClick={publish} disabled={busy} data-testid="host-room-retry"><RefreshCw className="size-4" /> Reintentar</Button>
      )}
      {room.published && <Link className="text-xs font-semibold text-soft underline-offset-2 hover:text-white hover:underline" href={`/sala/${room.id}`} target="_blank">Vista de invitados</Link>}
    </div>
  );
}

/** Registra los resultados del host también en la sala (el servidor es la referencia) y refleja el resultado devuelto. */
export function HostRoomProvider({ children }: { children: React.ReactNode }) {
  const room = useTournament((s) => s.current?.room);
  const active = !!room?.published && !!getHostToken(room.id);
  const actions = useMemo<MatchActions | null>(() => {
    if (!room || !active) return null;
    return {
      manualWinner: true,
      live: true,
      record: async (matchId, input) => {
        const err = useTournament.getState().recordResult(matchId, input);
        if (err) return err;
        const r = await hostResult(room.id, matchId, input);
        if (r.ok) {
          useTournament.getState().applyRemote(r.data.tournament, r.data.version);
          return null;
        }
        await pullFromRoom(room.id); // el servidor manda: se deshace lo que no aceptó
        return r.error === "invalid" && r.detail ? r.detail : roomErrorText(r.error);
      },
      reset: async (matchId) => {
        useTournament.getState().resetResult(matchId);
        const r = await hostClear(room.id, matchId);
        if (r.ok) {
          useTournament.getState().applyRemote(r.data.tournament, r.data.version);
          return null;
        }
        await pullFromRoom(room.id);
        return roomErrorText(r.error);
      },
    };
  }, [room, active]);
  return actions ? <MatchActionsContext.Provider value={actions}>{children}</MatchActionsContext.Provider> : <>{children}</>;
}
