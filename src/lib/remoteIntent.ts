import { create } from "zustand";
import type { DrawIntent } from "./roomTypes";

/** Petición pendiente de un jugador remoto (solo en memoria del host; no se persiste). */
export const useRemoteIntent = create<{ intent: DrawIntent | null; setIntent: (i: DrawIntent | null) => void }>((set) => ({
  intent: null,
  setIntent: (intent) => set({ intent }),
}));

/** ¿Es este participante un invitado que juega desde su propio dispositivo? */
export const isRemotePlayer = (guests: string[] | undefined, name: string | undefined) =>
  !!name && !!guests?.some((g) => g.trim().replace(/\s+/g, " ").toLowerCase() === name.trim().replace(/\s+/g, " ").toLowerCase());
