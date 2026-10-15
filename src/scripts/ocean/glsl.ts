import { Vector3 } from 'three';
import type { RGB } from './color';
import { skyOf, type Palette } from './timeline';

export const toVec3 = (color: RGB, target = new Vector3()) =>
  target.set(color[0] / 255, color[1] / 255, color[2] / 255);

// One set of uniform objects shared by every material, so a frame updates
// time, fog and light once. Colors stay in display (sRGB) space end to end,
// which keeps the canvas and the CSS tokens numerically identical.
export function createSharedUniforms(palette: Palette) {
  const sky = skyOf(palette);
  return {
    uTime: { value: 0 },
    uFogColor: { value: new Vector3() },
    uFogDensity: { value: 0 },
    uFogGradient: { value: 0 },
    uUnder: { value: 0 },
    uLight: { value: 1 },
    uSkyZenith: { value: toVec3(sky.zenith) },
    uSkyHorizon: { value: toVec3(sky.horizon) },
    uSunDir: { value: new Vector3(0.42, 0.11, -1).normalize() },
    uSunColor: { value: toVec3(palette.offWhite) },
  };
}
export type SharedUniforms = ReturnType<typeof createSharedUniforms>;

// Underwater the fog brightens towards the surface and darkens below, so
// the volume reads as depth; uFogGradient eases back to flat in the abyss.
export const fogChunk = /* glsl */ `
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uFogGradient;
vec3 fogTint(vec3 dir) {
  return uFogColor * (1.0 + uFogGradient * (smoothstep(-0.7, 0.7, dir.y) * 0.5 - 0.22));
}
vec3 applyFog(vec3 color, vec3 worldPosition) {
  vec3 ray = worldPosition - cameraPosition;
  float dist = length(ray);
  float f = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
  return mix(color, fogTint(ray / dist), clamp(f, 0.0, 1.0));
}
`;

export const skyChunk = /* glsl */ `
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
vec3 skyColor(vec3 dir) {
  float h = clamp(dir.y, 0.0, 1.0);
  vec3 color = mix(uSkyHorizon, uSkyZenith, pow(h, 0.45));
  float sun = max(dot(dir, uSunDir), 0.0);
  return color + uSunColor * (pow(sun, 3000.0) * 1.2 + pow(sun, 40.0) * 0.12 + pow(sun, 6.0) * 0.05);
}
`;

// Waves: a few long swells displace geometry; short ripples only bend the
// per-pixel normal. Speeds follow deep-water dispersion, slowed for calm.
export const waveChunk = /* glsl */ `
uniform float uTime;
void wave(vec2 p, vec2 dir, float k, float a, float w, inout float h, inout vec2 g) {
  float phase = dot(p, dir) * k + uTime * w;
  h += a * sin(phase);
  g += dir * (a * k * cos(phase));
}
float swell(vec2 p, inout vec2 g) {
  float h = 0.0;
  wave(p, vec2(0.92, 0.39), 0.13, 0.20, 0.62, h, g);
  wave(p, vec2(-0.40, 0.92), 0.17, 0.12, 0.71, h, g);
  wave(p, vec2(0.86, -0.51), 0.26, 0.06, 0.88, h, g);
  return h;
}
float waveHeight(vec2 p) {
  vec2 g = vec2(0.0);
  return swell(p, g);
}
vec3 waveNormal(vec2 p, float detail) {
  vec2 g = vec2(0.0);
  swell(p, g);
  float h = 0.0;
  vec2 r = vec2(0.0);
  wave(p, vec2(0.60, 0.80), 0.9, 0.032, 1.63, h, r);
  wave(p, vec2(-0.83, 0.55), 1.4, 0.020, 2.04, h, r);
  wave(p, vec2(0.20, -0.98), 2.3, 0.011, 2.61, h, r);
#ifdef HIGH_QUALITY
  wave(p, vec2(-0.50, -0.87), 3.7, 0.0065, 3.31, h, r);
  wave(p, vec2(0.97, 0.26), 5.5, 0.0038, 4.04, h, r);
#endif
  g += r * detail;
  return normalize(vec3(-g.x, 1.0, -g.y));
}
`;
