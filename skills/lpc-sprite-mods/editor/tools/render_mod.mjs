// Put a saved mod on an imported character and write the finished sheet, without anyone clicking.
//   npm run build      (once, and after changing src/)
//   node tools/render_mod.mjs <character id> <mod.json | none> <out.png> [--preview=preview.png] [--anim=walk] [--facing=south]
// The preview is a screenshot of the editor with the mod on (big frame + the four animated facings).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openPage } from './shots.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), flag = (n) => (args.find((a) => a.startsWith(`--${n}=`)) || '').split('=').slice(1).join('=') || undefined;
const [id, modFile, out] = args.filter((a) => !a.startsWith('--'));
if (!id || !modFile || !out) { console.error('Usage: node tools/render_mod.mjs <character id> <mod.json | none> <out.png> [--preview=preview.png] [--anim=walk] [--facing=south]'); process.exit(1); }
if (!fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) { console.error('Build first: npm run build'); process.exit(1); }
// dist/ has the imports that existed at build time; serve the live folder over it so new imports work too
const mod = modFile === 'none' ? null : fs.readFileSync(path.resolve(modFile), 'utf8');

const PORT = 4392;
const stage = path.join(ROOT, 'dist');
fs.cpSync(path.join(ROOT, 'public', 'imports'), path.join(stage, 'imports'), { recursive: true });
const server = spawn(process.execPath, [path.join(ROOT, 'tools', 'serve.mjs'), stage, String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
try {
  const page = await openPage(`http://localhost:${PORT}/?character=${encodeURIComponent(id)}`, { size: '1500x900' });
  const ok = await page.waitFor(`window.dbg?.app?.sheet?.meta.id === ${JSON.stringify(id)}`, 60000);
  if (!ok) throw new Error(`No imported character "${id}" (see public/imports/index.json)`);
  if (mod) await page.eval(`window.dbg.app.loadMod(${JSON.stringify(mod)})`);
  const url = await page.eval('window.dbg.app.sheetDataURL()');
  fs.writeFileSync(path.resolve(out), Buffer.from(url.split(',')[1], 'base64'));
  console.log('sheet', path.resolve(out));
  if (flag('preview')) {
    await page.eval(`(() => { const s = window.dbg.app; const a = s.sheet.anims.findIndex((x) => x.id === ${JSON.stringify(flag('anim') || 'walk')}); if (a >= 0) s.setAnim(a); s.setFacing(${JSON.stringify(flag('facing') || 'south')}); s.dirty = true; })()`);
    await new Promise((r) => setTimeout(r, 900));
    await page.shot(path.resolve(flag('preview')));
    console.log('preview', path.resolve(flag('preview')));
  }
  if (page.errors.length) console.log('page errors:', page.errors.slice(0, 3));
  await page.close();
} finally {
  server.kill();
}
