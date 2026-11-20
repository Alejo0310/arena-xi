"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { DrawMode, Participant, Tournament, TournamentSettings } from "@/lib/types";
import { uid } from "@/lib/random";
import { DEFAULT_POOL } from "@/lib/teams";
import { PLAYER_COLORS, generateTournamentName } from "@/lib/names";
import * as draw from "@/lib/draw";
import * as engine from "@/lib/tournament/engine";
import type { ResultInput } from "@/lib/tournament/match";
import { setSoundEnabled } from "@/lib/sound";
import { isTournament } from "@/lib/share";

export const DEFAULT_SETTINGS: TournamentSettings = {
  format: "league",
  legs: 1,
  thirdPlace: true,
  tiebreak: "gd",
  points: { win: 3, draw: 1, loss: 0 },
  allowRepeatTeams: false,
  matchMinutes: 12,
};

export const MAX_PARTICIPANTS = 32;

function blankTournament(base?: Partial<Tournament>): Tournament {
  const now = Date.now();
  return {
    id: uid("t"),
    name: generateTournamentName(),
    createdAt: now,
    updatedAt: now,
    phase: "setup",
    settings: { ...DEFAULT_SETTINGS },
    participants: [],
    teamPool: [...DEFAULT_POOL],
    assignments: {},
    drawHistory: [],
    draw: null,
    matches: [],
    championId: null,
    ...base,
  };
}

type Err = string | null;

interface State {
  current: Tournament | null;
  history: Tournament[];
  sound: boolean;

  newTournament: (opts?: { keepParticipants?: boolean }) => void;
  rename: (name: string) => void;
  updateSettings: (patch: Partial<TournamentSettings>) => void;
  addParticipant: (name: string) => Err;
  editParticipant: (id: string, patch: Partial<Omit<Participant, "id">>) => Err;
  removeParticipant: (id: string) => void;
  setPool: (ids: string[]) => void;

  startDraw: (mode: DrawMode) => Err;
  selectPot: (index: number) => void;
  assign: (participantId: string, teamId: string, envelopeIndex?: number) => void;
  resetDraw: () => void;

  startTournament: () => Err;
  recordResult: (matchId: string, r: ResultInput) => Err;
  resetResult: (matchId: string) => void;
  setLive: (matchId: string, live: boolean) => void;

  openFromHistory: (id: string) => void;
  deleteFromHistory: (id: string) => void;
  importTournament: (t: unknown) => Err;
  toggleSound: () => void;
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
              keep ? { participants: prev.participants, settings: prev.settings, teamPool: prev.teamPool } : undefined,
            ),
          });
        },

        rename: (name) => mutate((t) => ({ ...t, name: name.slice(0, 60) })),

        updateSettings: (patch) => {
          if (!editable()) return;
          mutate((t) => invalidateDraw({ ...t, settings: { ...t.settings, ...patch } }));
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
          if (!editable()) return;
          mutate((t) => invalidateDraw({ ...t, teamPool: [...new Set(ids)] }));
        },

        startDraw: (mode) => {
          const t = editable();
          if (!t) return "El torneo ya ha comenzado.";
          const err = draw.drawError(t, mode);
          if (err) return err;
          mutate((x) => ({ ...x, phase: "draw", draw: draw.initDraw(x, mode), assignments: {}, drawHistory: [] }));
          return null;
        },

        selectPot: (index) => mutate((t) => (t.draw ? { ...t, draw: draw.selectPot(t.draw, index) } : t)),

        assign: (participantId, teamId, envelopeIndex) =>
          mutate((t) => {
            if (!t.draw || draw.currentParticipant(t.draw) !== participantId || t.assignments[participantId]) return t;
            return {
              ...t,
              draw: draw.commitPick(t.draw, teamId, t.settings.allowRepeatTeams, envelopeIndex),
              assignments: { ...t.assignments, [participantId]: teamId },
              drawHistory: [...t.drawHistory, draw.record(participantId, teamId, t.draw.mode, envelopeIndex)],
            };
          }),

        resetDraw: () => {
          if (!editable()) return;
          mutate((t) => ({ ...t, phase: "setup", draw: null, assignments: {}, drawHistory: [] }));
        },

        startTournament: () => {
          const t = get().current;
          if (!t || t.phase !== "draw") return "Primero realiza el sorteo.";
          const ids = t.participants.map((p) => p.id);
          if (!draw.validateAssignments(t.assignments, ids, t.settings.allowRepeatTeams)) return "Faltan participantes por recibir equipo.";
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
          set({ current: t, history: archive(history.filter((h) => h.id !== id), current) });
        },

        deleteFromHistory: (id) => set({ history: get().history.filter((h) => h.id !== id) }),

        importTournament: (data) => {
          if (!isTournament(data)) return "El archivo no es un torneo válido.";
          const t = { ...data, id: uid("t"), updatedAt: Date.now() };
          set({ current: t, history: archive(get().history, get().current) });
          return null;
        },

        toggleSound: () => {
          const sound = !get().sound;
          setSoundEnabled(sound);
          set({ sound });
        },
      };
    },
    {
      name: "fc25-tournament-manager",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => setSoundEnabled(!!state?.sound),
    },
  ),
);

/** Torneos finalizados (actual + historial) para el ranking histórico. */
export function allTournaments(current: Tournament | null, history: Tournament[]): Tournament[] {
  return current ? [current, ...history.filter((h) => h.id !== current.id)] : history;
}
