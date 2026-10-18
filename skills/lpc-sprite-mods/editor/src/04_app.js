// The editor as a core skill: init(game, config), update(dt), dispose(), selfTest(t).
import { DIRS, loadImage, pixelsOf, buildSheet } from './01_sheet.js';
import { newLayer, setPixel, composeFrame, mirrorX, copyFacing, shiftFacing, serialize, deserialize, createHistory, presetHornsAndPlume, key } from './02_mod.js';
import { createView } from './03_view.js';

export const name = 'sprite-painter';

const FACING_LABEL = { north: 'Back', west: 'Left', south: 'Front', east: 'Right' };
const SWATCHES = [
  '#1e161e', '#3a3f4b', '#5a6276', '#8a96a8', '#c0cad6', '#f0f4fa',   // outline + steel
  '#6a1a26', '#a0283a', '#d64c48', '#f08a6a',                         // reds
  '#5a3a14', '#a07028', '#e2b848', '#fff0a0',                         // golds
  '#22263e', '#223e96', '#3c78dc', '#96ceff',                         // blues
  '#163a22', '#2e7a3c', '#62c05a', '#b4f08c',                         // greens
  '#3a1e52', '#6e3aa0', '#b07ae0', '#f6ecd0',                         // purples + bone
  '#4a2e20', '#704a2e', '#b07a50', '#e8c098',                         // leather + skin
];
const hexToRgba = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(255);
const rgbaToHex = (c) => '#' + c.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('');

let app = null;

export function init(game, config = {}) {
  const $ = (s) => document.querySelector(s);
  const ui = {
    stage: $('#stage'), charSel: $('#character'), animSel: $('#anim'), layers: $('#layers'), swatches: $('#swatches'), color: $('#color'),
    facings: $('#facings'), frame: $('#frame'), frameLabel: $('#frame-label'), status: $('#status'), labels: $('#preview-labels'),
    fps: $('#fps'), play: $('#play'), stamp: $('#stamp'), anchorInfo: $('#anchor-info'),
  };
  ui.stamp.textContent = `build ${game.stamp}`;
  const view = createView(ui.stage);

  const s = (app = {
    game, view, ui,
    sheet: null, layers: [], current: 0, history: createHistory(),
    tool: 'pencil', color: [226, 184, 72, 255], mirror: false,
    anim: null, facing: 'south', frameIdx: 0, playing: true, fps: 8, tick: 0, clock: 0,
    dirty: true, scratch: new Uint8ClampedArray(192 * 192 * 4),
  });

  // ------------------------------------------------------------ status
  let statusTimer = 0;
  s.say = (text, ms = 2600) => { ui.status.textContent = text; ui.status.classList.add('on'); clearTimeout(statusTimer); statusTimer = setTimeout(() => ui.status.classList.remove('on'), ms); };

  // ------------------------------------------------------------ characters
  s.loadIndex = async () => {
    const list = await fetch('imports/index.json', { cache: 'no-store' }).then((r) => r.json()).catch(() => []);
    ui.charSel.innerHTML = list.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
    return list;
  };

  s.loadCharacter = async (id) => {
    s.say(`Loading ${id}…`, 8000);
    const base = `imports/${id}/`;
    const meta = await fetch(base + 'meta.json', { cache: 'no-store' }).then((r) => { if (!r.ok || !/json/.test(r.headers.get('content-type') || '')) throw new Error('its files are missing'); return r.json(); });
    const [full, bare] = await Promise.all([loadImage(base + 'sheet.png'), loadImage(base + 'bare.png')]);
    s.sheet = buildSheet(meta, pixelsOf(full), pixelsOf(bare));
    ui.charSel.value = id;
    ui.animSel.innerHTML = s.sheet.anims.map((a, i) => `<option value="${i}">${a.id}${a.big ? ' (big)' : ''} · ${a.found}/${a.total}</option>`).join('');
    const walk = s.sheet.anims.findIndex((a) => a.id === 'walk');
    s.setAnim(walk >= 0 ? walk : 0);
    // the layers saved for this character, or one empty layer
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(`sprite-painter:${id}`) || 'null'); } catch {}
    s.layers = saved ? deserialize(saved) : [newLayer('Layer 1')];
    s.current = s.layers.length - 1;
    s.history = createHistory();
    s.renderLayers();
    s.say(`${meta.name}: ${s.sheet.anims.length} animations, anchor “${meta.anchor}”`);
    s.dirty = true;
  };

  s.save = () => { if (s.sheet) try { localStorage.setItem(`sprite-painter:${s.sheet.meta.id}`, JSON.stringify(serialize(s.layers))); } catch {} };

  // The reference anchor box for each facing: the first walk frame (else the first frame found).
  s.referenceBoxes = () => {
    const boxes = {};
    const order = [s.sheet.anims.find((a) => a.id === 'walk'), ...s.sheet.anims].filter(Boolean);
    for (const dir of DIRS) {
      for (const a of order) {
        const r = a.rows.indexOf(dir);
        const f = r >= 0 && a.frames[r].find((fr) => fr?.box);
        if (f) { boxes[dir] = { ...f.box, size: a.size }; break; }
      }
    }
    return boxes;
  };

  // ------------------------------------------------------------ animation, facing, frame
  s.setAnim = (i) => {
    s.anim = s.sheet.anims[i];
    ui.animSel.value = String(i);
    if (!s.anim.rows.includes(s.facing)) s.facing = s.anim.rows[0];
    s.frameIdx = Math.min(s.frameIdx, s.anim.count - 1);
    if (!s.currentFrame()) s.frameIdx = s.anim.frames[s.anim.rows.indexOf(s.facing)].findIndex((f) => f);
    ui.frame.max = String(s.anim.count - 1);
    s.renderFacings();
    s.dirty = true;
  };
  s.setFacing = (dir) => { if (!s.anim.rows.includes(dir)) return; s.facing = dir; s.renderFacings(); s.dirty = true; };
  s.currentFrame = () => s.anim?.frames[s.anim.rows.indexOf(s.facing)]?.[s.frameIdx] || null;
  s.setFrame = (f) => { s.frameIdx = (f + s.anim.count) % s.anim.count; s.dirty = true; };

  // ------------------------------------------------------------ painting
  s.layer = () => s.layers[s.current];
  s.compose = (anim, dir, f, out = s.scratch) => {
    const fr = anim.frames[anim.rows.indexOf(dir)]?.[f];
    const buf = out.subarray(0, anim.size * anim.size * 4);
    if (!fr) { buf.fill(0); return buf; }
    return composeFrame(s.sheet.full, fr, anim.size, s.layers, dir, buf);
  };

  let stroke = null;
  const applyAt = (x, y) => {
    const fr = s.currentFrame();
    if (!fr?.box) { s.say('No anchor part in this frame: pick another frame to paint on'); return; }
    const box = fr.box, layer = s.layer();
    if (!layer) return;
    if (s.tool === 'picker') {
      const px = s.compose(s.anim, s.facing, s.frameIdx);
      const i = (y * s.anim.size + x) * 4;
      if (px[i + 3]) s.setColor([px[i], px[i + 1], px[i + 2], 255]);
      return;
    }
    const value = s.tool === 'eraser' ? null : [...s.color];
    const spots = [[x, y]];
    if (s.mirror) spots.push([mirrorX(box, x), y]);
    for (const [px, py] of spots) setPixel(layer, s.facing, px - box.ax, py - box.ay, value);
    s.dirty = true;
  };
  const line = (a, b, fn) => {   // every pixel between two points, so a fast stroke has no gaps
    let [x0, y0] = a; const [x1, y1] = b;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) { fn(x0, y0); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
  };

  const canvas = view.renderer.domElement;
  let panning = null, spaceHeld = false;
  const local = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    const p = local(e);
    if (!view.inPaintArea(p.x) || !s.sheet) return;
    canvas.setPointerCapture?.(e.pointerId);
    if (e.button === 1 || e.button === 2 || spaceHeld) { panning = { x: p.x, y: p.y, pan: { ...view.pan } }; return; }
    const px = view.screenToPixel(p.x, p.y);
    if (!px) return;
    if (s.tool !== 'picker') s.history.push(s.layers);
    stroke = [px.x, px.y];
    applyAt(px.x, px.y);
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = local(e);
    if (panning) { view.pan = { x: panning.pan.x + p.x - panning.x, y: panning.pan.y + p.y - panning.y }; s.dirty = true; return; }
    const px = view.inPaintArea(p.x) ? view.screenToPixel(p.x, p.y) : null;
    view.cursor = px; s.dirty = true;
    if (stroke && px && s.tool !== 'picker') { line(stroke, [px.x, px.y], applyAt); stroke = [px.x, px.y]; }
  });
  const end = () => { if (stroke && s.tool !== 'picker') s.save(); stroke = null; panning = null; s.renderLayers(); };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointerleave', () => { view.cursor = null; s.dirty = true; });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = local(e);
    if (!view.inPaintArea(p.x)) return;
    const before = view.screenToPixel(p.x, p.y) || { x: view.size / 2, y: view.size / 2 };
    const z = Math.min(40, Math.max(1, view.zoom + (e.deltaY < 0 ? 1 : -1) * Math.max(1, Math.round(view.zoom / 6))));
    const o = view.frameOrigin(), fx = (p.x - o.x) / view.zoom, fy = (p.y - o.y) / view.zoom;
    view.zoom = z;
    const o2 = view.frameOrigin();
    view.pan.x += p.x - (o2.x + fx * z); view.pan.y += p.y - (o2.y + fy * z);
    void before; s.dirty = true;
  }, { passive: false });

  // ------------------------------------------------------------ tools, colour
  s.setTool = (t) => { s.tool = t; document.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === t)); };
  s.setColor = (c) => { s.color = c; ui.color.value = rgbaToHex(c); document.querySelectorAll('.swatch').forEach((b) => b.classList.toggle('on', b.dataset.hex === rgbaToHex(c))); };
  s.toggleMirror = (on = !s.mirror) => { s.mirror = on; $('#mirror').classList.toggle('on', on); s.dirty = true; };
  ui.swatches.innerHTML = SWATCHES.map((h) => `<button class="swatch" data-hex="${h}" style="background:${h}" title="${h}"></button>`).join('');
  ui.swatches.addEventListener('click', (e) => { const h = e.target.dataset.hex; if (h) s.setColor(hexToRgba(h)); });
  ui.color.addEventListener('input', () => s.setColor(hexToRgba(ui.color.value)));
  document.querySelectorAll('[data-tool]').forEach((b) => b.addEventListener('click', () => s.setTool(b.dataset.tool)));
  $('#mirror').addEventListener('click', () => s.toggleMirror());
  $('#grid').addEventListener('click', () => { view.grid = !view.grid; $('#grid').classList.toggle('on', view.grid); s.dirty = true; });
  $('#fit').addEventListener('click', () => { view.fit(); s.dirty = true; });
  s.undo = () => { const l = s.history.undo(s.layers); if (l) { s.layers = l; s.current = Math.min(s.current, l.length - 1); s.save(); s.renderLayers(); s.dirty = true; } };
  s.redo = () => { const l = s.history.redo(s.layers); if (l) { s.layers = l; s.current = Math.min(s.current, l.length - 1); s.save(); s.renderLayers(); s.dirty = true; } };
  $('#undo').addEventListener('click', s.undo);
  $('#redo').addEventListener('click', s.redo);

  // ------------------------------------------------------------ layers
  s.renderLayers = () => {
    ui.layers.innerHTML = s.layers.map((l, i) => `
      <li class="${i === s.current ? 'on' : ''}" data-i="${i}">
        <button class="eye ${l.visible ? 'on' : ''}" data-act="eye" title="Show / hide">${l.visible ? '◉' : '○'}</button>
        <input value="${l.name.replace(/"/g, '&quot;')}" data-act="name">
        <button class="${l.behind ? 'on' : ''}" data-act="behind" title="Behind the anchor part">behind</button>
        <span class="count">${l.px[s.facing].size}</span>
      </li>`).reverse().join('');
  };
  ui.layers.addEventListener('click', (e) => {
    const li = e.target.closest('li'); if (!li) return;
    const i = +li.dataset.i, act = e.target.dataset.act, l = s.layers[i];
    if (act === 'eye') { s.history.push(s.layers); l.visible = !l.visible; }
    else if (act === 'behind') { s.history.push(s.layers); l.behind = !l.behind; }
    s.current = i; s.save(); s.renderLayers(); s.dirty = true;
  });
  ui.layers.addEventListener('change', (e) => { const li = e.target.closest('li'); if (li && e.target.dataset.act === 'name') { s.layers[+li.dataset.i].name = e.target.value; s.save(); } });
  $('#layer-add').addEventListener('click', () => { s.history.push(s.layers); s.layers.splice(s.current + 1, 0, newLayer()); s.current++; s.save(); s.renderLayers(); });
  $('#layer-del').addEventListener('click', () => { if (!s.layers.length) return; s.history.push(s.layers); s.layers.splice(s.current, 1); if (!s.layers.length) s.layers.push(newLayer()); s.current = Math.max(0, s.current - 1); s.save(); s.renderLayers(); s.dirty = true; });
  $('#layer-up').addEventListener('click', () => { const i = s.current; if (i >= s.layers.length - 1) return; s.history.push(s.layers); [s.layers[i], s.layers[i + 1]] = [s.layers[i + 1], s.layers[i]]; s.current++; s.save(); s.renderLayers(); s.dirty = true; });
  $('#layer-down').addEventListener('click', () => { const i = s.current; if (i <= 0) return; s.history.push(s.layers); [s.layers[i], s.layers[i - 1]] = [s.layers[i - 1], s.layers[i]]; s.current--; s.save(); s.renderLayers(); s.dirty = true; });
  s.nudge = (dx, dy) => { if (!s.layer()) return; s.history.push(s.layers); shiftFacing(s.layer(), s.facing, dx, dy); s.save(); s.dirty = true; };

  // ------------------------------------------------------------ facings
  s.renderFacings = () => {
    ui.facings.querySelectorAll('[data-dir]').forEach((b) => { b.classList.toggle('on', b.dataset.dir === s.facing); b.disabled = !s.anim?.rows.includes(b.dataset.dir); });
    s.renderLayers?.();
  };
  ui.facings.addEventListener('click', (e) => { if (e.target.dataset.dir) s.setFacing(e.target.dataset.dir); });
  s.copyTo = (to, flip) => {
    const boxes = s.referenceBoxes(), from = s.facing;
    if (!boxes[from] || !boxes[to]) return;
    s.history.push(s.layers);
    copyFacing(s.layer(), from, to, { flip, fromBox: boxes[from], toBox: boxes[to], size: boxes[from].size });
    s.save(); s.renderLayers(); s.dirty = true;
    s.say(`Copied ${FACING_LABEL[from]} → ${FACING_LABEL[to]}${flip ? ' (mirrored)' : ''}`);
  };
  $('#copy-facing').addEventListener('click', () => {
    const to = { west: 'east', east: 'west', south: 'north', north: 'south' }[s.facing];
    s.copyTo(to, s.facing === 'west' || s.facing === 'east');
  });

  // ------------------------------------------------------------ animation controls
  ui.animSel.addEventListener('change', () => s.setAnim(+ui.animSel.value));
  ui.frame.addEventListener('input', () => s.setFrame(+ui.frame.value));
  ui.play.addEventListener('click', () => { s.playing = !s.playing; ui.play.textContent = s.playing ? '❚❚' : '▶'; });
  ui.fps.addEventListener('input', () => { s.fps = +ui.fps.value; });
  ui.charSel.addEventListener('change', () => s.loadCharacter(ui.charSel.value).catch((e) => { s.say(`Could not load ${ui.charSel.value}: ${e.message}`, 8000); if (s.sheet) ui.charSel.value = s.sheet.meta.id; }));

  // ------------------------------------------------------------ files
  const download = (blob, filename) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  s.exportSheet = () => {
    const sh = s.sheet, out = new ImageData(new Uint8ClampedArray(sh.full.data), sh.width, sh.height);
    const buf = new Uint8ClampedArray(192 * 192 * 4);
    for (const a of sh.anims) a.rows.forEach((dir, r) => a.frames[r].forEach((fr, f) => {
      if (!fr?.box) return;
      const px = s.compose(a, dir, f, buf);
      for (let y = 0; y < a.size; y++) out.data.set(px.subarray(y * a.size * 4, (y + 1) * a.size * 4), ((fr.y0 + y) * sh.width + fr.x0) * 4);
    }));
    const c = document.createElement('canvas'); c.width = sh.width; c.height = sh.height;
    c.getContext('2d').putImageData(out, 0, 0);
    return c;
  };
  $('#export-png').addEventListener('click', () => { s.exportSheet().toBlob((b) => download(b, `${s.sheet.meta.id}-modded.png`)); s.say('Sheet exported (same LPC layout as the generator)'); });
  $('#export-credits').addEventListener('click', async () => download(await fetch(`imports/${s.sheet.meta.id}/credits.txt`).then((r) => r.blob()), `${s.sheet.meta.id}-credits.txt`));
  $('#save-mod').addEventListener('click', () => download(new Blob([JSON.stringify(serialize(s.layers), null, 1)], { type: 'application/json' }), `${s.sheet.meta.id}-mod.json`));
  $('#load-mod').addEventListener('click', () => $('#load-file').click());
  $('#load-file').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { s.history.push(s.layers); s.layers = deserialize(JSON.parse(await f.text())); s.current = s.layers.length - 1; s.save(); s.renderLayers(); s.dirty = true; s.say(`Loaded ${f.name}`); }
    catch (err) { s.say(err.message); }
    e.target.value = '';
  });
  $('#preset').addEventListener('click', () => {
    s.history.push(s.layers);
    s.layers.push(...presetHornsAndPlume(s.referenceBoxes()));
    s.current = s.layers.length - 1; s.save(); s.renderLayers(); s.dirty = true;
    s.say('Added the horns & plume example (3 layers)');
  });
  $('#clear-mod').addEventListener('click', () => { s.history.push(s.layers); s.layers = [newLayer('Layer 1')]; s.current = 0; s.save(); s.renderLayers(); s.dirty = true; });

  // ------------------------------------------------------------ import dialog
  const dlg = $('#import-dialog');
  $('#import').addEventListener('click', () => { dlg.showModal(); $('#import-link').focus(); });
  $('#import-link').addEventListener('input', () => {
    const keys = ($('#import-link').value.split('#')[1] || '').split('&').map((p) => p.split('=')[0]).filter((k) => k && k !== 'sex');
    const sel = $('#import-anchor'), prev = sel.value;
    sel.innerHTML = keys.map((k) => `<option>${k}</option>`).join('');
    sel.value = keys.includes(prev) ? prev : ['hat', 'head'].find((k) => keys.includes(k)) || keys[0] || '';
  });
  $('#import-go').addEventListener('click', async (e) => {
    e.preventDefault();
    const body = { link: $('#import-link').value.trim(), anchor: $('#import-anchor').value, name: $('#import-name').value.trim(), id: $('#import-name').value.trim() };
    const msg = $('#import-msg');
    msg.textContent = 'Rendering in the generator… this takes about a minute.';
    $('#import-go').disabled = true;
    try {
      const helper = 'Importing needs the local helper: run `npm run dev` in the editor folder and open http://localhost:5180.';
      const res = await fetch('api/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => { throw new Error(helper); });
      if (res.status === 404 || res.status === 405) throw new Error(helper);
      const out = await res.json();
      if (!res.ok) throw new Error(out.error);
      await s.loadIndex();
      await s.loadCharacter(out.id);
      dlg.close();
    } catch (err) { msg.textContent = err.message; }
    $('#import-go').disabled = false;
  });
  $('#import-cancel').addEventListener('click', (e) => { e.preventDefault(); dlg.close(); });

  // ------------------------------------------------------------ keys
  addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, dialog')) return;
    const k = e.key.toLowerCase();
    if (e.code === 'Space') { spaceHeld = true; e.preventDefault(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? s.redo() : s.undo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); s.redo(); return; }
    if (k === 'b') s.setTool('pencil'); else if (k === 'e') s.setTool('eraser'); else if (k === 'i') s.setTool('picker');
    else if (k === 'm') s.toggleMirror(); else if (k === 'g') $('#grid').click(); else if (k === 'f') $('#fit').click();
    else if (k === '[') s.setFrame(s.frameIdx - 1); else if (k === ']') s.setFrame(s.frameIdx + 1);
    else if ('1234'.includes(k)) s.setFacing(['north', 'west', 'south', 'east'][+k - 1]);
    else if (e.key.startsWith('Arrow')) { e.preventDefault(); s.nudge({ ArrowLeft: -1, ArrowRight: 1 }[e.key] || 0, { ArrowUp: -1, ArrowDown: 1 }[e.key] || 0); }
  });
  addEventListener('keyup', (e) => { if (e.code === 'Space') spaceHeld = false; });
  addEventListener('resize', () => { view.layout(); s.dirty = true; });

  s.setTool('pencil');
  s.setColor([226, 184, 72, 255]);
  s.ready = (async () => {
    const list = await s.loadIndex();
    if (list.length) await s.loadCharacter(config.character && list.some((c) => c.id === config.character) ? config.character : list[0].id);
    else s.say('No characters yet: press Import and paste a link from the LPC generator', 10000);
  })();

  // for scripts (tools/render_mod.mjs): put a mod on and get the finished sheet back as a PNG data URL
  s.loadMod = (data) => { s.layers = deserialize(typeof data === 'string' ? JSON.parse(data) : data); s.current = s.layers.length - 1; s.renderLayers(); s.dirty = true; };
  s.sheetDataURL = () => s.exportSheet().toDataURL('image/png');

  game.dbg.app = s;
  return s;
}

export function update(dt) {
  const s = app;
  if (!s?.sheet) return;
  s.clock += dt;
  const step = 1 / Math.max(1, s.fps);
  if (s.playing && s.clock >= step) { s.clock %= step; s.tick++; s.dirty = true; }
  if (!s.dirty) return;
  s.dirty = false;
  const { view, ui, anim } = s;
  const fr = s.currentFrame();
  view.setFrame(s.compose(anim, s.facing, s.frameIdx), anim.size);
  view.anchor = fr?.box ? { x: fr.box.ax, y: fr.box.ay } : null;
  view.mirror = s.mirror && fr?.box ? (fr.box.left + fr.box.right + 1) / 2 : null;
  ui.frame.value = String(s.frameIdx);
  ui.frameLabel.textContent = `frame ${s.frameIdx + 1}/${anim.count}`;
  ui.anchorInfo.textContent = fr ? (fr.box ? `anchor at ${fr.box.ax}, ${fr.box.ay}` : 'no anchor part in this frame') : 'empty frame';
  // previews: one per facing this animation has
  const labels = [];
  DIRS.forEach((dir, i) => {
    const has = anim.rows.includes(dir);
    const f = anim.cycle.length ? anim.cycle[s.tick % anim.cycle.length] : 0;
    view.setPreview(i, s.compose(anim, has ? dir : anim.rows[0], has ? f : 0), anim.size);
    labels.push(has ? FACING_LABEL[dir] : '—');
  });
  view.render();
  view.previewRects().forEach((r, i) => {
    const el = ui.labels.children[i];
    if (el && r) { el.style.left = `${r.x}px`; el.style.top = `${r.y + r.h + 4}px`; el.style.width = `${r.w}px`; el.textContent = labels[i]; el.classList.toggle('on', DIRS[i] === s.facing); }
  });
}

export function dispose() { app?.view.renderer.dispose(); app = null; }

// ------------------------------------------------------------ ?test: drive it the way a person would
export async function selfTest(t) {
  const s = app;
  await s.ready;
  t.ok(!!s.sheet, 'a character is loaded');
  if (!s.sheet) return;
  // the tests paint; put the person's own work back afterwards
  const storeKey = `sprite-painter:${s.sheet.meta.id}`;
  let kept = null; try { kept = localStorage.getItem(storeKey); } catch {}
  const keptLayers = s.layers, keptColor = s.color, keptTool = s.tool;
  try { await run(t, s); } finally {
    s.layers = keptLayers; s.current = Math.min(s.current, keptLayers.length - 1); s.history = createHistory();
    try { kept == null ? localStorage.removeItem(storeKey) : localStorage.setItem(storeKey, kept); } catch {}
    s.setColor(keptColor); s.setTool(keptTool); s.toggleMirror(false);
    s.renderLayers(); s.dirty = true;
  }
}

async function run(t, s) {
  const walk = s.sheet.anims.find((a) => a.id === 'walk');
  t.eq(walk?.count, 9, 'walk has 9 frames');
  t.eq(walk?.found, walk?.total, 'the anchor part is found in every walk frame');
  const big = s.sheet.anims.find((a) => a.id === 'slash_128');
  if (big) t.eq(big.found, big.total, 'the anchor part is found in every big-sword slash frame');

  // paint one pixel above the helmet by clicking on the canvas
  s.layers = [newLayer('test')]; s.current = 0;
  s.setAnim(s.sheet.anims.indexOf(walk)); s.setFacing('south'); s.setFrame(0); s.setTool('pencil'); s.setColor([255, 0, 255, 255]); s.toggleMirror(false);
  update(0);
  const box = s.currentFrame().box;
  const canvas = s.view.renderer.domElement, r = canvas.getBoundingClientRect();
  const click = (x, y) => {
    const p = s.view.pixelToScreen(x, y), at = { clientX: r.left + p.x, clientY: r.top + p.y, button: 0, pointerId: 1, bubbles: true };
    canvas.dispatchEvent(new PointerEvent('pointerdown', at)); canvas.dispatchEvent(new PointerEvent('pointerup', at));
  };
  click(box.ax, box.ay - 3);
  t.ok(s.layers[0].px.south.has(key(0, -3)), 'a click on the canvas paints at that pixel, relative to the anchor');
  const other = walk.frames[walk.rows.indexOf('south')][5];
  const px = s.compose(walk, 'south', 5), i = ((other.box.ay - 3) * 64 + other.box.ax) * 4;
  t.eq([...px.slice(i, i + 4)], [255, 0, 255, 255], 'the pixel follows the anchor into another frame');

  // mirror
  s.toggleMirror(true); click(box.left + 1, box.ay + 2); s.toggleMirror(false);
  t.ok(s.layers[0].px.south.has(key(box.left + 1 - box.ax, 2)) && s.layers[0].px.south.has(key(box.right - 1 - box.ax, 2)), 'mirror paints both sides of the anchor part');

  // undo
  s.undo();
  t.ok(!s.layers[0].px.south.has(key(box.left + 1 - box.ax, 2)), 'undo takes the last stroke back');

  // never over the sword: a non-anchor, non-empty pixel stays as it was
  const fr0 = walk.frames[walk.rows.indexOf('south')][0];
  let solid = null;
  for (let p = 0; p < 64 * 64 && !solid; p++) if (!fr0.box.mask[p] && s.sheet.full.data[((fr0.y0 + (p >> 6)) * s.sheet.width + fr0.x0 + (p & 63)) * 4 + 3]) solid = p;
  setPixel(s.layers[0], 'south', (solid & 63) - fr0.box.ax, (solid >> 6) - fr0.box.ay, [0, 255, 0, 255]);
  const before = s.sheet.full.data.slice(((fr0.y0 + (solid >> 6)) * s.sheet.width + fr0.x0 + (solid & 63)) * 4, ((fr0.y0 + (solid >> 6)) * s.sheet.width + fr0.x0 + (solid & 63)) * 4 + 4);
  const after = s.compose(walk, 'south', 0).slice(solid * 4, solid * 4 + 4);
  t.eq([...after], [...before], 'a layer never paints over the body, armour or weapon');

  // behind: a layer marked behind leaves the anchor part alone
  const onHelm = fr0.box.mask.indexOf(1);
  s.layers[0].behind = true;
  setPixel(s.layers[0], 'south', (onHelm & 63) - fr0.box.ax, (onHelm >> 6) - fr0.box.ay, [0, 255, 0, 255]);
  t.ok(s.compose(walk, 'south', 0)[onHelm * 4 + 1] !== 255 || s.sheet.full.data[((fr0.y0 + (onHelm >> 6)) * s.sheet.width + fr0.x0 + (onHelm & 63)) * 4 + 1] === 255, 'a layer behind the anchor part does not cover it');
  s.layers[0].behind = false;
  t.eq([...s.compose(walk, 'south', 0).slice(onHelm * 4, onHelm * 4 + 4)], [0, 255, 0, 255], 'a layer in front does cover the anchor part');

  // presets, save/load, export
  const preset = presetHornsAndPlume(s.referenceBoxes());
  t.ok(DIRS.every((d) => preset.some((l) => l.px[d].size > 20)), 'the horns & plume example has pixels for every facing');
  const round = deserialize(JSON.parse(JSON.stringify(serialize(preset))));
  t.eq(JSON.stringify(serialize(round)), JSON.stringify(serialize(preset)), 'a mod survives save and load unchanged');
  s.layers = preset;
  const sheet = s.exportSheet();
  t.eq([sheet.width, sheet.height], [s.sheet.width, s.sheet.height], 'the exported sheet keeps the generator layout');
  const out = sheet.getContext('2d').getImageData(0, 0, sheet.width, sheet.height).data;
  let changed = 0; for (let k = 0; k < out.length; k += 4) if (out[k + 3] !== s.sheet.full.data[k + 3] || out[k] !== s.sheet.full.data[k]) changed++;
  t.ok(changed > 1000, `the export carries the mod (${changed} pixels changed)`);
}
