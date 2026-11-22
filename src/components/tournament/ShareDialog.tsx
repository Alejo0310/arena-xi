"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, Link2, ShieldCheck, X } from "lucide-react";
import type { Tournament } from "@/lib/types";
import { Portal } from "@/components/ui/Portal";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/feedback";
import { createShortLink, shareUrl } from "@/lib/share";
import { sanitizeSlug, suggestSlug } from "@/lib/shortLink";

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Compartir: enlace corto con el nombre del torneo (o el que elija el usuario) + sufijo único, o enlace largo sin servidor. */
export function ShareDialog({ t, open, onClose }: { t: Tournament; open: boolean; onClose: () => void }) {
  const [name, setName] = useState(() => suggestSlug(t.name));
  const [busy, setBusy] = useState(false);
  const [short, setShort] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(suggestSlug(t.name));
    setShort(null);
    setProblem(null);
    setCopied(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const base = sanitizeSlug(name);
  const origin = typeof window === "undefined" ? "" : window.location.origin.replace(/^https?:\/\//, "");

  const create = async () => {
    setBusy(true);
    setProblem(null);
    const res = await createShortLink(t, base);
    setBusy(false);
    if ("url" in res) {
      setShort(res.url);
      const ok = await copy(res.url);
      setCopied(ok);
      toast.success(ok ? "Enlace corto copiado." : "Enlace corto creado.");
    } else {
      setProblem(
        res.error === "no-storage"
          ? "Los enlaces cortos aún no están activados en este servidor. Puedes usar el enlace largo, que funciona igual."
          : res.error === "rate-limited"
            ? "Has creado demasiados enlaces en poco tiempo. Inténtalo más tarde o usa el enlace largo."
            : "No se pudo crear el enlace corto. Usa el enlace largo.",
      );
    }
  };

  const copyLong = async () => {
    const ok = await copy(await shareUrl(t));
    toast[ok ? "success" : "info"](ok ? "Enlace largo copiado: no pasa por ningún servidor." : "No se pudo copiar automáticamente. Usa Exportar → Datos (JSON).");
  };

  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[70] grid place-items-center bg-ink/80 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} role="dialog" aria-modal="true" aria-label="Compartir torneo">
            <motion.div className="glass w-full max-w-lg p-6" initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="kicker">Compartir</div>
                  <h2 className="display text-3xl font-extrabold">Enlace del torneo</h2>
                </div>
                <button onClick={onClose} aria-label="Cerrar" className="text-mute hover:text-white"><X className="size-5" /></button>
              </div>

              <label className="mt-5 block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-mute">Nombre del enlace</span>
                <input className="field" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} data-testid="share-name" aria-label="Nombre del enlace" />
              </label>
              <p className="mt-2 break-all text-sm text-soft" data-testid="share-preview">
                {origin}/compartir#<b className="text-neon">{base}</b>-<span className="text-mute">······</span>
              </p>
              <p className="mt-1 text-xs text-mute">Se añade un código de 6 caracteres al final para que dos torneos con el mismo nombre nunca compartan enlace.</p>

              {short ? (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-neon/40 bg-neon/5 p-3" data-testid="share-result">
                  <Check className="size-5 shrink-0 text-neon" />
                  <input readOnly className="min-w-0 flex-1 bg-transparent text-sm outline-none" value={short} onFocus={(e) => e.currentTarget.select()} aria-label="Enlace corto" />
                  <Button size="sm" variant="secondary" onClick={async () => { setCopied(await copy(short)); }}>
                    <Copy className="size-4" /> {copied ? "Copiado" : "Copiar"}
                  </Button>
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button onClick={create} disabled={busy} data-testid="share-create"><Link2 className="size-4" /> {busy ? "Creando…" : "Crear enlace corto"}</Button>
                  <Button variant="ghost" onClick={copyLong} data-testid="share-long">Copiar enlace largo</Button>
                </div>
              )}
              {problem && <p className="mt-3 text-sm text-blaze" role="alert" data-testid="share-problem">{problem}</p>}

              <p className="mt-5 flex items-start gap-2 text-xs text-mute">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                El enlace corto guarda el torneo (participantes, equipos y resultados) en un servidor durante un año. El enlace largo lleva todo dentro de la propia URL y no pasa por ningún servidor.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
