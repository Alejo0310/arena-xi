"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Crown, Eye, Radio, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState, Loader, PlayerDot } from "@/components/ui/bits";
import { TabBar, TournamentBody, type Tab } from "@/components/tournament/TournamentView";
import { MatchActionsContext, type MatchActions } from "@/components/tournament/MatchCard";
import { getHostToken, getMember, hasRole, hostClear, submitResultRemote } from "@/lib/roomClient";
import { roomErrorText } from "@/lib/roomSync";
import { useRoomPoll } from "@/lib/useRoomPoll";
import { ID_RE } from "@/lib/roomIds";
import { setActiveSnapshot } from "@/lib/teams";
import { SpectatorDraw } from "@/components/invite/SpectatorDraw";
import type { RoomPublic } from "@/lib/roomTypes";
import type { Match, Tournament } from "@/lib/types";

/** Vista en vivo de un torneo con invitaciones: sala de espera antes de empezar y, después, partidos y resultados. */
export default function RoomPage() {
  const { id } = useParams<{ id: string }>();
  const valid = ID_RE.test(id ?? "");
  const [room, setRoom] = useState<RoomPublic | null | undefined>(undefined);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [role, setRole] = useState<"host" | "member" | null>(null);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    setRole(getHostToken(id) ? "host" : getMember(id) ? "member" : null);
    setName(getMember(id)?.name ?? null);
  }, [id]);

  // Mientras el host hace el sorteo se consulta más a menudo (sin espaciar) para ver cada giro casi en directo.
  const live = !!room && !!room.draw && !room.started;
  useRoomPoll(
    valid ? id : null,
    (data) => {
      setRoom(data);
      setTournament(data.tournament);
    },
    { intervalMs: live ? 1500 : 3000, adaptive: !live },
  );
  // Si la sala no existe, el sondeo no devuelve datos: se marca como no encontrada tras unos segundos.
  useEffect(() => {
    if (!valid) return;
    const h = setTimeout(() => setRoom((r) => (r === undefined ? null : r)), 8000);
    return () => clearTimeout(h);
  }, [valid]);

  // Los equipos se muestran con los datos congelados del torneo, no con el catálogo vivo.
  useEffect(() => {
    setActiveSnapshot(tournament?.snapshot);
    return () => setActiveSnapshot(undefined);
  }, [tournament]);

  const actions = useMemo<MatchActions | null>(() => {
    if (!role) return null;
    const apply = (r: { version: number; tournament: Tournament }) => setTournament(r.tournament);
    return {
      manualWinner: role === "host",
      live: false,
      // Un jugador solo registra SUS partidos; el organizador, cualquiera.
      ...(role === "member"
        ? {
            canRecord: (m: Match) => {
              const me = tournament?.participants.find((p) => p.name.trim().replace(/\s+/g, " ").toLowerCase() === (name ?? "").trim().replace(/\s+/g, " ").toLowerCase());
              return !!me && (m.homeId === me.id || m.awayId === me.id);
            },
          }
        : {}),
      record: async (matchId, input) => {
        const r = await submitResultRemote(id, matchId, input);
        if (r.ok) {
          apply(r.data);
          return null;
        }
        return r.error === "invalid" && r.detail ? r.detail : roomErrorText(r.error);
      },
      ...(role === "host"
        ? {
            reset: async (matchId: string) => {
              const r = await hostClear(id, matchId);
              if (r.ok) {
                apply(r.data);
                return null;
              }
              return roomErrorText(r.error);
            },
          }
        : {}),
    };
  }, [role, id, name, tournament]);

  if (!valid || room === null) {
    return <EmptyState icon={<Eye className="size-8" />} title="Torneo no encontrado" body="El enlace no es válido o el torneo ya no está disponible." action={<Link href="/unirse"><Button>Unirme con un código</Button></Link>} />;
  }
  if (room === undefined) return <Loader label="Conectando con el torneo" />;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="kicker mb-1.5 flex items-center gap-2"><Radio className="size-3.5 animate-pulse text-neon" /> En vivo · {room.started ? "En juego" : room.draw ? "Sorteo" : "Inscripciones"}</div>
          <h1 className="display truncate text-4xl font-black italic sm:text-5xl" data-testid="room-title">{room.name}</h1>
          {room.host && <p className="mt-1 text-sm text-mute">Organiza {room.host}</p>}
        </div>
        <div className="flex items-center gap-2 text-sm" data-testid="room-role">
          {role === "host" ? (
            <span className="flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1.5 font-bold text-gold"><Crown className="size-4" /> Organizador</span>
          ) : role === "member" ? (
            <span className="flex items-center gap-1.5 rounded-full bg-neon/15 px-3 py-1.5 font-bold text-neon"><ShieldCheck className="size-4" /> {name ?? "Participante"}</span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 font-bold text-soft"><Eye className="size-4" /> Espectador</span>
          )}
        </div>
      </div>

      {room.draw && !room.started ? (
        <SpectatorDraw draw={room.draw} roomId={id} myName={hasRole(id) === "member" ? getMember(id)?.name : undefined} />
      ) : !room.started || !tournament ? (
        <div className="glass p-6" data-testid="room-lobby">
          <h2 className="display text-3xl font-extrabold">{room.open ? "Esperando a que el organizador inicie el torneo" : "El organizador está preparando el sorteo"}</h2>
          <p className="mt-1 text-sm text-soft">{room.open ? "Las inscripciones siguen abiertas." : "Las inscripciones están cerradas."} Esta página se actualiza sola y verás el sorteo en directo.</p>
          <div className="mt-4 flex items-center gap-2 text-sm text-mute"><Users className="size-4" /> <span data-testid="room-count">{room.participants.length}</span> / {room.max} inscritos</div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="room-participants">
            {room.participants.map((n) => (
              <li key={n} className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2 text-sm">
                <PlayerDot color="#3dff8b" size={9} />
                <span className="truncate font-semibold">{n}</span>
                {name && n.toLowerCase() === name.toLowerCase() && <span className="ml-auto rounded bg-neon/15 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-neon">Tú</span>}
              </li>
            ))}
          </ul>
          {!role && (
            <p className="mt-5 text-sm text-soft">¿Quieres jugar? Escanea el QR del organizador o <Link className="text-neon underline-offset-2 hover:underline" href="/unirse">introduce el código</Link>.</p>
          )}
        </div>
      ) : (
        <>
          {!role && <p className="glass mb-4 p-3 text-sm text-soft">Estás viendo el torneo como espectador. Solo los inscritos y el organizador pueden registrar resultados.</p>}
          <TabBar t={tournament} tab={tab} setTab={setTab} />
          <MatchActionsContext.Provider value={actions}>
            <TournamentBody t={tournament} tab={tab} readOnly={!role} />
          </MatchActionsContext.Provider>
        </>
      )}
    </div>
  );
}
