"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Logo, Wordmark } from "@/components/layout/Logo";
import { lookupCode } from "@/lib/roomClient";
import { roomErrorText } from "@/lib/roomSync";

/** Entrada manual del código numérico de 6 dígitos. El QR lleva directamente a /unirse/<código>. */
export default function JoinCodePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.replace(/\D/g, "");
    if (c.length !== 6) return setError("El código tiene 6 dígitos. Revísalo e inténtalo de nuevo.");
    setBusy(true);
    setError(null);
    const r = await lookupCode(c);
    setBusy(false);
    if (!r.ok) return setError(roomErrorText(r.error));
    router.push(`/unirse/${c}`);
  };

  return (
    <div className="mx-auto max-w-md pt-6 sm:pt-12">
      <div className="mb-8 flex items-center gap-3">
        <Logo size={44} gradientId="arena-logo-join" />
        <Wordmark />
      </div>
      <div className="kicker mb-2">Unirme a un torneo</div>
      <h1 className="display text-5xl font-black italic">Introduce el código</h1>
      <p className="mt-2 text-soft">Te lo ha dado el organizador. También puedes escanear su QR con la cámara del móvil.</p>
      <form onSubmit={submit} className="glass mt-6 p-5" noValidate>
        <label className="block">
          <span className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-mute">
            <KeyRound className="size-4" /> Código de 6 dígitos
          </span>
          <input
            className="field display !text-center !text-5xl font-black tracking-[0.3em]"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="······"
            aria-label="Código de invitación"
            data-testid="join-code-input"
            autoFocus
          />
        </label>
        {error && (
          <p className="mt-3 text-sm text-blaze" role="alert" data-testid="join-code-error">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="mt-4 w-full" disabled={busy || code.length !== 6} data-testid="join-code-submit">
          {busy ? "Buscando…" : "Continuar"} <ArrowRight className="size-5" />
        </Button>
      </form>
    </div>
  );
}
