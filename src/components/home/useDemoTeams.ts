"use client";

import { useMemo } from "react";
import { useTournament } from "@/store/tournament";
import { useHydrated } from "@/components/ui/bits";
import { useCatalog } from "@/components/teams/useCatalog";
import { teamsFor } from "@/lib/catalog";
import { editionInfo } from "@/lib/editions";
import { DEFAULT_CLUB_POOL, getTeam, isRated } from "@/lib/teams";
import type { GameEdition, Team } from "@/lib/types";

export interface DemoData {
  /** Equipos para ruleta, sobres, tómbola y draft. */
  pool: Team[];
  /** Equipos con valoración verificada (necesarios para los bombos). */
  potsPool: Team[];
  /** Cómo se identifica el origen de los datos en la interfaz. */
  label: string;
  potsLabel: string;
  edition: GameEdition;
  /** true si `pool` pertenece a una edición sin valoraciones verificadas (se mostrará “—”). */
  unrated: boolean;
}

const FC25_SAMPLE: Team[] = DEFAULT_CLUB_POOL.map((id) => getTeam(id)!).filter(isRated);

/**
 * Datos de las demostraciones del Home. Son de solo lectura: solo se lee la edición del torneo en
 * configuración; nunca se modifica el torneo. Sin torneo (o con FC 25) se usan los clubes valorados
 * de FC 25, identificados como datos de ejemplo. Con FC 26/27 se usan equipos de esa edición (sin
 * valoración verificada), y los bombos —que necesitan valoraciones— usan el ejemplo de FC 25.
 */
export function useDemoTeams(): DemoData {
  const hydrated = useHydrated();
  const edition = useTournament((s) => (hydrated ? (s.current?.settings.edition ?? "FC25") : "FC25"));
  const { catalog } = useCatalog(edition, edition !== "FC25");

  return useMemo(() => {
    const potsPool = FC25_SAMPLE.slice(0, 12);
    const potsLabel = "Datos de ejemplo · clubes de FC 25 con valoraciones verificadas";
    if (edition === "FC25" || !catalog) {
      return { pool: FC25_SAMPLE.slice(0, 8), potsPool, label: "Datos de ejemplo · clubes de FC 25 con valoraciones verificadas", potsLabel, edition: "FC25" as const, unrated: false };
    }
    const clubs = teamsFor(edition, "club", "men");
    const top = clubs.filter((t) => t.league === "Premier League" || t.league.startsWith("LALIGA") || t.league === "Bundesliga").slice(0, 8);
    const pool = top.length >= 5 ? top : clubs.slice(0, 8);
    return { pool, potsPool, label: `Equipos de ${editionInfo(edition).label} · sin valoraciones verificadas (se muestran como “—”)`, potsLabel, edition, unrated: true };
  }, [edition, catalog]);
}
