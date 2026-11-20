"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import { Download, FileJson, ImageDown, Link2, MonitorPlay, Plus, Printer, RotateCcw, Trophy } from "lucide-react";
import { useTournament } from "@/store/tournament";
import { Button } from "@/components/ui/Button";
import { EmptyState, Loader, useHydrated } from "@/components/ui/bits";
import { confirmDialog, toast } from "@/components/ui/feedback";
import { TabBar, TournamentBody, type Tab } from "@/components/tournament/TournamentView";
import { ChampionOverlay } from "@/components/tournament/Champion";
import { Portal } from "@/components/ui/Portal";
import { downloadJson, shareUrl, slug } from "@/lib/share";
import { PHASE_LABEL, phaseHref } from "@/lib/routes";
import { useRouter } from "next/navigation";

export default function TournamentPage() {
  const hydrated = useHydrated();
  const t = useTournament((s) => s.current);
  const newTournament = useTournament((s) => s.newTournament);
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  // Enlaces profundos (p. ej. desde el footer): /torneo?tab=table
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("tab");
    if (q === "overview" || q === "matches" || q === "table" || q === "stats") setTab(q);
  }, []);
  const [celebrate, setCelebrate] = useState(false);
  const [menu, setMenu] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const prevChampion = useRef<string | null | undefined>(undefined);

  // Celebración solo cuando el campeón aparece durante esta sesión (no al recargar).
  useEffect(() => {
    if (!t) return;
    if (prevChampion.current === null && t.championId) setCelebrate(true);
    prevChampion.current = t.championId;
  }, [t]);

  if (!hydrated) return <Loader label="Abriendo el estadio" />;
  if (!t || (t.phase !== "playing" && t.phase !== "finished")) {
    return (
      <EmptyState
        icon={<Trophy className="size-8" />}
        title="No hay torneo en juego"
        body={t ? `"${t.name}" está en fase de ${PHASE_LABEL[t.phase].toLowerCase()}.` : "Crea un torneo, sortea los equipos y empieza a competir."}
        action={<Link href={t ? phaseHref(t.phase) : "/nuevo"}><Button>{t ? "Continuar" : "Crear torneo"}</Button></Link>}
      />
    );
  }

  const exportImage = async () => {
    if (!bodyRef.current) return;
    try {
      const { toPng } = await import("html-to-image");
      const url = await toPng(bodyRef.current, { backgroundColor: "#05070a", pixelRatio: 2, cacheBust: true });
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug(t.name)}-${tab}.png`;
      a.click();
      toast.success("Imagen descargada.");
    } catch {
      toast.error("No se pudo generar la imagen en este navegador.");
    }
  };

  const share = async () => {
    const url = await shareUrl(t);
    try {
      if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
        await navigator.share({ title: t.name, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Enlace copiado: cualquiera podrá ver una instantánea del torneo.");
      }
    } catch {
      toast.info("No se pudo copiar automáticamente. Usa el botón de exportar JSON.");
    }
  };

  const restart = async (keep: boolean) => {
    const ok = await confirmDialog({
      title: keep ? "¿Revancha con los mismos jugadores?" : "¿Nuevo torneo?",
      body: `"${t.name}" se guardará en el historial.${keep ? " Conservarás participantes, reglas y equipos; el sorteo empieza de cero." : ""}`,
      confirmLabel: keep ? "Revancha" : "Nuevo torneo",
    });
    if (!ok) return;
    newTournament({ keepParticipants: keep });
    router.push("/nuevo");
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="kicker mb-1.5">{t.settings.format === "league" ? "Liga" : "Eliminatorias"} · {PHASE_LABEL[t.phase]}</div>
          <h1 className="display truncate text-4xl font-black italic sm:text-5xl">{t.name}</h1>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Link href="/proyeccion"><Button variant="secondary" size="sm"><MonitorPlay className="size-4" /> Proyección</Button></Link>
          <Button variant="secondary" size="sm" onClick={share}><Link2 className="size-4" /> Compartir</Button>
          <div className="relative">
            <Button variant="secondary" size="sm" onClick={() => setMenu((m) => !m)} aria-expanded={menu}><Download className="size-4" /> Exportar</Button>
            {menu && (
              <div className="glass absolute right-0 z-30 mt-2 w-52 p-1.5" onClick={() => setMenu(false)}>
                <MenuItem icon={ImageDown} onClick={exportImage}>Imagen (PNG)</MenuItem>
                <MenuItem icon={Printer} onClick={() => window.print()}>PDF (imprimir)</MenuItem>
                <MenuItem icon={FileJson} onClick={() => downloadJson(t)}>Datos (JSON)</MenuItem>
              </div>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => restart(true)}><RotateCcw className="size-4" /> Revancha</Button>
          <Button variant="ghost" size="sm" onClick={() => restart(false)}><Plus className="size-4" /> Nuevo</Button>
        </div>
      </div>

      <TabBar t={t} tab={tab} setTab={setTab} />
      <TournamentBody ref={bodyRef} t={t} tab={tab} onReplayChampion={() => setCelebrate(true)} />

      <Portal><AnimatePresence>{celebrate && t.championId && <ChampionOverlay t={t} onClose={() => setCelebrate(false)} />}</AnimatePresence></Portal>
    </div>
  );
}

function MenuItem({ icon: Icon, children, onClick }: { icon: typeof Download; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-white/10">
      <Icon className="size-4 text-neon" /> {children}
    </button>
  );
}
