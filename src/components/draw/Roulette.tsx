"use client";

import { animate, motion, useMotionValue } from "motion/react";
import { useRef } from "react";
import { Disc3 } from "lucide-react";
import { getTeam } from "@/lib/teams";
import { play } from "@/lib/sound";
import { prefersReducedMotion } from "@/lib/fx";
import { Button } from "@/components/ui/Button";
import { useSpinAnimation, type StageProps } from "./types";

/** Ruleta: el equipo ya está decidido al empezar a girar; la rueda se detiene sobre él. */
export default function Roulette(props: StageProps) {
  const { pool, phase, locked, actionLabel, onStart } = props;
  const rotation = useMotionValue(0);
  const lastSeg = useRef(-1);
  const n = pool.length;
  const seg = 360 / Math.max(n, 1);
  const spinning = phase === "spinning";

  useSpinAnimation(props, async (pick) => {
    const idx = Math.max(0, pool.indexOf(pick.teamId));
    const reduced = prefersReducedMotion();
    const current = rotation.get();
    // El puntero está arriba (0°): llevamos el centro del segmento elegido allí.
    const targetMod = 360 - (idx * seg + seg / 2);
    const jitter = (Math.random() - 0.5) * seg * 0.6;
    const base = current - (current % 360);
    play("whoosh");
    await animate(rotation, base + 360 * (reduced ? 1 : 6) + targetMod + jitter, {
      duration: reduced ? 0.3 : 5.2,
      ease: [0.15, 0.85, 0.12, 1],
      onUpdate: (v) => {
        const s = Math.floor((((v % 360) + 360) % 360) / seg);
        if (s !== lastSeg.current) {
          lastSeg.current = s;
          play("tick");
        }
      },
    });
  });

  const R = 160;
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative">
        <div className="absolute inset-0 -z-10 scale-110 rounded-full bg-[radial-gradient(circle,rgb(61_255_139/0.14),transparent_70%)]" />
        <div className="absolute left-1/2 top-[-14px] z-10 -translate-x-1/2">
          <svg width="36" height="44" viewBox="0 0 36 44" aria-hidden>
            <path d="M18 44 L2 6 Q18 -4 34 6 Z" fill="#3dff8b" stroke="#05070a" strokeWidth="3" />
          </svg>
        </div>
        <motion.svg
          viewBox={`${-R - 10} ${-R - 10} ${2 * R + 20} ${2 * R + 20}`}
          className="size-[min(84vw,400px)] will-change-transform"
          style={{ rotate: rotation }}
          role="img"
          aria-label={`Ruleta con ${n} equipos`}
        >
          <circle r={R + 8} fill="#0b0e13" stroke="#3dff8b" strokeOpacity="0.4" strokeWidth="2" />
          {pool.map((id, i) => {
            const t = getTeam(id)!;
            const a0 = ((i * seg - 90) * Math.PI) / 180;
            const a1 = (((i + 1) * seg - 90) * Math.PI) / 180;
            const large = seg > 180 ? 1 : 0;
            const path = n === 1 ? undefined : `M0 0 L${R * Math.cos(a0)} ${R * Math.sin(a0)} A${R} ${R} 0 ${large} 1 ${R * Math.cos(a1)} ${R * Math.sin(a1)} Z`;
            const mid = i * seg + seg / 2;
            return (
              <g key={id}>
                {path ? <path d={path} fill={i % 2 ? t.colors[0] : shadeHex(t.colors[0])} stroke="#05070a" strokeWidth="1.5" /> : <circle r={R} fill={t.colors[0]} />}
                <g transform={`rotate(${mid}) translate(0 ${-R * 0.68}) rotate(${n > 14 ? 90 : 0})`}>
                  <text textAnchor="middle" dominantBaseline="middle" fontFamily="var(--font-saira)" fontWeight="900" fontSize={n > 18 ? 11 : n > 10 ? 14 : 18} fill={textOn(t.colors[0])} stroke="#05070a" strokeWidth="0.5" paintOrder="stroke">
                    {t.short}
                  </text>
                </g>
              </g>
            );
          })}
          <circle r="34" fill="#05070a" stroke="#3dff8b" strokeWidth="3" />
          <circle r="10" fill="#3dff8b" />
        </motion.svg>
      </div>
      <Button size="lg" onClick={() => onStart()} disabled={locked || n === 0} data-testid="draw-action">
        <Disc3 className={`size-5 ${spinning ? "animate-spin" : ""}`} /> {spinning ? "Girando..." : actionLabel}
      </Button>
    </div>
  );
}

function shadeHex(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.round(c * 0.72);
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function textOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const l = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return l > 150 ? "#05070a" : "#ffffff";
}
