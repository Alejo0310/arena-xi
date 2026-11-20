"use client";

import { useState } from "react";
import { TeamBrowser } from "@/components/teams/TeamBrowser";
import { useCategoryChange } from "@/components/teams/useCategoryChange";
import { SectionHeader, useHydrated } from "@/components/ui/bits";
import { toast } from "@/components/ui/feedback";
import { useTournament } from "@/store/tournament";
import type { GameEdition, Gender, TeamKind } from "@/lib/types";

export default function TeamsPage() {
  const hydrated = useHydrated();
  const current = useTournament((s) => s.current);
  const setPool = useTournament((s) => s.setPool);
  const changeCategory = useCategoryChange();
  const [view, setView] = useState<{ edition: GameEdition; kind: TeamKind; gender: Gender }>({ edition: "FC25", kind: "club", gender: "men" });
  // Solo se seleccionan equipos aquí cuando hay un torneo en configuración; la edición la fija el torneo.
  const editable = hydrated && current && current.phase === "setup";

  return (
    <div>
      <SectionHeader kicker="Catálogo multiversión · FC 25, FC 26 y FC 27" title="Equipos" />
      <p className="-mt-2 mb-6 max-w-2xl text-soft">
        Clubes y selecciones, masculinos y femeninos, de cada edición. Las valoraciones solo aparecen donde son verificables.
        {editable ? " Marca o desmarca equipos para incluirlos en el sorteo de tu torneo." : " Crea un torneo para elegir qué equipos entran en el sorteo."}
      </p>
      {editable ? (
        <TeamBrowser
          edition={current.settings.edition ?? "FC25"}
          kind={current.settings.category}
          gender={current.settings.gender ?? "men"}
          onCategoryChange={changeCategory}
          selected={current.teamPool}
          onChange={(ids) => {
            const err = setPool(ids);
            if (err) toast.error(err);
          }}
        />
      ) : (
        <TeamBrowser
          edition={view.edition}
          onEditionChange={(edition) => setView((v) => ({ ...v, edition }))}
          kind={view.kind}
          gender={view.gender}
          onCategoryChange={(kind, gender) => setView((v) => ({ ...v, kind, gender }))}
        />
      )}
    </div>
  );
}
