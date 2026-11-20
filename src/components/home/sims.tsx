"use client";

/*
 * Simulaciones de demostración de las 5 modalidades de sorteo del Home.
 *
 * Son totalmente independientes del sorteo real: no leen ni escriben el store de torneos, no usan
 * useDrawController y sus resultados se guardan solo en estado local del componente. Cada simulación
 * decide su resultado ANTES de animar (igual que el sorteo real) y la animación solo lo revela, de modo
 * que el sector, sobre, bola o carta mostrados siempre coinciden con el resultado final.
 */

import { animate, motion, useMotionValue } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Disc3, PackageOpen, Sparkles, Swords } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TeamCrest } from "@/components/ui/TeamCrest";
import { fmtRating } from "@/lib/teams";
import { randomInt, sample, shuffle } from "@/lib/random";
import type { Team } from "@/lib/types";

export interface SimProps {
  teams: Team[];
  /** Equipos con valoración (solo los bombos). */
  rated: Team[];
}

type Phase = "idle" | "running" | "done";

/** Controla el ciclo idle → running → done y descarta resultados de ejecuciones anteriores o desmontadas. */
function useRun() {
  const [phase, setPhase] = useState<Phase>("idle");
  const run = useRef(0);
  useEffect(() => () => void (run.current = -1), []);
  const begin = useCallback(() => {
    run.current += 1;
    setPhase("running");
    return run.current;
  }, []);
  const alive = useCallback((id: number) => run.current === id, []);
  const finish = useCallback((id: number) => {
    if (run.current === id) setPhase("done");
  }, []);
  return { phase, begin, alive, finish };
}

function ResultCard({ team, caption }: { team: Team; caption?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 18 }}
      className="glass relative flex items-center gap-4 overflow-hidden !border-neon/50 p-4 shadow-[0_0_50px_-12px_#3dff8b]"
      data-testid="sim-result"
      role="status"
    >
      <div aria-hidden className="absolute inset-0 animate-sweep bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <TeamCrest team={team} size={64} />
      <div className="relative min-w-0">
        {caption && <div className="text-[0.65rem] font-bold uppercase tracking-[0.25em] text-neon">{caption}</div>}
        <div className="display truncate text-3xl font-black">{team.name}</div>
        <div className="truncate text-xs text-mute">{team.league} · {team.country}</div>
      </div>
      <div className="relative ml-auto text-right">
        <div className="display text-5xl font-black leading-none text-neon">{fmtRating(team.ovr)}</div>
        <div className="text-[0.6rem] font-bold uppercase tracking-widest text-mute">Media</div>
      </div>
    </motion.div>
  );
}

const hexN = (hex: string) => parseInt(hex.slice(1), 16);
const textOn = (hex: string) => {
  const n = hexN(hex);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 150 ? "#05070a" : "#ffffff";
};
const dim = (hex: string) => {
  const n = hexN(hex);
  const f = (c: number) => Math.round(c * 0.72);
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

/* ---------------------------------- RULETA ---------------------------------- */

export function RouletteSim({ teams }: SimProps) {
  const { phase, begin, alive, finish } = useRun();
  const rotation = useMotionValue(0);
  const [result, setResult] = useState<Team | null>(null);
  const n = teams.length;
  const seg = 360 / n;
  const R = 150;

  const spin = async () => {
    const id = begin();
    setResult(null);
    const idx = randomInt(n); // el resultado se decide primero
    const target = 360 - (idx * seg + seg / 2) + (Math.random() - 0.5) * seg * 0.6;
    const base = rotation.get() - (rotation.get() % 360);
    await animate(rotation, base + 360 * 5 + target, { duration: 4.2, ease: [0.15, 0.85, 0.12, 1] });
    if (!alive(id)) return;
    setResult(teams[idx]);
    finish(id);
  };

  return (
    <div className="grid items-center gap-6 md:grid-cols-[auto_1fr]">
      <div className="relative mx-auto">
        <div className="absolute left-1/2 top-[-12px] z-10 -translate-x-1/2" aria-hidden>
          <svg width="30" height="38" viewBox="0 0 36 44"><path d="M18 44 L2 6 Q18 -4 34 6 Z" fill="#3dff8b" stroke="#05070a" strokeWidth="3" /></svg>
        </div>
        <motion.svg viewBox={`${-R - 8} ${-R - 8} ${2 * R + 16} ${2 * R + 16}`} className="size-[min(72vw,320px)] will-change-transform" style={{ rotate: rotation }} role="img" aria-label={`Ruleta de ejemplo con ${n} equipos`}>
          <circle r={R + 6} fill="#0b0e13" stroke="#3dff8b" strokeOpacity="0.4" strokeWidth="2" />
          {teams.map((t, i) => {
            const a0 = ((i * seg - 90) * Math.PI) / 180;
            const a1 = (((i + 1) * seg - 90) * Math.PI) / 180;
            return (
              <g key={t.id}>
                <path d={`M0 0 L${R * Math.cos(a0)} ${R * Math.sin(a0)} A${R} ${R} 0 0 1 ${R * Math.cos(a1)} ${R * Math.sin(a1)} Z`} fill={i % 2 ? t.colors[0] : dim(t.colors[0])} stroke="#05070a" strokeWidth="1.5" />
                <g transform={`rotate(${i * seg + seg / 2}) translate(0 ${-R * 0.68})`}>
                  <text textAnchor="middle" dominantBaseline="middle" fontFamily="var(--font-saira)" fontWeight="900" fontSize="17" fill={textOn(t.colors[0])} stroke="#05070a" strokeWidth="0.5" paintOrder="stroke">{t.short}</text>
                </g>
              </g>
            );
          })}
          <circle r="28" fill="#05070a" stroke="#3dff8b" strokeWidth="3" />
          <circle r="8" fill="#3dff8b" />
        </motion.svg>
      </div>
      <div className="space-y-4">
        <Button size="lg" onClick={spin} disabled={phase === "running"} data-testid="sim-action">
          <Disc3 className={`size-5 ${phase === "running" ? "animate-spin" : ""}`} /> {phase === "running" ? "Girando..." : phase === "done" ? "Girar otra vez" : "GIRAR RULETA"}
        </Button>
        <div className="min-h-[96px]">{result && <ResultCard team={result} caption="Equipo sorteado" />}</div>
      </div>
    </div>
  );
}

/* ---------------------------------- SOBRES ---------------------------------- */

const ENVELOPES = 5;

export function EnvelopesSim({ teams }: SimProps) {
  const { phase, begin, alive, finish } = useRun();
  const [hidden] = useState(() => sample(teams, Math.min(ENVELOPES, teams.length))); // equipo oculto en cada sobre
  const [opened, setOpened] = useState<number | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  const open = (i: number) => {
    if (phase !== "idle") return;
    const id = begin();
    setOpened(i);
    window.setTimeout(() => {
      if (!alive(id)) return;
      setCelebrate(true);
      finish(id);
    }, 900);
  };

  return (
    <div className="space-y-5">
      <p className="text-center text-sm text-mute" aria-live="polite">{phase === "idle" ? "Elige un sobre para abrirlo" : phase === "running" ? "Abriendo…" : "¡Sobre abierto!"}</p>
      <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
        {hidden.map((t, i) => {
          const isOpen = opened === i;
          return (
            <motion.button
              key={t.id}
              type="button"
              data-testid="sim-envelope"
              onClick={() => open(i)}
              disabled={phase !== "idle"}
              aria-label={`Sobre ${i + 1}`}
              animate={{ y: isOpen ? -12 : 0, opacity: opened !== null && !isOpen ? 0.35 : 1, scale: isOpen ? 1.08 : 1 }}
              whileHover={phase === "idle" ? { y: -8, rotate: i % 2 ? 2 : -2 } : undefined}
              className="relative h-32 w-24 rounded-xl border border-neon/30 bg-gradient-to-br from-slate to-graphite shadow-lg sm:h-40 sm:w-28"
            >
              <div className="absolute inset-0 grid place-items-center">
                {isOpen && celebrate ? <TeamCrest team={t} size={56} /> : <PackageOpen className="size-9 text-neon/70" />}
              </div>
              <motion.div
                aria-hidden
                className="absolute inset-x-0 top-0 h-1/2 origin-top rounded-t-xl bg-gradient-to-b from-neon/30 to-transparent [clip-path:polygon(0_0,100%_0,50%_100%)]"
                animate={{ rotateX: isOpen ? 180 : 0 }}
                transition={{ duration: 0.5 }}
              />
              {isOpen && <motion.div aria-hidden className="absolute -inset-2 rounded-2xl bg-neon/20 blur-xl" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.4] }} transition={{ duration: 0.9 }} />}
              <span className="absolute bottom-2 left-0 right-0 text-center text-[0.6rem] font-bold uppercase tracking-widest text-mute">{i + 1}</span>
            </motion.button>
          );
        })}
      </div>
      <div className="min-h-[96px]">
        {opened !== null && celebrate && <ResultCard team={hidden[opened]} caption="Dentro del sobre" />}
        {celebrate && (
          <div className="pointer-events-none mt-2 flex justify-center gap-1 text-neon" aria-hidden>
            {Array.from({ length: 7 }, (_, k) => <motion.span key={k} initial={{ opacity: 0, y: 0 }} animate={{ opacity: [0, 1, 0], y: -26 - k * 4 }} transition={{ duration: 1.1, delay: k * 0.06 }}><Sparkles className="size-4" /></motion.span>)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- TÓMBOLA ---------------------------------- */

const BALL_COLORS = ["#3dff8b", "#2f9bff", "#ff7a1a", "#ffd23d", "#1de9d6", "#ff4f6d", "#c084fc", "#f5f5f5"];

export function MachineSim({ teams }: SimProps) {
  const { phase, begin, alive, finish } = useRun();
  const balls = teams.slice(0, 8);
  const [layout] = useState(() => balls.map(() => ({ x: [0, 1, 2].map(() => Math.random() * 70 - 35), y: [0, 1, 2].map(() => Math.random() * 60 - 25), d: 1.1 + Math.random() * 0.9 })));
  const [out, setOut] = useState<number | null>(null);
  const [result, setResult] = useState<Team | null>(null);

  const draw = () => {
    const id = begin();
    setOut(null);
    setResult(null);
    const idx = randomInt(balls.length); // la bola extraída se decide primero
    window.setTimeout(() => {
      if (!alive(id)) return;
      setOut(idx);
      window.setTimeout(() => {
        if (!alive(id)) return;
        setResult(balls[idx]);
        finish(id);
      }, 1100);
    }, 1800);
  };

  const mixing = phase === "running" && out === null;
  return (
    <div className="grid items-center gap-6 md:grid-cols-[auto_1fr]">
      <div className="relative mx-auto h-[300px] w-[min(80vw,280px)]">
        <div className="absolute inset-x-0 top-0 mx-auto size-[min(80vw,250px)] overflow-hidden rounded-full border-2 border-white/20 bg-[radial-gradient(circle_at_30%_25%,rgb(255_255_255/0.14),rgb(255_255_255/0.02)_60%)] shadow-[inset_0_0_40px_rgb(0_0_0/0.6),0_0_40px_-10px_#2f9bff]">
          {balls.map((t, i) => (
            <motion.div
              key={t.id}
              data-testid="sim-ball"
              className="absolute left-1/2 top-1/2 grid size-11 place-items-center rounded-full font-display text-sm font-black text-ink shadow-[inset_-4px_-4px_8px_rgb(0_0_0/0.35),inset_3px_3px_6px_rgb(255_255_255/0.5)]"
              style={{ background: BALL_COLORS[i % BALL_COLORS.length], marginLeft: -22, marginTop: -22 }}
              animate={out === i ? { x: 0, y: 190, scale: 1.25, opacity: 1 } : mixing ? { x: layout[i].x, y: layout[i].y, rotate: [0, 120, 240] } : { x: layout[i].x[0] * 0.6, y: 40 + layout[i].y[0] * 0.3, rotate: 0, opacity: out === null ? 1 : 0.6 }}
              transition={out === i ? { duration: 0.9, ease: "easeIn" } : mixing ? { duration: layout[i].d, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" } : { duration: 0.5 }}
            >
              {i + 1}
            </motion.div>
          ))}
        </div>
        <div aria-hidden className="absolute bottom-0 left-1/2 h-10 w-16 -translate-x-1/2 rounded-b-xl border-2 border-t-0 border-white/20 bg-black/40" />
      </div>
      <div className="space-y-4">
        <Button size="lg" onClick={draw} disabled={phase === "running"} data-testid="sim-action">
          <Disc3 className={`size-5 ${phase === "running" ? "animate-spin" : ""}`} /> {phase === "running" ? "Mezclando…" : phase === "done" ? "Sortear otra bola" : "SORTEAR BOLA"}
        </Button>
        <div className="min-h-[96px]">{result && out !== null && <ResultCard team={result} caption={`Bola n.º ${out + 1}`} />}</div>
      </div>
    </div>
  );
}

/* ----------------------------------- DRAFT ----------------------------------- */

export function DraftSim({ teams }: SimProps) {
  const { phase, begin, alive, finish } = useRun();
  const [options] = useState(() => sample(teams, 3));
  const [chosen, setChosen] = useState<number | null>(null);

  const choose = (i: number) => {
    if (phase !== "idle") return;
    const id = begin();
    setChosen(i);
    window.setTimeout(() => alive(id) && finish(id), 700);
  };

  return (
    <div className="space-y-5">
      <p className="text-center text-sm text-mute" aria-live="polite">{chosen === null ? "Elige una de las tres cartas" : phase === "done" ? "Elección confirmada" : "Confirmando…"}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {options.map((t, i) => {
          const active = chosen === i;
          return (
            <motion.button
              key={t.id}
              type="button"
              data-testid="sim-card"
              onClick={() => choose(i)}
              disabled={phase !== "idle"}
              aria-label={`Elegir ${t.name}, media ${fmtRating(t.ovr)}`}
              initial={{ opacity: 0, y: 20, rotateY: 90 }}
              animate={{ opacity: chosen !== null && !active ? 0.3 : 1, y: active ? -10 : 0, rotateY: 0, scale: active ? 1.05 : 1 }}
              transition={{ delay: chosen === null ? i * 0.12 : 0 }}
              whileHover={phase === "idle" ? { y: -8 } : undefined}
              className={`glass flex flex-col items-center gap-2 p-5 text-center ${active ? "!border-neon shadow-[0_0_40px_-8px_#3dff8b]" : ""}`}
            >
              <div className="display text-5xl font-black leading-none">{fmtRating(t.ovr)}</div>
              <TeamCrest team={t} size={64} />
              <div className="display text-xl font-extrabold">{t.name}</div>
              <div className="text-xs text-mute">{t.league}</div>
            </motion.button>
          );
        })}
      </div>
      <div className="min-h-[24px] text-center font-display text-lg font-bold text-neon" aria-live="polite">
        {phase === "done" && chosen !== null && <>¡Te quedas con {options[chosen].name}!</>}
      </div>
    </div>
  );
}

/* ----------------------------------- BOMBOS ----------------------------------- */

export function PotsSim({ rated }: SimProps) {
  const { phase, begin, alive, finish } = useRun();
  // 3 bombos de 4 equipos, de mayor a menor valoración (equipos de nivel similar juntos).
  const [pots] = useState<Team[][]>(() => {
    const sorted = [...rated].sort((a, b) => (b.ovr ?? 0) - (a.ovr ?? 0));
    return [sorted.slice(0, 4), sorted.slice(4, 8), sorted.slice(8, 12)];
  });
  const [draw, setDraw] = useState<{ a: Team; b: Team; potA: number; potB: number } | null>(null);
  const [step, setStep] = useState(0);

  const run = () => {
    const id = begin();
    setDraw(null);
    setStep(0);
    // Dos bombos distintos; un equipo de cada uno (nunca el mismo).
    const [pa, pb] = shuffle([0, 1, 2]).slice(0, 2).sort();
    const a = pots[pa][randomInt(pots[pa].length)];
    const b = pots[pb][randomInt(pots[pb].length)];
    setDraw({ a, b, potA: pa, potB: pb });
    window.setTimeout(() => alive(id) && setStep(1), 900);
    window.setTimeout(() => alive(id) && setStep(2), 1900);
    window.setTimeout(() => alive(id) && (setStep(3), finish(id)), 2700);
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {pots.map((p, i) => (
          <div key={i} className="glass p-3">
            <div className="display mb-2 flex items-center justify-between text-lg font-bold">
              <span>Bombo {i + 1}</span>
              <span className="num text-xs text-neon">OVR {p[p.length - 1].ovr}–{p[0].ovr}</span>
            </div>
            <ul className="space-y-1">
              {p.map((t) => {
                const hit = draw && ((step >= 1 && draw.a.id === t.id) || (step >= 2 && draw.b.id === t.id));
                return (
                  <li key={t.id} className={`flex items-center gap-2 rounded-lg px-2 py-1 text-sm transition-colors ${hit ? "bg-neon/15 font-bold text-white" : "text-soft"}`}>
                    <TeamCrest team={t} size={22} />
                    <span className="truncate">{t.name}</span>
                    <span className="num ml-auto text-xs text-mute">{t.ovr}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button size="lg" onClick={run} disabled={phase === "running"} data-testid="sim-action">
          <Swords className="size-5" /> {phase === "running" ? "Sorteando…" : phase === "done" ? "Sortear otro duelo" : "SORTEAR DUELO"}
        </Button>
        <span className="text-xs text-mute">Se extrae un equipo de dos bombos distintos.</span>
      </div>
      <div className="min-h-[96px]" aria-live="polite">
        {draw && step >= 1 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass flex flex-wrap items-center justify-center gap-4 p-4" data-testid="sim-result" role="status">
            <Side team={draw.a} pot={draw.potA} />
            <span className="display text-3xl font-black italic text-neon">{step >= 2 ? "VS" : "…"}</span>
            {step >= 2 ? <Side team={draw.b} pot={draw.potB} /> : <div className="grid h-16 w-40 place-items-center rounded-xl border border-dashed border-line text-mute">Bombo {draw.potB + 1}…</div>}
          </motion.div>
        )}
      </div>
    </div>
  );
}

function Side({ team, pot }: { team: Team; pot: number }) {
  return (
    <div className="flex items-center gap-3">
      <TeamCrest team={team} size={48} />
      <div>
        <div className="text-[0.6rem] font-bold uppercase tracking-widest text-neon">Bombo {pot + 1}</div>
        <div className="display text-xl font-extrabold">{team.name}</div>
        <div className="num text-xs text-mute">OVR {fmtRating(team.ovr)}</div>
      </div>
    </div>
  );
}
