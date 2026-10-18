// The core's own self-test, as a skill: game.use(coreTests) and ?test checks the bus, the config, saving, the keys
// and the loop along with everything else.
import { createBus } from './01_bus.js';
import { defineConfig, merge } from './02_config.js';
import { createStorage, createProfile, read } from './03_storage.js';
import { createLoop } from './05_loop.js';
import { createStages } from './11_stages.js';
import { warmUp, lightCount } from './12_warmup.js';

export const name = 'core';
let game = null;
export function init(g) { game = g; }
export function update() {}
export function dispose() { game = null; }

// A stand-in for localStorage, so the test never touches a real save.
const memory = () => {
  const box = {};
  Object.defineProperties(box, {
    getItem: { value: (k) => (Object.prototype.hasOwnProperty.call(box, k) ? box[k] : null) },
    setItem: { value: (k, v) => { box[k] = String(v); } },
    removeItem: { value: (k) => { delete box[k]; } },
  });
  return box;
};

export function selfTest(t) {
  // The bus
  const bus = createBus(), heard = [];
  const stop = bus.on('a:b', (d) => heard.push(d));
  bus.once('a:b', () => heard.push('once'));
  bus.emit('a:b', 1); bus.emit('a:b', 2); stop(); bus.emit('a:b', 3);
  t.eq(heard, [1, 'once', 2], 'bus: on, once, and stopping');

  // The config
  const { config, reset } = defineConfig({ move: { speed: 8 }, jump: { height: 2 } });
  config.move.speed = 99; reset();
  t.eq(config.move.speed, 8, 'config: reset puts the defaults back');
  t.eq(merge({ a: { x: 1, y: 2 }, b: 3 }, { a: { y: 5 } }), { a: { x: 1, y: 5 }, b: 3 }, 'config: a skill\'s settings lie over its defaults');

  // Saving: the prefix, the move from an old name, somebody else's keys left alone, a broken save survived
  const box = memory();
  box.setItem('old.best', '7'); box.setItem('older.best', '3'); box.setItem('older.name', 'Kirky'); box.setItem('othergame:x', 'keep');
  const storage = createStorage({ prefix: 'mastre:test:', old: ['old.', 'older.'], area: box });
  t.eq(storage.load('best'), '7', 'storage: an old save is moved to the new name (the later name wins)');
  t.eq(storage.load('name'), 'Kirky', 'storage: and one from the name before that');
  t.eq([box.getItem('old.best'), box.getItem('older.name'), box.getItem('othergame:x')], [null, null, 'keep'], 'storage: old keys gone, another game\'s key untouched');
  box.setItem('mastre:test:profile', '{"gold":"12.7","cleared":[1,"x",2,99],"tier":"nonsense"');   // (cut short: not JSON)
  const broken = createProfile(storage, { fresh: () => ({ gold: 0 }), restore: (s, p) => { p.gold = read.int(s.gold); } });
  t.eq(broken.data.gold, 0, 'profile: a half-written save gives a fresh profile, not a crash');
  storage.storeJSON('profile', { gold: '12.7', cleared: [1, 'x', 2, 99], tier: 'nonsense' });
  const profile = createProfile(storage, { fresh: () => ({ gold: 0, cleared: [], tier: 'normal' }), restore: (s, p) => { p.gold = read.int(s.gold); p.cleared = read.ints(s.cleared, 1, 9); p.tier = read.oneOf(s.tier, ['easy', 'normal', 'hard'], 'normal'); } });
  t.eq(profile.data, { gold: 12, cleared: [1, 2], tier: 'normal' }, 'profile: every field is checked on the way in');

  // The keys (the game's own input, driven the way a keyboard would drive it)
  const input = game.input, press = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
  input.clear();
  press('keydown', 'KeyZ');
  t.ok(input.down('KeyZ') && input.pressed('KeyZ'), 'input: a key down is held, and pressed this frame');
  input.endFrame();
  t.ok(input.down('KeyZ') && !input.pressed('KeyZ'), 'input: next frame it is still held, no longer "pressed"');
  press('keyup', 'KeyZ');
  t.ok(!input.down('KeyZ') && input.released('KeyZ'), 'input: released');
  input.endFrame();
  t.ok(typeof input.keyLabel('KeyW') === 'string' && input.keyLabel('KeyW').length >= 1, 'input: a key has a printed name');
  const view = { yaw: 0, pitch: 0 };
  input.look(view);
  t.eq(view, { yaw: 0, pitch: 0 }, 'input: the view does not turn without the pointer');

  // The loop: the same steps whatever the frame rate, and no clock involved
  let steps = 0, frames = 0, sum = 0;
  const loop = createLoop({ fixed: 1 / 100, step: () => steps++, frame: (dt) => { frames++; sum += dt; } });
  loop.advance(1, 1 / 60);
  t.near(steps, 100, 1, 'loop: one second is a hundred fixed steps');
  t.near(sum, 1, 1e-6, 'loop: and the frames add up to one second');
  const again = createLoop({ fixed: 1 / 100, step: () => steps--, frame: () => {} });
  again.advance(1, 1 / 24);
  t.near(steps, 0, 1, 'loop: the same number of steps at 24 frames a second');

  // Stages: named set-ups, in groups, each after the game's own reset
  const log = [], dbg = {}, stub = { bus: createBus(), dbg, query: new URLSearchParams('') };
  const st = createStages(stub, { reset: (s) => log.push(`reset for ${s.id}`) });
  st.add({ id: 'boss', group: 'Fights', name: 'The boss', run: () => log.push('boss') }, { id: 'shop', group: 'Menus', run: async () => { await null; log.push('shop'); } }, { id: 'swarm', group: 'Fights', run: () => log.push('swarm') });
  return Promise.all([st.go('boss'), st.go('nowhere')]).then(async ([went, not]) => {
    await st.go('shop');
    t.eq([went, not, log, st.current], [true, false, ['reset for boss', 'boss', 'reset for shop', 'shop'], 'shop'], 'stages: each is set up after a reset; one that does not exist is not');
    t.eq(st.groups.map((g) => `${g.group}: ${g.stages.map((x) => x.id).join(' ')}`), ['Fights: boss swarm', 'Menus: shop'], 'stages: kept in their groups, in the order their first one came');
    st.add({ id: 'boss', group: 'Fights', name: 'The boss, again', run: () => {} });
    t.eq([st.list.length, st.list[0].name, typeof dbg.stage, dbg.stages], [3, 'The boss, again', 'function', ['boss', 'shop', 'swarm']], 'stages: one added again replaces it; dbg.stage and dbg.stages reach them');

    // Warm-up: what is hidden is compiled, then put back as it was
    if (game?.renderer && game?.scene && game?.camera) {
      const THREE_ = await import('three');
      const hidden = new THREE_.Mesh(new THREE_.TorusKnotGeometry(0.2, 0.05, 32, 6), new THREE_.MeshPhysicalMaterial({ color: 0x336699, clearcoat: 1, sheen: 1 }));
      hidden.visible = false;
      const empty = new THREE_.InstancedMesh(new THREE_.BoxGeometry(0.1, 0.1, 0.1), new THREE_.MeshLambertMaterial({ color: 0x993333 }), 8);
      empty.count = 0;
      game.scene.add(hidden, empty);
      const before = game.renderer.info.programs?.length ?? 0, lights = lightCount(game.scene);
      const ok = warmUp(game.renderer, game.scene, game.camera, { show: [hidden] });
      const after = game.renderer.info.programs?.length ?? 0;
      t.ok(ok && after > before, `warm-up: what had never been drawn is compiled (${before} programs, then ${after})`);
      t.eq([hidden.visible, empty.count, lightCount(game.scene) === lights], [false, 0, true], 'warm-up: and everything is put back as it was');
      game.scene.remove(hidden, empty);
    }
  });
}
