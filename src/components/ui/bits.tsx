"use client";

import { animate, motion, useInView, useMotionValue, useTransform } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Participant, Team } from "@/lib/types";
import { TeamCrest } from "./TeamCrest";

/** true una vez que el estado persistido (localStorage) está disponible en el cliente. */
export function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function AnimatedNumber({ value, decimals = 0, className = "" }: { value: number; decimals?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => v.toFixed(decimals));
  useEffect(() => {
    if (!inView) return;
    const c = animate(mv, value, { duration: 1.1, ease: [0.16, 1, 0.3, 1] });
    return () => c.stop();
  }, [inView, value, mv]);
  return <motion.span ref={ref} className={`num ${className}`}>{text}</motion.span>;
}

export function PlayerDot({ color, size = 10 }: { color: string; size?: number }) {
  return <span className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: color, boxShadow: `0 0 10px ${color}` }} aria-hidden />;
}

export function PlayerTag({ participant, team, compact = false, align = "left" }: { participant?: Participant; team?: Team; compact?: boolean; align?: "left" | "right" }) {
  if (!participant) return <span className="text-sm italic text-mute">Por definir</span>;
  return (
    <div className={`flex min-w-0 items-center gap-2.5 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      <TeamCrest team={team} size={compact ? 28 : 38} />
      <div className="min-w-0">
        <div className={`flex items-center gap-1.5 ${align === "right" ? "flex-row-reverse" : ""}`}>
          <PlayerDot color={participant.color} size={8} />
          <span className={`truncate font-semibold ${compact ? "text-sm" : ""}`}>{participant.name}</span>
        </div>
        {team && <div className="truncate text-xs text-mute">{team.name}</div>}
      </div>
    </div>
  );
}

export function SectionHeader({ kicker, title, children }: { kicker?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {kicker && <div className="kicker mb-1.5">{kicker}</div>}
        <h2 className="display text-3xl font-extrabold sm:text-4xl">{title}</h2>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function StatTile({ label, value, sub, accent = "text-white", icon }: { label: string; value: React.ReactNode; sub?: React.ReactNode; accent?: string; icon?: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="glass glass-hover relative overflow-hidden p-4"
    >
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-mute">
        <span>{label}</span>
        {icon}
      </div>
      <div className={`display mt-2 text-4xl font-extrabold ${accent}`}>{value}</div>
      {sub && <div className="mt-1 truncate text-sm text-soft">{sub}</div>}
    </motion.div>
  );
}

export function Loader({ label = "Cargando" }: { label?: string }) {
  return (
    <div className="grid min-h-[50vh] place-items-center" role="status">
      <div className="flex flex-col items-center gap-4">
        <div className="relative size-14">
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-neon/20 border-t-neon" />
          <div className="absolute inset-2 animate-spin rounded-full border-2 border-volt/20 border-b-volt [animation-direction:reverse] [animation-duration:1.4s]" />
        </div>
        <span className="kicker">{label}</span>
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: React.ReactNode; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="glass flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 grid size-16 place-items-center rounded-2xl bg-neon/10 text-neon">{icon}</div>
      <h3 className="display text-2xl font-bold">{title}</h3>
      {body && <p className="mt-2 max-w-md text-sm text-soft">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function RatingBar({ label, value, color = "bg-neon" }: { label: string; value: number; color?: string }) {
  const pct = Math.max(0, Math.min(1, (value - 60) / 35));
  // CSS puro: sin observador ni componente de Motion por barra (en /equipos hay 78).
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-8 font-semibold text-mute">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
        <div className={`h-full w-full origin-left rounded-full ${color} animate-[bar-grow_0.8s_cubic-bezier(0.16,1,0.3,1)]`} style={{ transform: `scaleX(${pct})` }} />
      </div>
      <span className="num w-6 text-right font-bold">{value}</span>
    </div>
  );
}

/** Reloj simple que se re-renderiza cada segundo mientras `active`. */
export function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [active]);
  return now;
}
