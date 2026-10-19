import { clamp01, contrast, mixRGB, type RGB } from './color';

export type Vec3 = readonly [number, number, number];
/** The five brand tokens from docs/motion.md §6; everything else derives from them. */
export type Palette = { bg: RGB; deep: RGB; ocean: RGB; cyan: RGB; offWhite: RGB };
export type Phase = 'surface' | 'crossing' | 'descent' | 'abyss';
export type CopyKey = 'hero' | 'cue' | 'descent' | 'abyss';

export type OceanFrame = {
  progress: number;
  phase: Phase;
  position: Vec3;
  target: Vec3;
  /** 0 above the surface, 1 once the camera is fully submerged. */
  under: number;
  /** 0 at the surface, 1 at the deepest camera point. */
  depth: number;
  water: RGB;
  fogColor: RGB;
  /** Header ink: navy over the bright surface, off-white once the scene darkens. */
  ink: 'dark' | 'light';
  fogDensity: number;
  /** Underwater vertical light falloff; 0 at the surface and in the abyss. */
  fogGradient: number;
  sunlight: number;
  rays: number;
  particles: number;
  /** Strength of the waterline split on the lens; 1 while the camera is within the waves. */
  waterline: number;
  /** How far scene copy dims towards Muted Cyan with depth (L04). */
  copyTint: number;
  copy: Record<CopyKey, number>;
};

// Scroll progress → camera keyframes (motion.md L01). The hero holds, the
// camera drops to the water, then crosses it slowly through Scene 02 — the
// one authored moment. Just under, it looks back up at the light it left,
// then turns down into the abyss and eases to rest (Scene 04).
const KEYS: readonly { p: number; position: Vec3; target: Vec3 }[] = [
  { p: 0, position: [0, 3.2, 40], target: [0, 14, -80] },
  { p: 0.13, position: [0, 2.9, 36], target: [0, 10.5, -80] },
  { p: 0.2, position: [0, 0.45, 30], target: [0, -0.8, -70] },
  { p: 0.3, position: [0, 0, 26], target: [0, 0.2, -66] },
  { p: 0.4, position: [0, -0.45, 22], target: [0, 3.5, -60] },
  { p: 0.5, position: [0.4, -6, 16], target: [0, 4, -50] },
  { p: 0.62, position: [1.1, -19, 8], target: [0, -15, -54] },
  { p: 0.75, position: [1.8, -34, -1], target: [0, -50, -55] },
  { p: 1, position: [2.2, -46, -8], target: [0, -54, -60] },
];

export const ABYSS_Y = KEYS[KEYS.length - 1].position[1];

/** Fritsch–Carlson monotone cubic: C1-continuous and never overshoots a key. */
function monotone(xs: readonly number[], ys: readonly number[]) {
  const n = xs.length;
  const h = xs.slice(1).map((x, i) => x - xs[i]);
  const d = h.map((hi, i) => (ys[i + 1] - ys[i]) / hi);
  const m = xs.map((_, i) => {
    if (i === 0) return d[0];
    if (i === n - 1) return 0;
    return d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  });
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return (x: number) => {
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const t = (x - xs[i]) / h[i];
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i]
      + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1];
  };
}

const ps = KEYS.map((key) => key.p);
const curve = (pick: (key: (typeof KEYS)[number]) => Vec3) =>
  [0, 1, 2].map((axis) => monotone(ps, KEYS.map((key) => pick(key)[axis])));
const positionCurve = curve((key) => key.position);
const targetCurve = curve((key) => key.target);

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const band = (p: number, a: number, b: number, c: number, d: number) =>
  smoothstep(a, b, p) * (1 - smoothstep(c, d, p));

function ramp(t: number, stops: readonly (readonly [number, RGB])[]): RGB {
  for (let i = 1; i < stops.length; i++) {
    const [end, to] = stops[i];
    if (t <= end) {
      const [start, from] = stops[i - 1];
      return mixRGB(from, to, (t - start) / (end - start));
    }
  }
  return stops[stops.length - 1][1];
}

/** Calm daylight sky: Muted Cyan overhead, hazing toward Off White. */
export function skyOf(palette: Palette) {
  return { zenith: palette.cyan, horizon: mixRGB(palette.cyan, palette.offWhite, 0.55) };
}

export function phaseAt(progress: number): Phase {
  if (progress < 0.2) return 'surface';
  if (progress < 0.4) return 'crossing';
  if (progress < 0.75) return 'descent';
  return 'abyss';
}

export function oceanFrame(rawProgress: number, palette: Palette): OceanFrame {
  const progress = clamp01(rawProgress);
  const position = positionCurve.map((f) => f(progress)) as unknown as Vec3;
  const target = targetCurve.map((f) => f(progress)) as unknown as Vec3;
  // Every environmental value follows the camera height, so the crossing is
  // continuous rather than a cut between an "above" and "below" state.
  const under = smoothstep(0.4, -0.4, position[1]);
  const depth = clamp01(position[1] / ABYSS_Y);
  // Bright only right at the surface: a few metres down the water is Ocean
  // Blue, so the light overhead reads against it and copy stays legible.
  const water = ramp(depth, [
    [0, mixRGB(palette.ocean, palette.cyan, 0.38)],
    [0.05, palette.ocean],
    [0.5, palette.deep],
    [1, palette.bg],
  ]);
  const fogColor = mixRGB(skyOf(palette).horizon, water, under);
  return {
    progress,
    phase: phaseAt(progress),
    position,
    target,
    under,
    depth,
    water,
    fogColor,
    // Navy while it reads on the scene; then off-white over the top shade.
    ink: contrast(palette.bg, fogColor) >= 4.5 ? 'dark' : 'light',
    // Light reaches into open water near the surface, fading with depth.
    fogDensity: lerp(0.0032, lerp(0.014, 0.045, depth ** 3), under),
    fogGradient: under * (1 - smoothstep(0.7, 1, depth)),
    sunlight: lerp(1, Math.exp(-depth * 3.2), under),
    rays: under * (1 - smoothstep(0.35, 0.82, depth)),
    particles: under * lerp(0.75, 0.16, smoothstep(0.1, 1, depth)),
    waterline: 1 - smoothstep(0.35, 0.7, Math.abs(position[1])),
    copyTint: 0.35 * smoothstep(0.2, 1, depth),
    copy: {
      hero: 1 - smoothstep(0.13, 0.2, progress),
      cue: 1 - smoothstep(0, 0.045, progress),
      descent: band(progress, 0.38, 0.44, 0.62, 0.68),
      abyss: smoothstep(0.73, 0.79, progress),
    },
  };
}
