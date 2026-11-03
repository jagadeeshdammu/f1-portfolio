/** Circuit geometry for the racing game. All units are world pixels. */
export interface Pt {
  x: number;
  y: number;
}

export const WORLD = { w: 2600, h: 1800 };
export const TRACK_WIDTH = 170;

// Control points of the circuit (clockwise). A closed Catmull-Rom spline runs through them.
const CONTROL: Pt[] = [
  { x: 420, y: 1250 }, { x: 330, y: 820 }, { x: 470, y: 420 }, { x: 900, y: 260 },
  { x: 1300, y: 430 }, { x: 1620, y: 280 }, { x: 2080, y: 330 }, { x: 2280, y: 700 },
  { x: 2000, y: 980 }, { x: 2230, y: 1300 }, { x: 1900, y: 1540 }, { x: 1380, y: 1420 },
  { x: 1050, y: 1580 }, { x: 680, y: 1520 },
];

export function buildTrack(samplesPerSegment = 40): Pt[] {
  const pts: Pt[] = [];
  const n = CONTROL.length;
  for (let i = 0; i < n; i++) {
    const p0 = CONTROL[(i - 1 + n) % n];
    const p1 = CONTROL[i];
    const p2 = CONTROL[(i + 1) % n];
    const p3 = CONTROL[(i + 2) % n];
    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      pts.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  return pts;
}

export function nearestIndex(track: Pt[], x: number, y: number): { i: number; d: number } {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < track.length; i++) {
    const dx = track[i].x - x;
    const dy = track[i].y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return { i: best, d: Math.sqrt(bestD) };
}

/** Unit tangent and normal at sample i. */
export function frame(track: Pt[], i: number): { t: Pt; n: Pt } {
  const a = track[(i - 1 + track.length) % track.length];
  const b = track[(i + 1) % track.length];
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const t = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
  return { t, n: { x: -t.y, y: t.x } };
}

/** Small seeded random so trees and crowds land in the same spots every visit. */
export function seeded(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
