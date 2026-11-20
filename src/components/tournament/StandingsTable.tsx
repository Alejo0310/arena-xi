"use client";

import { motion } from "motion/react";
import type { Tournament } from "@/lib/types";
import { computeStandings } from "@/lib/tournament/league";
import { getTeam } from "@/lib/teams";
import { TeamCrest } from "@/components/ui/TeamCrest";
import { PlayerDot } from "@/components/ui/bits";

const FORM = { W: "bg-neon text-ink", D: "bg-white/20 text-white", L: "bg-danger text-white" };
const FORM_LABEL = { W: "V", D: "E", L: "D" };

export function StandingsTable({ t, compact = false }: { t: Tournament; compact?: boolean }) {
  const rows = computeStandings(t.participants, t.matches, t.settings);
  const byId = new Map(t.participants.map((p) => [p.id, p]));
  const finished = t.phase === "finished";

  return (
    <div className="glass overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">Tabla de posiciones</caption>
          <thead>
            <tr className="border-b border-line text-left text-[0.68rem] font-bold uppercase tracking-widest text-mute">
              <th className="w-12 px-3 py-3 text-center">#</th>
              <th className="px-3 py-3">Participante</th>
              {!compact && <th className="px-3 py-3">Equipo</th>}
              <Th title="Partidos jugados">PJ</Th>
              <Th title="Ganados">G</Th>
              <Th title="Empatados">E</Th>
              <Th title="Perdidos">P</Th>
              <Th title="Goles a favor">GF</Th>
              <Th title="Goles en contra">GC</Th>
              <Th title="Diferencia de goles">DG</Th>
              <Th title="Puntos" className="text-white">PTS</Th>
              {!compact && <th className="hidden px-3 py-3 xl:table-cell">Forma</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const p = byId.get(r.participantId)!;
              const team = getTeam(t.assignments[p.id]);
              const first = i === 0;
              return (
                <motion.tr
                  key={r.participantId}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03, layout: { type: "spring", stiffness: 200, damping: 25 } }}
                  className={`border-b border-line/60 last:border-0 ${first ? "bg-gradient-to-r from-neon/10 to-transparent" : "hover:bg-white/[0.03]"}`}
                >
                  <td className="px-3 py-3 text-center">
                    <span className={`display num inline-grid size-7 place-items-center rounded-md text-base font-black ${first ? (finished ? "bg-gold text-ink" : "bg-neon text-ink") : i < 3 ? "bg-white/10" : "text-mute"}`}>{i + 1}</span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <PlayerDot color={p.color} />
                      <span className="font-semibold">{p.name}</span>
                      {compact && <TeamCrest team={team} size={22} />}
                    </div>
                  </td>
                  {!compact && (
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2 text-soft">
                        <TeamCrest team={team} size={24} />
                        <span className="truncate">{team?.name}</span>
                      </div>
                    </td>
                  )}
                  <Td>{r.played}</Td>
                  <Td>{r.won}</Td>
                  <Td>{r.drawn}</Td>
                  <Td>{r.lost}</Td>
                  <Td>{r.gf}</Td>
                  <Td>{r.ga}</Td>
                  <Td className={r.gd > 0 ? "text-neon" : r.gd < 0 ? "text-danger" : ""}>{r.gd > 0 ? `+${r.gd}` : r.gd}</Td>
                  <td className="display num px-3 py-3 text-center text-xl font-black">{r.points}</td>
                  {!compact && (
                    <td className="hidden px-3 py-3 xl:table-cell">
                      <div className="flex gap-1">
                        {r.form.slice(-5).map((f, k) => (
                          <span key={k} className={`grid size-5 place-items-center rounded text-[0.6rem] font-black ${FORM[f]}`} title={f === "W" ? "Victoria" : f === "D" ? "Empate" : "Derrota"}>{FORM_LABEL[f]}</span>
                        ))}
                      </div>
                    </td>
                  )}
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-4 py-2.5 text-xs text-mute">
        Victoria {t.settings.points.win} · Empate {t.settings.points.draw} · Derrota {t.settings.points.loss} pts. Desempate: {t.settings.tiebreak === "gd" ? "diferencia de goles, goles a favor, enfrentamiento directo" : "enfrentamiento directo, diferencia de goles, goles a favor"}.
      </p>
    </div>
  );
}

function Th({ children, title, className = "" }: { children: React.ReactNode; title: string; className?: string }) {
  return <th className={`w-12 px-2 py-3 text-center ${className}`}><abbr title={title} className="no-underline">{children}</abbr></th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`num px-2 py-3 text-center ${className}`}>{children}</td>;
}
