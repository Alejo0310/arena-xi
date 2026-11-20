"use client";

import { motion } from "motion/react";
import { Flame, Goal, Shield, Swords, Target, Trophy } from "lucide-react";
import type { Match, Tournament } from "@/lib/types";
import { computeStats } from "@/lib/tournament/stats";
import { getTeam } from "@/lib/teams";
import { AnimatedNumber, PlayerDot, StatTile } from "@/components/ui/bits";
import { TeamCrest } from "@/components/ui/TeamCrest";

export function StatsPanel({ t }: { t: Tournament }) {
  const s = computeStats(t.participants, t.matches);
  const byId = new Map(t.participants.map((p) => [p.id, p]));
  const name = (id?: string) => (id ? byId.get(id)?.name : undefined) ?? "—";
  const maxGf = Math.max(1, ...s.perParticipant.map((p) => p.gf));
  const score = (m?: Match) => (m ? `${name(m.homeId!)} ${m.homeGoals}-${m.awayGoals} ${name(m.awayId!)}` : "Sin datos");

  if (s.played === 0) {
    return <p className="glass p-8 text-center text-mute">Las estadísticas aparecerán cuando se registre el primer resultado.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile label="Máximo goleador" icon={<Goal className="size-4 text-neon" />} value={<AnimatedNumber value={s.topScorer?.gf ?? 0} />} sub={name(s.topScorer?.participantId)} accent="text-neon" />
        <StatTile label="Más victorias" icon={<Trophy className="size-4 text-gold" />} value={<AnimatedNumber value={s.mostWins?.won ?? 0} />} sub={name(s.mostWins?.participantId)} accent="text-gold" />
        <StatTile label="Mejor diferencia" icon={<Target className="size-4 text-volt" />} value={(s.bestGD?.gd ?? 0) > 0 ? `+${s.bestGD?.gd}` : (s.bestGD?.gd ?? 0)} sub={name(s.bestGD?.participantId)} accent="text-volt" />
        <StatTile label="Mayor goleada" icon={<Flame className="size-4 text-blaze" />} value={s.biggestWin ? `${Math.max(s.biggestWin.homeGoals!, s.biggestWin.awayGoals!)}-${Math.min(s.biggestWin.homeGoals!, s.biggestWin.awayGoals!)}` : "—"} sub={score(s.biggestWin)} accent="text-blaze" />
        <StatTile label="Partido con más goles" icon={<Swords className="size-4" />} value={s.highestScoring ? (s.highestScoring.homeGoals ?? 0) + (s.highestScoring.awayGoals ?? 0) : "—"} sub={score(s.highestScoring)} />
        <StatTile label="Valla menos vencida" icon={<Shield className="size-4 text-neon" />} value={s.bestDefense ? (s.bestDefense.ga / Math.max(1, s.bestDefense.played)).toFixed(1) : "—"} sub={`${name(s.bestDefense?.participantId)} · goles recibidos por partido`} />
      </div>

      <div className="glass p-5">
        <h3 className="kicker mb-4">Rendimiento por participante</h3>
        <div className="space-y-3">
          {s.perParticipant.map((p, i) => {
            const part = byId.get(p.participantId)!;
            const team = getTeam(t.assignments[part.id]);
            return (
              <motion.div key={p.participantId} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }} className="grid grid-cols-[minmax(0,180px)_1fr_auto] items-center gap-3 sm:grid-cols-[220px_1fr_auto]">
                <div className="flex min-w-0 items-center gap-2">
                  <TeamCrest team={team} size={26} />
                  <PlayerDot color={part.color} size={8} />
                  <span className="truncate font-semibold">{part.name}</span>
                </div>
                <div>
                  <div className="flex h-2.5 overflow-hidden rounded-full bg-white/5" title={`${p.won}V ${p.drawn}E ${p.lost}D`}>
                    {p.played > 0 && (
                      <>
                        <motion.div className="bg-neon" initial={{ width: 0 }} whileInView={{ width: `${(p.won / p.played) * 100}%` }} viewport={{ once: true }} transition={{ duration: 0.8 }} />
                        <motion.div className="bg-white/30" initial={{ width: 0 }} whileInView={{ width: `${(p.drawn / p.played) * 100}%` }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.1 }} />
                        <motion.div className="bg-danger/80" initial={{ width: 0 }} whileInView={{ width: `${(p.lost / p.played) * 100}%` }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.2 }} />
                      </>
                    )}
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/5">
                    <motion.div className="h-full bg-blaze" initial={{ width: 0 }} whileInView={{ width: `${(p.gf / maxGf) * 100}%` }} viewport={{ once: true }} transition={{ duration: 0.8 }} />
                  </div>
                </div>
                <div className="num text-right text-xs text-soft">
                  <span className="font-bold text-white">{p.won}</span>V {p.drawn}E {p.lost}D · <span className="text-blaze">{p.gf}</span> GF · {Math.round(p.winRate * 100)}%
                </div>
              </motion.div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-mute">
          <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-neon" /> Victorias</span>
          <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-white/30" /> Empates</span>
          <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-danger/80" /> Derrotas</span>
          <span className="flex items-center gap-1.5"><i className="h-1 w-3 rounded-full bg-blaze" /> Goles a favor</span>
          <span>Total: <b className="num text-white">{s.totalGoals}</b> goles · media <b className="num text-white">{s.avgGoals.toFixed(2)}</b> por partido</span>
        </div>
      </div>
    </div>
  );
}
