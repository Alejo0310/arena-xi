"use client";

import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import type { RoomLink } from "@/lib/roomTypes";
import type { DrawMode, PotsConfig, GameEdition, Gender, Participant, PendingPick, Team, TeamKind, Tournament, TournamentSettings } from "@/lib/types";
import { uid } from "@/lib/random";
import { defaultPool, getTeam, setActiveSnapshot, snapshotOf } from "@/lib/teams";
import { PLAYER_COLORS, generateTournamentName } from "@/lib/names";
import * as draw from "@/lib/draw";
import * as engine from "@/lib/tournament/engine";
import type { ResultInput } from "@/lib/tournament/match";
import { setSoundEnabled } from "@/lib/sound";
import { isTournament } from "@/lib/share";
import { categoryError, isKind, sanitizePool, scopeOf, tournamentCategoryError } from "@/lib/category";
import { DEFAULT_EDITION, isEdition, isGender } from "@/lib/editions";

export const DEFAULT_SETTINGS: TournamentSettings = {
  format: "league",
  category: "club",
  edition: DEFAULT_EDITION,
  gender: "men",
  legs: 1,
  thirdPlace: true,
  tiebreak: "gd",
  points: { win: 3, draw: 1, loss: 0 },
  allowRepeatTeams: false,
  matchMinutes: 12,
};

export const MAX_PARTICIPANTS = 32;
export const STORAGE_KEY = "arena-xi";
/** Clave usada por versiones anteriores; se migra automáticamente. */
const LEGACY_KEY = "fc25-tournament-manager";

function blankTournament(base?: Partial<Tournament>): Tournament {
  const now = Date.now();
  const settings = { ...DEFAULT_SETTINGS, ...base?.settings };
  return {
    id: uid("t"),
    name: generateTournamentName(),
    createdAt: now,
    updatedAt: now,
    phase: "setup",
    participants: [],
    teamPool: defaultPool(settings.category, settings.edition, settings.gender),
    assignments: {},
    drawHistory: [],
    draw: null,
    matches: [],
    championId: null,
    ...base,
    settings,
  };
}

type Err = string | null;

interface State {
  current: Tournament | null;
  history: Tournament[];
  sound: boolean;

  newTournament: (opts?: { keepParticipants?: boolean }) => void;
  rename: (name: string) => void;
  updateSettings: (patch: Partial<Omit<TournamentSettings, "category" | "edition" | "gender">>) => void;
  /** Cambia categoría (y opcionalmente género). Reinicia la selección de equipos y el sorteo. */
  setCategory: (kind: TeamKind, gender?: Gender) => Err;
  /** Cambia la edición del juego. Reinicia la selección de equipos y el sorteo. */
  setEdition: (edition: GameEdition) => Err;
  addParticipant: (name: string) => Err;
  editParticipant: (id: string, patch: Partial<Omit<Participant, "id">>) => Err;
  removeParticipant: (id: string) => void;
  setPool: (ids: string[]) => Err;

  startDraw: (mode: DrawMode, pots?: PotsConfig) => Err;
  selectPot: (index: number) => void;
  /** Decide (y guarda como pendiente) el equipo del turno actual. No avanza el turno. */
  drawDecide: (choice?: draw.Choice) => { pending?: PendingPick; error?: string };
  /** Confirma el resultado pendiente y pasa al siguiente participante. */
  drawConfirm: () => Err;
  /** Asigna equipo a todos los que faltan de una vez. */
  drawRemaining: () => { participantId: string; teamId: string }[];
  resetDraw: () => void;

  startTournament: () => Err;
  recordResult: (matchId: string, r: ResultInput) => Err;
  resetResult: (matchId: string) => void;
  setLive: (matchId: string, live: boolean) => void;

  openFromHistory: (id: string) => void;
  deleteFromHistory: (id: string) => void;
  importTournament: (t: unknown) => Err;
  toggleSound: () => void;

  /** Sala de invitaciones (QR / código) del torneo actual. No contiene secretos. */
  setRoom: (room: RoomLink | null) => void;
  patchRoom: (patch: Partial<RoomLink>) => void;
  /** Aplica el estado de la sala (resultados registrados por otros) al torneo del host. */
  applyRemote: (remote: Tournament, version: number) => void;
}

function nameError(name: string, participants: Participant[], exceptId?: string): Err {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) return "El nombre no puede estar vacío.";
  if (clean.length > 24) return "Máximo 24 caracteres.";
  if (participants.some((p) => p.id !== exceptId && p.name.toLowerCase() === clean.toLowerCase())) return `"${clean}" ya está inscrito.`;
  return null;
}

/** Archiva el torneo actual si ya se había empezado a jugar. */
function archive(history: Tournament[], t: Tournament | null): Tournament[] {
  if (!t || t.phase === "setup" || t.phase === "draw") return history;
  return [t, ...history.filter((h) => h.id !== t.id)].slice(0, 50);
}

/** Cualquier cambio en la configuración invalida un sorteo en curso. */
function invalidateDraw(t: Tournament): Tournament {
  if (t.phase !== "draw") return t;
  return { ...t, phase: "setup", draw: null, assignments: {}, drawHistory: [] };
}

/**
 * Normaliza un torneo cargado (localStorage, importación o versiones antiguas):
 * añade la categoría si falta y, si su estado mezcla categorías, descarta el sorteo.
 */
/** Torneos guardados antes de las instantáneas: se congelan con los datos de FC 25 que usaban. */
function legacySnapshot(t: Tournament): Record<string, Team> | undefined {
  const ids = new Set<string>([...(t.teamPool ?? []), ...Object.values(t.assignments ?? {})]);
  const snap = snapshotOf([...ids].filter((id) => getTeam(id)));
  return Object.keys(snap).length ? snap : undefined;
}

export function normalizeTournament(raw: Tournament): Tournament {
  const settings = {
    ...DEFAULT_SETTINGS,
    ...raw.settings,
    category: isKind(raw.settings?.category) ? raw.settings.category : "club",
    edition: isEdition(raw.settings?.edition) ? raw.settings.edition : DEFAULT_EDITION,
    gender: isGender(raw.settings?.gender) ? raw.settings.gender : "men",
  } as TournamentSettings;
  let t: Tournament = { ...raw, settings, snapshot: raw.snapshot ?? legacySnapshot(raw), draw: raw.draw ? { ...raw.draw, id: raw.draw.id ?? uid("d"), pending: raw.draw.pending ?? null } : null };
  if (tournamentCategoryError(t) && (t.phase === "setup" || t.phase === "draw")) {
    t = { ...t, phase: "setup", draw: null, assignments: {}, drawHistory: [], teamPool: sanitizePool(t.teamPool, scopeOf(settings)) };
  }
  return t;
}

/** Lee la clave nueva y, si no existe, la de la versión anterior (sin perder torneos). */
const storage: StateStorage = {
  getItem: (name) => localStorage.getItem(name) ?? (name === STORAGE_KEY ? localStorage.getItem(LEGACY_KEY) : null),
  setItem: (name, value) => localStorage.setItem(name, value),
  removeItem: (name) => localStorage.removeItem(name),
};

export const useTournament = create<State>()(
  persist(
    (set, get) => {
      const mutate = (fn: (t: Tournament) => Tournament) => {
        const t = get().current;
        if (t) set({ current: { ...fn(t), updatedAt: Date.now() } });
      };
      const editable = () => {
        const t = get().current;
        return t && (t.phase === "setup" || t.phase === "draw") ? t : null;
      };

      return {
        current: null,
        history: [],
        sound: false,

        newTournament: (opts) => {
          const prev = get().current;
          const keep = opts?.keepParticipants && prev;
          set({
            history: archive(get().history, prev),
            current: blankTournament(
              keep ? { participants: prev.participants, settings: prev.settings, teamPool: sanitizePool(prev.teamPool, scopeOf(prev.settings)) } : undefined,
            ),
          });
        },

        rename: (name) => mutate((t) => ({ ...t, name: name.slice(0, 60) })),

        updateSettings: (patch) => {
          if (!editable()) return;
          // La categoría solo cambia mediante setCategory (que reinicia el pool).
          const { category: _c, edition: _e, gender: _g, ...safe } = patch as Partial<TournamentSettings>;
          void _c;
          void _e;
          void _g;
          mutate((t) => invalidateDraw({ ...t, settings: { ...t.settings, ...safe } }));
        },

        setCategory: (kind, gender) => {
          const t = editable();
          if (!t) return "El torneo ya ha comenzado: la categoría no se puede cambiar.";
          if (!isKind(kind)) return "Categoría no válida.";
          const g = gender ?? t.settings.gender ?? "men";
          if (!isGender(g)) return "Género no válido.";
          if (t.settings.category === kind && (t.settings.gender ?? "men") === g) return null;
          const pool = defaultPool(kind, t.settings.edition ?? DEFAULT_EDITION, g);
          mutate((x) => ({
            ...x,
            phase: "setup",
            draw: null,
            assignments: {},
            drawHistory: [],
            settings: { ...x.settings, category: kind, gender: g },
            teamPool: pool,
            snapshot: snapshotOf(pool),
          }));
          return null;
        },

        setEdition: (edition) => {
          const t = editable();
          if (!t) return "El torneo ya ha comenzado: la edición no se puede cambiar.";
          if (!isEdition(edition)) return "Edición no válida.";
          if ((t.settings.edition ?? DEFAULT_EDITION) === edition) return null;
          const pool = defaultPool(t.settings.category, edition, t.settings.gender ?? "men");
          mutate((x) => ({
            ...x,
            phase: "setup",
            draw: null,
            assignments: {},
            drawHistory: [],
            settings: { ...x.settings, edition },
            teamPool: pool,
            snapshot: snapshotOf(pool),
          }));
          return null;
        },

        addParticipant: (name) => {
          const t = editable();
          if (!t) return "El torneo ya ha comenzado.";
          if (t.participants.length >= MAX_PARTICIPANTS) return `Máximo ${MAX_PARTICIPANTS} participantes.`;
          const err = nameError(name, t.participants);
          if (err) return err;
          const used = new Set(t.participants.map((p) => p.color));
          const color = PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[t.participants.length % PLAYER_COLORS.length];
          mutate((x) => invalidateDraw({ ...x, participants: [...x.participants, { id: uid("p"), name: name.trim().replace(/\s+/g, " "), color }] }));
          return null;
        },

        editParticipant: (id, patch) => {
          const t = get().current;
          if (!t) return null;
          if (patch.name !== undefined) {
            const err = nameError(patch.name, t.participants, id);
            if (err) return err;
            patch = { ...patch, name: patch.name.trim().replace(/\s+/g, " ") };
          }
          // Renombrar o cambiar color no altera el torneo, así que se permite siempre.
          mutate((x) => ({ ...x, participants: x.participants.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
          return null;
        },

        removeParticipant: (id) => {
          if (!editable()) return;
          mutate((t) => invalidateDraw({ ...t, participants: t.participants.filter((p) => p.id !== id) }));
        },

        setPool: (ids) => {
          const t = editable();
          if (!t) return "El torneo ya ha comenzado.";
          const err = categoryError(ids, scopeOf(t.settings));
          if (err) return err;
          const pool = [...new Set(ids)];
          mutate((x) => invalidateDraw({ ...x, teamPool: pool, snapshot: snapshotOf(pool) }));
          return null;
        },

        startDraw: (mode, pots) => {
          const t = editable();
          if (!t) return "El torneo ya ha comenzado.";
          const cfg = mode === "pots" ? (pots ?? t.potsConfig) : undefined;
          const err = draw.drawError(t, mode, cfg);
          if (err) return err;
          mutate((x) => ({ ...x, ...(cfg ? { potsConfig: cfg } : {}), phase: "draw", draw: draw.initDraw(x, mode, cfg), assignments: {}, drawHistory: [] }));
          return null;
        },

        selectPot: (index) => mutate((t) => (t.draw ? { ...t, draw: draw.selectPot(t.draw, index) } : t)),

        drawDecide: (choice) => {
          const t = get().current;
          if (!t || t.phase !== "draw" || !t.draw) return { error: "No hay un sorteo en curso." };
          const res = draw.decidePick(t.draw, scopeOf(t.settings), choice);
          if (res.pending) mutate((x) => ({ ...x, draw: { ...x.draw!, pending: res.pending } }));
          return res;
        },

        drawConfirm: () => {
          const t = get().current;
          if (!t?.draw?.pending) return "No hay ningún resultado pendiente.";
          const res = draw.confirmPick(t.draw, t.settings.allowRepeatTeams);
          if (!res) return "El resultado pendiente no corresponde al turno actual.";
          mutate((x) => ({
            ...x,
            draw: res.state,
            assignments: { ...x.assignments, [res.record.participantId]: res.record.teamId },
            drawHistory: [...x.drawHistory, res.record],
          }));
          return null;
        },

        drawRemaining: () => {
          const t = get().current;
          if (!t || t.phase !== "draw" || !t.draw || t.draw.pending) return [];
          const results = draw.drawAll(t.draw, t.settings.allowRepeatTeams);
          let d = t.draw;
          const assignments = { ...t.assignments };
          const history = [...t.drawHistory];
          for (const r of results) {
            const res = draw.confirmPick({ ...d, pending: { ...r, at: Date.now() } }, t.settings.allowRepeatTeams);
            if (!res) break;
            d = res.state;
            assignments[r.participantId] = r.teamId;
            history.push(res.record);
          }
          mutate((x) => ({ ...x, draw: d, assignments, drawHistory: history }));
          return results;
        },

        resetDraw: () => {
          if (!editable()) return;
          mutate((t) => ({ ...t, phase: "setup", draw: null, assignments: {}, drawHistory: [] }));
        },

        startTournament: () => {
          const t = get().current;
          if (!t || t.phase !== "draw" || !t.draw) return "Primero realiza el sorteo.";
          if (!draw.isDrawComplete(t.draw)) return "El sorteo aún no ha terminado.";
          const ids = t.participants.map((p) => p.id);
          const catErr = tournamentCategoryError(t);
          if (catErr) return catErr;
          if (!draw.validateAssignments(t.assignments, ids, t.settings.allowRepeatTeams, scopeOf(t.settings))) return "Faltan participantes por recibir equipo.";
          mutate((x) => ({ ...x, phase: "playing", matches: engine.buildMatches(x), championId: null }));
          return null;
        },

        recordResult: (matchId, r) => {
          const t = get().current;
          if (!t || (t.phase !== "playing" && t.phase !== "finished")) return "No hay torneo en juego.";
          const res = engine.recordResult(t, matchId, r);
          if (res.error) return res.error;
          set({ current: res.tournament! });
          return null;
        },

        resetResult: (matchId) => mutate((t) => engine.resetResult(t, matchId)),

        setLive: (matchId, live) => mutate((t) => engine.setLive(t, matchId, live)),

        openFromHistory: (id) => {
          const { history, current } = get();
          const t = history.find((h) => h.id === id);
          if (!t) return;
          set({ current: normalizeTournament(t), history: archive(history.filter((h) => h.id !== id), current) });
        },

        deleteFromHistory: (id) => set({ history: get().history.filter((h) => h.id !== id) }),

        importTournament: (data) => {
          if (!isTournament(data)) return "El archivo no es un torneo válido.";
          const t = normalizeTournament({ ...data, id: uid("t"), updatedAt: Date.now() });
          const err = tournamentCategoryError(t);
          if (err) return `El torneo importado no es válido: ${err}`;
          set({ current: t, history: archive(get().history, get().current) });
          return null;
        },

        setRoom: (room) => {
          const t = get().current;
          if (!t) return;
          set({ current: { ...t, room: room ?? undefined, updatedAt: Date.now() } });
        },

        patchRoom: (patch) => {
          const t = get().current;
          if (!t?.room) return;
          set({ current: { ...t, room: { ...t.room, ...patch } } });
        },

        applyRemote: (remote, version) => {
          const t = get().current;
          if (!t?.room) return;
          set({
            current: {
              ...t,
              matches: remote.matches,
              championId: remote.championId,
              phase: remote.phase,
              finishedAt: remote.finishedAt,
              updatedAt: Date.now(),
              room: { ...t.room, version, published: true },
            },
          });
        },

        toggleSound: () => {
          const sound = !get().sound;
          setSoundEnabled(sound);
          set({ sound });
        },
      };
    },
    {
      name: STORAGE_KEY,
      version: 2,
      storage: createJSONStorage(() => storage),
      partialize: (s) => ({ current: s.current, history: s.history, sound: s.sound }),
      migrate: (persisted) => persisted as State,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        return {
          ...current,
          ...p,
          current: p.current ? normalizeTournament(p.current) : null,
          history: (p.history ?? []).map(normalizeTournament),
        };
      },
      onRehydrateStorage: () => (state) => setSoundEnabled(!!state?.sound),
    },
  ),
);

/** Torneos finalizados (actual + historial) para el ranking histórico. */
export function allTournaments(current: Tournament | null, history: Tournament[]): Tournament[] {
  return current ? [current, ...history.filter((h) => h.id !== current.id)] : history;
}

// El torneo activo manda: sus equipos congelados tienen prioridad sobre el catálogo vivo.
useTournament.subscribe((s, prev) => {
  if (s.current?.snapshot !== prev.current?.snapshot || s.current?.id !== prev.current?.id) setActiveSnapshot(s.current?.snapshot);
});
