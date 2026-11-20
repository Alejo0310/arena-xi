export const BRAND = "ARENA XI";
export const SLOGAN = "Que gane el mejor";

/** Marca ARENA XI: escudo con monograma "XI" (los once titulares). */
export function Logo({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 52" aria-hidden className={`shrink-0 ${className}`}>
      <defs>
        <linearGradient id="arena-logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3dff8b" />
          <stop offset="1" stopColor="#2f9bff" />
        </linearGradient>
      </defs>
      <path d="M24 2 L44 8 V26 C44 38 35 46 24 50 C13 46 4 38 4 26 V8 Z" fill="#05070a" stroke="url(#arena-logo-g)" strokeWidth="3" strokeLinejoin="round" />
      {/* X */}
      <path d="M12 15 L18 15 L22.5 22.5 L18 30 L12 30 L16.5 22.5 Z M27 15 L21 15 L16.5 22.5 L21 30 L27 30 L22.5 22.5 Z" fill="url(#arena-logo-g)" />
      {/* I */}
      <rect x="30" y="15" width="6" height="15" rx="1" fill="url(#arena-logo-g)" />
      <path d="M13 36 H35" stroke="url(#arena-logo-g)" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="leading-none">
      <div className={`display font-black tracking-wide ${compact ? "text-lg" : "text-xl"}`}>
        ARENA <span className="text-neon">XI</span>
      </div>
      {!compact && <div className="mt-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.25em] text-mute">{SLOGAN}</div>}
    </div>
  );
}
