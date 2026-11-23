"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Lock, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Loader } from "@/components/ui/bits";
import { Logo, Wordmark } from "@/components/layout/Logo";
import { getMember, joinRoom, lookupCode, setMember, type CodeInfo } from "@/lib/roomClient";
import { roomErrorText } from "@/lib/roomSync";
import { CODE_RE } from "@/lib/roomIds";

/** Página de acceso desde el QR o el código: nombre del torneo, campo para el nombre y botón para unirse. */
export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const [info, setInfo] = useState<CodeInfo | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState<string | null>(null);

  useEffect(() => {
    if (!CODE_RE.test(code ?? "")) {
      setInfo(null);
      setLoadError("El código no es válido: tiene que tener 6 dígitos.");
      return;
    }
    let off = false;
    void lookupCode(code).then((r) => {
      if (off) return;
      if (r.ok) {
        setInfo(r.data);
        const m = getMember(r.data.id);
        if (m) setJoined(m.name);
      } else {
        setInfo(null);
        setLoadError(roomErrorText(r.error));
      }
    });
    return () => {
      off = true;
    };
  }, [code]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!info) return;
    const n = name.trim().replace(/\s+/g, " ");
    if (!n) return setError("Escribe tu nombre para unirte.");
    if (n.length > 24) return setError("El nombre puede tener como máximo 24 caracteres.");
    setBusy(true);
    setError(null);
    const r = await joinRoom(info.id, n);
    setBusy(false);
    if (!r.ok) {
      setError(roomErrorText(r.error));
      // Refresca el estado (p. ej. si se cerró o se llenó mientras escribías).
      const again = await lookupCode(code);
      if (again.ok) setInfo(again.data);
      return;
    }
    setMember(info.id, { token: r.data.memberToken, name: r.data.name });
    setJoined(r.data.name);
  };

  const shell = (children: React.ReactNode) => (
    <div className="mx-auto max-w-md pt-6 sm:pt-12">
      <div className="mb-8 flex items-center gap-3">
        <Logo size={44} gradientId="arena-logo-join" />
        <Wordmark />
      </div>
      {children}
    </div>
  );

  if (info === undefined) return <Loader label="Buscando el torneo" />;
  if (info === null) {
    return shell(
      <div className="glass p-6" role="alert" data-testid="join-error">
        <h1 className="display text-4xl font-black italic">No se puede entrar</h1>
        <p className="mt-2 text-soft">{loadError}</p>
        <Link href="/unirse">
          <Button className="mt-5">Introducir otro código</Button>
        </Link>
      </div>,
    );
  }

  if (joined) {
    return shell(
      <div className="glass border-neon/40 p-6" data-testid="join-success">
        <div className="mb-3 grid size-14 place-items-center rounded-full bg-neon text-ink">
          <Check className="size-8" strokeWidth={3} />
        </div>
        <div className="kicker">Inscripción confirmada</div>
        <h1 className="display text-4xl font-black italic">¡Estás dentro, {joined}!</h1>
        <p className="mt-2 text-soft">Ya apareces en la lista de «{info.name}». Cuando el organizador inicie el torneo podrás ver los partidos y registrar resultados desde aquí.</p>
        <Link href={`/sala/${info.id}`}>
          <Button size="lg" className="mt-5 w-full" data-testid="join-open-room">
            <Trophy className="size-5" /> Ver el torneo
          </Button>
        </Link>
      </div>,
    );
  }

  const blocked = info.started
    ? "El torneo ya ha comenzado y las inscripciones están cerradas."
    : !info.open
      ? "El organizador ha cerrado las inscripciones."
      : info.count >= info.max
        ? "El torneo ya está completo: se alcanzó el número máximo de participantes."
        : null;

  return shell(
    <>
      <div className="kicker mb-2">Te han invitado a</div>
      <h1 className="display text-5xl font-black italic" data-testid="join-title">
        {info.name}
      </h1>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-soft">
        {info.host && (
          <span>
            Organiza <b className="text-white">{info.host}</b>
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <Users className="size-4" /> {info.count} de {info.max} plazas ocupadas
        </span>
      </div>

      {blocked ? (
        <div className="glass mt-6 flex items-start gap-3 border-blaze/40 p-5" role="alert" data-testid="join-blocked">
          <Lock className="mt-0.5 size-5 shrink-0 text-blaze" />
          <div>
            <p className="font-semibold">{blocked}</p>
            <p className="mt-1 text-sm text-soft">
              {info.started ? (
                <>
                  Puedes seguirlo desde{" "}
                  <Link className="text-neon underline-offset-2 hover:underline" href={`/sala/${info.id}`}>
                    la vista del torneo
                  </Link>
                  .
                </>
              ) : (
                "Pide al organizador que reabra las inscripciones o que amplíe el cupo."
              )}
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="glass mt-6 p-5" noValidate>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-mute">Tu nombre</span>
            <input className="field !text-lg" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Cómo quieres aparecer" autoComplete="nickname" autoFocus data-testid="join-name" aria-label="Tu nombre" />
          </label>
          {error && (
            <p className="mt-3 text-sm text-blaze" role="alert" data-testid="join-form-error">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="mt-4 w-full" disabled={busy} data-testid="join-submit">
            {busy ? "Uniéndome…" : "Unirme al torneo"} <ArrowRight className="size-5" />
          </Button>
          <p className="mt-3 text-xs text-mute">Solo se guarda el nombre que escribas. Entrar no te da permisos de organizador.</p>
        </form>
      )}
    </>,
  );
}
