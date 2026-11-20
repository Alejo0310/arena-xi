import type { Team } from "@/lib/types";

/**
 * Insignia generada con los colores del club. No reproduce escudos oficiales
 * (marcas registradas); sirve como identificador visual propio.
 */
export function TeamCrest({ team, size = 40, className = "" }: { team?: Team; size?: number; className?: string }) {
  if (!team) {
    return (
      <div
        className={`grid shrink-0 place-items-center rounded-lg border border-dashed border-line text-mute ${className}`}
        style={{ width: size, height: size }}
        aria-hidden
      >
        ?
      </div>
    );
  }
  const [a, b] = team.colors;
  const gid = `g-${team.id}`;
  const fs = team.short.length > 3 ? 13 : 15;
  return (
    <svg width={size} height={size} viewBox="0 0 48 56" className={`shrink-0 drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)] ${className}`} role="img" aria-label={`Insignia de ${team.name}`}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={shade(a, -0.25)} />
        </linearGradient>
      </defs>
      <path d="M24 2 L45 9 V27 C45 41 35 50 24 54 C13 50 3 41 3 27 V9 Z" fill={`url(#${gid})`} stroke={b} strokeWidth="2.5" />
      <path d="M3 30 C14 26 34 26 45 30 L45 34 C34 30 14 30 3 34 Z" fill={b} opacity="0.85" />
      <text
        x="24"
        y="24"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="var(--font-saira), sans-serif"
        fontWeight="900"
        fontSize={fs}
        fill={contrast(a)}
        letterSpacing="0.5"
      >
        {team.short}
      </text>
    </svg>
  );
}

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shade(hex: string, amt: number) {
  const [r, g, b] = hexToRgb(hex).map((c) => Math.max(0, Math.min(255, Math.round(c * (1 + amt)))));
  return `rgb(${r},${g},${b})`;
}

function contrast(hex: string) {
  const [r, g, b] = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#0b0e13" : "#ffffff";
}
