// One config object, tuned live.
//
// Every number that changes how the game feels lives in one object, grouped by system, each with a comment written
// for whoever is tuning it ("seconds between throws", not "throwInterval"). Systems read config.x.y every time they
// need it and never keep a copy, so a slider moved in the panel is felt on the next frame.
//
//   const { config, defaults, reset } = defineConfig({ move: { speed: 8 }, jump: { height: 2 } });
//   const panel = await createTweakPanel(config, { reset, actions: { respawn } });   // backquote opens it
import { createBus } from './01_bus.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

// Lay `over` on top of `base`, group by group (a skill's own settings over its defaults).
export function merge(base, over) {
  const out = clone(base);
  for (const key in over || {}) {
    const v = over[key];
    out[key] = v && typeof v === 'object' && !Array.isArray(v) && typeof out[key] === 'object' ? merge(out[key], v) : v;
  }
  return out;
}

export function defineConfig(values) {
  const config = values, defaults = clone(values), changed = createBus();
  const reset = () => { for (const group in defaults) Object.assign(config[group], clone(defaults[group])); changed.emit('reset'); };
  return { config, defaults, reset, changed };
}

// The tuning panel (lil-gui). It builds itself from the config: add a number or a true/false there and it has a
// slider or a tick box here. Numbers get a range of 0 to three times what they start at.
// lil-gui is only fetched when the panel is first made, so a game that never opens it never pays for it.
export async function createTweakPanel(config, { title = 'Tuning  ( ` to hide )', reset = null, actions = {}, open = [], key = 'Backquote' } = {}) {
  const { default: GUI } = await import('lil-gui');
  const gui = new GUI({ title, width: 330 });
  for (const [group, values] of Object.entries(config)) {
    if (!values || typeof values !== 'object') continue;
    const folder = gui.addFolder(group);
    for (const [name, value] of Object.entries(values)) {
      if (typeof value === 'boolean') folder.add(values, name);
      else if (typeof value === 'number') folder.add(values, name, Math.min(0, value * 3), value === 0 ? 5 : Math.abs(value) * 3);
    }
    if (!open.includes(group)) folder.close();
  }
  const all = {
    ...actions,
    ...(reset ? { 'reset to defaults': () => { reset(); gui.controllersRecursive().forEach((c) => c.updateDisplay()); } } : {}),
    'copy config (JSON)': () => { const json = JSON.stringify(config, null, 2); console.log(json); navigator.clipboard?.writeText(json); },
  };
  for (const name of Object.keys(all)) gui.add(all, name);
  gui.hide();
  const panel = { gui, get open() { return !gui._hidden; }, toggle() { gui.show(gui._hidden); }, dispose() { removeEventListener('keydown', onKey); gui.destroy(); } };
  const onKey = (e) => { if (e.code === key && !(e.target instanceof HTMLInputElement)) panel.toggle(); };
  addEventListener('keydown', onKey);
  return panel;
}
