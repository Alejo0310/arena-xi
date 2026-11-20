"use client";

import { useEffect, useState } from "react";
import type { GameEdition } from "@/lib/types";
import { annotateMissing, getCatalogSync, loadCatalog, type Catalog } from "@/lib/catalog";

/** Carga (una sola vez por edición) el catálogo de equipos y lo expone al componente. */
export function useCatalog(edition: GameEdition, enabled = true): { catalog: Catalog | undefined; loading: boolean; error: boolean } {
  const [state, setState] = useState<{ edition: GameEdition; catalog?: Catalog; error?: boolean }>(() => ({ edition, catalog: getCatalogSync(edition) }));

  useEffect(() => {
    if (!enabled) return;
    let off = false;
    const hit = getCatalogSync(edition);
    if (hit) {
      setState({ edition, catalog: hit });
      return;
    }
    setState({ edition });
    loadCatalog(edition)
      .then((catalog) => !off && setState({ edition, catalog }))
      .catch(() => !off && setState({ edition, error: true }));
    return () => {
      off = true;
    };
  }, [edition, enabled]);

  // Mientras llega el catálogo de la nueva edición no se muestran los datos de la anterior.
  const fresh = state.edition === edition;
  return { catalog: fresh && enabled ? state.catalog : undefined, loading: enabled && (!fresh || (!state.catalog && !state.error)), error: fresh && !!state.error };
}

/** Carga las tres ediciones para saber en cuáles existe cada selección ausente. */
export function useAllCatalogs(enabled: boolean): Catalog[] {
  const [all, setAll] = useState<Catalog[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let off = false;
    Promise.all((["FC25", "FC26", "FC27"] as const).map(loadCatalog)).then((cs) => {
      if (off) return;
      annotateMissing(cs);
      setAll(cs);
    });
    return () => {
      off = true;
    };
  }, [enabled]);
  return all;
}
