import type { Match, MatchSource } from "../types";
import { clearResult, matchLoser, matchWinner } from "./match";

export function bracketSize(n: number): number {
  let s = 1;
  while (s < n) s *= 2;
  return Math.max(2, s);
}

/** Posiciones de siembra estándar: el 1 y el 2 solo pueden cruzarse en la final. */
export function seedOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const len = order.length * 2;
    order = order.flatMap((s) => [s, len + 1 - s]);
  }
  return order;
}

export function roundName(playersInRound: number): string {
  switch (playersInRound) {
    case 2: return "Final";
    case 4: return "Semifinales";
    case 8: return "Cuartos de final";
    case 16: return "Octavos de final";
    case 32: return "Dieciseisavos";
    default: return `Ronda de ${playersInRound}`;
  }
}

/**
 * Genera el cuadro. `seededIds` ya viene en orden aleatorio (posición = siembra).
 * Los primeros cabezas de serie reciben los descansos (BYE) cuando el número
 * de participantes no es potencia de 2.
 */
export function generateKnockout(seededIds: readonly string[], opts: { thirdPlace: boolean }): Match[] {
  const n = seededIds.length;
  if (n < 2) return [];
  const size = bracketSize(n);
  const rounds = Math.log2(size);
  const slots = seedOrder(size).map((seed) => (seed <= n ? seededIds[seed - 1] : null));
  const matches: Match[] = [];

  for (let r = 1; r <= rounds; r++) {
    const count = size / 2 ** r;
    const label = roundName(count * 2);
    for (let j = 0; j < count; j++) {
      const id = `K${r}-${j}`;
      const base: Match = { id, round: r, label, slot: j, homeId: null, awayId: null, homeGoals: null, awayGoals: null, status: "pending" };
      if (r === 1) {
        base.homeId = slots[2 * j];
        base.awayId = slots[2 * j + 1];
      } else {
        base.homeSource = { matchId: `K${r - 1}-${2 * j}`, outcome: "winner" };
        base.awaySource = { matchId: `K${r - 1}-${2 * j + 1}`, outcome: "winner" };
      }
      matches.push(base);
    }
  }

  if (opts.thirdPlace && n >= 4) {
    matches.push({
      id: "K3RD",
      round: rounds,
      label: "Tercer puesto",
      slot: 1,
      isThirdPlace: true,
      homeId: null,
      awayId: null,
      homeGoals: null,
      awayGoals: null,
      status: "pending",
      homeSource: { matchId: `K${rounds - 1}-0`, outcome: "loser" },
      awaySource: { matchId: `K${rounds - 1}-1`, outcome: "loser" },
    });
  }
  return resolveKnockout(matches);
}

function fromSource(src: MatchSource | undefined, byId: Map<string, Match>): string | null | undefined {
  if (!src) return undefined;
  const m = byId.get(src.matchId);
  if (!m) return null;
  return src.outcome === "winner" ? matchWinner(m) : matchLoser(m);
}

/**
 * Recalcula quién ocupa cada llave a partir de los resultados previos.
 * Si un resultado anterior cambia de ganador, los partidos dependientes cuyos
 * participantes ya no coinciden se reinician. Resuelve los BYE automáticamente.
 */
export function resolveKnockout(input: Match[]): Match[] {
  const ordered = [...input].sort((a, b) => a.round - b.round || Number(!!a.isThirdPlace) - Number(!!b.isThirdPlace) || (a.slot ?? 0) - (b.slot ?? 0));
  const byId = new Map<string, Match>();
  for (let m of ordered) {
    const home = fromSource(m.homeSource, byId);
    const away = fromSource(m.awaySource, byId);
    if (home !== undefined || away !== undefined) {
      const h = home === undefined ? m.homeId : home;
      const a = away === undefined ? m.awayId : away;
      if (h !== m.homeId || a !== m.awayId) {
        m = { ...clearResult(m), homeId: h, awayId: a };
      }
    }
    if (m.round === 1 && !m.homeSource) {
      const bye = (m.homeId === null) !== (m.awayId === null);
      if (bye && !m.isBye) m = { ...clearResult(m), isBye: true, status: "done" };
    }
    byId.set(m.id, m);
  }
  return input.map((m) => byId.get(m.id)!);
}

/** Partidos que se reiniciarían si el ganador de `matchId` cambiara. */
export function dependentMatches(matches: Match[], matchId: string): Match[] {
  const out: Match[] = [];
  const queue = [matchId];
  while (queue.length) {
    const id = queue.shift()!;
    for (const m of matches) {
      if (m.homeSource?.matchId === id || m.awaySource?.matchId === id) {
        if (!out.includes(m)) {
          out.push(m);
          queue.push(m.id);
        }
      }
    }
  }
  return out;
}

export function knockoutChampion(matches: Match[]): string | null {
  const final = finalMatch(matches);
  return final ? matchWinner(final) : null;
}

export function finalMatch(matches: Match[]): Match | undefined {
  const maxRound = Math.max(...matches.map((m) => m.round));
  return matches.find((m) => m.round === maxRound && !m.isThirdPlace);
}

/** Clasificación final de eliminatorias: campeón, subcampeón y tercero si existe. */
export function knockoutPodium(matches: Match[]): { first: string | null; second: string | null; third: string | null } {
  const final = finalMatch(matches);
  const third = matches.find((m) => m.isThirdPlace);
  return {
    first: final ? matchWinner(final) : null,
    second: final ? matchLoser(final) : null,
    third: third ? matchWinner(third) : null,
  };
}
