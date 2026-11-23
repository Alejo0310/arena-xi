"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Download, Lock, LockOpen, QrCode, Share2, Trash2, Users, X } from "lucide-react";
import { useTournament } from "@/store/tournament";
import { Button } from "@/components/ui/Button";
import { PlayerDot } from "@/components/ui/bits";
import { toast } from "@/components/ui/feedback";
import { QRCode, downloadQrPng } from "./QRCode";
import { createRoomRemote, getHostToken, hostRemove, hostSetOpen } from "@/lib/roomClient";
import { reconcileNow } from "@/lib/roomSync";
import { useRoomPoll } from "@/lib/useRoomPoll";
import { ROOM_ERROR_TEXT, type RoomPublic } from "@/lib/roomTypes";

const spaced = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;

/**
 * Paso 3 · Invitar participantes: QR + código de 6 dígitos. La lista de la sala (Upstash Redis) se sincroniza con la
 * lista local del host; el registro manual sigue funcionando exactamente igual.
 */
export function InvitePanel({ max }: { max: number }) {
  const t = useTournament((s) => s.current)!;
  const remove = useTournament((s) => s.removeParticipant);
  const setRoom = useTournament((s) => s.setRoom);
  const room = t.room;
  const [open, setOpen] = useState(!!room);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<RoomPublic | null>(null);
  const lastServer = useRef<string[] | null>(null);
  const lastSync = useRef<string>("");
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const isHost = !!room && !!getHostToken(room.id);
  const url = room ? `${origin}/unirse/${room.code}` : "";
  const capacity = Math.min(32, Math.max(2, max, t.participants.length));

  const create = async () => {
    setCreating(true);
    setError(null);
    const r = await createRoomRemote({ name: t.name || "Torneo", max: capacity, names: t.participants.map((p) => p.name) });
    setCreating(false);
    if (!r.ok) {
      setError(r.error === "network" ? ROOM_ERROR_TEXT.storage : ROOM_ERROR_TEXT[r.error] ?? ROOM_ERROR_TEXT.storage);
      return;
    }
    lastSync.current = "";
    lastServer.current = null;
    setState(null);
    setRoom({ id: r.data.id, code: r.data.code, guests: [] });
    setOpen(true);
  };

  /** Reconcilia la lista local con la de la sala (altas, bajas y nombres del registro manual). */
  const run = useCallback(async () => {
    const server = lastServer.current;
    if (!server) return;
    const r = await reconcileNow(server, capacity, lastSync.current);
    lastSync.current = r.sig;
    for (const e of r.addErrors) toast.error(`No se pudo añadir a ${e}`);
    if (r.conflicts.length) toast.error(`${r.conflicts.join(", ")}: un invitado ya usa ese nombre. Cámbialo para evitar duplicados.`);
  }, [capacity]);

  const nudge = useRoomPoll(
    room?.id,
    (data) => {
      setState(data);
      lastServer.current = data.participants;
      void run();
    },
    { enabled: !!room && isHost && t.phase !== "playing" && t.phase !== "finished" },
  );

  // Cambios locales (registro manual, cupo): se reflejan en la sala sin esperar al siguiente sondeo.
  const localSig = t.participants.map((p) => p.name).join("|") + "#" + capacity;
  useEffect(() => {
    if (!room || !isHost || !lastServer.current) return;
    const h = setTimeout(() => void run(), 500);
    return () => clearTimeout(h);
  }, [localSig, room, isHost, run]);

  const toggleOpen = async () => {
    if (!room || !state) return;
    const r = await hostSetOpen(room.id, !state.open);
    if (!r.ok) return toast.error(ROOM_ERROR_TEXT[r.error as keyof typeof ROOM_ERROR_TEXT] ?? ROOM_ERROR_TEXT.storage);
    nudge();
    toast.info(state.open ? "Inscripciones cerradas." : "Inscripciones abiertas.");
  };

  const copy = async (text: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(msg);
    } catch {
      toast.info(`Cópialo manualmente: ${text}`);
    }
  };
  const share = async () => {
    const data = { title: t.name, text: `Únete a «${t.name}» en ARENA XI con el código ${room!.code}`, url };
    try {
      if (navigator.share) await navigator.share(data);
      else await copy(url, "Enlace de invitación copiado.");
    } catch {
      /* el usuario canceló */
    }
  };
  const kick = async (name: string) => {
    const p = t.participants.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (p) remove(p.id);
    if (room) await hostRemove(room.id, name);
    nudge();
  };

  const count = state?.participants.length ?? t.participants.length;
  const free = Math.max(0, (state?.max ?? capacity) - count);
  const guestSet = new Set((room?.guests ?? []).map((g) => g.toLowerCase()));

  if (!room || !open) {
    return (
      <div className="glass mt-4 flex flex-col gap-4 p-5 sm:flex-row sm:items-center" data-testid="invite-cta">
        <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-neon/10 text-neon"><QrCode className="size-7" /></div>
        <div className="min-w-0 flex-1">
          <h3 className="display text-2xl font-extrabold">Invitar participantes</h3>
          <p className="text-sm text-soft">Genera un QR y un código de 6 dígitos: cada jugador entra desde su móvil, escribe su nombre y queda inscrito. Tú sigues pudiendo añadir jugadores a mano.</p>
          {error && <p className="mt-2 text-sm text-blaze" role="alert" data-testid="invite-error">{error}</p>}
        </div>
        <Button onClick={room ? () => setOpen(true) : create} disabled={creating} data-testid="invite-generate">
          <QrCode className="size-4" /> {creating ? "Generando…" : room ? "Ver invitación" : "Invitar participantes"}
        </Button>
      </div>
    );
  }

  return (
    <div className="glass mt-4 overflow-hidden border-neon/30 p-5 sm:p-6" data-testid="invite-panel">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h3 className="display text-2xl font-extrabold">Invitar participantes</h3>
        <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${state?.open === false ? "bg-blaze/15 text-blaze" : "bg-neon/15 text-neon"}`} data-testid="invite-status">
          {state?.open === false ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
          {state?.started ? "Torneo iniciado" : state?.open === false ? "Inscripciones cerradas" : "Inscripciones abiertas"}
        </span>
        <button className="ml-auto text-mute hover:text-white" onClick={() => setOpen(false)} aria-label="Ocultar invitación"><X className="size-5" /></button>
      </div>

      {!isHost ? (
        <div className="rounded-xl border border-blaze/40 p-4 text-sm" role="alert">
          <p>Este navegador no tiene los permisos de organizador de esta invitación (se guardan solo en el navegador donde se creó). Puedes generar una invitación nueva.</p>
          <Button className="mt-3" variant="secondary" size="sm" onClick={create} disabled={creating}>Generar invitación nueva</Button>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
          <div className="mx-auto flex w-full max-w-[260px] flex-col items-center gap-3 lg:mx-0">
            <QRCode value={url} label={`Código QR para unirse a ${t.name}`} className="aspect-square w-full max-w-[240px]" />
            <div className="text-center">
              <div className="text-[0.65rem] font-bold uppercase tracking-[0.25em] text-mute">Código</div>
              <div className="display text-6xl font-black leading-none tracking-wider text-neon" data-testid="invite-code" data-code={room.code}>{spaced(room.code)}</div>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => copy(room.code, "Código copiado.")} data-testid="invite-copy"><Copy className="size-4" /> Copiar código</Button>
              <Button size="sm" variant="secondary" onClick={share} data-testid="invite-share"><Share2 className="size-4" /> Compartir</Button>
              <Button size="sm" variant="ghost" onClick={async () => { if (!(await downloadQrPng(url, `arena-xi-${room.code}.png`))) toast.error("No se pudo descargar el QR."); }} data-testid="invite-download"><Download className="size-4" /> QR</Button>
            </div>
            <p className="break-all text-center text-xs text-mute">O entra en <b className="text-soft">{origin.replace(/^https?:\/\//, "")}/unirse</b> e introduce el código.</p>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-mute">Inscritos en la sala</div>
                <div className="display text-5xl font-black"><span className="text-neon" data-testid="invite-count">{count}</span><span className="text-2xl text-mute"> / {state?.max ?? capacity}</span></div>
              </div>
              <div className="text-right text-sm text-soft" data-testid="invite-free">{state?.started ? "Torneo iniciado" : free > 0 ? `${free} plaza${free === 1 ? "" : "s"} disponible${free === 1 ? "" : "s"}` : "Sin plazas disponibles"}</div>
            </div>

            <ul className="mt-4 grid max-h-[280px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2" data-testid="invite-list">
              {(state?.participants ?? []).map((n) => {
                const guest = guestSet.has(n.toLowerCase());
                const p = t.participants.find((x) => x.name.toLowerCase() === n.toLowerCase());
                return (
                  <li key={n} className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2 text-sm">
                    {p ? <PlayerDot color={p.color} size={9} /> : <Users className="size-3.5 text-mute" />}
                    <span className="min-w-0 flex-1 truncate font-semibold">{n}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider ${guest ? "bg-volt/20 text-volt" : "bg-white/10 text-mute"}`}>{guest ? "Invitado" : "Manual"}</span>
                    {guest && !state?.started && (
                      <button onClick={() => kick(n)} className="text-mute hover:text-danger" aria-label={`Quitar a ${n}`}><Trash2 className="size-4" /></button>
                    )}
                  </li>
                );
              })}
            </ul>
            {state && state.participants.length === 0 && <p className="mt-4 text-sm text-mute">Aún no hay nadie. Escanea el QR o introduce el código desde otro dispositivo.</p>}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" onClick={toggleOpen} disabled={!state || state.started} data-testid="invite-toggle">
                {state?.open === false ? <><LockOpen className="size-4" /> Reabrir inscripciones</> : <><Lock className="size-4" /> Cerrar inscripciones</>}
              </Button>
              <span className="text-xs text-mute">Se cierran solas al empezar el sorteo.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
