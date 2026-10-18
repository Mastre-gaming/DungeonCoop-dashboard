// Stages: every part of a game, set up on demand. A stage is a named moment (round 5 with the boss coming, the lift
// arriving, a scare, the shop with a full purse) that a function puts the game into. The owner reviews a build by
// clicking through them; tests and screenshots go straight to one. DeadSlide's DEAD AIR had sixty, in groups ("The way
// in", "The station", "The objectives", "The scares"); that list is how the owner checked each fix, and how each was
// tested headless.
//
//   const stages = createStages(game);
//   stages.add({ id: 'boss', group: 'Fights', name: 'The boss, now', blurb: 'he arrives in front of you', run: (game) => spawnBoss() });
//   await stages.go('boss');               // (run can be async; go waits for `ready` first, if the game says it is not ready yet)
//   ?stage=boss in the address             goes there once the game has drawn its first frame
//   ?stages (or ?editor) in the address    shows the list as buttons, in its groups
//   dbg.stage('boss') / dbg.stages        from the console, or a headless test
// Before each stage the game's own `reset` (if given) puts things back to a plain start, so one stage never leaks
// into the next; `stages.current` is the one last set up.
const CSS = `
#stages { position: fixed; right: 12px; top: 12px; z-index: 60; width: 260px; max-height: calc(100vh - 24px); overflow-y: auto; padding: 10px 12px; font: 13px/1.35 'Segoe UI', system-ui, sans-serif; color: #f3efe4; background: rgba(8,10,14,0.88); border: 1px solid rgba(243,239,228,0.25); border-radius: 6px; }
#stages h3 { margin: 10px 0 4px; font: 600 11px 'Segoe UI', system-ui, sans-serif; letter-spacing: 2px; text-transform: uppercase; color: #ffb84a; }
#stages h3:first-child { margin-top: 0; }
#stages button { display: block; width: 100%; margin: 3px 0; padding: 5px 8px; text-align: left; font: inherit; color: inherit; background: rgba(243,239,228,0.06); border: 1px solid rgba(243,239,228,0.2); cursor: pointer; }
#stages button:hover, #stages button.on { background: rgba(255,184,74,0.18); border-color: #ffb84a; }
#stages button small { display: block; opacity: 0.65; font-size: 11px; }
`;

export function createStages(game, { reset = null, ready = null } = {}) {
  const list = [];
  let panel = null, current = null;
  const stages = {
    get list() { return list.slice(); },
    get current() { return current; },
    get groups() { const order = [...new Set(list.map((s) => s.group))]; return order.map((g) => ({ group: g, stages: list.filter((s) => s.group === g) })); },
    add(...items) {
      for (const s of items.flat()) {
        if (!s.id || typeof s.run !== 'function') throw new Error('a stage needs an id and a run()');
        const i = list.findIndex((x) => x.id === s.id);
        const stage = { group: 'Stages', name: s.id, blurb: '', ...s };
        if (i >= 0) list[i] = stage; else list.push(stage);
      }
      if (panel) stages.show();
      return stages;
    },
    has: (id) => list.some((s) => s.id === id),
    // Into one: the game's reset, then the stage's own set-up. Resolves true once it is set up (false: no such stage).
    async go(id) {
      const s = list.find((x) => x.id === id);
      if (!s) return false;
      if (ready) await ready();
      await reset?.(s);
      await s.run(game, s);
      current = id;
      game.bus?.emit('stage:go', { id });
      if (panel) for (const b of panel.querySelectorAll('button')) b.classList.toggle('on', b.dataset.id === id);
      return true;
    },
    // The list as buttons, in its groups (the editor's page of every part of the game).
    show() {
      if (typeof document === 'undefined') return null;
      if (!document.getElementById('stages-style')) document.head.appendChild(Object.assign(document.createElement('style'), { id: 'stages-style', textContent: CSS }));
      panel ??= document.body.appendChild(Object.assign(document.createElement('div'), { id: 'stages' }));
      panel.replaceChildren();
      for (const { group, stages: of } of stages.groups) {
        panel.appendChild(Object.assign(document.createElement('h3'), { textContent: group }));
        for (const s of of) {
          const b = Object.assign(document.createElement('button'), { type: 'button' });
          b.dataset.id = s.id;
          b.append(s.name);
          if (s.blurb) b.appendChild(Object.assign(document.createElement('small'), { textContent: s.blurb }));
          b.addEventListener('click', (e) => { e.stopPropagation(); stages.go(s.id); });
          panel.appendChild(b);
        }
      }
      return panel;
    },
    hide() { panel?.remove(); panel = null; },
  };
  if (game?.dbg) { game.dbg.stage = (id) => stages.go(id); Object.defineProperty(game.dbg, 'stages', { get: () => list.map((s) => s.id), configurable: true }); }
  const q = game?.query;
  if (q && (q.has('stages') || q.has('editor'))) queueMicrotask(() => stages.show());
  if (q?.get('stage') && game.bus) game.bus.once('game:start', () => requestAnimationFrame(() => stages.go(q.get('stage'))));
  game && (game.stages = stages);
  return stages;
}
