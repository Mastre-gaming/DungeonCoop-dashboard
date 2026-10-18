// Import a character from the Universal LPC Spritesheet Character Generator.
//
//   node tools/lpc_import.mjs <generator link or #hash> [--anchor=hat] [--id=knight] [--name="Knight"]
//
// The hosted generator draws the character in a headless Edge; we keep its finished sheet, plus a second sheet
// without the anchor part (the editor diffs the two to find that part in every frame), the generator's credits and
// the list of extra big-weapon animation blocks below the 54 standard rows.
// Writes public/imports/<id>/{sheet.png, bare.png, credits.txt, meta.json} and updates public/imports/index.json.
// The dev server calls importCharacter() for the editor's Import button (see vite.config.js).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPage } from './shots.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const GENERATOR = 'https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/';
const IMPORTS = path.join(ROOT, 'public', 'imports');

export function parseLink(link) {
  const hash = String(link).split('#').slice(1).join('#') || String(link);
  const pairs = hash.replace(/^#/, '').split('&').filter(Boolean).map((p) => p.split('='));
  return pairs.filter(([k, v]) => k && v !== undefined);
}

// The part to track: a hat if there is one (it sits on the head in every frame), else the head.
export function defaultAnchor(pairs) {
  const keys = pairs.map(([k]) => k);
  return ['hat', 'helmet', 'head'].find((k) => keys.includes(k)) || keys.find((k) => k !== 'sex' && k !== 'body') || 'head';
}

async function render(hash, log) {
  const want = hash.split('&').filter((p) => p && !p.startsWith('sex=')).length;
  const page = await openPage(`${GENERATOR}#${hash}`, { size: '1400x1000' });
  try {
    const ok = await page.waitFor(`(() => {
      const h = [...document.querySelectorAll('h1,h2,h3,h4,summary')].find(e => /Current Selections/.test(e.textContent));
      const n = h ? h.closest('section,details,div').innerText.trim().split('\\n').length - 1 : 0;
      return n === ${want} && window.canvasRenderer && window.canvasRenderer.canvas;
    })()`, 90000);
    if (!ok) throw new Error('The generator did not take every part in the link (a misspelt item?)');
    // Layers keep loading for a while: wait until the sheet stops changing for 5 checks in a row.
    let last = '', same = 0;
    for (let t = 0; t < 150 && same < 5; t++) {
      await new Promise((r) => setTimeout(r, 1000));
      const sig = await page.eval(`(() => { const c = window.canvasRenderer.canvas; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let s = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) s = (s + i) % 1000000007; return c.width + 'x' + c.height + ':' + s; })()`);
      same = sig === last ? same + 1 : 0; last = sig;
    }
    const out = await page.eval(`(() => {
      const c = window.canvasRenderer.canvas, cr = window.canvasRenderer;
      const custom = cr.addedCustomAnimations ? Array.from(cr.addedCustomAnimations instanceof Map ? cr.addedCustomAnimations.keys() : cr.addedCustomAnimations) : [];
      const h = [...document.querySelectorAll('h1,h2,h3,h4,summary,div,span')].find(e => e.childElementCount === 0 && /Credits & Attribution/.test(e.textContent));
      let box = h; for (let i = 0; i < 4 && box.parentElement; i++) { box = box.parentElement; if (box.innerText.length > 200) break; }
      return { w: c.width, h: c.height, url: c.toDataURL('image/png'), custom, credits: box ? box.innerText : '' };
    })()`);
    if (page.errors.length) log(`  (generator could not load: ${page.errors.map((e) => e.replace('Failed to load image: ', '')).join(', ')})`);
    return out;
  } finally {
    await page.close();
  }
}

export async function importCharacter({ link, anchor, id, name }, log = console.log) {
  const pairs = parseLink(link);
  if (!pairs.length) throw new Error('No parts in that link: copy the whole address from the generator');
  anchor = anchor || defaultAnchor(pairs);
  if (!pairs.some(([k]) => k === anchor)) throw new Error(`The link has no "${anchor}" part to track`);
  id = (id || pairs.find(([k]) => k === anchor)?.[1] || 'character').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const hash = pairs.map(([k, v]) => `${k}=${v}`).join('&');
  const bareHash = pairs.filter(([k]) => k !== anchor).map(([k, v]) => `${k}=${v}`).join('&');

  log(`rendering ${id} (anchor: ${anchor})`);
  const full = await render(hash, log);
  log(`rendering ${id} without its ${anchor}`);
  const bare = await render(bareHash, log);
  if (full.w !== bare.w || full.h !== bare.h) throw new Error(`The two sheets differ in size (${full.w}x${full.h} vs ${bare.w}x${bare.h})`);

  const dir = path.join(IMPORTS, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'sheet.png'), Buffer.from(full.url.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(dir, 'bare.png'), Buffer.from(bare.url.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(dir, 'credits.txt'), `Character: ${name || id}\nMade with the Universal LPC Spritesheet Character Generator: ${GENERATOR}#${hash}\n\n${full.credits}\n`);
  const meta = { id, name: name || id, link: `${GENERATOR}#${hash}`, anchor, width: full.w, height: full.h, custom: full.custom, imported: new Date().toISOString() };
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));

  const indexFile = path.join(IMPORTS, 'index.json');
  const index = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : [];
  const entry = { id, name: meta.name, anchor };
  const at = index.findIndex((e) => e.id === id);
  if (at >= 0) index[at] = entry; else index.push(entry);
  fs.writeFileSync(indexFile, JSON.stringify(index, null, 2));
  log(`saved public/imports/${id}  (${full.w}x${full.h}, extra blocks: ${full.custom.join(', ') || 'none'})`);
  return meta;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), flag = (n) => (args.find((a) => a.startsWith(`--${n}=`)) || '').split('=').slice(1).join('=') || undefined;
  const link = args.find((a) => !a.startsWith('--'));
  if (!link) { console.error('Usage: node tools/lpc_import.mjs <generator link> [--anchor=hat] [--id=knight] [--name="Knight"]'); process.exit(1); }
  importCharacter({ link, anchor: flag('anchor'), id: flag('id'), name: flag('name') }).catch((e) => { console.error(e.message); process.exit(1); });
}
