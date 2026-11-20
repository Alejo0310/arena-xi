import type { Team } from "@/lib/types";
import { TeamCrest } from "@/components/ui/TeamCrest";

/**
 * Versión ligera del núcleo de sorteo (SVG + CSS, sin WebGL): balón con costuras
 * de neón, anillos de energía en perspectiva y escudos en órbita. Todas las
 * animaciones son transform en CSS (compositor) y se detienen con movimiento reducido.
 * Sin filtros ni sombras con desenfoque: los brillos son degradados radiales,
 * mucho más baratos de pintar en móviles.
 */
export function HeroFallback({ teams }: { teams: Team[] }) {
  return (
    <div className="relative size-full [perspective:900px]" aria-hidden>
      <div className="absolute left-1/2 top-1/2 size-[78%] max-h-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(61_255_139/0.22),rgb(47_155_255/0.08)_45%,transparent_70%)]" />

      {/* Anillos en perspectiva */}
      <div className="absolute left-1/2 top-1/2 aspect-square h-[78%] -translate-x-1/2 -translate-y-1/2 [transform-style:preserve-3d]">
        <div className="absolute inset-0 [transform:rotateX(72deg)]">
          <div className="size-full animate-[spin_14s_linear_infinite] rounded-full border-2 border-neon/70" style={{ borderStyle: "dashed" }} />
        </div>
        <div className="absolute inset-[6%] [transform:rotateX(64deg)_rotateY(18deg)]">
          <div className="size-full animate-[spin_20s_linear_infinite_reverse] rounded-full border border-volt/70" />
        </div>
      </div>

      {/* Escudos en órbita: el contenedor gira y cada escudo contra-gira para quedar derecho */}
      <div className="absolute left-1/2 top-1/2 aspect-square h-[88%] -translate-x-1/2 -translate-y-1/2 animate-[spin_36s_linear_infinite]">
        {teams.map((t, i) => {
          const a = (i / teams.length) * Math.PI * 2;
          return (
            <div key={t.id} className="absolute" style={{ left: `${50 + Math.cos(a) * 47}%`, top: `${50 + Math.sin(a) * 47}%`, transform: "translate(-50%, -50%)" }}>
              <div className="animate-[spin_36s_linear_infinite_reverse]">
                <div className="rounded-xl border border-neon/40 bg-ink/85 p-1.5">
                  <TeamCrest team={t} size={30} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Balón */}
      <div className="absolute left-1/2 top-1/2 aspect-square h-[44%] -translate-x-1/2 -translate-y-1/2 animate-float">
        <div className="absolute -inset-[18%] rounded-full bg-[radial-gradient(circle,rgb(61_255_139/0.35),transparent_65%)]" />
        <svg viewBox="-50 -50 100 100" className="relative size-full">
          <defs>
            <radialGradient id="hero-ball" cx="35%" cy="30%" r="75%">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.6" stopColor="#c9d2de" />
              <stop offset="1" stopColor="#4b5563" />
            </radialGradient>
            <clipPath id="hero-ball-clip">
              <circle r="46" />
            </clipPath>
          </defs>
          <circle r="46" fill="url(#hero-ball)" />
          <g clipPath="url(#hero-ball-clip)" stroke="#3dff8b" strokeWidth="1.6" strokeLinejoin="round">
            <polygon points="0,-14 13.3,-4.3 8.2,11.3 -8.2,11.3 -13.3,-4.3" fill="#0b0e13" />
            {[0, 72, 144, 216, 288].map((deg) => (
              <g key={deg} transform={`rotate(${deg})`}>
                <line x1="0" y1="-14" x2="0" y2="-28" />
                <polygon points="0,-28 12,-36 9,-50 -9,-50 -12,-36" fill="#0b0e13" />
              </g>
            ))}
            {[36, 108, 180, 252, 324].map((deg) => (
              <line key={deg} transform={`rotate(${deg})`} x1="0" y1="-11.3" x2="0" y2="-40" strokeOpacity="0.55" />
            ))}
          </g>
          <circle r="46" fill="none" stroke="#3dff8b" strokeOpacity="0.6" strokeWidth="1.2" />
        </svg>
      </div>

      {/* Pedestal */}
      <div className="absolute bottom-[4%] left-1/2 h-[10%] w-[46%] -translate-x-1/2 rounded-[50%] border border-neon/40 bg-[radial-gradient(ellipse,rgb(47_155_255/0.35),transparent_70%)]" />
    </div>
  );
}
