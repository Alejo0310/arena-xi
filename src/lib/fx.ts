import confetti from "canvas-confetti";

const NEON = ["#3dff8b", "#2f9bff", "#ff7a1a", "#ffffff"];
const GOLD = ["#ffd23d", "#fff3b0", "#ffb000", "#ffffff"];

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function burst(colors = NEON) {
  if (prefersReducedMotion()) return;
  void confetti({ particleCount: 90, spread: 75, startVelocity: 42, origin: { y: 0.6 }, colors, disableForReducedMotion: true });
}

/** Celebración larga para campeones: cañones laterales durante unos segundos. */
export function championCelebration(durationMs = 3500) {
  if (prefersReducedMotion()) return;
  const end = Date.now() + durationMs;
  const frame = () => {
    void confetti({ particleCount: 5, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors: GOLD, disableForReducedMotion: true });
    void confetti({ particleCount: 5, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors: GOLD, disableForReducedMotion: true });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}
