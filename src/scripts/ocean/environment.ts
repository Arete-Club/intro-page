import {
  AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, DoubleSide, Mesh, PlaneGeometry,
  Points, ShaderMaterial, SphereGeometry, Vector3,
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
varying vec3 vDirection;
void main() {
  vec3 dir = normalize(vDirection);
  gl_FragColor = vec4(mix(skyColor(dir), fogTint(dir), uUnder), 1.0);
}
`;

const seabedVertex = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const seabedFragment = /* glsl */ `
${fogChunk}
uniform vec3 uRock;
uniform vec3 uRim;
uniform float uLight;
varying vec3 vWorld;
void main() {
  vec3 normal = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  if (normal.y < 0.0) normal = -normal;
  float diffuse = clamp(dot(normal, normalize(vec3(-0.25, 1.0, 0.35))), 0.0, 1.0);
  // Lit from above near the surface; a dark silhouette in the abyss.
  vec3 color = uRock * (0.3 + 0.7 * diffuse) * (0.12 + 0.88 * uLight);
  color += uRim * pow(1.0 - normal.y, 2.0) * 0.18;
  gl_FragColor = vec4(applyFog(color, vWorld), 1.0);
}
`;

const raysVertex = /* glsl */ `
attribute vec3 aCenter;
attribute vec2 aSize;
attribute float aSeed;
uniform vec3 uShear;
varying vec2 vUv;
varying float vSeed;
varying float vDist;
void main() {
  float along = -position.y;
  vec3 base = aCenter + uShear * along * aSize.y + vec3(0.0, position.y * aSize.y, 0.0);
  vec3 toCamera = cameraPosition - base;
  // Cylindrical billboard: each shaft turns to face the camera around Y.
  vec3 right = normalize(vec3(toCamera.z, 0.0, -toCamera.x) + 1e-5);
  vec3 world = base + right * position.x * aSize.x * (1.0 + along * 0.9);
  vec4 view = viewMatrix * vec4(world, 1.0);
  vUv = vec2(position.x + 0.5, along);
  vSeed = aSeed;
  vDist = -view.z;
  gl_Position = projectionMatrix * view;
}
`;

const raysFragment = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform float uFogDensity;
uniform vec3 uRayColor;
varying vec2 vUv;
varying float vSeed;
varying float vDist;
void main() {
  float across = pow(clamp(1.0 - abs(vUv.x - 0.5) * 2.0, 0.0, 1.0), 2.2);
  float fall = smoothstep(0.0, 0.06, vUv.y) * pow(1.0 - vUv.y, 1.6);
  float shimmer = 0.7 + 0.3 * sin(uTime * 0.5 + vSeed * 40.0 + vUv.y * 3.0);
  float fog = exp(-pow(uFogDensity * vDist * 0.8, 2.0));
  float near = smoothstep(2.0, 8.0, vDist);
  gl_FragColor = vec4(uRayColor, across * fall * shimmer * fog * near * uOpacity * 0.17);
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
  vAlpha = edge * submerged * fog * (0.35 + 0.65 * aSeed);
  gl_PointSize = uSize * uPixelRatio * (0.6 + aSeed * 0.9) / max(dist, 0.5);
  gl_Position = projectionMatrix * view;
}
`;

const particlesFragment = /* glsl */ `
uniform vec3 uParticleColor;
uniform float uOpacity;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  gl_FragColor = vec4(uParticleColor, smoothstep(0.5, 0.1, d) * vAlpha * uOpacity * 0.75);
}
`;

export function seabedHeight(x: number, z: number) {
  // Rolling floor below the camera path, with two ridges that rise into
  // view during the descent and stay below the camera's final depth.
  return -62
    + Math.sin(x * 0.045 + z * 0.02) * 3.2
    + Math.sin(z * 0.06 - x * 0.03) * 2.1
    + Math.sin((x + z) * 0.11) * 0.8
    + 20 * Math.exp(-((x + 14) ** 2 + (z + 26) ** 2) / 300)
    + 18 * Math.exp(-((x - 22) ** 2 + (z + 58) ** 2) / 500);
}

export function createEnvironment(shared: SharedUniforms, palette: Palette, mobile: boolean) {
  const rand = random(7);

  const skyGeometry = new SphereGeometry(1, 32, 16);
  const skyMaterial = new ShaderMaterial({
    uniforms: shared,
    vertexShader: skyVertex,
    fragmentShader: skyFragment,
    side: BackSide,
    depthWrite: false,
  });
  const sky = new Mesh(skyGeometry, skyMaterial);
  sky.scale.setScalar(1500);
  sky.renderOrder = -1;
  sky.frustumCulled = false;

  const seabedSegments = mobile ? 72 : 128;
  const seabedGeometry = new PlaneGeometry(420, 420, seabedSegments, seabedSegments);
  seabedGeometry.rotateX(-Math.PI / 2);
  seabedGeometry.translate(0, 0, -50);
  const ground = seabedGeometry.attributes.position;
  for (let i = 0; i < ground.count; i++) ground.setY(i, seabedHeight(ground.getX(i), ground.getZ(i)));
  seabedGeometry.computeBoundingSphere();
  const seabedMaterial = new ShaderMaterial({
    uniforms: {
      ...shared,
      uRock: { value: toVec3(mixRGB(palette.ocean, palette.cyan, 0.25)) },
      uRim: { value: toVec3(palette.cyan) },
    },
    vertexShader: seabedVertex,
    fragmentShader: seabedFragment,
  });
  const seabed = new Mesh(seabedGeometry, seabedMaterial);

  const rayCount = mobile ? 5 : 9;
  const rayPositions: number[] = [];
  const rayCenters: number[] = [];
  const raySizes: number[] = [];
  const raySeeds: number[] = [];
  const rayIndex: number[] = [];
  for (let i = 0; i < rayCount; i++) {
    const center = [(rand() - 0.5) * 56, -0.2, 10 - rand() * 70];
    const size = [1.6 + rand() * 3.2, 26 + rand() * 22];
    const seed = rand();
    for (const [x, y] of [[-0.5, 0], [0.5, 0], [0.5, -1], [-0.5, -1]]) {
      rayPositions.push(x, y, 0);
      rayCenters.push(...center);
      raySizes.push(...size);
      raySeeds.push(seed);
    }
    const base = i * 4;
    rayIndex.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
  const raysGeometry = new BufferGeometry();
  raysGeometry.setAttribute('position', new BufferAttribute(new Float32Array(rayPositions), 3));
  raysGeometry.setAttribute('aCenter', new BufferAttribute(new Float32Array(rayCenters), 3));
  raysGeometry.setAttribute('aSize', new BufferAttribute(new Float32Array(raySizes), 2));
  raysGeometry.setAttribute('aSeed', new BufferAttribute(new Float32Array(raySeeds), 1));
  raysGeometry.setIndex(rayIndex);
  const raysMaterial = new ShaderMaterial({
    uniforms: {
      uTime: shared.uTime,
      uFogDensity: shared.uFogDensity,
      uOpacity: { value: 0 },
      uShear: { value: new Vector3(-0.12, 0, 0.25) },
      uRayColor: { value: toVec3(mixRGB(palette.cyan, palette.offWhite, 0.5)) },
    },
    vertexShader: raysVertex,
    fragmentShader: raysFragment,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
  const rays = new Mesh(raysGeometry, raysMaterial);
  rays.frustumCulled = false;

  const box = 36;
  const particleCount = mobile ? 260 : 640;
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
      uSize: { value: 30 },
      uPixelRatio: { value: 1 },
      uOpacity: { value: 0 },
      uParticleColor: { value: toVec3(mixRGB(palette.cyan, palette.offWhite, 0.35)) },
    },
    vertexShader: particlesVertex,
    fragmentShader: particlesFragment,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const particles = new Points(particlesGeometry, particlesMaterial);
  particles.frustumCulled = false;

  return {
    objects: [sky, seabed, rays, particles],
    setPixelRatio(ratio: number) {
      particlesMaterial.uniforms.uPixelRatio.value = ratio;
    },
    update(frame: OceanFrame, cameraPosition: Vector3) {
      sky.position.copy(cameraPosition);
      seabed.visible = frame.under > 0.001;
      rays.visible = frame.rays > 0.001;
      raysMaterial.uniforms.uOpacity.value = frame.rays;
      particles.visible = frame.particles > 0.001;
      particlesMaterial.uniforms.uOpacity.value = frame.particles;
    },
    dispose() {
      for (const geometry of [skyGeometry, seabedGeometry, raysGeometry, particlesGeometry]) geometry.dispose();
      for (const material of [skyMaterial, seabedMaterial, raysMaterial, particlesMaterial]) material.dispose();
    },
  };
}
