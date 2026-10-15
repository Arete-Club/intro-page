import {
  DoubleSide, Mesh, PlaneGeometry, ShaderMaterial, Vector3, type PerspectiveCamera,
} from 'three';
import { mixRGB } from './color';
import { fogChunk, skyChunk, toVec3, waveChunk, type SharedUniforms } from './glsl';
import type { OceanFrame, Palette } from './timeline';

const WATERLINE_DISTANCE = 0.6;

const surfaceVertex = /* glsl */ `
${waveChunk}
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  float fade = 1.0 - smoothstep(60.0, 260.0, distance(world.xz, cameraPosition.xz));
  world.y += waveHeight(world.xz) * fade;
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const surfaceFragment = /* glsl */ `
${waveChunk}
${skyChunk}
${fogChunk}
uniform vec3 uWaterBody;
uniform vec3 uSurfaceLight;
uniform float uLight;
varying vec3 vWorld;
void main() {
  vec3 toCamera = cameraPosition - vWorld;
  float dist = length(toCamera);
  vec3 view = toCamera / dist;
  vec3 normal = waveNormal(vWorld.xz, 1.0 / (1.0 + dist * 0.02));
  vec3 color;
  if (gl_FrontFacing) {
    float fresnel = 0.02 + 0.98 * pow(1.0 - clamp(dot(normal, view), 0.0, 1.0), 5.0);
    vec3 reflected = reflect(-view, normal);
    reflected.y = abs(reflected.y);
    color = mix(uWaterBody, skyColor(reflected), fresnel);
    color += uSunColor * pow(max(dot(reflected, uSunDir), 0.0), 420.0) * 0.8;
  } else {
    // From below: a bright refracted window overhead, total internal
    // reflection (the water's own color) towards grazing angles.
    float overhead = clamp(-view.y, 0.0, 1.0) + normal.x * 0.6 + normal.z * 0.3;
    float window = smoothstep(0.62, 0.86, overhead);
    color = mix(fogTint(-view) * 1.12, uSurfaceLight, window * uLight);
  }
  gl_FragColor = vec4(applyFog(color, vWorld), 1.0);
}
`;

const waterlineVertex = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

// A lens-sized quad just in front of the camera: where it sits below the
// wave height it is tinted with water, so the frame splits at a moving
// waterline while the camera passes through the surface.
const waterlineFragment = /* glsl */ `
${waveChunk}
uniform vec3 uUnderColor;
uniform vec3 uLineColor;
uniform float uFade;
varying vec3 vWorld;
void main() {
  float d = vWorld.y - waveHeight(vWorld.xz);
  float below = 1.0 - smoothstep(-0.006, 0.006, d);
  float line = 1.0 - smoothstep(0.0, 0.018, abs(d));
  vec3 color = mix(uUnderColor, uLineColor, line * 0.7);
  gl_FragColor = vec4(color, max(below * 0.78, line * 0.45) * uFade);
}
`;

export function createWater(shared: SharedUniforms, palette: Palette, mobile: boolean) {
  const quality: Record<string, string> = mobile ? {} : { HIGH_QUALITY: '' };
  const segments = mobile ? 128 : 200;
  const geometry = new PlaneGeometry(2, 2, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  // Quadratic spacing: dense under the camera, sparse towards the horizon.
  const half = 2000;
  const spread = (t: number) => Math.sign(t) * t * t * half;
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    positions.setXYZ(i, spread(positions.getX(i)), 0, spread(positions.getZ(i)));
  }
  geometry.computeBoundingSphere();

  const surfaceMaterial = new ShaderMaterial({
    defines: quality,
    uniforms: {
      ...shared,
      uWaterBody: { value: toVec3(mixRGB(palette.deep, palette.ocean, 0.55)) },
      uSurfaceLight: { value: toVec3(mixRGB(palette.cyan, palette.offWhite, 0.45)) },
    },
    vertexShader: surfaceVertex,
    fragmentShader: surfaceFragment,
    side: DoubleSide,
  });
  const surface = new Mesh(geometry, surfaceMaterial);
  surface.frustumCulled = false;

  const waterlineGeometry = new PlaneGeometry(2, 2);
  const waterlineMaterial = new ShaderMaterial({
    uniforms: {
      uTime: shared.uTime,
      uUnderColor: { value: new Vector3() },
      uLineColor: { value: toVec3(palette.offWhite) },
      uFade: { value: 0 },
    },
    vertexShader: waterlineVertex,
    fragmentShader: waterlineFragment,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const waterline = new Mesh(waterlineGeometry, waterlineMaterial);
  waterline.position.z = -WATERLINE_DISTANCE;
  waterline.renderOrder = 10;
  waterline.frustumCulled = false;

  return {
    surface,
    waterline,
    fit(camera: PerspectiveCamera) {
      const halfHeight = WATERLINE_DISTANCE * Math.tan((camera.fov * Math.PI) / 360) * 1.05;
      waterline.scale.set(halfHeight * camera.aspect, halfHeight, 1);
    },
    update(frame: OceanFrame) {
      const [x, y, z] = frame.position;
      surface.position.set(x, 0, z - 6);
      const fade = 1 - Math.min(1, Math.max(0, (Math.abs(y) - 0.25) / 0.3));
      waterline.visible = fade > 0;
      waterlineMaterial.uniforms.uFade.value = fade;
      toVec3(frame.water, waterlineMaterial.uniforms.uUnderColor.value);
    },
    dispose() {
      geometry.dispose();
      surfaceMaterial.dispose();
      waterlineGeometry.dispose();
      waterlineMaterial.dispose();
    },
  };
}
