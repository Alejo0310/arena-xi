export interface DrawResult {
  participantId: string;
  teamId: string;
  envelopeIndex?: number;
}

/**
 * Contrato común de las mecánicas de sorteo.
 * `decide` genera y guarda el resultado (aleatorio) ANTES de animar;
 * `onRevealed` se llama cuando la animación termina para mostrar la revelación.
 */
export interface StageProps {
  pool: string[];
  decide: (choice?: { teamId?: string; envelopeIndex?: number }) => DrawResult | null;
  onRevealed: (r: DrawResult) => void;
  busy: boolean;
}
