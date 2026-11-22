"use client";

import { useEffect, useRef } from "react";
import type { Tournament } from "@/lib/types";
import { Portal } from "@/components/ui/Portal";
import { toast } from "@/components/ui/feedback";
import { slug } from "@/lib/share";
import { REPORT_WIDTH, TournamentReport } from "./TournamentReport";

export type ExportJob = "png" | "pdf";

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

/**
 * Monta el informe fuera de pantalla solo mientras dura la exportación.
 *  - PNG: lo captura con html-to-image (carga diferida) a doble resolución.
 *  - PDF: lo imprime con el diálogo del navegador; los estilos de impresión (globals.css) ocultan el resto de
 *    la aplicación, conservan los colores y ajustan el ancho a una hoja A4.
 */
export function ReportExporter({ t, job, onDone }: { t: Tournament; job: ExportJob | null; onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!job) return;
    let cancelled = false;
    const html = document.documentElement;
    const finish = () => {
      html.classList.remove("printing-report");
      window.removeEventListener("afterprint", finish);
      if (!cancelled) onDone();
    };

    (async () => {
      try {
        await document.fonts?.ready;
        await nextFrame();
        const el = root.current?.querySelector<HTMLElement>(".report");
        if (!el || cancelled) return;
        if (job === "png") {
          const { toPng } = await import("html-to-image");
          const url = await toPng(el, { backgroundColor: "#05070a", pixelRatio: 2, cacheBust: true, width: REPORT_WIDTH, height: el.scrollHeight });
          const a = document.createElement("a");
          a.href = url;
          a.download = `${slug(t.name)}-informe.png`;
          a.click();
          toast.success("Informe descargado como imagen.");
          if (!cancelled) onDone();
        } else {
          html.classList.add("printing-report");
          window.addEventListener("afterprint", finish);
          window.print(); // bloquea hasta cerrar el diálogo; afterprint limpia el estado
        }
      } catch {
        toast.error("No se pudo generar el informe en este navegador.");
        finish();
      }
    })();

    return () => {
      cancelled = true;
      html.classList.remove("printing-report");
      window.removeEventListener("afterprint", finish);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job]);

  if (!job) return null;
  return (
    <Portal>
      <div id="report-root" ref={root} aria-hidden style={{ position: "fixed", left: -20000, top: 0, width: REPORT_WIDTH, pointerEvents: "none" }}>
        <TournamentReport t={t} />
      </div>
    </Portal>
  );
}
