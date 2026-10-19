import {
  BackSide, BufferAttribute, BufferGeometry, Mesh, Points, ShaderMaterial, SphereGeometry, Vector3,
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
varying vec3 vDirection;

// Low-frequency light patches projected down from the moving surface.
// Sampled in world space: the field has depth as the camera descends, with
// no billboard edges, floor silhouette or narrow shafts facing the lens.
float lightField(vec3 p) {
  float depth = max(-p.y, 0.0);
  vec2 q = (p.xz + uSunDir.xz * depth * 0.3) * 0.065;
  float patches = 0.5
    + 0.25 * sin(q.x + sin(q.y * 0.71) + uTime * 0.07)
    + 0.25 * sin(q.y * 1.13 + sin(q.x * 0.57) - uTime * 0.05);
  return patches * patches * exp(-depth * 0.025);
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
  vec3 lightTint = mix(uFogColor, uSunColor, 0.18);
  return fogTint(dir) + lightTint * (scattered * 1.35 + overhead * 0.12) * uRays;
}

void main() {
  vec3 dir = normalize(vDirection);
  gl_FragColor = vec4(mix(skyColor(dir), underwaterColor(dir), uUnder), 1.0);
}
`;

const particlesVertex = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform float uBox;
uniform float uSize;
uniform float uPixelRatio;
uniform float uFogDensity;
varying float vAlpha;
void main() {
  vec3 drift = vec3(
    sin(uTime * 0.11 + aSeed * 12.0) * 0.6,
    -uTime * (0.05 + aSeed * 0.08),
    cos(uTime * 0.09 + aSeed * 7.0) * 0.6
  );
  // Wrap a fixed box of points around the camera: no CPU updates per frame.
  vec3 p = mod(position + drift - cameraPosition + uBox * 0.5, uBox) - uBox * 0.5 + cameraPosition;
  vec4 view = viewMatrix * vec4(p, 1.0);
  float dist = -view.z;
  float edge = 1.0 - smoothstep(uBox * 0.32, uBox * 0.5, length(p - cameraPosition));
  float submerged = 1.0 - smoothstep(-1.5, -0.2, p.y);
  float fog = exp(-pow(uFogDensity * dist, 2.0));
  float near = smoothstep(1.0, 3.5, dist);
  vAlpha = edge * submerged * fog * near * (0.35 + 0.65 * aSeed);
  gl_PointSize = clamp(uSize * uPixelRatio * (0.6 + aSeed * 0.9) / max(dist, 1.0), 1.0, 3.0 * uPixelRatio);
  gl_Position = projectionMatrix * view;
}
`;

const particlesFragment = /* glsl */ `
uniform vec3 uParticleColor;
uniform float uOpacity;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  gl_FragColor = vec4(uParticleColor, (1.0 - smoothstep(0.1, 0.5, d)) * vAlpha * uOpacity * 0.35);
}
`;

export function createEnvironment(shared: SharedUniforms, palette: Palette, mobile: boolean) {
  const rand = random(7);

  const skyGeometry = new SphereGeometry(1, 32, 16);
  const skyMaterial = new ShaderMaterial({
    uniforms: { ...shared, uRays: { value: 0 } },
    vertexShader: skyVertex,
    fragmentShader: skyFragment,
    side: BackSide,
    depthWrite: false,
  });
  const sky = new Mesh(skyGeometry, skyMaterial);
  sky.scale.setScalar(1500);
  sky.renderOrder = -1;
  sky.frustumCulled = false;

  const box = 36;
  const particleCount = mobile ? 70 : 180;
  const particlePositions = new Float32Array(particleCount * 3);
  const particleSeeds = new Float32Array(particleCount);
  for (let i = 0; i < particleCount; i++) {
    particlePositions.set([(rand() - 0.5) * box, (rand() - 0.5) * box, (rand() - 0.5) * box], i * 3);
    particleSeeds[i] = rand();
  }
  const particlesGeometry = new BufferGeometry();
  particlesGeometry.setAttribute('position', new BufferAttribute(particlePositions, 3));
  particlesGeometry.setAttribute('aSeed', new BufferAttribute(particleSeeds, 1));
  const particlesMaterial = new ShaderMaterial({
    uniforms: {
      uTime: shared.uTime,
      uFogDensity: shared.uFogDensity,
      uBox: { value: box },
      uSize: { value: 14 },
      uPixelRatio: { value: 1 },
      uOpacity: { value: 0 },
      uParticleColor: { value: toVec3(mixRGB(palette.cyan, palette.offWhite, 0.15)) },
    },
    vertexShader: particlesVertex,
    fragmentShader: particlesFragment,
    transparent: true,
    depthWrite: false,
  });
  const particles = new Points(particlesGeometry, particlesMaterial);
  particles.renderOrder = 2;
  particles.frustumCulled = false;

  return {
    objects: [sky, particles],
    setPixelRatio(ratio: number) {
      particlesMaterial.uniforms.uPixelRatio.value = ratio;
    },
    update(frame: OceanFrame, cameraPosition: Vector3) {
      sky.position.copy(cameraPosition);
      skyMaterial.uniforms.uRays.value = frame.rays;
      particles.visible = frame.particles > 0.001;
      particlesMaterial.uniforms.uOpacity.value = frame.particles;
    },
    dispose() {
      for (const geometry of [skyGeometry, particlesGeometry]) geometry.dispose();
      for (const material of [skyMaterial, particlesMaterial]) material.dispose();
    },
  };
}
