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
uniform float uUnder;
varying vec3 vWorld;
void main() {
  vec3 toCamera = cameraPosition - vWorld;
  float dist = length(toCamera);
  vec3 view = toCamera / dist;
  vec3 normal = waveNormal(vWorld.xz, 1.0 / (1.0 + dist * 0.02));
  float fresnel = 0.02 + 0.98 * pow(1.0 - clamp(dot(normal, view), 0.0, 1.0), 5.0);
  vec3 reflected = reflect(-view, normal);
  reflected.y = abs(reflected.y);
  vec3 above = mix(uWaterBody, skyColor(reflected), fresnel);
  // Sun glitter belongs to the view from above; it would leave a thin
  // bright line on the far waterline once the camera is in the waves.
  above += uSunColor * pow(max(dot(reflected, uSunDir), 0.0), 420.0) * 0.8 * smoothstep(-0.1, 0.3, cameraPosition.y);
  // A diffuse window from below, without an abrupt front/back-face switch
  // when a wave passes the lens. Both sides meet over a narrow depth band.
  float overhead = clamp(-view.y, 0.0, 1.0) + normal.x * 0.6 + normal.z * 0.3;
  // Wide enough that the rippling light overhead enters the frame when the
  // camera looks back up after the crossing (motion.md L03).
  float window = smoothstep(0.25, 0.7, overhead);
  // Full strength only once the camera is under; within the waves the
  // undersides of nearby crests must not flash on the far waterline.
  float lift = smoothstep(0.85, 1.0, uUnder);
  vec3 below = mix(fogTint(-view), uSurfaceLight, window * uLight * mix(0.65, 0.9, lift));
  // Once the camera is clearly under, every crest and trough is seen from
  // below; otherwise far troughs show their top side as a pale line.
  float aboveWeight = smoothstep(-0.12, 0.12, toCamera.y) * smoothstep(-0.35, -0.05, cameraPosition.y);
  vec3 color = mix(below, above, aboveWeight);
  // At underwater grazing angles the open-water light field must remain
  // visible. An opaque underside would draw a false horizontal horizon.
  float opacity = mix(window * uLight * mix(0.5, 0.85, lift), 1.0, aboveWeight);
  gl_FragColor = vec4(applyFog(color, vWorld), opacity);
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
// waterline while the camera passes through the surface. It only tints the
// submerged part: no bright rim, foam stripe or separately lit boundary.
const waterlineFragment = /* glsl */ `
${waveChunk}
uniform vec3 uUnderColor;
uniform float uFade;
varying vec3 vWorld;
void main() {
  float d = vWorld.y - waveHeight(vWorld.xz);
  float feather = max(fwidth(d) * 2.0, 0.025);
  float below = 1.0 - smoothstep(-feather, feather, d);
  // Nearly opaque, darkening away from the line: the lens reads as half in
  // the water, and the close-up surface behind it cannot show a second edge.
  vec3 tint = uUnderColor * (1.0 - 0.3 * clamp(-d * 2.0, 0.0, 1.0));
  gl_FragColor = vec4(tint, below * 0.92 * uFade);
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
    transparent: true,
    depthWrite: false,
  });
  const surface = new Mesh(geometry, surfaceMaterial);
  surface.renderOrder = 1;
  surface.frustumCulled = false;

  const waterlineGeometry = new PlaneGeometry(2, 2);
  const waterlineMaterial = new ShaderMaterial({
    uniforms: {
      uTime: shared.uTime,
      uUnderColor: { value: new Vector3() },
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
      const [x, , z] = frame.position;
      surface.position.set(x, 0, z - 6);
      waterline.visible = frame.waterline > 0;
      waterlineMaterial.uniforms.uFade.value = frame.waterline;
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
