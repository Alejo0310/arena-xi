"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sparkles } from "lucide-react";
import { DEFAULT_CLUB_POOL, getTeam } from "@/lib/teams";
import { randomInt } from "@/lib/random";
import type { Team } from "@/lib/types";
import { play } from "@/lib/sound";
import { HeroFallback } from "./HeroFallback";
import type { ArenaCoreHandle } from "./arenaCore";

const ORBIT_TEAMS: Team[] = DEFAULT_CLUB_POOL.slice(0, 8).map((id) => getTeam(id)!);

/** ¿Merece la pena el 3D en este dispositivo? */
function canRender3D(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (!window.matchMedia("(min-width: 1024px)").matches) return false; // móvil/tablet: versión CSS
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if ((nav.hardwareConcurrency ?? 8) < 4 || (nav.deviceMemory ?? 8) < 4 || nav.connection?.saveData) return false;
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") ?? c.getContext("webgl");
    if (!gl) return false;
    (gl as WebGLRenderingContext).getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * Elemento protagonista del Hero: "núcleo de sorteo".
 * Se muestra primero la versión CSS (también sirve de estado de carga); el módulo
 * Three.js se descarga después, cuando el navegador queda libre y el Hero es visible,
 * y aparece con un fundido sin desplazar el diseño.
 */
export function HeroVisual() {
  const host = useRef<HTMLDivElement>(null);
  const core = useRef<ArenaCoreHandle | null>(null);
  const [mode, setMode] = useState<"css" | "loading3d" | "3d">("css");
  // En escritorio el 3D sustituye al respaldo: mientras llega, solo se pinta un halo ligero.
  // Si el dispositivo no puede con el 3D, se muestra el respaldo completo también en escritorio.
  const [fullFallback, setFullFallback] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [result, setResult] = useState<Team | null>(null);

  useEffect(() => {
    if (!canRender3D()) {
      setFullFallback(true);
      return;
    }
    let cancelled = false;
    let idleId: number | undefined;
    const el = host.current;
    if (!el) return;

    const load = async () => {
      setMode("loading3d");
      const fontFamily = getComputedStyle(document.documentElement).getPropertyValue("--font-saira").trim() || "sans-serif";
      await document.fonts?.ready;
      const { createArenaCore } = await import("./arenaCore");
      if (cancelled || !host.current) return;
      try {
        core.current = createArenaCore({
          container: host.current,
          teams: ORBIT_TEAMS,
          fontFamily,
          pickIndex: randomInt,
          onReady: () => !cancelled && setMode("3d"),
          onDrawStart: () => {
            setDrawing(true);
            setResult(null);
            play("whoosh");
          },
          onDrawEnd: (team) => {
            setDrawing(false);
            setResult(team);
            play("reveal");
          },
        });
      } catch {
        setMode("css"); // Sin contexto WebGL utilizable: se queda la versión CSS.
        setFullFallback(true);
      }
    };

    // Solo cuando la página terminó de cargar, el Hero es visible y el navegador está libre:
    // el 3D nunca compite con el contenido principal.
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500));
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      idleId = idle(() => void load(), { timeout: 4000 }) as number;
    });
    const observe = () => io.observe(el);
    if (document.readyState === "complete") observe();
    else window.addEventListener("load", observe, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", observe);
      io.disconnect();
      if (idleId !== undefined) window.cancelIdleCallback?.(idleId);
      core.current?.dispose();
      core.current = null;
    };
  }, []);

  const is3D = mode === "3d";

  return (
    <div className="relative mx-auto w-full max-w-[560px] lg:max-w-none" data-testid="hero-visual" data-mode={mode}>
      <div
        className="relative h-[260px] sm:h-[340px] lg:h-[520px]"
        role="img"
        aria-label="Balón de ARENA XI rodeado de anillos de energía y tarjetas de equipos en órbita, como un bombo de sorteo"
      >
        <motion.div className={`absolute inset-0 ${fullFallback ? "" : "lg:hidden"}`} animate={{ opacity: is3D ? 0 : 1 }} transition={{ duration: 0.6 }}>
          <HeroFallback teams={ORBIT_TEAMS} />
        </motion.div>
        {!fullFallback && (
          <div className={`absolute inset-0 hidden transition-opacity duration-700 lg:block ${is3D ? "opacity-0" : "opacity-100"}`} aria-hidden>
            <div className="absolute left-1/2 top-1/2 size-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(61_255_139/0.2),rgb(47_155_255/0.06)_45%,transparent_70%)]" />
          </div>
        )}
        <div ref={host} className={`absolute inset-0 transition-opacity duration-700 ${is3D ? "opacity-100" : "opacity-0"}`} />
      </div>

      {is3D && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-line bg-ink/80 px-4 py-2 text-sm backdrop-blur" aria-live="polite">
            <AnimatePresence mode="wait">
              {result ? (
                <motion.span key={result.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="font-semibold" data-testid="hero-draw-result">
                  Sorteo exprés: <span className="text-neon">{result.name}</span>
                </motion.span>
              ) : (
                <motion.span key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-soft">
                  {drawing ? "Sorteando..." : "Pulsa el balón para un sorteo exprés"}
                </motion.span>
              )}
            </AnimatePresence>
            <button
              onClick={() => core.current?.draw()}
              disabled={drawing}
              className="flex items-center gap-1 rounded-full bg-neon/15 px-3 py-1 font-display text-xs font-bold uppercase tracking-wider text-neon transition-colors hover:bg-neon hover:text-ink disabled:opacity-40"
              data-testid="hero-draw"
            >
              <Sparkles className="size-3.5" /> Sortear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
