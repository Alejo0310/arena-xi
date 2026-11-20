// Aleatoriedad criptográfica (sin sesgo de módulo) para sorteos transparentes.

export function randomInt(max: number): number {
  if (!Number.isInteger(max) || max <= 0) throw new Error(`randomInt: max inválido (${max})`);
  const c = globalThis.crypto;
  if (!c?.getRandomValues) return Math.floor(Math.random() * max);
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  let x: number;
  do {
    c.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return x % max;
}

/** Fisher–Yates; devuelve una copia barajada. */
export function shuffle<T>(items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pick<T>(items: readonly T[]): T {
  if (items.length === 0) throw new Error("pick: lista vacía");
  return items[randomInt(items.length)];
}

export function sample<T>(items: readonly T[], k: number): T[] {
  return shuffle(items).slice(0, Math.min(k, items.length));
}

export function uid(prefix = ""): string {
  const c = globalThis.crypto;
  const core = c?.randomUUID ? c.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return prefix ? `${prefix}_${core}` : core;
}
