// The first time anything is drawn, its shader is compiled, and that is a stall: the first monster of a kind, the first
// muzzle flash, the gun before your eye, a light switched on. DEAD AIR's owner reported it as "FPS drops at spawns".
// warmUp draws all of it once, with nobody looking, while the loading screen is up: everything that is hidden is
// shown for the call, every instanced mesh with nothing in it is given one instance far below the floor, and then
// it is all put back.
//
//   warmUp(renderer, scene, camera, { show: [muzzleFlash, viewGun, ...] });   // after building, before play
//   await warmUpAsync(renderer, scene, camera)                                 // the same, without blocking (where three has compileAsync)
//
// Its rule for lights, the other cause of the same stall: never add or remove a light during play, and never toggle
// `visible` on one (the number of lights is part of every shader; changing it recompiles everything). Make them all up
// front and turn them up and down with `intensity`.
export function warmUp(renderer, scene, camera, { show = [], below = -50 } = {}) {
  const undo = prepare(scene, show, below);
  let ok = true;
  try { renderer.compile(scene, camera); } catch (error) { ok = false; console.warn('warm-up', error); }
  for (const u of undo) u();
  return ok;
}
export async function warmUpAsync(renderer, scene, camera, { show = [], below = -50 } = {}) {
  if (typeof renderer.compileAsync !== 'function') return warmUp(renderer, scene, camera, { show, below });
  const undo = prepare(scene, show, below);
  let ok = true;
  try { await renderer.compileAsync(scene, camera); } catch (error) { ok = false; console.warn('warm-up', error); }
  for (const u of undo) u();
  return ok;
}
function prepare(scene, show, below) {
  const undo = [];
  const reveal = (o) => { if (o && o.visible === false) { o.visible = true; undo.push(() => { o.visible = false; }); } };
  for (const o of show) { reveal(o); o?.traverse?.(reveal); }
  scene.traverse((o) => {
    if (o.isInstancedMesh && o.count === 0) {
      const m = o.instanceMatrix.array, saved = Array.from(m.slice(0, 16));
      o.count = 1;
      m.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, below, 0, 1], 0);
      o.instanceMatrix.needsUpdate = true;
      undo.push(() => { o.count = 0; m.set(saved, 0); o.instanceMatrix.needsUpdate = true; });
    }
  });
  return undo;
}
// How many lights a scene has that can change a shader if they come or go: for a test that says "the count of lights
// never changes during play" (call it at the start and again later; the two must be equal).
export function lightCount(scene) { let n = 0; scene.traverse((o) => { if (o.isLight && o.visible) n++; }); return n; }
