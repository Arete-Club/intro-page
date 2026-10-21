import {
  AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, Mesh, Points, ShaderMaterial, SphereGeometry, Vector3,
} from 'three';
import { mixRGB } from './color';
import { fogChunk, skyChunk, toVec3, type SharedUniforms } from './glsl';
import type { OceanFrame, Palette } from './timeline';

// Deterministic layout keeps captures comparable between runs.
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const skyVertex = /* glsl */ `
varying vec3 vDirection;
void main() {
  vDirection = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const skyFragment = /* glsl */ `
${skyChunk}
${fogChunk}
uniform float uUnder;
uniform float uTime;
uniform float uRays;
uniform float uShaftDensity;
varying vec3 vDirection;

// Low-frequency light patches projected down from the moving surface.
// Sampled in world space: the field has depth as the camera descends, with
// no billboard edges or floor silhouette.
float lightField(vec3 p) {
  float depth = max(-p.y, 0.0);
  vec2 q = (p.xz + uSunDir.xz * depth * 0.3) * 0.065;
  float patches = 0.5
    + 0.25 * sin(q.x + sin(q.y * 0.71) + uTime * 0.07)
    + 0.25 * sin(q.y * 1.13 + sin(q.x * 0.57) - uTime * 0.05);
  return patches * patches * exp(-depth * 0.025);
}

// Shafts of light fanning out from the refracted sun overhead. A function of
// direction only, like the sun itself: the rays keep their place while the
// camera sinks along them, and uRays fades them as it leaves the light
// behind. Whole-number frequencies around the source leave the fan without
// a seam; soft edges leave each shaft without an outline.
float shafts(vec3 dir) {
  vec3 source = normalize(vec3(uSunDir.x * 0.3, 1.0, uSunDir.z * 0.3));
  vec3 across = normalize(cross(source, vec3(0.0, 0.0, 1.0)));
  vec3 v = dir - source * dot(dir, source);
  // A narrow portrait view spans less of the fan: denser rays fill it.
  float a = atan(dot(v, cross(source, across)), dot(v, across)) * uShaftDensity;
  float n = 0.5
    + 0.22 * sin(a * 7.0 + uTime * 0.05 + 1.3)
    + 0.16 * sin(a * 13.0 - uTime * 0.07 + 4.1)
    + 0.12 * sin(a * 29.0 + uTime * 0.11 + 2.2)
    + 0.08 * sin(a * 53.0 - uTime * 0.13 + 0.7);
  // Brightest towards the surface. Just under it they are spent before the
  // middle of the frame, where the brighter water leaves the scene copy no
  // room (T12); deeper down the water is darker and they reach further.
  float depth = max(-cameraPosition.y, 0.0);
  float reach = smoothstep(6.0, 20.0, depth);
  float fan = smoothstep(0.52, 0.86, n) * smoothstep(0.24 - reach * 0.2, 0.66 - reach * 0.12, dir.y);
  // Dimmer the deeper the camera is, so the light thins out on the way down.
  return fan * exp(-depth * 0.03);
}

vec3 underwaterColor(vec3 dir) {
  float scattered = 0.0;
  // Five bounded samples give broad, soft light without a postprocess pass.
  for (int i = 0; i < 5; i++) {
    float sampleDistance = 6.0 + float(i * i) * 4.5;
    vec3 p = cameraPosition + dir * sampleDistance;
    float submerged = 1.0 - smoothstep(-0.8, 0.2, p.y);
    scattered += lightField(p) * submerged * exp(-sampleDistance * 0.018) * 0.2;
  }
  float overhead = smoothstep(-0.4, 0.7, dir.y);
  // The light pools overhead; towards the horizon a quarter of it remains.
  float skyward = mix(0.25, 1.0, smoothstep(0.1, 0.6, dir.y));
  vec3 lightTint = mix(uFogColor, uSunColor, 0.18);
  vec3 shaftTint = mix(uFogColor, uSunColor, 0.35);
  return fogTint(dir)
    + lightTint * (scattered * 1.35 * skyward + overhead * 0.12) * uRays
    + shaftTint * shafts(dir) * 0.9 * uRays * smoothstep(0.85, 1.0, uUnder);
}

void main() {
  vec3 dir = normalize(vDirection);
  gl_FragColor = vec4(mix(skyColor(dir), underwaterColor(dir), uUnder), 1.0);
}
`;

const motesVertex = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform float uBox;
uniform float uSize;
uniform float uMaxSize;
uniform vec2 uNear;
uniform float uPixelRatio;
uniform float uFogDensity;
uniform float uFall;
varying float vAlpha;
varying float vStretch;
void main() {
  vec3 drift = vec3(
    sin(uTime * 0.11 + aSeed * 12.0) * 0.6,
    -uTime * (0.05 + aSeed * 0.08),
    cos(uTime * 0.09 + aSeed * 7.0) * 0.6
  );
  // Wrap a fixed box of points around the camera: no CPU updates per frame.
  // The points stay put in the water, so a descending camera streams past them.
  vec3 p = mod(position + drift - cameraPosition + uBox * 0.5, uBox) - uBox * 0.5 + cameraPosition;
  vec4 view = viewMatrix * vec4(p, 1.0);
  float dist = -view.z;
  float edge = 1.0 - smoothstep(uBox * 0.32, uBox * 0.5, length(p - cameraPosition));
  float submerged = 1.0 - smoothstep(-1.5, -0.2, p.y);
  float fog = exp(-pow(uFogDensity * dist, 2.0));
  float near = smoothstep(uNear.x, uNear.y, dist);
  // Motes near the surface catch more of the light from above.
  float lit = mix(0.55, 1.0, exp(p.y * 0.05));
  // Falling past a mote smears it along the motion, more for the closer ones.
  vStretch = clamp(abs(uFall) * 0.8 / max(dist, 1.0), 0.0, 4.0);
  vAlpha = edge * submerged * fog * near * lit * (0.35 + 0.65 * aSeed) / (1.0 + vStretch * 0.5);
  // Near motes are larger than far ones, so parallax gives the water depth.
  float size = clamp(uSize * uPixelRatio * (0.6 + aSeed * 0.9) / max(dist, 0.5), 1.0, uMaxSize * uPixelRatio);
  gl_PointSize = size * (1.0 + vStretch);
  gl_Position = projectionMatrix * view;
}
`;

const motesFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uSoft;
varying float vAlpha;
varying float vStretch;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  c.x *= 1.0 + vStretch;
  float d = length(c);
  gl_FragColor = vec4(uColor, (1.0 - smoothstep(uSoft, 1.0, d)) * vAlpha * uOpacity);
}
`;

// Bioluminescence: a few lights far off in the deep water, pulsing slowly,
// so the abyss is an open space with something in it rather than a flat
// colour. Large and out of focus: small sharp points would read as stars.
const glowVertex = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform float uPixelRatio;
uniform float uFogDensity;
varying float vAlpha;
void main() {
  vec3 p = position + vec3(
    sin(uTime * 0.07 + aSeed * 30.0),
    sin(uTime * 0.05 + aSeed * 17.0) * 0.6,
    cos(uTime * 0.06 + aSeed * 23.0)
  ) * 0.8;
  vec4 view = viewMatrix * vec4(p, 1.0);
  float dist = -view.z;
  // A light source carries further through the water than a lit mote.
  float fog = exp(-pow(uFogDensity * dist * 0.6, 2.0));
  float pulse = pow(0.5 + 0.5 * sin(uTime * (0.3 + aSeed * 0.45) + aSeed * 40.0), 2.0);
  vAlpha = fog * (0.25 + 0.75 * pulse) * smoothstep(4.0, 9.0, dist);
  gl_PointSize = clamp(uPixelRatio * (900.0 + aSeed * 900.0) / max(dist, 1.0), 40.0 * uPixelRatio, 150.0 * uPixelRatio);
  gl_Position = projectionMatrix * view;
}
`;

const glowFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  // One soft falloff with no core, gone before the sprite edge.
  float light = exp(-d * d * 4.5) * (1.0 - smoothstep(0.55, 1.0, d)) * 0.22;
  gl_FragColor = vec4(uColor * light * vAlpha * uOpacity, 1.0);
}
`;

type MotesOptions = { count: number; box: number; size: number; maxSize: number; near: [number, number]; soft: number; opacity: number };

export function createEnvironment(shared: SharedUniforms, palette: Palette, mobile: boolean) {
  const rand = random(7);

  const skyGeometry = new SphereGeometry(1, 32, 16);
  const skyMaterial = new ShaderMaterial({
    uniforms: { ...shared, uRays: { value: 0 }, uShaftDensity: { value: 1 } },
    vertexShader: skyVertex,
    fragmentShader: skyFragment,
    side: BackSide,
    depthWrite: false,
  });
  const sky = new Mesh(skyGeometry, skyMaterial);
  sky.scale.setScalar(1500);
  sky.renderOrder = -1;
  sky.frustumCulled = false;

  const pixelRatio = { value: 1 };
  const fall = { value: 0 };
  const moteColor = toVec3(mixRGB(palette.cyan, palette.offWhite, 0.15));

  function createMotes({ count, box, size, maxSize, near, soft, opacity }: MotesOptions) {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions.set([(rand() - 0.5) * box, (rand() - 0.5) * box, (rand() - 0.5) * box], i * 3);
      seeds[i] = rand();
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1));
    const material = new ShaderMaterial({
      uniforms: {
        uTime: shared.uTime,
        uFogDensity: shared.uFogDensity,
        uPixelRatio: pixelRatio,
        uFall: fall,
        uBox: { value: box },
        uSize: { value: size },
        uMaxSize: { value: maxSize },
        uNear: { value: near },
        uSoft: { value: soft },
        uOpacity: { value: 0 },
        uColor: { value: moteColor },
      },
      vertexShader: motesVertex,
      fragmentShader: motesFragment,
      transparent: true,
      depthWrite: false,
    });
    const points = new Points(geometry, material);
    points.renderOrder = 2;
    points.frustumCulled = false;
    return { points, geometry, material, opacity };
  }

  // Fine marine snow out to the fog, and a few large, out-of-focus motes
  // right in front of the lens: the two layers move past at different speeds.
  const layers = [
    createMotes({ count: mobile ? 800 : 2000, box: mobile ? 16 : 20, size: 36, maxSize: 8, near: [0.8, 2.5], soft: 0.1, opacity: 0.95 }),
    createMotes({ count: mobile ? 50 : 100, box: 7, size: 46, maxSize: 70, near: [0.35, 1.1], soft: 0, opacity: 0.16 }),
  ];

  // Spread through the deep water ahead of the camera's last stretch.
  const glowCount = mobile ? 8 : 14;
  const glowPositions = new Float32Array(glowCount * 3);
  const glowSeeds = new Float32Array(glowCount);
  for (let i = 0; i < glowCount; i++) {
    glowPositions.set([2 + (rand() + rand() - 1) * 16, -40 - rand() * 24, -14 - rand() * 26], i * 3);
    glowSeeds[i] = rand();
  }
  const glowGeometry = new BufferGeometry();
  glowGeometry.setAttribute('position', new BufferAttribute(glowPositions, 3));
  glowGeometry.setAttribute('aSeed', new BufferAttribute(glowSeeds, 1));
  const glowMaterial = new ShaderMaterial({
    uniforms: {
      uTime: shared.uTime,
      uFogDensity: shared.uFogDensity,
      uPixelRatio: pixelRatio,
      uOpacity: { value: 0 },
      uColor: { value: toVec3(mixRGB(palette.cyan, palette.offWhite, 0.12)) },
    },
    vertexShader: glowVertex,
    fragmentShader: glowFragment,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const glow = new Points(glowGeometry, glowMaterial);
  glow.renderOrder = 2;
  glow.frustumCulled = false;

  return {
    objects: [sky, glow, ...layers.map((layer) => layer.points)],
    setView(ratio: number, portrait: boolean) {
      pixelRatio.value = ratio;
      // Whole multiples only, so the fan of shafts stays seamless.
      skyMaterial.uniforms.uShaftDensity.value = portrait ? 2 : 1;
    },
    /** fallSpeed: how fast the camera sinks, in world units per second. */
    update(frame: OceanFrame, cameraPosition: Vector3, fallSpeed: number) {
      sky.position.copy(cameraPosition);
      skyMaterial.uniforms.uRays.value = frame.rays;
      fall.value = fallSpeed;
      for (const layer of layers) {
        layer.points.visible = frame.particles > 0.001;
        layer.material.uniforms.uOpacity.value = frame.particles * layer.opacity;
      }
      glow.visible = frame.glow > 0.001;
      glowMaterial.uniforms.uOpacity.value = frame.glow;
    },
    dispose() {
      for (const geometry of [skyGeometry, glowGeometry, ...layers.map((layer) => layer.geometry)]) geometry.dispose();
      for (const material of [skyMaterial, glowMaterial, ...layers.map((layer) => layer.material)]) material.dispose();
    },
  };
}
