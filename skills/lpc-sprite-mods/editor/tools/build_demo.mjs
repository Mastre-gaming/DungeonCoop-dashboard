// Build demo.html: the whole editor in one file that opens with a double-click (no Node, no server), carrying
// every character in public/imports. Import needs the dev server; everything else works.
//   npm run build && node tools/build_demo.mjs        -> demo.html
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(ROOT, 'dist');
let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

// the files the editor asks for, by the same relative path it uses
const embed = {};
const imports = path.join(ROOT, 'public', 'imports');
const index = JSON.parse(fs.readFileSync(path.join(imports, 'index.json'), 'utf8'));
embed['imports/index.json'] = JSON.stringify(index);
for (const { id } of index) {
  const dir = path.join(imports, id);
  embed[`imports/${id}/meta.json`] = fs.readFileSync(path.join(dir, 'meta.json'), 'utf8');
  embed[`imports/${id}/credits.txt`] = fs.readFileSync(path.join(dir, 'credits.txt'), 'utf8');
  for (const png of ['sheet.png', 'bare.png']) embed[`imports/${id}/${png}`] = `data:image/png;base64,${fs.readFileSync(path.join(dir, png)).toString('base64')}`;
}
const shim = `<script>
window.__EMBED = ${JSON.stringify(embed)};
(() => {
  const real = window.fetch.bind(window);
  window.fetch = (url, options) => {
    const key = String(url).replace(/^\\.\\//, '');
    if (!(key in window.__EMBED)) return real(url, options);
    const v = window.__EMBED[key];
    if (v.startsWith('data:')) return real(v);
    const type = key.endsWith('.json') ? 'application/json' : 'text/plain';
    return Promise.resolve(new Response(v, { headers: { 'content-type': type } }));
  };
})();
</script>`;

const read = (ref) => fs.readFileSync(path.join(dist, ref.replace(/^\.\//, '')), 'utf8');
html = html.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_, ref) => `<style>\n${read(ref)}\n</style>`);
html = html.replace(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g, (_, ref) => `${shim}\n<script type="module">\n${read(ref).replace(/<\/script/gi, '<\\/script')}\n</script>`);
if (/src="\.\/assets|href="\.\/assets/.test(html)) throw new Error('demo.html still points at dist/assets');
fs.writeFileSync(path.join(ROOT, 'demo.html'), html);
console.log(`demo.html  ${(html.length / 1048576).toFixed(1)} MB  (characters: ${index.map((c) => c.id).join(', ')})`);
