"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Timer } from "lucide-react";
import { useNow } from "@/components/ui/bits";
import { play as sfx } from "@/lib/sound";

/** Cronómetro de partido (cuenta atrás). Su estado es local a la pantalla. */
export function MatchTimer({ minutes, compact = false }: { minutes: number; compact?: boolean }) {
  const total = minutes * 60_000;
  const [elapsed, setElapsed] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const now = useNow(startedAt !== null);
  const used = elapsed + (startedAt ? now - startedAt : 0);
  const left = Math.max(0, total - used);
  const over = left === 0;
  const warned = useRef(false);

  useEffect(() => {
    if (over && startedAt && !warned.current) {
      warned.current = true;
      sfx("goal");
      setElapsed(total);
      setStartedAt(null);
    }
  }, [over, startedAt, total]);

  const toggle = () => {
    if (startedAt) {
      setElapsed(used);
      setStartedAt(null);
    } else if (!over) {
      setStartedAt(Date.now());
    }
  };
  const reset = () => {
    setElapsed(0);
    setStartedAt(null);
    warned.current = false;
  };

  const mm = Math.floor(left / 60000).toString().padStart(2, "0");
  const ss = Math.floor((left % 60000) / 1000).toString().padStart(2, "0");
  const pct = (used / total) * 100;

  return (
    <div className={`flex items-center gap-3 ${compact ? "" : "glass p-4"}`}>
      <Timer className={`size-5 ${startedAt ? "animate-pulse text-blaze" : "text-mute"}`} />
      <div className="flex-1">
        <div className={`display num font-black ${compact ? "text-3xl" : "text-5xl"} ${over ? "text-danger" : startedAt ? "text-white" : "text-soft"}`} aria-live="off">
          {mm}:{ss}
        </div>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/5">
          <div className="h-full bg-blaze transition-[width] duration-300" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      </div>
      <button onClick={toggle} disabled={over} className="grid size-10 place-items-center rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30" aria-label={startedAt ? "Pausar cronómetro" : "Iniciar cronómetro"}>
        {startedAt ? <Pause className="size-5" /> : <Play className="size-5" />}
      </button>
      <button onClick={reset} className="grid size-10 place-items-center rounded-lg bg-white/5 hover:bg-white/10" aria-label="Reiniciar cronómetro">
        <RotateCcw className="size-4" />
      </button>
    </div>
  );
}
