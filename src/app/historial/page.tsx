"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Crown, FolderOpen, History, Medal, Trash2, Upload } from "lucide-react";
import { allTournaments, useTournament } from "@/store/tournament";
import { historicalRanking } from "@/lib/tournament/stats";
import { getTeam } from "@/lib/teams";
import { phaseHref, PHASE_LABEL } from "@/lib/routes";
import { Button } from "@/components/ui/Button";
import { EmptyState, Loader, PlayerDot, SectionHeader, useHydrated } from "@/components/ui/bits";
import { confirmDialog, toast } from "@/components/ui/feedback";
import { TeamCrest } from "@/components/ui/TeamCrest";

export default function HistoryPage() {
  const hydrated = useHydrated();
  const current = useTournament((s) => s.current);
  const history = useTournament((s) => s.history);
  const open = useTournament((s) => s.openFromHistory);
  const remove = useTournament((s) => s.deleteFromHistory);
  const importT = useTournament((s) => s.importTournament);
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);

  if (!hydrated) return <Loader />;
  const all = allTournaments(current, history);
  const ranking = historicalRanking(all);

  const onImport = async (f: File) => {
    try {
      const err = importT(JSON.parse(await f.text()));
      if (err) return toast.error(err);
      toast.success("Torneo importado.");
      router.push(phaseHref(useTournament.getState().current!.phase));
    } catch {
      toast.error("No se pudo leer el archivo.");
    }
  };

  return (
    <div className="space-y-12">
      <section>
        <SectionHeader kicker="Salón de la fama" title="Ranking histórico" />
        {ranking.length === 0 ? (
          <EmptyState icon={<Crown className="size-8" />} title="Sin torneos finalizados" body="Cuando termine tu primer torneo, aquí se acumularán títulos, podios y estadísticas de cada jugador (se agrupan por nombre)." />
        ) : (
          <div className="glass overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[0.68rem] font-bold uppercase tracking-widest text-mute">
                  <th className="px-4 py-3">#</th><th className="px-4 py-3">Jugador</th>
                  <th className="px-2 py-3 text-center">Títulos</th><th className="px-2 py-3 text-center">Podios</th><th className="px-2 py-3 text-center">Torneos</th>
                  <th className="px-2 py-3 text-center">PJ</th><th className="px-2 py-3 text-center">G-E-P</th><th className="px-2 py-3 text-center">GF</th><th className="px-2 py-3 text-center">DG</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r, i) => (
                  <motion.tr key={r.name} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }} className="border-b border-line/60 last:border-0">
                    <td className="display px-4 py-3 text-lg font-black text-mute">{i + 1}</td>
                    <td className="px-4 py-3"><span className="flex items-center gap-2 font-semibold"><PlayerDot color={r.color} /> {r.name}</span></td>
                    <td className="px-2 py-3 text-center">{r.titles > 0 ? <span className="display text-xl font-black text-gold">{r.titles} 🏆</span> : <span className="text-mute">0</span>}</td>
                    <td className="num px-2 py-3 text-center">{r.podiums}</td>
                    <td className="num px-2 py-3 text-center">{r.tournaments}</td>
                    <td className="num px-2 py-3 text-center">{r.played}</td>
                    <td className="num px-2 py-3 text-center">{r.won}-{r.drawn}-{r.lost}</td>
                    <td className="num px-2 py-3 text-center">{r.gf}</td>
                    <td className="num px-2 py-3 text-center">{r.gf - r.ga > 0 ? "+" : ""}{r.gf - r.ga}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <SectionHeader kicker="Tus competiciones" title="Historial de torneos">
          <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
          <Button variant="secondary" size="sm" onClick={() => file.current?.click()}><Upload className="size-4" /> Importar JSON</Button>
        </SectionHeader>
        {all.length === 0 ? (
          <EmptyState icon={<History className="size-8" />} title="Aún no hay torneos" body="Los torneos se guardan automáticamente en este navegador." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {all.map((t, i) => {
              const champ = t.participants.find((p) => p.id === t.championId);
              const isCurrent = t.id === current?.id;
              const played = t.matches.filter((m) => m.status === "done" && !m.isBye).length;
              return (
                <motion.div key={t.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className={`glass glass-hover p-5 ${isCurrent ? "!border-neon/50" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-widest text-mute">
                        {isCurrent && <span className="text-neon">Actual · </span>}
                        {PHASE_LABEL[t.phase]} · {new Date(t.createdAt).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                      <h3 className="display truncate text-2xl font-extrabold">{t.name}</h3>
                      <div className="text-sm text-soft">{t.settings.format === "league" ? "Liga" : "Eliminatorias"} · {t.participants.length} jugadores · {played} partidos</div>
                    </div>
                    {champ ? <Medal className="size-7 shrink-0 text-gold" /> : null}
                  </div>
                  {champ && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-gold/10 px-3 py-2 text-sm">
                      <Crown className="size-4 text-gold" />
                      <span className="font-bold">{champ.name}</span>
                      <TeamCrest team={getTeam(t.assignments[champ.id])} size={22} />
                      <span className="truncate text-soft">{getTeam(t.assignments[champ.id])?.name}</span>
                    </div>
                  )}
                  <div className="mt-4 flex gap-2">
                    {isCurrent ? (
                      <Button size="sm" onClick={() => router.push(phaseHref(t.phase))}>Abrir</Button>
                    ) : (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => { open(t.id); router.push(phaseHref(t.phase)); }}><FolderOpen className="size-4" /> Abrir</Button>
                        <Button size="sm" variant="ghost" onClick={async () => (await confirmDialog({ title: "¿Eliminar del historial?", body: `"${t.name}" se borrará definitivamente.`, danger: true, confirmLabel: "Eliminar" })) && remove(t.id)}>
                          <Trash2 className="size-4" /> Eliminar
                        </Button>
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
