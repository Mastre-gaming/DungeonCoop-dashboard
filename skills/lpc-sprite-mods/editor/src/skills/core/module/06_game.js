// The game shell: one object every skill is handed, and the rules they all follow.
//
//   const game = createGame({ config, bindings, storage: { prefix: 'mastre:my-game:' } });
//   const stage = game.use(stage3d, { canvas });      // a skill: init(game, config), update(dt), dispose(), selfTest(t)
//   const audio = game.use(synthAudio);
//   game.start();
//
// A skill is a module with four exports (and a `name`):
//   init(game, config)   set itself up; whatever it returns is what game.use() returns (its handle)
//   update(dt)           once a frame            (optional: step(h) for fixed-step physics)
//   dispose()            put everything away
//   selfTest(t, game)    its own checks, run by ?test in the address (t.ok, t.eq, t.near)
//   always = true        (optional) it is updated even while another skill has the frame to itself (game.solo)
// Skills never hold on to each other: they talk through game.bus ('combat:hit'), and read game.config live.
//
// In the address:  ?test  runs every skill's self-test and prints passed/total;  ?spot=name  goes to a named
// viewpoint (dbg.spot);  ?seed=123  is game.seed;  ?freeze  starts paused.
// In the console:  dbg.go('title'), dbg.freeze(), dbg.advance(2), dbg.god = true, dbg.dump().
import { createBus } from './01_bus.js';
import { createStorage } from './03_storage.js';
import { createInput } from './04_input.js';
import { createLoop } from './05_loop.js';
import { runSelfTests } from './08_test.js';

export function createGame({ config = {}, bindings = {}, storage = null, fixed = 1 / 120, debugName = 'dbg' } = {}) {
  const query = new URLSearchParams(location.search), bus = createBus(), skills = [], spots = new Map();
  const game = {
    config, bus, query, skills,
    seed: Number(query.get('seed')) || Math.floor(Math.random() * 1e6) + 1,
    stamp: typeof __BUILD_STAMP__ === 'undefined' ? 'dev' : __BUILD_STAMP__,   // when it was built: show it on the title screen
    storage: storage ? createStorage(storage) : null,
    input: createInput({ bindings, bus }),
    render: null,   // set by whoever draws (07_stage3d.js)
    // The name of a skill that has taken the frame for itself (a cutscene, a minigame, a menu scene). While it is
    // set, only that skill is updated, with the skills marked `always` (the stage, the sound): the game underneath
    // stands still without each of its systems having to know why.
    solo: null,

    // Add a skill. `settings` is laid over the skill's own defaults by the skill itself.
    use(skill, settings = {}) {
      const handle = skill.init(game, settings);
      skills.push(skill);
      return handle ?? skill;
    },
    start() { loop.start(); bus.emit('game:start'); if (query.has('freeze')) loop.paused = true; return game; },
    dispose() {
      loop.stop();
      for (const skill of [...skills].reverse()) { try { skill.dispose?.(); } catch (error) { console.warn(`${skill.name}: dispose failed`, error); } }
      skills.length = 0;
      game.input.dispose();
      bus.clear();
    },
    test: () => runSelfTests(game),
  };

  const loop = (game.loop = createLoop({
    fixed,
    step: (h) => { if (!game.solo) for (const skill of skills) skill.step?.(h); },
    frame: (dt) => {
      for (const skill of skills) if (!game.solo || skill.name === game.solo || skill.always) skill.update?.(dt);
      game.render?.(dt);
      game.input.endFrame();
    },
  }));

  // The debug handle: everything a tester (a person at the console, or a script taking screenshots) needs.
  const dbg = (game.dbg = {
    game,
    god: false,                                           // skills that can hurt the player check game.dbg.god
    spot(name, go) { spots.set(name, go); return dbg; },   // name a viewpoint: dbg.spot('title', () => { ... })
    go(name) { const go = spots.get(name); if (!go) return false; go(game); return true; },
    get spots() { return [...spots.keys()]; },
    freeze(on = !loop.paused) { loop.paused = on; return on; },
    advance(seconds) { const was = loop.paused; loop.paused = false; loop.advance(seconds); loop.paused = was; },
    dump() { return { skills: skills.map((s) => s.name), time: +loop.time.toFixed(2), frameMs: +loop.ms.toFixed(2), draw: game.renderer?.info.render, seed: game.seed, stamp: game.stamp }; },
    test: game.test,
  });
  if (debugName) window[debugName] = dbg;

  // ?spot and ?test act once the game has drawn its first frame.
  bus.once('game:start', () => requestAnimationFrame(() => {
    if (query.get('spot')) dbg.go(query.get('spot'));
    if (query.has('test')) game.test();
  }));
  return game;
}
