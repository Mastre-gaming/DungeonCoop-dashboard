// The event bus: how modules talk to each other without holding on to each other.
// Names are 'area:what' ('combat:hit', 'player:landed', 'run:over'). A module says what happened; whoever cares listens.
//
//   const bus = createBus();
//   const stop = bus.on('player:landed', ({ impact }) => { ... });   // stop() to stop listening
//   bus.emit('player:landed', { impact: 4 });
//   bus.on('*', (name, data) => console.log(name, data));           // everything (for a debug log)
export function createBus() {
  const lists = new Map();
  const off = (name, fn) => { lists.get(name)?.delete(fn); };
  const on = (name, fn) => {
    if (!lists.has(name)) lists.set(name, new Set());
    lists.get(name).add(fn);
    return () => off(name, fn);
  };
  const once = (name, fn) => { const stop = on(name, (data) => { stop(); fn(data); }); return stop; };
  // (Listeners are copied before they are called: one of them may stop listening, or add another, while it runs.)
  const emit = (name, data) => {
    const list = lists.get(name), all = lists.get('*');
    if (list) for (const fn of [...list]) fn(data);
    if (all) for (const fn of [...all]) fn(name, data);
  };
  return { on, off, once, emit, clear: () => lists.clear(), count: (name) => lists.get(name)?.size || 0 };
}
