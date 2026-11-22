"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Eye, Download } from "lucide-react";
import { decodeTournament, fetchShortLink } from "@/lib/share";
import { isShortId } from "@/lib/shortLink";
import type { Tournament } from "@/lib/types";
import { normalizeTournament, useTournament } from "@/store/tournament";
import { Button } from "@/components/ui/Button";
import { EmptyState, Loader } from "@/components/ui/bits";
import { toast } from "@/components/ui/feedback";
import { TabBar, TournamentBody, type Tab } from "@/components/tournament/TournamentView";
import { useRouter } from "next/navigation";
import { phaseHref } from "@/lib/routes";
import { setActiveSnapshot } from "@/lib/teams";

/** Vista de solo lectura de un torneo recibido por enlace (datos en el fragmento #). */
export default function SharedPage() {
  const [t, setT] = useState<Tournament | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("overview");
  const importT = useTournament((s) => s.importTournament);
  const router = useRouter();

  useEffect(() => {
    const read = () => {
      const h = decodeURIComponent(window.location.hash.slice(1));
      setT(undefined);
      // Enlace corto (NombreDelTorneo-xxxxxx): los datos están en el servidor. Si no, el torneo viaja en la propia URL.
      const load = isShortId(h) ? fetchShortLink(h) : decodeTournament(h);
      void load.then((x) => setT(x ? normalizeTournament(x) : null));
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  // Un torneo compartido se muestra con los datos congelados que trae, no con el catálogo vivo.
  useEffect(() => {
    if (!t) return;
    setActiveSnapshot(t.snapshot);
    return () => setActiveSnapshot(useTournament.getState().current?.snapshot);
  }, [t]);

  if (t === undefined) return <Loader />;
  if (t === null) {
    return <EmptyState icon={<Eye className="size-8" />} title="Enlace no válido" body="El enlace está incompleto, ha caducado o está dañado." action={<Link href="/"><Button>Ir al inicio</Button></Link>} />;
  }

  const save = () => {
    const err = importT(t);
    if (err) return toast.error(err);
    toast.success("Torneo guardado en tu navegador.");
    router.push(phaseHref(t.phase));
  };

  return (
    <div>
      <div className="glass mb-6 flex flex-wrap items-center gap-3 p-4 text-sm">
        <Eye className="size-5 text-volt" />
        <span className="flex-1 text-soft">Instantánea compartida de solo lectura. Guárdala para continuarla en este dispositivo.</span>
        <Button size="sm" variant="secondary" onClick={save}><Download className="size-4" /> Guardar copia</Button>
      </div>
      <h1 className="display mb-6 text-5xl font-black italic">{t.name}</h1>
      {t.matches.length ? (
        <>
          <TabBar t={t} tab={tab} setTab={setTab} />
          <TournamentBody t={t} tab={tab} readOnly />
        </>
      ) : (
        <p className="text-mute">Este torneo aún no ha comenzado.</p>
      )}
    </div>
  );
}
