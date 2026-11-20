"use client";

import { motion } from "motion/react";
import { Check } from "lucide-react";
import { EDITIONS } from "@/lib/editions";
import type { GameEdition } from "@/lib/types";

/** Paso "SELECCIONA TU FC": tres tarjetas, una por edición del videojuego. */
export function EditionSelector({ value, onChange, disabled }: { value: GameEdition; onChange: (e: GameEdition) => void; disabled?: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Edición de EA SPORTS FC">
      {EDITIONS.map((e, i) => {
        const active = e.id === value;
        return (
          <motion.button
            key={e.id}
            type="button"
            role="radio"
            aria-checked={active}
            data-edition={e.id}
            disabled={disabled}
            onClick={() => onChange(e.id)}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            style={{ ["--ed" as string]: e.accent, ["--ed2" as string]: e.accent2 }}
            className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition-colors disabled:opacity-50 ${active ? "border-[var(--ed)] bg-[color-mix(in_srgb,var(--ed)_10%,#0a0d12)] shadow-[0_0_40px_-12px_var(--ed)]" : "border-line bg-graphite/70 hover:border-white/30"}`}
          >
            <div aria-hidden className="pointer-events-none absolute -right-6 -top-10 select-none font-display text-[9rem] font-black italic leading-none text-white/[0.04] transition-transform duration-500 group-hover:scale-110">
              {e.label.slice(3)}
            </div>
            <div aria-hidden className="absolute inset-x-0 top-0 h-1 origin-left bg-gradient-to-r from-[var(--ed)] to-[var(--ed2)] transition-transform duration-500" style={{ transform: `scaleX(${active ? 1 : 0.25})` }} />
            <div className="relative flex items-start justify-between">
              <div>
                <div className="text-[0.65rem] font-bold uppercase tracking-[0.25em] text-mute">EA SPORTS</div>
                <div className="display text-5xl font-black italic leading-none">{e.label}</div>
              </div>
              <span className={`grid size-7 place-items-center rounded-full border transition-colors ${active ? "border-transparent bg-[var(--ed)] text-ink" : "border-line text-transparent"}`} aria-hidden>
                <Check className="size-4" strokeWidth={3} />
              </span>
            </div>
            <div className="relative mt-3 flex items-center gap-2 text-sm">
              <span className="num font-bold text-[var(--ed)]">{e.year}</span>
              <span className="text-mute">·</span>
              <span className="text-soft">Temporada {e.season}</span>
            </div>
            <p className="relative mt-2 text-xs text-mute">{e.tagline}</p>
          </motion.button>
        );
      })}
    </div>
  );
}
