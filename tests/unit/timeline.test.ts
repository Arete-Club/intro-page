import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { clamp01, contrast, luminance, mixRGB, parseHex } from '../../src/scripts/ocean/color';
import { ABYSS_Y, oceanFrame, phaseAt, skyOf, type Palette } from '../../src/scripts/ocean/timeline';

const css = readFileSync(new URL('../../src/styles/global.css', import.meta.url), 'utf8');
const token = (name: string) => parseHex(css.match(new RegExp(`--${name}: (#[a-f0-9]{6})`))![1]);
const palette: Palette = { bg: token('bg'), deep: token('deep'), ocean: token('ocean'), cyan: token('cyan'), offWhite: token('off-white') };
const samples = Array.from({ length: 1001 }, (_, i) => oceanFrame(i / 1000, palette));
const at = (p: number) => oceanFrame(p, palette);
// Sequence heights as shipped: desktop, then the phone override. The pinned stage is one screen.
const sequences = [...css.matchAll(/\.ocean:not\(\[data-scene='fallback'\]\) \{ height: (\d+)svh; \}/g)].map((m) => Number(m[1]));

/** L01/L02 rhythm in screens of scroll for one sequence height. */
function rhythm(svh: number) {
  const screens = svh / 100 - 1;
  const readable = (frame: (typeof samples)[number]) => Math.max(frame.copy.hero, frame.copy.descent, frame.copy.abyss) > 0.5;
  let silent = 0;
  let gap = 0;
  let longest = 0;
  for (const frame of samples) {
    if (readable(frame)) { gap = 0; continue; }
    silent++;
    longest = Math.max(longest, ++gap);
  }
  const first = (test: (frame: (typeof samples)[number]) => boolean) => samples.find(test)!.progress;
  return {
    silentShare: silent / samples.length,
    longestGap: (longest / 1000) * screens,
    crossing: (first((f) => f.position[1] <= -0.4) - first((f) => f.position[1] <= 0.4)) * screens,
    split: (samples.filter((f) => f.waterline > 0.99).length / 1000) * screens,
  };
}

describe('T03: scroll-driven ocean timeline', () => {
  it('uses the motion.md palette tokens', () => {
    expect(palette).toEqual({ bg: [6, 21, 33], deep: [10, 38, 56], ocean: [18, 70, 94], cyan: [129, 183, 200], offWhite: [241, 244, 242] });
  });

  it.each([[-0.5, 0], [1.5, 1], [NaN, 0], [Infinity, 0], [0.42, 0.42]])('bounds %s to %s', (input, expected) => {
    expect(clamp01(input)).toBe(expected);
    expect(at(input).progress).toBe(expected);
  });

  it('maps the four scenes to the documented scroll ranges', () => {
    expect([0, 0.19, 0.2, 0.39, 0.4, 0.74, 0.75, 1].map(phaseAt))
      .toEqual(['surface', 'surface', 'crossing', 'crossing', 'descent', 'descent', 'abyss', 'abyss']);
  });

  it('starts above the surface, crosses it during Scene 02 and never resurfaces', () => {
    expect(at(0).position[1]).toBeGreaterThan(2);
    expect(at(0.2).under).toBeLessThan(0.05);
    expect(at(0.4).under).toBeGreaterThan(0.95);
    expect(at(1).position[1]).toBeCloseTo(ABYSS_Y);
    let previous = Infinity;
    for (const frame of samples) {
      expect(frame.position[1]).toBeLessThanOrEqual(previous + 1e-9);
      previous = frame.position[1];
    }
  });

  it('moves along one continuous curve without jumps in position or aim', () => {
    const direction = (frame: (typeof samples)[number]) => {
      const d = frame.target.map((v, k) => v - frame.position[k]);
      const length = Math.hypot(...d);
      return d.map((v) => v / length);
    };
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1];
      const b = samples[i];
      const step = Math.hypot(...a.position.map((v, k) => v - b.position[k]));
      const [da, db] = [direction(a), direction(b)];
      const turn = Math.acos(Math.min(1, da.reduce((sum, v, k) => sum + v * db[k], 0)));
      expect(step).toBeLessThan(0.15);
      // Under a quarter of a degree per 0.1% of scroll.
      expect(turn).toBeLessThan((0.25 * Math.PI) / 180);
    }
  });

  it('slows the camera towards the end of the abyss', () => {
    const travel = (from: number, to: number) => {
      let sum = 0;
      for (let i = from * 1000 + 1; i <= to * 1000; i++) {
        sum += Math.hypot(...samples[i].position.map((v, k) => v - samples[i - 1].position[k]));
      }
      return sum / (to - from);
    };
    expect(travel(0.9, 1)).toBeLessThan(travel(0.45, 0.75) * 0.5);
    const tail = samples[1000].position.map((v, k) => v - samples[999].position[k]);
    expect(Math.hypot(...tail)).toBeLessThan(0.002);
  });

  it('blends the environment continuously across the waterline', () => {
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1];
      const b = samples[i];
      expect(Math.abs(a.under - b.under)).toBeLessThan(0.08);
      expect(Math.max(...a.fogColor.map((v, k) => Math.abs(v - b.fogColor[k])))).toBeLessThan(6);
      expect(Math.abs(a.fogDensity - b.fogDensity)).toBeLessThan(0.002);
    }
    const crossing = samples.filter((frame) => frame.under > 0.05 && frame.under < 0.95);
    expect(crossing.length).toBeGreaterThan(10);
  });

  it('darkens with depth: light, fog and luminance follow the descent', () => {
    let light = Infinity;
    let glow = Infinity;
    for (const frame of samples.slice(400)) {
      expect(frame.sunlight).toBeLessThanOrEqual(light + 1e-9);
      expect(luminance(frame.fogColor)).toBeLessThanOrEqual(glow + 1e-9);
      light = frame.sunlight;
      glow = luminance(frame.fogColor);
    }
    expect(at(0.9).fogDensity).toBeGreaterThan(at(0.5).fogDensity);
    expect(at(0.5).fogDensity).toBeGreaterThan(at(0.1).fogDensity * 4);
  });

  it('ends in Midnight Navy that matches the page, never pure black', () => {
    expect(at(1).fogColor.map(Math.round)).toEqual([...palette.bg]);
    // Flat fog at the end, so the canvas edge meets the page without a seam.
    expect(at(1).fogGradient).toBe(0);
    expect(at(0).fogGradient).toBe(0);
    expect(at(0.5).fogGradient).toBeGreaterThan(0.9);
    for (const frame of samples) expect(Math.max(...frame.fogColor)).toBeGreaterThan(20);
    expect(at(1).particles).toBeGreaterThan(0);
    expect(at(1).particles).toBeLessThan(0.2);
  });

  it('shows rays and particles only underwater, fading rays in the abyss', () => {
    expect(at(0).rays).toBe(0);
    expect(at(0).particles).toBe(0);
    expect(at(0.5).rays).toBeGreaterThan(0.5);
    expect(at(0.5).particles).toBeGreaterThan(0.5);
    expect(at(1).rays).toBe(0);
    expect(at(1).particles).toBeLessThan(at(0.5).particles * 0.3);
    for (let i = 401; i < samples.length; i++) {
      expect(samples[i].particles).toBeLessThanOrEqual(samples[i - 1].particles);
    }
  });

  it('lights the abyss with bioluminescence only in the deep water', () => {
    // Nothing glows while the light from the surface still reaches the descent copy.
    for (const frame of samples.filter((f) => f.progress <= 0.62)) expect(frame.glow).toBe(0);
    expect(at(0.8).glow).toBeGreaterThan(0.5);
    expect(at(1).glow).toBe(1);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i].glow).toBeGreaterThanOrEqual(samples[i - 1].glow);
    }
  });

  it('fades overlay copy in and out by scroll range', () => {
    expect(at(0).copy.hero).toBe(1);
    expect(at(0.12).copy.hero).toBe(1);
    expect(at(0.2).copy.hero).toBe(0);
    expect(at(0.3).copy.descent).toBe(0);
    expect(at(0.5).copy.descent).toBe(1);
    expect(at(0.58).copy.descent).toBe(1);
    expect(at(0.7).copy.descent).toBe(0);
    expect(at(0.72).copy.abyss).toBe(0);
    expect(at(0.8).copy.abyss).toBe(1);
    expect(at(1).copy.abyss).toBe(1);
  });

  it.each([['desktop', 0], ['mobile', 1]] as const)('L01/L02: %s rhythm keeps copy on screen and gives the crossing room', (_, index) => {
    expect(sequences).toHaveLength(2);
    const { silentShare, longestGap, crossing, split } = rhythm(sequences[index]);
    expect(silentShare).toBeLessThanOrEqual(0.4);
    expect(longestGap).toBeLessThanOrEqual(0.9);
    expect(crossing).toBeGreaterThanOrEqual(0.6);
    expect(split).toBeGreaterThanOrEqual(0.3);
  });

  it('L01: the descent copy arrives only once the camera is under', () => {
    const arrival = samples.find((frame) => frame.copy.descent > 0.5)!;
    expect(arrival.under).toBeGreaterThan(0.99);
  });

  it('keeps text readable over the scene where each piece of copy appears', () => {
    const sky = skyOf(palette);
    expect(contrast(palette.bg, sky.zenith)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette.bg, sky.horizon)).toBeGreaterThanOrEqual(4.5);
    for (const frame of samples) {
      if (frame.copy.descent > 0.05 || frame.copy.abyss > 0.05) {
        // L04: over the scene, title and description share Off White and dim
        // towards Muted Cyan with depth, never below 4.5:1.
        expect(contrast(mixRGB(palette.offWhite, palette.cyan, frame.copyTint), frame.fogColor)).toBeGreaterThanOrEqual(4.5);
      }
      // Light header ink sits on the underwater top shade (≥ 40% Primary
      // Background) over fog that brightens up to 1.28× towards the surface.
      const top = frame.fogColor.map((v) => Math.min(255, v * (1 + frame.fogGradient * 0.28))) as unknown as typeof frame.fogColor;
      if (frame.ink === 'dark') expect(contrast(palette.bg, frame.fogColor)).toBeGreaterThanOrEqual(4.5);
      else expect(contrast(palette.offWhite, mixRGB(top, palette.bg, 0.4))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('L04: scene copy dims with the light as the camera descends', () => {
    expect(at(0).copyTint).toBe(0);
    expect(at(1).copyTint).toBeGreaterThan(0.2);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i].copyTint).toBeGreaterThanOrEqual(samples[i - 1].copyTint);
    }
  });

  it('returns the identical frame when scrolling back to a prior point', () => {
    const before = at(0.63);
    at(1);
    at(0);
    expect(at(0.63)).toEqual(before);
  });
});
