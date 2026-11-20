import type { FlagSpec, Team } from "@/lib/types";

const SHIELD = "M24 2 L45 9 V27 C45 41 35 50 24 54 C13 50 3 41 3 27 V9 Z";

/**
 * Insignia del equipo. Clubes: escudo generado con sus colores. Selecciones: su
 * bandera dentro del escudo. No reproduce escudos oficiales (marcas registradas).
 */
export function TeamCrest({ team, size = 40, className = "" }: { team?: Team; size?: number; className?: string }) {
  if (!team) {
    return (
      <div className={`grid shrink-0 place-items-center rounded-lg border border-dashed border-line text-mute ${className}`} style={{ width: size, height: size }} aria-hidden>
        ?
      </div>
    );
  }
  return team.kind === "national" && team.flag ? <NationalCrest team={team} flag={team.flag} size={size} className={className} /> : <ClubCrest team={team} size={size} className={className} />;
}

function ClubCrest({ team, size, className }: { team: Team; size: number; className: string }) {
  const [a, b] = team.colors;
  const gid = `g-${team.id}`;
  const fs = team.short.length > 3 ? 13 : 15;
  return (
    <svg width={size} height={size} viewBox="0 0 48 56" className={`shrink-0 ${className}`} role="img" aria-label={`Insignia de ${team.name}`}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={shade(a, -0.25)} />
        </linearGradient>
      </defs>
      <path d={SHIELD} fill={`url(#${gid})`} stroke={b} strokeWidth="2.5" />
      <path d="M3 30 C14 26 34 26 45 30 L45 34 C34 30 14 30 3 34 Z" fill={b} opacity="0.85" />
      <text x="24" y="24" textAnchor="middle" dominantBaseline="middle" fontFamily="var(--font-saira), sans-serif" fontWeight="900" fontSize={fs} fill={contrast(a)} letterSpacing="0.5">
        {team.short}
      </text>
    </svg>
  );
}

function NationalCrest({ team, flag, size, className }: { team: Team; flag: FlagSpec; size: number; className: string }) {
  const cid = `f-${team.id}`;
  return (
    <svg width={size} height={size} viewBox="0 0 48 56" className={`shrink-0 ${className}`} role="img" aria-label={`Bandera de la selección de ${team.name}`}>
      <defs>
        <clipPath id={cid}>
          <path d={SHIELD} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${cid})`}>
        <Stripes flag={flag} />
        <Emblem flag={flag} />
        <rect x="0" y="40" width="48" height="16" fill="#05070a" opacity="0.78" />
        <text x="24" y="48.5" textAnchor="middle" dominantBaseline="middle" fontFamily="var(--font-saira), sans-serif" fontWeight="900" fontSize="9.5" fill="#ffffff" letterSpacing="1">
          {team.short}
        </text>
      </g>
      <path d={SHIELD} fill="none" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="2" />
    </svg>
  );
}

/** Franjas de la bandera dentro del área del escudo (48×42 útiles sobre la etiqueta). */
function Stripes({ flag }: { flag: FlagSpec }) {
  const ratios = flag.ratios ?? flag.stripes.map(() => 1);
  const total = ratios.reduce((a, b) => a + b, 0);
  const W = 48;
  const H = 42;
  let offset = 0;
  return (
    <>
      {flag.stripes.map((c, i) => {
        const len = ((flag.layout === "h" ? H : W) * ratios[i]) / total;
        const r = flag.layout === "h" ? <rect key={i} x="0" y={offset} width={W} height={len + 0.5} fill={c} /> : <rect key={i} x={offset} y="0" width={len + 0.5} height="56" fill={c} />;
        offset += len;
        return r;
      })}
      {flag.layout === "h" && <rect x="0" y={H} width={W} height="14" fill={flag.stripes[flag.stripes.length - 1]} />}
    </>
  );
}

function Emblem({ flag }: { flag: FlagSpec }) {
  const c = flag.emblemColor ?? "#ffffff";
  switch (flag.emblem) {
    case "cross":
      return (
        <>
          <rect x="20.5" y="0" width="7" height="56" fill={c} />
          <rect x="0" y="17.5" width="48" height="7" fill={c} />
        </>
      );
    case "sun":
      return <circle cx="24" cy="21" r="4.6" fill={c} stroke="#85340a" strokeWidth="0.6" />;
    case "star":
      return <path d="M24 10 L27.1 19.6 L37.2 19.6 L29 25.5 L32.1 35.1 L24 29.2 L15.9 35.1 L19 25.5 L10.8 19.6 L20.9 19.6 Z" fill="none" stroke={c} strokeWidth="1.8" strokeLinejoin="round" />;
    case "checker":
      return (
        <g transform="translate(17 13)">
          <rect width="14" height="16" rx="2" fill="#ffffff" />
          {Array.from({ length: 20 }, (_, k) => {
            const x = k % 4;
            const y = Math.floor(k / 4);
            return (x + y) % 2 === 0 ? <rect key={k} x={x * 3.5} y={y * 3.2} width="3.5" height="3.2" fill={c} /> : null;
          })}
        </g>
      );
    default:
      return null;
  }
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
