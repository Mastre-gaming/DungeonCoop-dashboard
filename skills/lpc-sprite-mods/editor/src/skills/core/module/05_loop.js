// The main loop: physics in fixed steps, everything else once a frame.
//
//   const loop = createLoop({ step: (h) => physics(h), frame: (dt) => { update(dt); render(); } });
//   loop.start();
//
// - `step(h)` is called with the same small `h` every time (1/120 s unless told otherwise), as many times as the
//   frame's time allows: what it computes does not depend on how fast the screen is.
// - `frame(dt)` is called once per screen frame with the time since the last one, never negative and never more than
//   `maxDt` (a tab left in the background does not come back with a two-second step).
// - `loop.paused = true` stops both but keeps the frames coming with dt = 0, so a pause screen still draws.
// - `loop.speed` slows or quickens time (0.2 for slow motion).
// - `loop.advance(seconds)` runs the game forward by exactly that much, with no clock involved: for tests, and for
//   screenshots of a moment (headless browsers run slow, so never wait on the wall clock for them).
export function createLoop({ step = null, frame = null, fixed = 1 / 120, maxDt = 0.05, maxSteps = 10 } = {}) {
  let last = 0, left = 0, id = 0;
  const loop = {
    fixed, running: false, paused: false, speed: 1, time: 0, frames: 0, ms: 0,
    start() { if (loop.running) return; loop.running = true; last = performance.now(); id = requestAnimationFrame(tick); },
    stop() { loop.running = false; cancelAnimationFrame(id); },
    // (After a pause, a level change or anything else that took a while: forget the time that passed.)
    resync() { last = performance.now(); left = 0; },
    advance(seconds, frameDt = 1 / 60) {
      for (let t = 0; t < seconds - 1e-9; t += frameDt) run(Math.min(frameDt, seconds - t));
    },
  };
  function run(dt) {
    if (step) {
      left += dt;
      let n = 0;
      while (left >= fixed && n++ < maxSteps) { step(fixed); left -= fixed; }
      if (n > maxSteps) left = 0;   // (too far behind to catch up: drop the debt rather than spiral)
    }
    loop.time += dt;
    loop.frames++;
    frame?.(dt);
  }
  function tick(now) {
    if (!loop.running) return;
    id = requestAnimationFrame(tick);
    const dt = loop.paused ? 0 : Math.max(0, Math.min(maxDt, (now - last) / 1000)) * loop.speed;
    last = now;
    const before = performance.now();
    run(dt);
    loop.ms += (performance.now() - before - loop.ms) * 0.05;   // a smoothed "how long a frame takes", for an F3 readout
  }
  return loop;
}
