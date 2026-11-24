/**
 * Logique pure du CTA magnétique (scripts/magnetic.ts) : décalage vers le pointeur,
 * proportionnel à sa distance au centre de l'élément et borné à `max` pixels par axe.
 */

export interface Box {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface Offset {
  readonly x: number;
  readonly y: number;
}

const axis = (pointer: number, start: number, size: number, max: number): number => {
  if (size <= 0) return 0;
  const ratio = (pointer - (start + size / 2)) / (size / 2);
  const bounded = Math.min(1, Math.max(-1, ratio));
  // Arrondi au dixième de pixel : évite des chaînes de transform interminables.
  return Math.round(bounded * max * 10) / 10 || 0;
};

export function magneticOffset(clientX: number, clientY: number, box: Box, max: number): Offset {
  return {
    x: axis(clientX, box.left, box.width, max),
    y: axis(clientY, box.top, box.height, max),
  };
}
