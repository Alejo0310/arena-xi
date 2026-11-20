"use client";

import { motion } from "motion/react";
import { Crown, Medal } from "lucide-react";
import type { Match, Tournament } from "@/lib/types";
import { getTeam } from "@/lib/teams";
import { matchWinner } from "@/lib/tournament/match";
import { TeamCrest } from "@/components/ui/TeamCrest";

/**
 * Cuadro de eliminatorias. Cada ronda es una columna; las llaves se centran
 * verticalmente con flex para que las líneas de conexión cuadren.
 */
export function Bracket({ t, onSelect }: { t: Tournament; onSelect?: (m: Match) => void }) {
  const main = t.matches.filter((m) => !m.isThirdPlace);
  const third = t.matches.find((m) => m.isThirdPlace);
  const rounds = [...new Set(main.map((m) => m.round))].sort((a, b) => a - b);
  const lastRound = rounds[rounds.length - 1];

  return (
    <div className="glass overflow-hidden p-4 sm:p-6">
      <div className="overflow-x-auto pb-4 scrollbar-thin">
        <div className="flex min-w-max gap-8">
          {rounds.map((r, ri) => {
            const ms = main.filter((m) => m.round === r).sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
            return (
              <div key={r} className="flex w-60 flex-col">
                <div className={`kicker mb-4 text-center ${r === lastRound ? "!text-gold" : ""}`}>{ms[0]?.label}</div>
                <div className="flex flex-1 flex-col">
                  {ms.map((m, mi) => (
                    <div key={m.id} className="relative flex flex-1 items-center py-2">
                      <BracketMatch t={t} m={m} delay={ri * 0.12 + mi * 0.04} onSelect={onSelect} isFinal={r === lastRound} />
                      {ri < rounds.length - 1 && (
                        <>
                          <span className="absolute -right-4 top-1/2 h-px w-4 bg-white/15" />
                          <span className={`absolute -right-4 w-px bg-white/15 ${mi % 2 === 0 ? "top-1/2 h-1/2" : "bottom-1/2 h-1/2"}`} />
                        </>
                      )}
                      {ri > 0 && <span className="absolute -left-4 top-1/2 h-px w-4 bg-white/15" />}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {third && (
        <div className="mt-4 max-w-xs border-t border-line pt-4">
          <div className="kicker mb-3 flex items-center gap-1.5 !text-blaze"><Medal className="size-3.5" /> Tercer puesto</div>
          <BracketMatch t={t} m={third} delay={0.3} onSelect={onSelect} />
        </div>
      )}
    </div>
  );
}

function BracketMatch({ t, m, delay, onSelect, isFinal }: { t: Tournament; m: Match; delay: number; onSelect?: (m: Match) => void; isFinal?: boolean }) {
  const winner = matchWinner(m);
  const byId = new Map(t.participants.map((p) => [p.id, p]));
  const row = (id: string | null, goals: number | null, pens: number | null | undefined) => {
    const p = id ? byId.get(id) : undefined;
    const team = getTeam(p && t.assignments[p.id]);
    const won = !!winner && winner === id;
    const lost = !!winner && !!id && winner !== id;
    return (
      <div className={`flex items-center gap-2 px-2.5 py-2 ${won ? "bg-neon/10" : ""} ${lost ? "opacity-45" : ""}`}>
        {p ? <TeamCrest team={team} size={22} /> : <span className="size-[22px] rounded border border-dashed border-line" />}
        <span className={`flex-1 truncate text-sm ${won ? "font-bold text-white" : "text-soft"}`}>
          {p ? p.name : m.isBye && m.round === 1 ? "BYE" : "Por definir"}
        </span>
        {pens != null && <span className="num text-[0.65rem] text-mute">({pens})</span>}
        <span className={`display num w-5 text-right text-lg font-black ${won ? "text-neon" : ""}`}>{m.isBye ? "" : goals ?? ""}</span>
        {won && isFinal && <Crown className="size-4 text-gold" />}
      </div>
    );
  };
  const Comp = onSelect && !m.isBye ? motion.button : motion.div;
  return (
    <Comp
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      onClick={onSelect && !m.isBye ? () => onSelect(m) : undefined}
      className={`relative w-full overflow-hidden rounded-xl border bg-ink/70 text-left transition-colors ${isFinal ? "border-gold/50 shadow-[0_0_30px_-10px_#ffd23d]" : m.status === "live" ? "border-blaze/60" : "border-line"} ${onSelect && !m.isBye ? "hover:border-neon/50" : ""}`}
      aria-label={onSelect ? `Ver partido ${m.label}` : undefined}
    >
      {row(m.homeId, m.homeGoals, m.homePens)}
      <div className="h-px bg-line" />
      {row(m.awayId, m.awayGoals, m.awayPens)}
      {m.status === "live" && <span className="absolute right-1.5 top-1.5 size-1.5 animate-ping rounded-full bg-blaze" />}
    </Comp>
  );
}
