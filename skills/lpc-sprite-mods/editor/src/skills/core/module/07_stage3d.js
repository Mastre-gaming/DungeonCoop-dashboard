// The 3D stage (three.js): renderer, scene and camera, sharp at any window size.
//
//   const stage = game.use(stage3d, { canvas, fov: 60, sky: 0x10141c });
//   game.scene, game.camera, game.renderer are set; game.render draws them once a frame.
//
// Full resolution (the screen's own pixel ratio, up to `maxPixelRatio`), antialiased, and no fog unless a level asks
// for it: "blurry, foggy, grainy" is the first thing that makes a 3D game look cheap.
import * as THREE from 'three';

export const name = 'stage3d';
export const always = true;
const DEFAULTS = { canvas: null, fov: 60, near: 0.1, far: 2000, sky: 0x0b0e14, maxPixelRatio: 2, antialias: true, shadows: false, toneMapping: true };
let game = null, renderer = null, onResize = null, settings = null;

export function init(g, config = {}) {
  game = g;
  settings = { ...DEFAULTS, ...config };
  const canvas = settings.canvas || document.body.appendChild(Object.assign(document.createElement('canvas'), { id: 'view' }));
  renderer = new THREE.WebGLRenderer({ canvas, antialias: settings.antialias, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, settings.maxPixelRatio));
  if (settings.toneMapping) renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = settings.shadows;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(settings.sky);
  const camera = new THREE.PerspectiveCamera(settings.fov, 1, settings.near, settings.far);
  camera.position.set(0, 3, 8);

  onResize = () => {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    game.bus.emit('stage:resize', { width: w, height: h });
  };
  addEventListener('resize', onResize);
  onResize();

  Object.assign(game, { scene, camera, renderer, canvas });
  game.render = () => renderer.render(scene, camera);
  return { scene, camera, renderer, canvas, resize: onResize };
}

export function update() {}

export function dispose() {
  removeEventListener('resize', onResize);
  game.scene?.traverse((o) => { o.geometry?.dispose?.(); for (const m of [].concat(o.material || [])) { for (const k in m) m[k]?.isTexture && m[k].dispose(); m.dispose?.(); } });
  renderer?.dispose();
  game.render = null;
  game.scene = game.camera = game.renderer = null;
}

export function selfTest(t) {
  t.ok(!!renderer && !!game.scene && !!game.camera, 'renderer, scene and camera exist');
  const size = renderer.getSize(new THREE.Vector2());
  t.ok(size.x > 0 && size.y > 0, 'the canvas has a size');
  t.near(game.camera.aspect, size.x / size.y, 0.01, 'the camera matches the canvas');
  t.ok(renderer.getPixelRatio() >= 1, 'drawn at full resolution');
  t.ok(!game.scene.fog, 'no fog by default');
}

// What a frame costs to draw: for an F3 readout, and for "did that optimisation hide something" checks.
export const drawn = () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles });
