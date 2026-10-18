// The self-test: ?test in the address runs every skill's own checks and prints passed/total.
//
// A skill's selfTest(t, game) says what must be true:
//   t.ok(condition, 'what should be so')
//   t.eq(got, wanted, 'what')            t.near(got, wanted, tolerance, 'what')
// It may be async. A check that throws counts as failed, not as a crash.
//
// The result goes four places: the console; a panel on the page; window.__test = { passed, total, failed: [...] };
// and <html data-test="12/12" data-failed="..."> so a headless run can read it off the page (core/tools/test_demos.mjs).
//
// Tests that mean something: drive the thing the way a player would (hold forward through the doorway, do not
// teleport past it), and check what the player would see. A green test that teleported has lied before.
export function createTester() {
  const results = [];
  let group = '';
  const add = (pass, name) => { results.push({ pass: !!pass, name: group ? `${group}: ${name}` : name }); return !!pass; };
  const t = {
    group(name) { group = name; },
    ok: (condition, name) => add(condition, name),
    eq: (got, wanted, name) => add(Object.is(got, wanted) || JSON.stringify(got) === JSON.stringify(wanted), `${name} (got ${JSON.stringify(got)}, wanted ${JSON.stringify(wanted)})`),
    near: (got, wanted, tolerance, name) => add(Math.abs(got - wanted) <= tolerance, `${name} (got ${typeof got === 'number' ? +got.toFixed(4) : got}, wanted ${wanted} ± ${tolerance})`),
    throws: (fn, name) => { try { fn(); return add(false, name); } catch { return add(true, name); } },
  };
  return { t, results };
}

export async function runSelfTests(game) {
  const { t, results } = createTester();
  for (const skill of game.skills) {
    if (!skill.selfTest) continue;
    t.group(skill.name || 'skill');
    try { await skill.selfTest(t, game); } catch (error) { t.ok(false, `threw: ${error?.message || error}`); }
  }
  const failed = results.filter((r) => !r.pass).map((r) => r.name), passed = results.length - failed.length;
  const report = { passed, total: results.length, failed };
  window.__test = report;
  document.documentElement.dataset.test = `${passed}/${results.length}`;
  document.documentElement.dataset.failed = failed.join('; ');
  console.log(`self-test ${passed}/${results.length}${failed.length ? `\n  failed:\n  - ${failed.join('\n  - ')}` : ''}`);

  let panel = document.getElementById('self-test');
  if (!panel) {
    panel = document.body.appendChild(Object.assign(document.createElement('pre'), { id: 'self-test' }));
    panel.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:9999;margin:0;padding:10px 14px;max-width:46vw;max-height:60vh;overflow:auto;font:12px/1.5 ui-monospace,Consolas,monospace;white-space:pre-wrap;border-radius:6px;background:rgba(8,10,14,.92);border:1px solid';
  }
  panel.style.color = panel.style.borderColor = failed.length ? '#ff7a6b' : '#7dffb0';
  panel.textContent = `self-test  ${passed}/${results.length}${failed.length ? `\n\nfailed:\n- ${failed.join('\n- ')}` : '  all passed'}`;
  game.bus?.emit('test:done', report);
  return report;
}
