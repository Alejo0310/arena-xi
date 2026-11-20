"use client";

import { useEffect, useRef } from "react";

/**
 * Fondo de estadio: focos de luz, líneas de campo y partículas flotantes.
 *
 * Rendimiento: las partículas se dibujan con un sprite de brillo prerenderizado
 * (en lugar de `shadowBlur`, que recalcula un desenfoque por partícula y fotograma),
 * a ~30 fps, solo cuando la pestaña es visible y tras la carga inicial
 * (requestIdleCallback). Con movimiento reducido no se anima nada.
 */
export function BackgroundFX() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvas.current;
    if (!c || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = 0;
    let w = 0;
    let h = 0;
    let started = false;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const sprites = [makeSprite("61,255,139"), makeSprite("47,155,255")];

    const resize = () => {
      w = c.clientWidth;
      h = c.clientHeight;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const count = Math.round(Math.min(window.innerWidth < 768 ? 18 : 40, (w * h) / 32000));
    const pts = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      s: Math.random() * 10 + 6,
      vy: -(Math.random() * 0.5 + 0.1),
      vx: (Math.random() - 0.5) * 0.25,
      sprite: Math.random() > 0.65 ? 1 : 0,
      a: Math.random() * 0.5 + 0.2,
    }));

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 33) return; // ~30 fps es suficiente para un fondo ambiental
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -20) {
          p.y = h + 20;
          p.x = Math.random() * w;
        }
        ctx.globalAlpha = p.a;
        ctx.drawImage(sprites[p.sprite], p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
      }
    };
    const start = () => {
      if (started || document.hidden) return;
      started = true;
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      started = false;
      cancelAnimationFrame(raf);
    };
    const onVis = () => (document.hidden ? stop() : start());

    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1200));
    const idleId = idle(start, { timeout: 2500 });
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      window.cancelIdleCallback?.(idleId as number);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div className="no-print pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="absolute -top-40 left-1/2 h-[560px] w-[1200px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgb(61_255_139/0.14),transparent_65%)]" />
      <div className="absolute -left-48 top-1/3 h-[560px] w-[560px] bg-[radial-gradient(circle,rgb(47_155_255/0.10),transparent_65%)]" />
      <div className="absolute -right-48 bottom-0 h-[520px] w-[520px] bg-[radial-gradient(circle,rgb(255_122_26/0.07),transparent_65%)]" />
      <div className="pitch-lines absolute inset-0" />
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
    </div>
  );
}

/** Punto de luz con halo, dibujado una sola vez en un canvas fuera de pantalla. */
function makeSprite(rgb: string): HTMLCanvasElement {
  const size = 32;
  const s = document.createElement("canvas");
  s.width = s.height = size;
  const g = s.getContext("2d")!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${rgb},1)`);
  grad.addColorStop(0.18, `rgba(${rgb},0.9)`);
  grad.addColorStop(0.4, `rgba(${rgb},0.25)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return s;
}
