"use client";

import { forwardRef, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BarChart3, CalendarDays, Coffee, GitBranch, LayoutDashboard, ListOrdered, X } from "lucide-react";
import type { Match, Tournament } from "@/lib/types";
import { getTeam } from "@/lib/teams";
import { matchLoser, shootoutText } from "@/lib/tournament/match";
import { recentResults, upcomingMatches } from "@/lib/tournament/engine";
import { restingInRound } from "@/lib/tournament/league";
import { computeStats } from "@/lib/tournament/stats";
import { AnimatedNumber, PlayerDot, StatTile } from "@/components/ui/bits";
import { TeamCrest } from "@/components/ui/TeamCrest";
import { MatchCard } from "./MatchCard";
import { StandingsTable } from "./StandingsTable";
import { Bracket } from "./Bracket";
import { StatsPanel } from "./StatsPanel";
import { MatchTimer } from "./MatchTimer";
import { ChampionBanner } from "./Champion";
import { Portal } from "@/components/ui/Portal";

export type Tab = "overview" | "matches" | "table" | "stats";

export function useTabs(t: Tournament) {
  return [
    { id: "overview" as Tab, label: "Resumen", icon: LayoutDashboard },
    { id: "matches" as Tab, label: t.settings.format === "league" ? "Calendario" : "Partidos", icon: CalendarDays },
    { id: "table" as Tab, label: t.settings.format === "league" ? "Tabla" : "Llaves", icon: t.settings.format === "league" ? ListOrdered : GitBranch },
    { id: "stats" as Tab, label: "Estadísticas", icon: BarChart3 },
  ];
}

export function TabBar({ t, tab, setTab }: { t: Tournament; tab: Tab; setTab: (t: Tab) => void }) {
  const tabs = useTabs(t);
  return (
    <div className="no-print mb-6 flex gap-1 overflow-x-auto rounded-xl border border-line bg-ink/60 p-1 scrollbar-thin" role="tablist">
      {tabs.map((x) => (
        <button key={x.id} role="tab" aria-selected={tab === x.id} onClick={() => setTab(x.id)} className={`relative flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 font-display text-sm font-bold uppercase tracking-wider transition-colors ${tab === x.id ? "text-ink" : "text-soft hover:text-white"}`}>
          {tab === x.id && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-lg bg-neon" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
          <x.icon className="relative size-4" />
          <span className="relative">{x.label}</span>
        </button>
      ))}
    </div>
  );
}

export const TournamentBody = forwardRef<HTMLDivElement, { t: Tournament; tab: Tab; readOnly?: boolean; onReplayChampion?: () => void }>(function TournamentBody(
  { t, tab, readOnly = false, onReplayChampion },
  ref,
) {
  const [selected, setSelected] = useState<Match | null>(null);
  const live = selected ? t.matches.find((m) => m.id === selected.id) : null;

  return (
    <div ref={ref} className="print-area">
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
          {tab === "overview" && <Overview t={t} readOnly={readOnly} onReplayChampion={onReplayChampion} />}
          {tab === "matches" && <Matches t={t} readOnly={readOnly} />}
          {tab === "table" && (t.settings.format === "league" ? <StandingsTable t={t} /> : <Bracket t={t} onSelect={setSelected} />)}
          {tab === "stats" && <StatsPanel t={t} />}
        </motion.div>
      </AnimatePresence>

      <Portal><AnimatePresence>
        {live && (
          <motion.div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelected(null)}>
            <motion.div className="relative w-full max-w-xl" initial={{ scale: 0.94 }} animate={{ scale: 1 }} onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setSelected(null)} className="absolute -top-10 right-0 flex items-center gap-1 text-sm text-soft hover:text-white"><X className="size-4" /> Cerrar</button>
              <MatchCard t={t} m={live} readOnly={readOnly} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence></Portal>
    </div>
  );
});

function Overview({ t, readOnly, onReplayChampion }: { t: Tournament; readOnly: boolean; onReplayChampion?: () => void }) {
  const stats = useMemo(() => computeStats(t.participants, t.matches), [t.participants, t.matches]);
  const upcoming = upcomingMatches(t);
  const recent = recentResults(t, 6);
  const liveMatch = upcoming.find((m) => m.status === "live");
  const next = upcoming.filter((m) => m !== liveMatch).slice(0, 4);
  const knockout = t.settings.format === "knockout";
  const total = t.matches.filter((m) => !m.isBye).length;
  const progress = total ? (stats.played / total) * 100 : 0;
  const alive = knockout ? aliveIds(t) : [];
  const byId = new Map(t.participants.map((p) => [p.id, p]));

  return (
    <div className="space-y-6">
      {t.phase === "finished" && <ChampionBanner t={t} onReplay={onReplayChampion ?? (() => {})} />}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Modalidad" value={knockout ? "K.O." : "Liga"} sub={knockout ? `Eliminatorias${t.settings.thirdPlace && t.participants.length >= 4 ? " + 3.er puesto" : ""}` : `${t.settings.legs === 2 ? "Ida y vuelta" : "Solo ida"}`} />
        <StatTile label="Participantes" value={<AnimatedNumber value={t.participants.length} />} />
        <StatTile label="Disputados" value={<AnimatedNumber value={stats.played} />} sub={`de ${total} partidos`} accent="text-neon" />
        <StatTile label="Pendientes" value={<AnimatedNumber value={total - stats.played} />} accent="text-blaze" />
        <StatTile label={knockout ? "Siguen vivos" : "Goles"} value={<AnimatedNumber value={knockout ? alive.length : stats.totalGoals} />} sub={knockout ? undefined : `${stats.avgGoals.toFixed(1)} por partido`} accent="text-volt" />
      </div>

      <div className="glass p-4">
        <div className="mb-2 flex justify-between text-xs font-semibold uppercase tracking-widest text-mute">
          <span>Progreso del torneo</span>
          <span className="num">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/5">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-neon to-volt" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 1 }} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          {liveMatch && (
            <section>
              <h3 className="kicker mb-3 !text-blaze">● En juego</h3>
              <div className="space-y-3">
                <MatchCard t={t} m={liveMatch} readOnly={readOnly} />
                {!readOnly && <MatchTimer minutes={t.settings.matchMinutes} />}
              </div>
            </section>
          )}
          <section>
            <h3 className="kicker mb-3">Próximos enfrentamientos</h3>
            {next.length ? (
              <div className="space-y-3">{next.map((m) => <MatchCard key={m.id} t={t} m={m} readOnly={readOnly} />)}</div>
            ) : (
              <p className="glass p-6 text-center text-mute">{t.phase === "finished" ? "Todos los partidos se han disputado." : "No hay partidos listos para jugarse."}</p>
            )}
          </section>
        </div>

        <div className="min-w-0 space-y-6">
          {knockout ? (
            <section>
              <h3 className="kicker mb-3">Clasificados</h3>
              <div className="glass grid grid-cols-1 gap-2 p-4 min-[420px]:grid-cols-2">
                {t.participants.map((p) => {
                  const on = alive.includes(p.id);
                  return (
                    <div key={p.id} className={`flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${on ? "" : "opacity-35 line-through"}`}>
                      <TeamCrest team={getTeam(t.assignments[p.id])} size={22} />
                      <span className="truncate">{p.name}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : (
            <section>
              <h3 className="kicker mb-3">Clasificación</h3>
              <StandingsTable t={t} compact />
            </section>
          )}
          <section>
            <h3 className="kicker mb-3">Últimos resultados</h3>
            <div className="glass divide-y divide-line">
              {recent.length === 0 && <p className="p-5 text-center text-sm text-mute">Aún no hay resultados.</p>}
              {recent.map((m) => (
                <div key={m.id} className="px-3 py-3 text-sm sm:px-4" data-testid="recent-result">
                  <div className="mb-1.5 truncate text-[0.7rem] font-semibold uppercase tracking-wider text-mute sm:hidden">{m.label}</div>
                  <div className="flex items-center gap-2">
                    <span className="hidden w-20 shrink-0 truncate text-xs text-mute sm:block">{m.label}</span>
                    <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-right">
                      <span className="truncate">{byId.get(m.homeId!)?.name}</span>
                      <TeamCrest team={getTeam(t.assignments[m.homeId!])} size={20} />
                    </span>
                    <span className="w-16 shrink-0 text-center">
                      <span className="display num block text-lg font-black leading-tight">{m.homeGoals ?? "–"}-{m.awayGoals ?? "–"}</span>
                      {shootoutText(m) && <span className="num block text-[0.65rem] font-semibold uppercase leading-tight text-mute" data-testid="recent-pens">pen. {shootoutText(m)}</span>}
                    </span>
                    <span className="flex min-w-0 flex-1 items-center gap-1.5">
                      <TeamCrest team={getTeam(t.assignments[m.awayId!])} size={20} />
                      <span className="truncate">{byId.get(m.awayId!)?.name}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function aliveIds(t: Tournament): string[] {
  const out = new Set<string>();
  for (const m of t.matches) {
    if (m.isThirdPlace || m.status !== "done") continue;
    const l = matchLoser(m);
    if (l) out.add(l);
  }
  return t.participants.map((p) => p.id).filter((id) => !out.has(id));
}

function Matches({ t, readOnly }: { t: Tournament; readOnly: boolean }) {
  const [filter, setFilter] = useState<"all" | "pending" | "done">("all");
  const rounds = [...new Set(t.matches.map((m) => m.round))].sort((a, b) => a - b);
  const league = t.settings.format === "league";

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2">
        {([["all", "Todos"], ["pending", "Pendientes"], ["done", "Finalizados"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k} className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${filter === k ? "border-neon bg-neon/10 text-white" : "border-line text-soft hover:text-white"}`}>
            {l}
          </button>
        ))}
      </div>
      <div className="space-y-8">
        {rounds.map((r) => {
          const ms = t.matches
            .filter((m) => m.round === r)
            .filter((m) => (filter === "all" ? true : filter === "done" ? m.status === "done" : m.status !== "done"))
            .sort((a, b) => Number(!!a.isThirdPlace) - Number(!!b.isThirdPlace) || (a.slot ?? 0) - (b.slot ?? 0));
          if (!ms.length) return null;
          const resting = league ? restingInRound(t.participants, t.matches, r) : [];
          const labels = [...new Set(ms.map((m) => m.label))].join(" · ");
          return (
            <section key={r}>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <h3 className="display text-2xl font-extrabold">{labels}</h3>
                {resting.map((p) => (
                  <span key={p.id} className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-xs text-soft">
                    <Coffee className="size-3.5" /> <PlayerDot color={p.color} size={7} /> Descansa {p.name}
                  </span>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {ms.map((m) => <MatchCard key={m.id} t={t} m={m} readOnly={readOnly} />)}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
