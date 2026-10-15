import { PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { createEnvironment } from './environment';
import { createSharedUniforms, toVec3 } from './glsl';
import type { OceanFrame, Palette } from './timeline';
import { createWater } from './water';

export function createOceanScene(host: HTMLElement, palette: Palette, onContextLost: () => void) {
  const mobile = Math.min(window.innerWidth, window.innerHeight) < 700 || window.matchMedia('(pointer: coarse)').matches;
  const renderer = new WebGLRenderer({ antialias: !mobile, alpha: false, stencil: false, powerPreference: 'high-performance' });
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.append(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(50, 1, 0.1, 4000);
  const shared = createSharedUniforms(palette);
  const water = createWater(shared, palette, mobile);
  const environment = createEnvironment(shared, palette, mobile);
  scene.add(...environment.objects, water.surface, camera);
  camera.add(water.waterline);

  const lookAt = new Vector3();
  const onLost = (event: Event) => { event.preventDefault(); onContextLost(); };
  renderer.domElement.addEventListener('webglcontextlost', onLost);
  let shaderError = '';
  renderer.debug.onShaderError = (gl, _program, vertex, fragment) => {
    shaderError = `${gl.getShaderInfoLog(vertex) ?? ''}${gl.getShaderInfoLog(fragment) ?? ''}`.trim() || 'link failed';
  };
  const assertShaders = () => {
    if (shaderError) throw new Error(`Ocean shader failed: ${shaderError}`);
  };

  function resize() {
    const width = host.clientWidth;
    const height = host.clientHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5);
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    environment.setPixelRatio(ratio);
    camera.aspect = width / Math.max(1, height);
    // Keep the horizontal field of view usable on portrait screens.
    camera.fov = camera.aspect < 0.8 ? 62 : 50;
    camera.updateProjectionMatrix();
    water.fit(camera);
  }
  resize();

  function dispose() {
    renderer.domElement.removeEventListener('webglcontextlost', onLost);
    water.dispose();
    environment.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  }

  // Warm-up draw while every object is still visible (the canvas is hidden
  // until ready): programs and GPU pipelines are built now, so a rejected
  // shader falls back immediately and the first dive does not stall.
  renderer.render(scene, camera);
  if (shaderError) {
    dispose();
    assertShaders();
  }

  return {
    resize,
    dispose,
    /** Camera follows scroll (frame); waves, rays and particles follow time. */
    draw(frame: OceanFrame, time: number) {
      camera.position.set(...frame.position);
      lookAt.set(...frame.target);
      camera.lookAt(lookAt);
      shared.uTime.value = time;
      shared.uUnder.value = frame.under;
      shared.uLight.value = frame.sunlight;
      shared.uFogDensity.value = frame.fogDensity;
      shared.uFogGradient.value = frame.fogGradient;
      toVec3(frame.fogColor, shared.uFogColor.value);
      water.update(frame);
      environment.update(frame, camera.position);
      renderer.render(scene, camera);
      assertShaders();
    },
  };
}
