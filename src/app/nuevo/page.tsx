"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, GitBranch, ListOrdered, Pencil, Plus, Sparkles, Trash2, Users, Wand2, AlertTriangle, Check } from "lucide-react";
import { useTournament, MAX_PARTICIPANTS } from "@/store/tournament";
import { Button } from "@/components/ui/Button";
import { Loader, PlayerDot, SectionHeader, useHydrated } from "@/components/ui/bits";
import { confirmDialog, toast } from "@/components/ui/feedback";
import { TeamBrowser } from "@/components/teams/TeamBrowser";
import { useCategoryChange, useEditionChange } from "@/components/teams/useCategoryChange";
import { EditionSelector } from "@/components/teams/EditionSelector";
import { InvitePanel } from "@/components/invite/InvitePanel";
import { finalizeInvitations } from "@/lib/roomSync";
import { categoryLabel, editionInfo } from "@/lib/editions";
import { generateTournamentName, PLAYER_COLORS } from "@/lib/names";
import { bracketSize } from "@/lib/tournament/knockout";
import type { Participant, TournamentSettings } from "@/lib/types";
import { phaseHref } from "@/lib/routes";

export default function SetupPage() {
  const hydrated = useHydrated();
  const current = useTournament((s) => s.current);
  const newTournament = useTournament((s) => s.newTournament);
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !current) newTournament();
  }, [hydrated, current, newTournament]);

  if (!hydrated || !current) return <Loader label="Preparando el vestuario" />;

  if (current.phase === "playing" || current.phase === "finished") {
    return (
      <div className="glass mx-auto mt-10 max-w-xl p-8 text-center">
        <h1 className="display text-4xl font-extrabold">Torneo en marcha</h1>
        <p className="mt-3 text-soft">
          &ldquo;{current.name}&rdquo; ya comenzó, así que su configuración está bloqueada para mantener los resultados coherentes.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/torneo"><Button>Ir al torneo</Button></Link>
          <Button variant="secondary" onClick={() => newTournament({ keepParticipants: true })}>Nuevo con los mismos jugadores</Button>
          <Button variant="ghost" onClick={() => newTournament()}>Torneo desde cero</Button>
        </div>
      </div>
    );
  }

  return <SetupForm onDone={() => router.push(phaseHref("draw"))} />;
}

function SetupForm({ onDone }: { onDone: () => void }) {
  const t = useTournament((s) => s.current)!;
  const rename = useTournament((s) => s.rename);
  const setPool = useTournament((s) => s.setPool);
  const changeCategory = useCategoryChange();
  const changeEdition = useEditionChange();
  const edition = t.settings.edition ?? "FC25";
  const gender = t.settings.gender ?? "men";
  const resetDraw = useTournament((s) => s.resetDraw);
  const n = t.participants.length;

  const problems: string[] = [];
  if (n < 2) problems.push("Inscribe al menos 2 participantes.");
  if (!t.name.trim()) problems.push("Ponle nombre al torneo.");
  if (!t.settings.allowRepeatTeams && t.teamPool.length < n) problems.push(`Selecciona al menos ${n} equipos (hay ${t.teamPool.length}) o permite equipos repetidos.`);
  if (t.teamPool.length === 0) problems.push("Selecciona equipos para el sorteo.");

  const goDraw = async () => {
    if (problems.length) return toast.error(problems[0]);
    // Con invitaciones: lista definitiva y cierre persistente de las inscripciones antes del sorteo.
    if (t.room) {
      const err = await finalizeInvitations();
      if (err) toast.error(`No se pudieron cerrar las inscripciones de la sala: ${err}`);
    }
    onDone();
  };

  return (
    <div className="space-y-10">
      {t.phase === "draw" && (
        <div className="glass flex flex-wrap items-center gap-3 border-blaze/40 p-4 text-sm">
          <AlertTriangle className="size-5 text-blaze" />
          <span className="flex-1">Hay un sorteo en curso. Cambiar participantes, formato o equipos lo reiniciará.</span>
          <Link href="/sorteo"><Button size="sm" variant="secondary">Volver al sorteo</Button></Link>
          <Button size="sm" variant="ghost" onClick={async () => (await confirmDialog({ title: "¿Reiniciar el sorteo?", body: "Se borrarán las asignaciones hechas hasta ahora.", danger: true, confirmLabel: "Reiniciar" })) && resetDraw()}>
            Reiniciar sorteo
          </Button>
        </div>
      )}

      {/* Edición del videojuego */}
      <section>
        <div className="kicker mb-3">Paso 1 · Selecciona tu FC</div>
        <h2 className="display mb-1 text-3xl font-extrabold">SELECCIONA TU FC</h2>
        <p className="mb-4 text-sm text-mute">La edición define los clubes, selecciones y valoraciones disponibles. Se mantiene durante todo el torneo.</p>
        <EditionSelector value={edition} onChange={changeEdition} />
      </section>

      {/* Nombre */}
      <section>
        <div className="kicker mb-3">Paso 2 · Identidad</div>
        <div className="glass flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
          <label className="flex-1">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-mute">Nombre del torneo</span>
            <input className="field display !text-2xl font-bold" value={t.name} maxLength={60} onChange={(e) => rename(e.target.value)} placeholder="Copa de los Cracks" />
          </label>
          <Button variant="secondary" onClick={() => rename(generateTournamentName())} className="sm:mt-6">
            <Wand2 className="size-4" /> Generar nombre
          </Button>
        </div>
      </section>

      <Participants />
      <Format />

      <section>
        <div className="kicker mb-3">Paso 5 · Categoría y equipos del sorteo</div>
        <SectionHeader title={`${categoryLabel(t.settings.category, gender)} · ${editionInfo(edition).label} · ${t.teamPool.length} seleccionados`} />
        <p className="-mt-3 mb-4 text-sm text-mute">Todos los participantes juegan con equipos de la misma edición y categoría: clubes contra clubes o selecciones contra selecciones, sin mezclar masculinos y femeninos.</p>
        <TeamBrowser
          edition={edition}
          kind={t.settings.category}
          gender={gender}
          onCategoryChange={changeCategory}
          selected={t.teamPool}
          onChange={(ids) => {
            const err = setPool(ids);
            if (err) toast.error(err);
          }}
        />
      </section>

      <div className="no-print sticky bottom-4 z-40">
        <div className="glass flex flex-col items-stretch gap-3 p-3 shadow-[0_20px_60px_-10px_black] sm:flex-row sm:items-center sm:gap-4 sm:p-4">
          <div className="min-w-0 flex-1 text-xs sm:text-sm">
            {problems.length ? (
              <span className="flex items-center gap-2 text-blaze"><AlertTriangle className="size-4 shrink-0" /> {problems[0]}</span>
            ) : (
              <span className="flex items-center gap-2 text-neon"><Check className="size-4" /> Todo listo: {n} jugadores, {t.settings.format === "league" ? "liga" : "eliminatorias"}, {t.teamPool.length} equipos de {editionInfo(edition).label}.</span>
            )}
          </div>
          <Button size="lg" onClick={goDraw} disabled={problems.length > 0} className="w-full sm:w-auto">
            Ir al sorteo <ArrowRight className="size-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function Participants() {
  const t = useTournament((s) => s.current)!;
  const add = useTournament((s) => s.addParticipant);
  const remove = useTournament((s) => s.removeParticipant);
  const [name, setName] = useState("");
  const [target, setTarget] = useState(8);
  const inputRef = useRef<HTMLInputElement>(null);
  const n = t.participants.length;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // Admite varios nombres separados por comas.
    const names = name.split(",").map((s) => s.trim()).filter(Boolean);
    if (!names.length) return;
    let added = 0;
    for (const nm of names) {
      const err = add(nm);
      if (err) toast.error(err);
      else added++;
    }
    if (added) setName("");
    inputRef.current?.focus();
  };

  const fillTo = async () => {
    if (target < n) {
      const ok = await confirmDialog({
        title: `¿Reducir a ${target} participantes?`,
        body: `Se eliminarán los últimos ${n - target} inscritos.`,
        danger: true,
        confirmLabel: "Reducir",
      });
      if (!ok) return;
      t.participants.slice(target).forEach((p) => remove(p.id));
      return;
    }
    let i = 1;
    for (let k = n; k < target && i < 200; k++) {
      while (i < 200 && add(`Jugador ${i}`)) i++;
      i++;
    }
  };

  return (
    <section>
      <div className="kicker mb-3">Paso 3 · Participantes</div>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="glass p-5">
          <form onSubmit={submit} className="flex gap-2">
            <label className="flex-1">
              <span className="sr-only">Nombre del participante</span>
              <input ref={inputRef} className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del jugador (o varios separados por comas)" maxLength={200} />
            </label>
            <Button type="submit" disabled={!name.trim() || n >= MAX_PARTICIPANTS}>
              <Plus className="size-4" /> <span className="hidden sm:inline">Añadir</span>
            </Button>
          </form>

          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            <AnimatePresence initial={false}>
              {t.participants.map((p, i) => (
                <ParticipantRow key={p.id} p={p} index={i} />
              ))}
            </AnimatePresence>
          </ul>
          {n === 0 && (
            <div className="mt-6 flex flex-col items-center gap-2 py-8 text-center text-mute">
              <Users className="size-10" />
              <p>Aún no hay jugadores. Añádelos uno a uno o genera las plazas con el selector de cantidad.</p>
            </div>
          )}
        </div>

        <div className="glass flex flex-col gap-4 p-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-mute">Inscritos</div>
            <div className="display text-6xl font-black"><span className="text-neon">{n}</span><span className="text-2xl text-mute"> / {MAX_PARTICIPANTS}</span></div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-mute" htmlFor="target">Cantidad de jugadores</label>
            <div className="mt-2 flex items-center gap-2">
              <input id="target" type="number" min={2} max={MAX_PARTICIPANTS} value={target} onChange={(e) => setTarget(Math.max(2, Math.min(MAX_PARTICIPANTS, +e.target.value || 2)))} className="field num w-24 text-center text-lg font-bold" />
              <Button variant="secondary" onClick={fillTo} disabled={target === n}>
                <Sparkles className="size-4" /> Ajustar
              </Button>
            </div>
            <p className="mt-2 text-xs text-mute">Crea plazas &ldquo;Jugador N&rdquo; que luego puedes renombrar, o recorta la lista.</p>
          </div>
          <StructurePreview n={n} settings={t.settings} />
        </div>
      </div>
      <InvitePanel max={target} />
    </section>
  );
}

function ParticipantRow({ p, index }: { p: Participant; index: number }) {
  const edit = useTournament((s) => s.editParticipant);
  const remove = useTournament((s) => s.removeParticipant);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(p.name);

  const save = () => {
    const err = edit(p.id, { name: value });
    if (err) {
      toast.error(err);
      return;
    }
    setEditing(false);
  };

  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12, height: 0 }}
      className="group flex items-center gap-3 rounded-xl border border-line bg-ink/40 px-3 py-2"
      style={{ boxShadow: `inset 3px 0 0 ${p.color}` }}
    >
      <span className="num w-5 text-xs font-bold text-mute">{index + 1}</span>
      <label className="relative cursor-pointer" title="Cambiar color">
        <PlayerDot color={p.color} size={14} />
        <input type="color" list="player-colors" value={p.color} onChange={(e) => edit(p.id, { color: e.target.value })} className="absolute inset-0 size-full cursor-pointer opacity-0" aria-label={`Color de ${p.name}`} />
      </label>
      {editing ? (
        <form className="flex flex-1 gap-1" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <input autoFocus className="field !py-1" value={value} maxLength={24} onChange={(e) => setValue(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === "Escape" && (setValue(p.name), setEditing(false))} aria-label="Nuevo nombre" />
        </form>
      ) : (
        <button className="flex-1 truncate text-left font-semibold" onClick={() => { setValue(p.name); setEditing(true); }} title="Editar nombre">
          {p.name}
        </button>
      )}
      <button onClick={() => { setValue(p.name); setEditing(true); }} className="text-mute opacity-60 transition hover:text-white group-hover:opacity-100" aria-label={`Editar ${p.name}`}>
        <Pencil className="size-4" />
      </button>
      <button onClick={() => remove(p.id)} className="text-mute opacity-60 transition hover:text-danger group-hover:opacity-100" aria-label={`Eliminar ${p.name}`}>
        <Trash2 className="size-4" />
      </button>
      <datalist id="player-colors">{PLAYER_COLORS.map((c) => <option key={c} value={c} />)}</datalist>
    </motion.li>
  );
}

function StructurePreview({ n, settings }: { n: number; settings: TournamentSettings }) {
  if (n < 2) return <p className="text-sm text-mute">Con 2 o más jugadores verás aquí la estructura del torneo.</p>;
  if (settings.format === "league") {
    const rounds = (n % 2 ? n : n - 1) * settings.legs;
    const matches = ((n * (n - 1)) / 2) * settings.legs;
    return (
      <div className="rounded-xl border border-line bg-ink/40 p-4 text-sm">
        <div className="mb-2 flex items-center gap-2 font-semibold"><ListOrdered className="size-4 text-neon" /> Estructura de liga</div>
        <ul className="space-y-1 text-soft">
          <li><b className="num text-white">{matches}</b> partidos en <b className="num text-white">{rounds}</b> jornadas</li>
          <li>Cada jugador disputa <b className="num text-white">{(n - 1) * settings.legs}</b> partidos</li>
          {n % 2 === 1 && <li className="text-blaze">Número impar: descansa un jugador por jornada</li>}
        </ul>
      </div>
    );
  }
  const size = bracketSize(n);
  const byes = size - n;
  const rounds = Math.log2(size);
  return (
    <div className="rounded-xl border border-line bg-ink/40 p-4 text-sm">
      <div className="mb-2 flex items-center gap-2 font-semibold"><GitBranch className="size-4 text-neon" /> Estructura eliminatoria</div>
      <ul className="space-y-1 text-soft">
        <li>Cuadro de <b className="num text-white">{size}</b> · <b className="num text-white">{rounds}</b> rondas</li>
        <li><b className="num text-white">{n - 1 + (settings.thirdPlace && n >= 4 ? 1 : 0)}</b> partidos en total</li>
        {byes > 0 && <li className="text-blaze"><b className="num">{byes}</b> {byes === 1 ? "jugador pasa" : "jugadores pasan"} directo (BYE)</li>}
      </ul>
    </div>
  );
}

function Format() {
  const t = useTournament((s) => s.current)!;
  const update = useTournament((s) => s.updateSettings);
  const s = t.settings;

  return (
    <section>
      <div className="kicker mb-3">Paso 4 · Modalidad y reglas</div>
      <div className="grid gap-4 md:grid-cols-2">
        <FormatCard active={s.format === "league"} onClick={() => update({ format: "league" })} icon={<ListOrdered className="size-7" />} title="Liga" text="Todos contra todos. Puntos, tabla y campeón por regularidad." />
        <FormatCard active={s.format === "knockout"} onClick={() => update({ format: "knockout" })} icon={<GitBranch className="size-7" />} title="Eliminatorias" text="Llaves a partido único. Quien pierde, se va a casa." />
      </div>

      <div className="glass mt-4 grid gap-5 p-5 md:grid-cols-2 lg:grid-cols-3">
        {s.format === "league" ? (
          <>
            <Segmented label="Vueltas" value={s.legs} onChange={(v) => update({ legs: v })} options={[[1, "Solo ida"], [2, "Ida y vuelta"]]} />
            <Segmented label="Desempate (tras puntos)" value={s.tiebreak} onChange={(v) => update({ tiebreak: v })} options={[["gd", "Diferencia de goles"], ["h2h", "Enfrentamiento directo"]]} />
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-mute">Puntos (V / E / D)</div>
              <div className="flex gap-2">
                {(["win", "draw", "loss"] as const).map((k) => (
                  <input key={k} type="number" min={0} max={10} value={s.points[k]} aria-label={`Puntos por ${k === "win" ? "victoria" : k === "draw" ? "empate" : "derrota"}`} onChange={(e) => update({ points: { ...s.points, [k]: Math.max(0, Math.min(10, +e.target.value || 0)) } })} className="field num w-16 text-center font-bold" />
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <Toggle label="Partido por el tercer puesto" checked={s.thirdPlace} onChange={(v) => update({ thirdPlace: v })} hint="Requiere 4 o más jugadores." />
            <div className="text-sm text-soft">
              <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-mute">Empates</div>
              Si un partido termina empatado se define por <b className="text-white">penaltis</b> (introduce la tanda) o eligiendo el ganador manualmente.
            </div>
          </>
        )}
        <Toggle label="Permitir equipos repetidos" checked={s.allowRepeatTeams} onChange={(v) => update({ allowRepeatTeams: v })} hint="Desactivado: cada jugador recibe un club distinto." />
        <label>
          <span className="mb-2 block text-xs font-semibold uppercase tracking-widest text-mute">Cronómetro por partido (min)</span>
          <input type="number" min={1} max={90} value={s.matchMinutes} onChange={(e) => update({ matchMinutes: Math.max(1, Math.min(90, +e.target.value || 1)) })} className="field num w-24 text-center font-bold" />
        </label>
      </div>
    </section>
  );
}

function FormatCard({ active, onClick, icon, title, text }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; text: string }) {
  return (
    <button onClick={onClick} aria-pressed={active} className={`glass glass-hover relative flex items-center gap-4 overflow-hidden p-5 text-left ${active ? "!border-neon/60" : "opacity-70 hover:opacity-100"}`}>
      {active && <motion.div layoutId="format-glow" className="absolute inset-0 bg-[radial-gradient(circle_at_0%_50%,rgb(61_255_139/0.18),transparent_60%)]" />}
      <div className={`relative grid size-14 place-items-center rounded-xl ${active ? "bg-neon text-ink" : "bg-white/5 text-soft"}`}>{icon}</div>
      <div className="relative">
        <div className="display text-3xl font-extrabold">{title}</div>
        <div className="text-sm text-soft">{text}</div>
      </div>
    </button>
  );
}

function Segmented<T extends string | number>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-mute">{label}</div>
      <div className="inline-flex rounded-xl border border-line bg-ink/50 p-1" role="radiogroup" aria-label={label}>
        {options.map(([v, l]) => (
          <button key={String(v)} role="radio" aria-checked={value === v} onClick={() => onChange(v)} className={`relative rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${value === v ? "text-ink" : "text-soft hover:text-white"}`}>
            {value === v && <motion.span layoutId={`seg-${label}`} className="absolute inset-0 rounded-lg bg-neon" />}
            <span className="relative">{l}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <div>
      <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex items-center gap-3 text-left">
        <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-neon" : "bg-steel"}`}>
          <motion.span layout className={`absolute top-0.5 size-5 rounded-full bg-white shadow ${checked ? "right-0.5" : "left-0.5"}`} />
        </span>
        <span className="font-semibold">{label}</span>
      </button>
      {hint && <p className="ml-14 mt-1 text-xs text-mute">{hint}</p>}
    </div>
  );
}
