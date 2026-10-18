// Keyboard and mouse.
//
// Keys are PHYSICAL keys ('KeyW' is the key where W sits on a QWERTY keyboard, wherever the player is), so the game
// plays the same on a French AZERTY keyboard; what is printed on the key is worked out for the help text (keyLabel).
// The mouse looks around only once the page has the pointer (click to capture, Esc gives it back), never inverted,
// with a sensitivity the player can change.
//
//   const input = createInput({ bindings: { forward: ['KeyW', 'ArrowUp'], jump: ['Space'] } });
//   input.held('forward')        true while it is down
//   input.pressed('jump')        true from the press until the frame ends (endFrame); input.take('jump') uses it up now
//   input.axis('left', 'right')  -1, 0 or 1
//   input.look(view)             turns { yaw, pitch } by what the mouse has moved since last asked
//   canvas.onclick = () => input.lock(canvas);       // (the browser only allows this from a click or a key)
//   <span data-key="KeyW"></span>                    // filled in with what that key is called on this keyboard
const AZERTY = { KeyQ: 'A', KeyA: 'Q', KeyW: 'Z', KeyZ: 'W', KeyM: ',', Backquote: '²' };
const NAMES = { Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', Escape: 'Esc', Backspace: 'Backspace', Enter: 'Enter', Tab: 'Tab', Backquote: '`', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
const LOOK = 0.0022;   // radians per pixel of mouse at sensitivity 1

export function createInput({ bindings = {}, sensitivity = 1, bus = null, prevent = ['Space', 'Tab'] } = {}) {
  const down = new Set(), pressed = new Set(), released = new Set();
  const stop = [];
  const listen = (target, type, fn, options) => { target.addEventListener(type, fn, options); stop.push(() => target.removeEventListener(type, fn, options)); };
  const typing = (e) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target?.isContentEditable;
  const codes = (action) => bindings[action] || [action];   // (an action name, or a key code as it stands)
  let layout = null, dx = 0, dy = 0, wheel = 0, lockedAt = -1e9;

  const input = {
    bindings,
    sensitivity,           // change it from a slider; it is read every time the mouse moves the view
    fire: false,           // left mouse, while the page has the pointer
    aim: false,            // right mouse
    get locked() { return !!document.pointerLockElement; },

    down: (code) => down.has(code),
    held: (action) => codes(action).some((c) => down.has(c)),
    pressed: (action) => codes(action).some((c) => pressed.has(c)),
    released: (action) => codes(action).some((c) => released.has(c)),
    take(action) { let any = false; for (const c of codes(action)) any = pressed.delete(c) || any; return any; },
    axis: (negative, positive) => (input.held(positive) ? 1 : 0) - (input.held(negative) ? 1 : 0),
    rebind(action, list) { bindings[action] = list; relabel(); },

    // Mouse movement since last asked, in pixels (unscaled).
    takeMouse() { const d = [dx, dy]; dx = dy = 0; return d; },
    takeWheel() { const w = wheel; wheel = 0; return w; },
    // Turn a view by the mouse: right turns right, up looks up. Never the other way round.
    look(view, { minPitch = -1.45, maxPitch = 1.45 } = {}) {
      const [mx, my] = input.takeMouse(), k = LOOK * input.sensitivity;
      view.yaw -= mx * k;
      view.pitch = Math.max(minPitch, Math.min(maxPitch, view.pitch - my * k));
      return view;
    },

    lock(element) { try { element.requestPointerLock()?.catch?.(() => {}); } catch {} },
    unlock() { document.exitPointerLock?.(); },
    // Call once at the end of every frame: "pressed" and "released" last one frame.
    endFrame() { pressed.clear(); released.clear(); },
    clear() { down.clear(); pressed.clear(); released.clear(); input.fire = input.aim = false; dx = dy = 0; },
    keyLabel,
    relabel,
    dispose() { for (const fn of stop) fn(); stop.length = 0; },
  };

  // What is printed on a key, on this player's keyboard.
  function keyLabel(code) {
    if (/^Digit\d$/.test(code)) return code.slice(5);   // (the number row is called by its numbers, whatever is printed unshifted on it)
    const own = layout?.get(code);
    if (own) return own.length === 1 ? own.toUpperCase() : own;
    if (!layout && /^fr\b/i.test(navigator.language || '') && AZERTY[code]) return AZERTY[code];   // (no answer from the browser: guess from its language)
    return NAMES[code] || code.replace(/^Key|^Digit/, '');
  }
  // data-key="KeyW" (or several: "KeyA KeyD"; or an action: data-action="jump") gets its text from the keyboard.
  function relabel(root = document) {
    for (const el of root.querySelectorAll('[data-key]')) el.textContent = el.dataset.key.split(' ').map(keyLabel).join(' / ');
    for (const el of root.querySelectorAll('[data-action]')) el.textContent = (bindings[el.dataset.action] || []).slice(0, 1).map(keyLabel).join('');
  }

  listen(window, 'keydown', (e) => {
    if (typing(e)) return;
    if (prevent.includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    down.add(e.code);
    pressed.add(e.code);
  });
  listen(window, 'keyup', (e) => { if (down.delete(e.code)) released.add(e.code); });
  listen(window, 'blur', () => input.clear());
  // Mouse buttons only count while the game has the pointer, so a click on a menu never fires a gun.
  listen(window, 'mousedown', (e) => { if (!input.locked) return; if (e.button === 0) input.fire = true; if (e.button === 2) input.aim = true; });
  listen(window, 'mouseup', (e) => { if (e.button === 0) input.fire = false; if (e.button === 2) input.aim = false; });
  listen(window, 'contextmenu', (e) => { if (input.locked) e.preventDefault(); });
  // (the first movement after the pointer is captured or let go can carry hundreds of pixels at once: DEAD AIR's
  // "camera swings". Dropped for 150 ms after either, and no single event moves more than 120 px.)
  listen(window, 'mousemove', (e) => { if (!input.locked || performance.now() - lockedAt < 150) return; dx += Math.max(-120, Math.min(120, e.movementX)); dy += Math.max(-120, Math.min(120, e.movementY)); });
  listen(window, 'wheel', (e) => { wheel += Math.sign(e.deltaY); }, { passive: true });
  // Losing the pointer (Esc, alt-tab) is the game's cue to pause.
  listen(document, 'pointerlockchange', () => { lockedAt = performance.now(); dx = dy = 0; if (!input.locked) { input.fire = input.aim = false; } bus?.emit(input.locked ? 'input:locked' : 'input:unlocked'); });

  relabel();
  navigator.keyboard?.getLayoutMap?.().then((map) => { layout = map; relabel(); }).catch(() => {});
  return input;
}
