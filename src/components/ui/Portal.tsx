"use client";

import { createPortal } from "react-dom";
import { useHydrated } from "./bits";

/**
 * Renderiza en `document.body`. Necesario para overlays a pantalla completa:
 * la transición de página aplica transform/filter, que convertiría al
 * contenedor en referencia de los elementos `position: fixed`.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  return hydrated ? createPortal(children, document.body) : null;
}
