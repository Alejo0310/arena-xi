"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Ban, Check, Search, Sparkles } from "lucide-react";
import { sortByRating, TEAMS_SOURCE } from "@/lib/teams";
import { teamsFor } from "@/lib/catalog";
import { CATEGORIES, EDITIONS, LICENSE_LABEL, editionInfo } from "@/lib/editions";
import type { GameEdition, Gender, LicenseStatus, Team, TeamKind } from "@/lib/types";
import { TeamCrest } from "@/components/ui/TeamCrest";
import { RatingBar } from "@/components/ui/bits";
import { fmtRating, ratingStatusOf } from "@/lib/teams";
import { useAllCatalogs, useCatalog } from "./useCatalog";

type SortKey = "ovr" | "att" | "mid" | "def" | "name";

interface Props {
  edition: GameEdition;
  /** Si se pasa, aparece el filtro de edición (modo catálogo). En la configuración la edición ya está fijada. */
  onEditionChange?: (e: GameEdition) => void;
  kind: TeamKind;
  gender: Gender;
  onCategoryChange: (kind: TeamKind, gender: Gender) => void;
  selected?: string[];
  onChange?: (ids: string[]) => void;
}

const PAGE = 24;

/**
 * Catálogo de equipos de UNA edición y UNA categoría (clubes/selecciones × masculino/femenino),
 * con buscador y filtros por país, continente, liga, valoración y licencia.
 * Nunca muestra equipos de otra edición, y las valoraciones solo existen donde son verificables.
 */
export function TeamBrowser({ edition, onEditionChange, kind, gender, onCategoryChange, selected, onChange }: Props) {
  const { catalog, loading, error } = useCatalog(edition);
  const [q, setQ] = useState("");
  const [league, setLeague] = useState("");
  const [country, setCountry] = useState("");
  const [continent, setContinent] = useState("");
  const [license, setLicense] = useState<"" | LicenseStatus>("");
  const [minOvr, setMinOvr] = useState(0);
  const [onlyNew, setOnlyNew] = useState(false);
  const [rating, setRating] = useState<"all" | "rated" | "unrated">("all");
  const [sort, setSort] = useState<SortKey>("ovr");
  const [shown, setShown] = useState(PAGE);
  const dq = useDeferredValue(q);

  const selectable = !!onChange && !!selected;
  const sel = useMemo(() => new Set(selected ?? []), [selected]);
  const national = kind === "national";
  const all = useMemo(() => (catalog ? teamsFor(edition, kind, gender) : []), [catalog, edition, kind, gender]);
  const anyRated = useMemo(() => all.some((t) => t.ovr != null), [all]);

  // Los filtros se reinician al cambiar de edición o categoría para no dejar listas vacías por un filtro obsoleto.
  useEffect(() => {
    setLeague("");
    setCountry("");
    setContinent("");
    setLicense("");
    setMinOvr(0);
    setOnlyNew(false);
    setRating("all");
    setShown(PAGE);
    setSort(anyRated ? "ovr" : "name");
  }, [edition, kind, gender, anyRated]);
  useEffect(() => setShown(PAGE), [dq, league, country, continent, license, minOvr, onlyNew, rating, sort]);

  const leagues = useMemo(() => [...new Set(all.filter((t) => (!country || t.country === country) && (!continent || t.continent === continent)).map((t) => t.league))].sort((a, b) => a.localeCompare(b)), [all, country, continent]);
  const countries = useMemo(() => [...new Set(all.filter((t) => !continent || t.continent === continent).map((t) => t.country))].sort((a, b) => a.localeCompare(b)), [all, continent]);
  const continents = useMemo(() => [...new Set(all.map((t) => t.continent ?? "Otros"))].sort(), [all]);

  const list = useMemo(() => {
    const text = dq.trim().toLowerCase();
    return all
      .filter(
        (t) =>
          (!text || t.name.toLowerCase().includes(text) || t.realName?.toLowerCase().includes(text) || t.country.toLowerCase().includes(text)) &&
          (!league || t.league === league) &&
          (!country || t.country === country) &&
          (!continent || t.continent === continent) &&
          (!license || (t.license ?? "unknown") === license) &&
          (!onlyNew || t.newIn) &&
          (rating === "all" || (rating === "rated") === (ratingStatusOf(t) !== "unavailable")) &&
          (minOvr === 0 || (t.ovr != null && t.ovr >= minOvr)),
      )
      .sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : (b[sort] ?? -1) - (a[sort] ?? -1) || a.name.localeCompare(b.name)));
  }, [all, dq, league, country, continent, license, onlyNew, rating, minOvr, sort]);

  const toggle = (id: string) => onChange?.(sel.has(id) ? [...sel].filter((x) => x !== id) : [...sel, id]);
  const visibleIds = list.map((t) => t.id);
  const ranked = useMemo(() => sortByRating(all.map((t) => t.id)), [all]);
  const cat = CATEGORIES.find((c) => c.kind === kind && c.gender === gender)!;
  const info = editionInfo(edition);

  return (
    <div>
      {onEditionChange && (
        <div className="mb-3 flex flex-wrap items-center gap-2" role="tablist" aria-label="Edición del juego">
          <span className="mr-1 text-xs font-semibold uppercase tracking-widest text-mute">Edición</span>
          {EDITIONS.map((e) => (
            <button
              key={e.id}
              role="tab"
              aria-selected={e.id === edition}
              onClick={() => onEditionChange(e.id)}
              className={`rounded-xl border px-4 py-1.5 font-display text-base font-bold uppercase tracking-wider transition-colors ${e.id === edition ? "border-neon bg-neon text-ink" : "border-line text-soft hover:border-white/30 hover:text-white"}`}
            >
              {e.label}
            </button>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-1.5 rounded-2xl border border-line bg-ink/60 p-1.5" role="tablist" aria-label="Categoría de equipos">
        {CATEGORIES.map((c) => {
          const active = c.kind === kind && c.gender === gender;
          return (
            <button
              key={c.id}
              role="tab"
              aria-selected={active}
              data-category={c.id}
              onClick={() => !active && onCategoryChange(c.kind, c.gender)}
              className={`relative flex items-center gap-2 rounded-xl px-4 py-2.5 font-display text-sm font-bold uppercase tracking-wider transition-colors sm:text-base ${active ? "text-ink" : "text-soft hover:text-white"}`}
            >
              {active && <motion.span layoutId="category-pill" className="pointer-events-none absolute inset-0 rounded-xl bg-neon" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
              <span className="relative">{c.label}</span>
              {catalog && <span className={`relative num rounded-full px-1.5 text-xs ${active ? "bg-ink/15" : "bg-white/10"}`}>{teamsFor(edition, c.kind, c.gender).length}</span>}
            </button>
          );
        })}
      </div>

      <div className="glass mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="relative sm:col-span-2">
          <span className="sr-only">Buscar equipo</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mute" />
          <input className="field pl-9" placeholder={national ? "Buscar selección o país..." : "Buscar club, país..."} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <Select label="Continente" value={continent} onChange={(v) => { setContinent(v); setCountry(""); setLeague(""); }} options={continents} />
        <Select label="País" value={country} onChange={(v) => { setCountry(v); setLeague(""); }} options={countries} />
        {!national && <Select label="Liga" value={league} onChange={setLeague} options={leagues} />}
        {national && <Select label="Confederación" value={league} onChange={setLeague} options={leagues} />}
        <label>
          <span className="sr-only">Licencia</span>
          <select className="field !py-2" value={license} onChange={(e) => setLicense(e.target.value as "" | LicenseStatus)} aria-label="Licencia">
            <option value="">Licencia: todas</option>
            {(Object.keys(LICENSE_LABEL) as LicenseStatus[]).map((l) => (
              <option key={l} value={l}>{LICENSE_LABEL[l]}</option>
            ))}
          </select>
        </label>
        <label className={`flex items-center gap-2 text-sm ${anyRated ? "" : "opacity-50"}`} title={anyRated ? undefined : `Sin valoraciones verificadas en ${info.label}`}>
          <span className="whitespace-nowrap text-mute">OVR ≥</span>
          <input type="range" min={0} max={85} step={1} value={minOvr} disabled={!anyRated} onChange={(e) => setMinOvr(+e.target.value)} className="w-24 accent-[#3dff8b]" aria-label="Valoración mínima" />
          <span className="num w-6 font-bold">{minOvr || "—"}</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">Ordenar por</span>
          <select className="field !py-2" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Ordenar por">
            {anyRated && <option value="ovr">Media</option>}
            {anyRated && <option value="att">Ataque</option>}
            {anyRated && <option value="mid">Mediocampo</option>}
            {anyRated && <option value="def">Defensa</option>}
            <option value="name">Nombre</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Valoración</span>
          <select className="field !py-2" value={rating} onChange={(e) => setRating(e.target.value as "all" | "rated" | "unrated")} aria-label="Valoración">
            <option value="all">Valoración: mostrar todos</option>
            <option value="rated">Solo con valoración</option>
            <option value="unrated">Solo sin valoración</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-soft">
          <input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} className="accent-[#3dff8b]" />
          Solo novedades verificadas
        </label>
      </div>

      {!anyRated && catalog && (
        <p className="glass mb-4 border-volt/30 p-3 text-sm text-soft" role="note">
          <b className="text-white">{info.label}: sin valoraciones verificadas.</b> Se buscaron en las fuentes accesibles y no hay datos verificables, así que los equipos se identifican como “SIN VALORACIÓN” en lugar de inventar números. Siguen disponibles para todos los sorteos; en Bombos puedes usar el reparto manual o el aleatorio equilibrado.
        </p>
      )}

      {selectable && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="mr-2 text-soft">
            <b className="num text-neon">{sel.size}</b> {national ? "selecciones" : "clubes"} en el sorteo
          </span>
          {anyRated && <Chip onClick={() => onChange!(ranked.slice(0, 8))}>Top 8</Chip>}
          {anyRated && !national && <Chip onClick={() => onChange!(ranked.slice(0, 16))}>Top 16</Chip>}
          <Chip onClick={() => onChange!([...new Set([...sel, ...visibleIds])])}>Añadir visibles ({visibleIds.length})</Chip>
          <Chip onClick={() => onChange!([...sel].filter((id) => !visibleIds.includes(id)))}>Quitar visibles</Chip>
          {national && <Chip onClick={() => onChange!(ranked)}>Todas</Chip>}
          <Chip onClick={() => onChange!([])}>Ninguno</Chip>
        </div>
      )}

      {loading && <p className="py-10 text-center text-mute" role="status">Cargando catálogo de {info.label}…</p>}
      {error && <p className="py-10 text-center text-blaze" role="alert">No se pudo cargar el catálogo de {info.label}. Recarga la página.</p>}

      {catalog && (
        <>
          <div className="mb-2 text-xs text-mute" aria-live="polite">{list.length} de {all.length} · {cat.label} · {info.label}</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="team-grid">
            <AnimatePresence mode="popLayout" initial={false}>
              {list.slice(0, shown).map((t) => (
                <TeamCard key={t.id} team={t} selected={sel.has(t.id)} onToggle={selectable ? () => toggle(t.id) : undefined} />
              ))}
            </AnimatePresence>
          </div>
          {list.length > shown && (
            <div className="mt-4 text-center">
              <button className="rounded-full border border-line px-5 py-2 text-sm font-semibold text-soft hover:border-neon/50 hover:text-white" onClick={() => setShown((n) => n + PAGE * 2)}>
                Mostrar más ({list.length - shown} restantes)
              </button>
            </div>
          )}
          {list.length === 0 && <p className="py-10 text-center text-mute">Ningún equipo coincide con los filtros.</p>}
          {national && <MissingTeams edition={edition} gender={gender} />}
        </>
      )}
      <p className="mt-6 text-xs text-mute">
        Fuentes: {edition === "FC25" ? `${TEAMS_SOURCE} (valoraciones); ` : ""}FIFPlay (disponibilidad, país y liga) y FIFAUTeam (licencias y novedades).
        Las insignias y banderas son ilustraciones propias, no escudos oficiales.
      </p>
    </div>
  );
}

function TeamCard({ team, selected, onToggle }: { team: Team; selected: boolean; onToggle?: () => void }) {
  const Comp = onToggle ? motion.button : motion.div;
  const lic = team.license ?? "unknown";
  return (
    <Comp
      layout="position"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2 }}
      onClick={onToggle}
      aria-pressed={onToggle ? selected : undefined}
      data-team={team.id}
      className={`glass glass-hover relative flex w-full items-center gap-4 p-4 text-left ${onToggle ? "cursor-pointer" : ""} ${selected ? "!border-neon/60 shadow-[0_0_30px_-12px_#3dff8b]" : onToggle ? "opacity-70 hover:opacity-100" : ""}`}
    >
      <TeamCrest team={team} size={52} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-bold">{team.name}</div>
            <div className="truncate text-xs text-mute">
              {team.realName ? `${team.realName} · ` : ""}
              {team.kind === "national" ? `${team.league} · ${team.continent ?? ""}` : `${team.league} · ${team.country}`}
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              <span className={`rounded px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider ${lic === "licensed" ? "bg-neon/15 text-neon" : lic === "generic" ? "bg-volt/15 text-volt" : "bg-white/5 text-mute"}`}>{LICENSE_LABEL[lic]}</span>
              {team.newIn && <span className="flex items-center gap-0.5 rounded bg-aqua/15 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-aqua"><Sparkles className="size-2.5" />Nuevo en {team.newIn.replace("FC", "FC ")}</span>}
            </div>
          </div>
          <div className="text-right">
            {ratingStatusOf(team) === "unavailable" ? (
              <div className="rounded bg-white/5 px-1.5 py-1 text-[0.6rem] font-bold uppercase tracking-wider text-mute" data-testid="no-rating">Sin valoración</div>
            ) : (
              <>
                <div className="display text-3xl font-black leading-none text-neon">{ratingStatusOf(team) === "estimated" ? "~" : ""}{fmtRating(team.ovr)}</div>
                <div className="text-[0.6rem] font-bold uppercase tracking-widest text-mute">{ratingStatusOf(team) === "estimated" ? "Media estimada" : "Media"}</div>
              </>
            )}
          </div>
        </div>
        <div className="mt-2 space-y-1">
          <RatingBar label="ATQ" value={team.att} color="bg-blaze" />
          <RatingBar label="MED" value={team.mid} color="bg-volt" />
          <RatingBar label="DEF" value={team.def} color="bg-neon" />
        </div>
      </div>
      {onToggle && (
        <span className={`absolute right-3 top-3 grid size-5 place-items-center rounded-md border ${selected ? "border-neon bg-neon text-ink" : "border-line"}`} aria-hidden>
          {selected && <Check className="size-3.5" strokeWidth={3} />}
        </span>
      )}
    </Comp>
  );
}

/** Selecciones relevantes que no existen en la edición: informativo, no se pueden sortear. */
function MissingTeams({ edition, gender }: { edition: GameEdition; gender: Gender }) {
  const all = useAllCatalogs(true);
  const cat = all.find((c) => c.edition === edition);
  const missing = cat?.missing.filter((m) => m.gender === gender) ?? [];
  if (!missing.length) return null;
  return (
    <section className="glass mt-8 p-5" aria-label="Selecciones no disponibles">
      <h3 className="display flex items-center gap-2 text-2xl font-extrabold"><Ban className="size-5 text-blaze" /> Selecciones no disponibles</h3>
      <p className="mt-1 text-sm text-soft">
        Estas selecciones no figuran en {editionInfo(edition).label} según las listas consultadas. No se pueden sortear. Una selección sin licencia de escudo o equipación puede estar disponible con diseño genérico: eso es distinto de no estar en el juego.
      </p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {missing.map((m) => (
          <li key={m.name} className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-line px-3 py-2 text-sm opacity-80">
            <span className="font-semibold">{m.es}</span>
            <span className="text-xs text-mute">{m.availableIn.length ? `Sí está en ${m.availableIn.map((e) => e.replace("FC", "FC ")).join(", ")}` : "No está en ninguna edición consultada"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select className="field !py-2" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        <option value="">{label}: todos</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

function Chip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-soft transition-colors hover:border-neon/50 hover:text-white">
      {children}
    </button>
  );
}
