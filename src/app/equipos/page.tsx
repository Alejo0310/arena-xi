"use client";

import { useState } from "react";
import { TeamBrowser } from "@/components/teams/TeamBrowser";
import { useCategoryChange } from "@/components/teams/useCategoryChange";
import { SectionHeader, useHydrated } from "@/components/ui/bits";
import { toast } from "@/components/ui/feedback";
import { useTournament } from "@/store/tournament";
import type { TeamKind } from "@/lib/types";

export default function TeamsPage() {
  const hydrated = useHydrated();
  const current = useTournament((s) => s.current);
  const setPool = useTournament((s) => s.setPool);
  const changeCategory = useCategoryChange();
  const [browse, setBrowse] = useState<TeamKind>("club");
  const editable = hydrated && current && current.phase === "setup";

  return (
    <div>
      <SectionHeader kicker="Base de datos EA SPORTS FC 25" title="Equipos" />
      <p className="-mt-2 mb-6 max-w-2xl text-soft">
        Clubes y selecciones con su media, ataque, mediocampo y defensa.
        {editable ? " Marca o desmarca equipos para incluirlos en el sorteo de tu torneo. Un torneo es de clubes o de selecciones, nunca mixto." : " Crea un torneo para elegir qué equipos entran en el sorteo."}
      </p>
      {editable ? (
        <TeamBrowser
          category={current.settings.category}
          onCategoryChange={changeCategory}
          selected={current.teamPool}
          onChange={(ids) => {
            const err = setPool(ids);
            if (err) toast.error(err);
          }}
        />
      ) : (
        <TeamBrowser category={browse} onCategoryChange={setBrowse} />
      )}
    </div>
  );
}
