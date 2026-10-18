// Build check: serve dist/, run ?test in a headless Edge, take screenshots of the editor.
//   npm run build && npm test          -> prints passed/total, saves shots/*.png
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPage } from './shots.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4391;
const server = spawn(process.execPath, [path.join(ROOT, 'tools', 'serve.mjs'), path.join(ROOT, 'dist'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
const url = `http://localhost:${PORT}/`;
let failed = false;
try {
  const page = await openPage(`${url}?test`, { size: '1500x900' });
  const result = await page.waitFor('document.documentElement.dataset.test', 60000);
  const fails = await page.eval('document.documentElement.dataset.failed');
  console.log(`self-test ${result}${fails ? `\n  failed: ${fails}` : ''}`);
  failed = !result || !!fails;
  if (page.errors.length) console.log('page errors:', page.errors.slice(0, 5));
  await page.close();

  const shot = await openPage(url, { size: '1500x900' });
  await shot.waitFor('window.dbg && window.dbg.app && window.dbg.app.sheet');
  await new Promise((r) => setTimeout(r, 800));
  await shot.shot(path.join(ROOT, 'shots', 'editor_empty.png'));
  await shot.eval(`(() => { document.querySelector('#preset').click(); })()`);
  await new Promise((r) => setTimeout(r, 900));
  await shot.shot(path.join(ROOT, 'shots', 'editor_preset.png'));
  await shot.eval(`(() => { const s = window.dbg.app; s.setFacing('west'); s.view.zoom = 12; s.dirty = true; })()`);
  await new Promise((r) => setTimeout(r, 700));
  await shot.shot(path.join(ROOT, 'shots', 'editor_west.png'));
  await shot.eval(`(() => { const s = window.dbg.app; s.setAnim(s.sheet.anims.findIndex(a => a.id === 'slash_128')); s.setFacing('south'); s.dirty = true; })()`);
  await new Promise((r) => setTimeout(r, 700));
  await shot.shot(path.join(ROOT, 'shots', 'editor_slash.png'));
  // leave the person's saved work alone
  await shot.eval(`(() => { localStorage.clear(); })()`);
  if (shot.errors.length) console.log('page errors:', shot.errors.slice(0, 5));
  await shot.close();
  console.log('shots saved in shots/');
} finally {
  server.kill();
}
process.exit(failed ? 1 : 0);
