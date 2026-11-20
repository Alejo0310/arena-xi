"use client";

import { TeamBrowser } from "@/components/teams/TeamBrowser";
import { SectionHeader, useHydrated } from "@/components/ui/bits";
import { useTournament } from "@/store/tournament";

export default function TeamsPage() {
  const hydrated = useHydrated();
  const current = useTournament((s) => s.current);
  const setPool = useTournament((s) => s.setPool);
  const editable = hydrated && current && current.phase === "setup";

  return (
    <div>
      <SectionHeader kicker="Base de datos FC 25" title="Equipos" />
      <p className="-mt-2 mb-6 max-w-2xl text-soft">
        Valoraciones de EA SPORTS FC 25: media general, ataque, mediocampo y defensa.
        {editable ? " Marca o desmarca clubes para incluirlos en el sorteo de tu torneo." : " Crea un torneo para elegir qué equipos entran en el sorteo."}
      </p>
      {editable ? <TeamBrowser selected={current.teamPool} onChange={setPool} /> : <TeamBrowser />}
    </div>
  );
}
