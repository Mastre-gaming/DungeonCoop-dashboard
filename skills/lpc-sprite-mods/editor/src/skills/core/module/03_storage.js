// Saving in this browser (localStorage), and a profile that cannot be broken by a bad save.
//
//   const storage = createStorage({ prefix: 'mastre:my-game:', old: ['my-game.'] });
//   storage.store('best', '120');  storage.load('best');  storage.loadJSON('run');  storage.storeJSON('run', {...});
//
// The prefix keeps one game's saves apart from another's on a site that hosts several (the Mastre Gaming hub asks
// for 'mastre:<id>:'). `old` lists the prefixes the game used before: anything found under one is moved to the new
// name before the game reads a thing, so a rename never costs a player their progress. Only this game's own keys
// are ever touched.
export function createStorage({ prefix, old = [], area = null } = {}) {
  if (!prefix) throw new Error('createStorage: give a prefix (e.g. "mastre:my-game:")');
  let box = area;
  try { box ||= localStorage; } catch { box = null; }   // (storage can be blocked outright: then nothing is saved, and nothing breaks)
  const key = (name) => prefix + name;

  try {
    for (const was of old) {   // (the later name first: where both hold something, the first listed is the one kept)
      for (const k of Object.keys(box)) {
        if (!k.startsWith(was)) continue;
        const now = key(k.slice(was.length));
        if (box.getItem(now) === null) box.setItem(now, box.getItem(k));
        box.removeItem(k);
      }
    }
  } catch {}

  const load = (name) => { try { return box.getItem(key(name)); } catch { return null; } };
  const store = (name, value) => { try { box.setItem(key(name), value); return true; } catch { return false; } };
  const remove = (name) => { try { box.removeItem(key(name)); } catch {} };
  const loadJSON = (name, fallback = null) => { try { const v = JSON.parse(load(name)); return v ?? fallback; } catch { return fallback; } };
  const storeJSON = (name, value) => store(name, JSON.stringify(value));
  return { prefix, load, store, remove, loadJSON, storeJSON };
}

// Reading a saved value you cannot trust: each returns something of the right kind whatever was in the save.
export const read = {
  int: (v, min = 0, max = Infinity, fallback = min) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback; },
  num: (v, min = -Infinity, max = Infinity, fallback = 0) => { const n = Number(v); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback; },
  bool: (v) => !!v,
  text: (v, max = 64, fallback = '') => (typeof v === 'string' ? v.slice(0, max) : fallback),
  oneOf: (v, allowed, fallback = allowed[0]) => (allowed.includes(v) ? v : fallback),
  ids: (v, allowed = null, max = 200) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && (!allowed || allowed.includes(x))).slice(0, max) : []),
  ints: (v, min = 0, max = 1e9, most = 200) => (Array.isArray(v) ? v.filter((n) => Number.isInteger(n) && n >= min && n <= max).slice(0, most) : []),
};

// What is kept between runs. `fresh()` makes an empty profile; `restore(saved, profile)` copies across what it
// recognises from the save, field by field, each one checked (use `read` above). A missing, half-written or
// tampered save gives a fresh profile instead of a crash, and a field added later is simply absent from old saves.
//
//   const profile = createProfile(storage, {
//     fresh: () => ({ gold: 0, cleared: [] }),
//     restore: (saved, p) => { p.gold = read.int(saved.gold); p.cleared = read.ints(saved.cleared, 1, 9); },
//   });
//   profile.data.gold += 5;  profile.save();
export function createProfile(storage, { key = 'profile', fresh, restore }) {
  const data = fresh();
  try { const saved = storage.loadJSON(key); if (saved && typeof saved === 'object') restore(saved, data); } catch { Object.assign(data, fresh()); }
  return {
    data,
    save: () => storage.storeJSON(key, data),
    wipe: () => { for (const k of Object.keys(data)) delete data[k]; Object.assign(data, fresh()); storage.remove(key); },
  };
}
