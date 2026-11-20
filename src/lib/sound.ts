// Efectos de sonido sintetizados con Web Audio (sin archivos externos).

type Sfx = "tick" | "whoosh" | "reveal" | "goal" | "champion" | "click";

let ctx: AudioContext | null = null;
let enabled = false;

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.15, endFreq?: number) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + start;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export function play(sfx: Sfx) {
  if (!enabled) return;
  switch (sfx) {
    case "tick": return tone(1400, 0, 0.03, "square", 0.04);
    case "click": return tone(600, 0, 0.05, "triangle", 0.08);
    case "whoosh": return tone(200, 0, 0.45, "sawtooth", 0.05, 1200);
    case "reveal":
      tone(523, 0, 0.18, "triangle", 0.12);
      tone(659, 0.1, 0.18, "triangle", 0.12);
      return tone(784, 0.2, 0.4, "triangle", 0.14);
    case "goal":
      tone(392, 0, 0.12, "square", 0.07);
      return tone(784, 0.1, 0.3, "square", 0.07);
    case "champion":
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.14, 0.32, "triangle", 0.13));
      return;
  }
}
