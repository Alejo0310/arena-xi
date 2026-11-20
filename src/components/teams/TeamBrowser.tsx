"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Search, SlidersHorizontal } from "lucide-react";
import { COUNTRIES, LEAGUES, TEAMS, TEAMS_SOURCE, sortByRating } from "@/lib/teams";
import type { Team } from "@/lib/types";
import { TeamCrest } from "@/components/ui/TeamCrest";
import { RatingBar } from "@/components/ui/bits";

type SortKey = "ovr" | "att" | "mid" | "def" | "name";

interface Props {
  selected?: string[];
  onChange?: (ids: string[]) => void;
}

/** Base de datos de equipos con filtros; si recibe `onChange`, permite elegir los equipos del sorteo. */
export function TeamBrowser({ selected, onChange }: Props) {
  const [q, setQ] = useState("");
  const [league, setLeague] = useState("");
  const [country, setCountry] = useState("");
  const [minOvr, setMinOvr] = useState(0);
  const [sort, setSort] = useState<SortKey>("ovr");
  const selectable = !!onChange && !!selected;
  const sel = useMemo(() => new Set(selected ?? []), [selected]);

  const list = useMemo(() => {
    const text = q.trim().toLowerCase();
    return TEAMS.filter(
      (t) =>
        (!text || t.name.toLowerCase().includes(text) || t.realName?.toLowerCase().includes(text) || t.short.toLowerCase().includes(text)) &&
        (!league || t.league === league) &&
        (!country || t.country === country) &&
        t.ovr >= minOvr,
    ).sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : b[sort] - a[sort] || b.ovr - a.ovr));
  }, [q, league, country, minOvr, sort]);

  const toggle = (id: string) => onChange?.(sel.has(id) ? [...sel].filter((x) => x !== id) : [...sel, id]);
  const visibleIds = list.map((t) => t.id);

  return (
    <div>
      <div className="glass mb-4 grid gap-3 p-4 md:grid-cols-[1fr_auto_auto_auto_auto]">
        <label className="relative">
          <span className="sr-only">Buscar equipo</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mute" />
          <input className="field pl-9" placeholder="Buscar club..." value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <Select label="Liga" value={league} onChange={setLeague} options={LEAGUES} />
        <Select label="País" value={country} onChange={setCountry} options={COUNTRIES} />
        <label className="flex items-center gap-2 text-sm">
          <span className="whitespace-nowrap text-mute">OVR ≥</span>
          <input type="range" min={0} max={85} step={1} value={minOvr} onChange={(e) => setMinOvr(+e.target.value)} className="w-24 accent-[#3dff8b]" aria-label="Valoración mínima" />
          <span className="num w-6 font-bold">{minOvr || "—"}</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <SlidersHorizontal className="size-4 text-mute" />
          <span className="sr-only">Ordenar por</span>
          <select className="field !py-2" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="ovr">Media</option>
            <option value="att">Ataque</option>
            <option value="mid">Mediocampo</option>
            <option value="def">Defensa</option>
            <option value="name">Nombre</option>
          </select>
        </label>
      </div>

      {selectable && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="mr-2 text-soft">
            <b className="num text-neon">{sel.size}</b> equipos en el sorteo
          </span>
          <Chip onClick={() => onChange!(sortByRating(TEAMS.map((t) => t.id)).slice(0, 8))}>Top 8</Chip>
          <Chip onClick={() => onChange!(sortByRating(TEAMS.map((t) => t.id)).slice(0, 16))}>Top 16</Chip>
          <Chip onClick={() => onChange!([...new Set([...sel, ...visibleIds])])}>Añadir visibles</Chip>
          <Chip onClick={() => onChange!([...sel].filter((id) => !visibleIds.includes(id)))}>Quitar visibles</Chip>
          <Chip onClick={() => onChange!(TEAMS.map((t) => t.id))}>Todos</Chip>
          <Chip onClick={() => onChange!([])}>Ninguno</Chip>
        </div>
      )}

      <motion.div layout className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {list.map((t, i) => (
            <TeamCard key={t.id} team={t} index={i} selected={sel.has(t.id)} onToggle={selectable ? () => toggle(t.id) : undefined} />
          ))}
        </AnimatePresence>
      </motion.div>
      {list.length === 0 && <p className="py-10 text-center text-mute">Ningún equipo coincide con los filtros.</p>}
      <p className="mt-6 text-xs text-mute">
        Fuente: {TEAMS_SOURCE}. Las insignias son ilustraciones propias con los colores de cada club, no escudos oficiales.
      </p>
    </div>
  );
}

function TeamCard({ team, selected, onToggle, index }: { team: Team; selected: boolean; onToggle?: () => void; index: number }) {
  const Comp = onToggle ? motion.button : motion.div;
  return (
    <Comp
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: Math.min(index * 0.02, 0.3) }}
      onClick={onToggle}
      aria-pressed={onToggle ? selected : undefined}
      className={`glass glass-hover relative flex w-full items-center gap-4 p-4 text-left ${onToggle ? "cursor-pointer" : ""} ${selected ? "!border-neon/60 shadow-[0_0_30px_-12px_#3dff8b]" : onToggle ? "opacity-70 hover:opacity-100" : ""}`}
    >
      <TeamCrest team={team} size={52} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-bold">{team.name}</div>
            <div className="truncate text-xs text-mute">
              {team.realName ? `${team.realName} · ` : ""}
              {team.league} · {team.country}
            </div>
          </div>
          <div className="text-right">
            <div className="display text-3xl font-black leading-none text-neon">{team.ovr}</div>
            <div className="text-[0.6rem] font-bold uppercase tracking-widest text-mute">Media</div>
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

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select className="field !py-2" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{label}: todas</option>
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
