import type { Match, Participant, Tournament } from "@/lib/types";
import { getTeam } from "@/lib/teams";
import { categoryLabel, editionInfo } from "@/lib/editions";
import { computeStandings } from "@/lib/tournament/league";
import { matchWinner, shootoutText } from "@/lib/tournament/match";
import { computeReport } from "@/lib/tournament/stats";
import { TeamCrest } from "@/components/ui/TeamCrest";
import { Logo } from "@/components/layout/Logo";
import { SITE_URL } from "@/lib/links";

/*
 * Informe del torneo para exportar (PNG y PDF). Es una vista ESTÁTICA, sin animaciones ni elementos
 * interactivos, con ancho fijo y la identidad de ARENA XI (fondo oscuro, verde neón, turquesa, azul).
 * No usa la clase .glass para que los estilos de impresión genéricos no la conviertan en blanco y negro.
 */

export const REPORT_WIDTH = 1000;

const card = "rounded-2xl border border-white/10 bg-[#0d1117] p-5";
const label = "text-[11px] font-bold uppercase tracking-[0.22em] text-[#8a94a6]";

export function TournamentReport({ t }: { t: Tournament }) {
  const r = computeReport(t);
  const byId = new Map(t.participants.map((p) => [p.id, p]));
  const name = (id?: string | null) => (id ? byId.get(id)?.name : undefined) ?? "—";
  const team = (id?: string | null) => (id ? getTeam(t.assignments[id], t.snapshot) : undefined);
  const knockout = t.settings.format === "knockout";
  const ed = editionInfo(t.settings.edition ?? "FC25");
  const champion = t.championId ? byId.get(t.championId) : undefined;
  const finished = t.phase === "finished";
  const date = new Date(t.finishedAt ?? t.updatedAt).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
  const mostCS = [...r.cleanSheets.entries()].sort((a, b) => b[1] - a[1])[0];
  const streak = [...r.bestStreak.entries()].sort((a, b) => b[1] - a[1])[0];
  const penKing = [...r.penaltyWins.entries()].sort((a, b) => b[1] - a[1])[0];
  const score = (m?: Match) => (m ? `${name(m.homeId)} ${m.homeGoals}-${m.awayGoals} ${name(m.awayId)}` : "—");
  const rounds = [...new Set(t.matches.map((m) => m.round))].sort((a, b) => a - b);
  const standings = knockout ? [] : computeStandings(t.participants, t.matches, t.settings);
  const podiumIds = knockout ? [r.podium?.first, r.podium?.second, r.podium?.third] : standings.slice(0, 3).map((s) => s.participantId);
  const maxRoundGoals = Math.max(1, ...r.goalsByRound.map((g) => g.goals));

  const kpis: [string, string | number, string?][] = [
    ["Partidos", r.played, `de ${t.matches.filter((m) => !m.isBye).length}`],
    ["Goles", r.totalGoals, `${r.avgGoals.toFixed(1)} por partido`],
    [knockout ? "Tandas de penaltis" : "Empates", knockout ? r.shootouts.length : r.draws],
    ["Victorias local / visitante", `${r.homeWins} / ${r.awayWins}`],
    ["Participantes", t.participants.length],
  ];

  const highlights: { title: string; value: string; sub: string; tone: string }[] = [
    { title: "Máximo goleador", value: `${r.topScorer?.gf ?? 0} goles`, sub: name(r.topScorer?.participantId), tone: "#3dff8b" },
    { title: "Más victorias", value: `${r.mostWins?.won ?? 0}`, sub: name(r.mostWins?.participantId), tone: "#ffd23d" },
    { title: "Mejor diferencia de goles", value: `${(r.bestGD?.gd ?? 0) > 0 ? "+" : ""}${r.bestGD?.gd ?? 0}`, sub: name(r.bestGD?.participantId), tone: "#2f9bff" },
    { title: "Valla menos vencida", value: r.bestDefense ? `${(r.bestDefense.ga / Math.max(1, r.bestDefense.played)).toFixed(1)} por partido` : "—", sub: name(r.bestDefense?.participantId), tone: "#1de9d6" },
    { title: "Mayor goleada", value: r.biggestWin ? `${Math.max(r.biggestWin.homeGoals!, r.biggestWin.awayGoals!)}-${Math.min(r.biggestWin.homeGoals!, r.biggestWin.awayGoals!)}` : "—", sub: score(r.biggestWin), tone: "#ff7a1a" },
    { title: "Partido con más goles", value: r.highestScoring ? `${(r.highestScoring.homeGoals ?? 0) + (r.highestScoring.awayGoals ?? 0)} goles` : "—", sub: score(r.highestScoring), tone: "#ff4f6d" },
    { title: "Porterías a cero", value: mostCS ? `${mostCS[1]}` : "0", sub: mostCS ? name(mostCS[0]) : "Ninguna", tone: "#3dff8b" },
    { title: "Mejor racha de victorias", value: streak ? `${streak[1]} seguidas` : "—", sub: streak ? name(streak[0]) : "—", tone: "#ffd23d" },
    ...(knockout
      ? [{ title: "Rey de los penaltis", value: penKing ? `${penKing[1]} tanda${penKing[1] > 1 ? "s" : ""} ganada${penKing[1] > 1 ? "s" : ""}` : "Sin tandas", sub: penKing ? name(penKing[0]) : "Ningún empate fue a penaltis", tone: "#c084fc" }]
      : [{ title: "Invictos", value: `${r.unbeaten.length}`, sub: r.unbeaten.map(name).slice(0, 3).join(", ") || "Ninguno", tone: "#c084fc" }]),
  ];

  return (
    <div
      className="report relative overflow-hidden text-white"
      style={{ width: REPORT_WIDTH, background: "radial-gradient(1200px 500px at 85% -5%, rgba(61,255,139,.16), transparent 60%), radial-gradient(900px 500px at -10% 25%, rgba(47,155,255,.14), transparent 60%), #05070a", fontFamily: "var(--font-barlow), system-ui, sans-serif" }}
      data-testid="report"
    >
      <div className="p-10">
        {/* Cabecera */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size={46} gradientId="arena-logo-report" />
            <div className="leading-none">
              <div className="display text-3xl font-black tracking-wide">ARENA <span className="text-[#3dff8b]">XI</span></div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-[#8a94a6]">Que gane el mejor</div>
            </div>
          </div>
          <div className="text-right">
            <div className={label}>Informe del torneo</div>
            <div className="mt-1 text-sm text-[#c5ccd8]">{date}</div>
          </div>
        </header>

        <div className="mt-8">
          <div className="text-xs font-bold uppercase tracking-[0.25em] text-[#3dff8b]">
            {knockout ? "Eliminatorias" : "Liga"} · {finished ? "Finalizado" : "En juego"} · {ed.label} · {categoryLabel(t.settings.category, t.settings.gender ?? "men")}
          </div>
          <h1 className="display mt-2 text-6xl font-black italic leading-none">{t.name}</h1>
        </div>

        {/* Campeón y podio */}
        {champion && (
          <section className="mt-8 rounded-3xl border border-[#ffd23d]/40 p-6" style={{ background: "linear-gradient(120deg, rgba(255,210,61,.16), rgba(255,210,61,.03) 60%, transparent)" }}>
            <div className="flex items-center gap-6">
              <svg viewBox="0 0 24 24" className="size-16 shrink-0 text-[#ffd23d]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold uppercase tracking-[0.3em] text-[#ffd23d]">{knockout ? "Campeón del torneo" : "Campeón de la liga"}</div>
                <div className="display mt-1 text-5xl font-black italic leading-tight text-[#ffd23d]">{champion.name}</div>
                <div className="mt-1 text-lg text-[#c5ccd8]">{team(champion.id)?.name}</div>
              </div>
              <TeamCrest team={team(champion.id)} size={96} />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/10 pt-5">
              {podiumIds.slice(0, 3).map((id, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="display grid size-9 shrink-0 place-items-center rounded-full text-lg font-black text-[#05070a]" style={{ background: ["#ffd23d", "#c5ccd8", "#ff9a4d"][i] }}>{i + 1}</span>
                  <TeamCrest team={team(id)} size={30} />
                  <div className="min-w-0 text-sm">
                    <div className="truncate font-semibold">{name(id)}</div>
                    <div className="truncate text-xs text-[#8a94a6]">{team(id)?.name}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Cifras generales */}
        <section className="mt-6 grid grid-cols-5 gap-3">
          {kpis.map(([k, v, sub]) => (
            <div key={k} className={card}>
              <div className={label}>{k}</div>
              <div className="display mt-2 text-4xl font-black text-[#3dff8b]">{v}</div>
              {sub && <div className="mt-0.5 text-xs text-[#8a94a6]">{sub}</div>}
            </div>
          ))}
        </section>

        {/* Datos destacados */}
        <ReportTitle>Datos destacados</ReportTitle>
        <section className="grid grid-cols-3 gap-3">
          {highlights.map((h) => (
            <div key={h.title} className={`${card} relative overflow-hidden`} style={{ breakInside: "avoid" }}>
              <div className="absolute inset-y-0 left-0 w-1" style={{ background: h.tone }} />
              <div className={label}>{h.title}</div>
              <div className="display mt-2 text-3xl font-black" style={{ color: h.tone }}>{h.value}</div>
              <div className="mt-1 truncate text-sm text-[#c5ccd8]">{h.sub}</div>
            </div>
          ))}
        </section>

        {/* Llaves o clasificación */}
        {knockout ? (
          <>
            <ReportTitle>Llaves del torneo</ReportTitle>
            <StaticBracket t={t} />
          </>
        ) : (
          <>
            <ReportTitle>Clasificación final</ReportTitle>
            <section className={`${card} !p-0 overflow-hidden`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-widest text-[#8a94a6]">
                    {["#", "Participante", "PJ", "G", "E", "P", "GF", "GC", "DG", "PTS"].map((h, i) => <th key={h} className={`px-3 py-2.5 ${i > 1 ? "text-center" : ""}`}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s, i) => (
                    <tr key={s.participantId} className="border-b border-white/5" style={{ breakInside: "avoid", background: i === 0 ? "rgba(255,210,61,.08)" : undefined }}>
                      <td className="px-3 py-2 font-bold">{i + 1}</td>
                      <td className="px-3 py-2"><span className="flex items-center gap-2"><TeamCrest team={team(s.participantId)} size={22} />{name(s.participantId)}</span></td>
                      {[s.played, s.won, s.drawn, s.lost, s.gf, s.ga, s.gd > 0 ? `+${s.gd}` : s.gd].map((v, k) => <td key={k} className="px-3 py-2 text-center text-[#c5ccd8]">{v}</td>)}
                      <td className="px-3 py-2 text-center font-black text-[#3dff8b]">{s.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}

        {/* Penaltis */}
        {r.shootouts.length > 0 && (
          <>
            <ReportTitle>Tandas de penaltis</ReportTitle>
            <section className="grid grid-cols-2 gap-3">
              {r.shootouts.map((s) => (
                <div key={s.match.id} className={card} style={{ breakInside: "avoid" }}>
                  <div className={label}>{s.match.label}</div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                    <span className={`min-w-0 flex-1 truncate text-right ${s.winnerId === s.match.homeId ? "font-bold text-white" : "text-[#8a94a6]"}`}>{s.home}</span>
                    <span className="text-center">
                      <span className="display block text-2xl font-black leading-none">{s.match.homeGoals}-{s.match.awayGoals}</span>
                      <span className="display block text-sm font-bold text-[#c084fc]">pen. {s.pens}</span>
                    </span>
                    <span className={`min-w-0 flex-1 truncate ${s.winnerId === s.match.awayId ? "font-bold text-white" : "text-[#8a94a6]"}`}>{s.away}</span>
                  </div>
                  <div className="mt-2 text-xs text-[#3dff8b]">Avanza {name(s.winnerId)}</div>
                </div>
              ))}
            </section>
          </>
        )}

        {/* Resultados */}
        <ReportTitle>Resultados</ReportTitle>
        <div className="space-y-4">
          {rounds.map((rd) => {
            const ms = t.matches.filter((m) => m.round === rd && !m.isBye).sort((a, b) => Number(!!a.isThirdPlace) - Number(!!b.isThirdPlace) || (a.slot ?? 0) - (b.slot ?? 0));
            if (!ms.length) return null;
            return (
              <section key={rd} className={`${card} !p-0 overflow-hidden`} style={{ breakInside: "avoid" }}>
                <div className="border-b border-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[#3dff8b]">{[...new Set(ms.map((m) => m.label))].join(" · ")}</div>
                {ms.map((m) => <ResultRow key={m.id} m={m} byId={byId} team={team} />)}
              </section>
            );
          })}
        </div>

        {/* Goles por ronda */}
        <ReportTitle>Goles por {knockout ? "ronda" : "jornada"}</ReportTitle>
        <section className={card} style={{ breakInside: "avoid" }}>
          <div className="space-y-2">
            {r.goalsByRound.map((g) => (
              <div key={g.round} className="flex items-center gap-3 text-sm">
                <span className="w-40 shrink-0 truncate text-[#c5ccd8]">{g.label}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full rounded-full" style={{ width: `${(g.goals / maxRoundGoals) * 100}%`, background: "linear-gradient(90deg,#3dff8b,#2f9bff)" }} />
                </div>
                <span className="display w-20 shrink-0 text-right text-lg font-black">{g.goals} <span className="text-xs font-semibold text-[#8a94a6]">/ {g.matches}p</span></span>
              </div>
            ))}
          </div>
        </section>

        {/* Rendimiento */}
        <ReportTitle>Rendimiento por participante</ReportTitle>
        <section className={`${card} !p-0 overflow-hidden`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-widest text-[#8a94a6]">
                {["Participante", "PJ", "G", "E", "P", "GF", "GC", "DG", "Port. a 0", "Pen. ganados"].map((h, i) => <th key={h} className={`px-3 py-2.5 ${i > 0 ? "text-center" : ""}`}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {r.perParticipant.map((s) => (
                <tr key={s.participantId} className="border-b border-white/5" style={{ breakInside: "avoid" }}>
                  <td className="px-3 py-2"><span className="flex items-center gap-2"><TeamCrest team={team(s.participantId)} size={22} /><span className={s.participantId === t.championId ? "font-bold text-[#ffd23d]" : ""}>{name(s.participantId)}</span></span></td>
                  {[s.played, s.won, s.drawn, s.lost, s.gf, s.ga, s.gd > 0 ? `+${s.gd}` : s.gd, r.cleanSheets.get(s.participantId) ?? 0, r.penaltyWins.get(s.participantId) ?? 0].map((v, k) => <td key={k} className="px-3 py-2 text-center text-[#c5ccd8]">{v}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Camino del campeón */}
        {champion && r.championPath.length > 0 && (
          <>
            <ReportTitle>El camino de {champion.name}</ReportTitle>
            <section className="space-y-2">
              {r.championPath.map((m) => {
                const rival = m.homeId === champion.id ? m.awayId : m.homeId;
                const mine = m.homeId === champion.id ? [m.homeGoals, m.awayGoals] : [m.awayGoals, m.homeGoals];
                const won = matchWinner(m) === champion.id;
                const pens = shootoutText(m);
                return (
                  <div key={m.id} className={`${card} flex items-center gap-4 !py-3`} style={{ breakInside: "avoid" }}>
                    <span className="w-32 shrink-0 text-xs font-bold uppercase tracking-widest text-[#8a94a6]">{m.label}</span>
                    <span className="min-w-0 flex-1 truncate">vs <b>{name(rival)}</b></span>
                    <span className="display text-2xl font-black">{mine[0]}-{mine[1]}</span>
                    {pens && <span className="text-xs font-bold text-[#c084fc]">pen. {m.homeId === champion.id ? pens : pens.split("-").reverse().join("-")}</span>}
                    <span className="w-24 text-right text-xs font-bold uppercase tracking-wider" style={{ color: won ? "#3dff8b" : "#c5ccd8" }}>{won ? "Victoria" : "Empate"}</span>
                  </div>
                );
              })}
            </section>
          </>
        )}

        {/* Pie */}
        <footer className="mt-10 flex items-end justify-between gap-6 border-t border-white/10 pt-5 text-xs text-[#8a94a6]">
          <div className="max-w-[560px]">
            Informe generado con ARENA XI · {SITE_URL.replace("https://", "")}. Proyecto independiente, sin afiliación, patrocinio ni respaldo oficial de EA SPORTS o Electronic Arts. EA SPORTS FC es una marca de Electronic Arts.
          </div>
          <div className="display text-lg font-black tracking-wide text-white">ARENA <span className="text-[#3dff8b]">XI</span></div>
        </footer>
      </div>
    </div>
  );
}

function ReportTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="display mb-3 mt-9 flex items-center gap-3 text-2xl font-extrabold uppercase tracking-wide" style={{ breakAfter: "avoid" }}>
      <span className="h-6 w-1.5 rounded-full" style={{ background: "linear-gradient(#3dff8b,#2f9bff)" }} />
      {children}
    </h2>
  );
}

function ResultRow({ m, byId, team }: { m: Match; byId: Map<string, Participant>; team: (id?: string | null) => ReturnType<typeof getTeam> }) {
  const w = matchWinner(m);
  const pens = shootoutText(m);
  const side = (id: string | null, align: "right" | "left") => {
    const p = id ? byId.get(id) : undefined;
    const lost = !!w && id !== w;
    return (
      <span className={`flex min-w-0 flex-1 items-center gap-2 ${align === "right" ? "justify-end text-right" : ""} ${lost ? "opacity-50" : ""}`}>
        {align === "left" && <TeamCrest team={team(id)} size={22} />}
        <span className={`truncate ${w && id === w ? "font-bold" : ""}`}>{p?.name ?? "—"}</span>
        {align === "right" && <TeamCrest team={team(id)} size={22} />}
      </span>
    );
  };
  return (
    <div className="flex items-center gap-3 border-b border-white/5 px-4 py-2.5 text-sm last:border-0">
      {side(m.homeId, "right")}
      <span className="w-20 shrink-0 text-center">
        <span className="display block text-xl font-black leading-tight">{m.homeGoals ?? "–"}-{m.awayGoals ?? "–"}</span>
        {pens && <span className="display block text-[11px] font-bold uppercase leading-tight text-[#c084fc]">pen. {pens}</span>}
        {m.walkover && <span className="block text-[10px] font-bold uppercase text-[#8a94a6]">W.O.</span>}
      </span>
      {side(m.awayId, "left")}
    </div>
  );
}

/** Cuadro de eliminatorias estático: cada ronda es una columna, el ganador va resaltado y se ven los penaltis. */
function StaticBracket({ t }: { t: Tournament }) {
  const main = t.matches.filter((m) => !m.isThirdPlace);
  const third = t.matches.find((m) => m.isThirdPlace);
  const rounds = [...new Set(main.map((m) => m.round))].sort((a, b) => a - b);
  const last = rounds[rounds.length - 1];
  const byId = new Map(t.participants.map((p) => [p.id, p]));
  const colW = Math.floor((REPORT_WIDTH - 80 - (rounds.length - 1) * 28) / rounds.length);

  const matchBox = (m: Match, final = false) => {
    const w = matchWinner(m);
    const row = (id: string | null, goals: number | null, pens: number | null | undefined) => {
      const p = id ? byId.get(id) : undefined;
      const won = !!w && w === id;
      return (
        <div className="flex items-center gap-2 px-2.5 py-1.5" style={{ background: won ? "rgba(61,255,139,.12)" : undefined, opacity: w && !won && id ? 0.5 : 1 }}>
          {p ? <TeamCrest team={getTeam(t.assignments[p.id], t.snapshot)} size={20} /> : <span className="size-5 rounded border border-dashed border-white/20" />}
          <span className={`min-w-0 flex-1 truncate text-xs ${won ? "font-bold text-white" : "text-[#c5ccd8]"}`}>{p ? p.name : m.isBye ? "BYE" : "Por definir"}</span>
          {pens != null && goals === (id === m.homeId ? m.awayGoals : m.homeGoals) && <span className="text-[10px] font-bold text-[#c084fc]">({pens})</span>}
          <span className={`display w-4 text-right text-base font-black ${won ? "text-[#3dff8b]" : ""}`}>{m.isBye ? "" : goals ?? ""}</span>
        </div>
      );
    };
    return (
      <div className="w-full overflow-hidden rounded-xl border" style={{ borderColor: final ? "rgba(255,210,61,.55)" : "rgba(255,255,255,.12)", background: "#0b0e13", boxShadow: final ? "0 0 28px -10px #ffd23d" : undefined }}>
        {row(m.homeId, m.homeGoals, m.homePens)}
        <div className="h-px bg-white/10" />
        {row(m.awayId, m.awayGoals, m.awayPens)}
      </div>
    );
  };

  return (
    <section className={`${card} !p-6`} style={{ breakInside: "avoid" }}>
      <div className="flex" style={{ gap: 28 }}>
        {rounds.map((r, ri) => {
          const ms = main.filter((m) => m.round === r).sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
          return (
            <div key={r} className="flex flex-col" style={{ width: colW }}>
              <div className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: r === last ? "#ffd23d" : "#3dff8b" }}>{ms[0]?.label}</div>
              <div className="flex flex-1 flex-col">
                {ms.map((m, mi) => (
                  <div key={m.id} className="relative flex flex-1 items-center py-1.5">
                    {matchBox(m, r === last)}
                    {ri < rounds.length - 1 && (
                      <>
                        <span className="absolute top-1/2 h-px bg-white/20" style={{ right: -14, width: 14 }} />
                        <span className={`absolute w-px bg-white/20 ${mi % 2 === 0 ? "top-1/2 h-1/2" : "bottom-1/2 h-1/2"}`} style={{ right: -14 }} />
                      </>
                    )}
                    {ri > 0 && <span className="absolute top-1/2 h-px bg-white/20" style={{ left: -14, width: 14 }} />}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {third && (
        <div className="mt-5 border-t border-white/10 pt-4" style={{ maxWidth: colW }}>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#ff7a1a]">Tercer puesto</div>
          {matchBox(third)}
        </div>
      )}
    </section>
  );
}
