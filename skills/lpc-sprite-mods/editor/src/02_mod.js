// A mod: layers of pixels painted relative to the anchor point (top centre of the anchor part), one set per facing.
// The same pixels land in every frame of every animation, following the anchor as it bobs, leans and swings.
//
// Drawing rules (the same as the knight's horns):
//   a layer pixel is drawn on empty space, on the anchor part, or over an earlier layer;
//   it never covers anything else (sword, shield, cape), so swings pass in front of it;
//   a layer marked `behind` only fills empty space, so it sits behind the anchor part too.
import { DIRS } from './01_sheet.js';

let nextId = 1;
export function newLayer(name = `Layer ${nextId}`) {
  return { id: nextId++, name, visible: true, behind: false, px: Object.fromEntries(DIRS.map((d) => [d, new Map()])) };
}

export const key = (dx, dy) => `${dx},${dy}`;
export const unkey = (k) => k.split(',').map(Number);

export function setPixel(layer, dir, dx, dy, rgba) {
  if (rgba) layer.px[dir].set(key(dx, dy), rgba); else layer.px[dir].delete(key(dx, dy));
}

// Draw a frame: the sheet's own pixels, then every visible layer. `out` is a Uint8ClampedArray of size*size*4.
export function composeFrame(sheetPx, frame, size, layers, dir, out) {
  const src = sheetPx.data, w = sheetPx.width;
  for (let y = 0; y < size; y++) {
    const s = ((frame.y0 + y) * w + frame.x0) * 4;
    out.set(src.subarray(s, s + size * 4), y * size * 4);
  }
  const box = frame.box;
  if (!box) return out;
  const ours = new Uint8Array(size * size);
  for (const layer of layers) {
    if (!layer.visible) continue;
    for (const [k, c] of layer.px[dir]) {
      const [dx, dy] = unkey(k), x = box.ax + dx, y = box.ay + dy;
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      const p = y * size + x, i = p * 4;
      const empty = out[i + 3] === 0, onPart = box.mask[p] === 1, onOurs = ours[p] === 1;
      if (empty || (!layer.behind && (onPart || onOurs))) {
        out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; out[i + 3] = c[3];
        ours[p] = 1;
      }
    }
  }
  return out;
}

// Mirror across the anchor part (left <-> right inside one facing).
export function mirrorX(box, x) { return box.left + box.right - x; }

// Copy one facing's pixels to another. West and east are pixel mirrors of each other in LPC sheets
// (x -> size-1-x), so a flipped copy lands on the same spot of the turned head.
export function copyFacing(layer, from, to, { flip, fromBox, toBox, size }) {
  const map = new Map();
  for (const [k, c] of layer.px[from]) {
    let [dx, dy] = unkey(k);
    if (flip) dx = size - 1 - (fromBox.ax + dx) - toBox.ax;
    else dx = fromBox.ax + dx - toBox.ax;
    dy = fromBox.ay + dy - toBox.ay;
    map.set(key(dx, dy), c);
  }
  layer.px[to] = map;
}

export function shiftFacing(layer, dir, ddx, ddy) {
  const map = new Map();
  for (const [k, c] of layer.px[dir]) { const [dx, dy] = unkey(k); map.set(key(dx + ddx, dy + ddy), c); }
  layer.px[dir] = map;
}

// ---------------------------------------------------------------- save / load
const hex = (c) => c.slice(0, 4).map((v) => v.toString(16).padStart(2, '0')).join('');
const unhex = (h) => [0, 2, 4, 6].map((i) => parseInt(h.slice(i, i + 2), 16));

export function serialize(layers) {
  return {
    format: 'sprite-painter/1',
    layers: layers.map((l) => ({
      name: l.name, visible: l.visible, behind: l.behind,
      px: Object.fromEntries(DIRS.map((d) => [d, [...l.px[d]].map(([k, c]) => `${k},${hex(c)}`)])),
    })),
  };
}

export function deserialize(data) {
  if (!data || data.format !== 'sprite-painter/1') throw new Error('Not a sprite-painter mod file');
  return data.layers.map((s) => {
    const l = newLayer(s.name);
    l.visible = s.visible !== false; l.behind = !!s.behind;
    for (const d of DIRS) for (const e of s.px[d] || []) { const [dx, dy, h] = e.split(','); l.px[d].set(key(+dx, +dy), unhex(h)); }
    return l;
  });
}

// ---------------------------------------------------------------- undo
export function createHistory(limit = 200) {
  const back = [], fwd = [];
  return {
    push(layers) { back.push(JSON.stringify(serialize(layers))); if (back.length > limit) back.shift(); fwd.length = 0; },
    undo(layers) { if (!back.length) return null; fwd.push(JSON.stringify(serialize(layers))); return deserialize(JSON.parse(back.pop())); },
    redo(layers) { if (!fwd.length) return null; back.push(JSON.stringify(serialize(layers))); return deserialize(JSON.parse(fwd.pop())); },
    get size() { return back.length; },
  };
}

// ---------------------------------------------------------------- presets
const PRESET_PAL = {
  K: [30, 22, 30, 255], H: [246, 236, 208, 255], h: [214, 196, 156, 255], d: [160, 136, 98, 255], g: [226, 184, 72, 255], G: [160, 112, 40, 255],
  L: [150, 206, 255, 255], B: [60, 120, 220, 255], b: [34, 62, 150, 255],
};
const DARKER = { H: 'h', h: 'd', g: 'G', L: 'B', B: 'b' };
const GRIDS = {
  hornFront: [`KK..........|KHK.........|KHhK........|KHhK........|.KHhK.......|.KHHhK......|..KHHhKK....|...KHHhhdKK.|....KKHhhggK|......KKKggK|.........KK.`, 9, 8],
  hornSide: [`K.....|HK....|KHK...|.KHhK.|.KHhK.|..KHhK|..KHhK|.KHhdK|.KggGK|..KKK.`, 3, 8],
  plumeFront: [`...KKK...|..KLBBK..|.KLLBBbK.|.KLBBBbK.|KLLBBBbbK|KLBBBBbbK|.KBBBbbK.|..KBbbK..|...KKK...`, 4, 7],
  plumeBack: [`...KKK...|..KBBbK..|.KBBBbbK.|.KBBBbbK.|KBBBBbbbK|KBBBbbbbK|.KBBbbbK.|..KBbbK..|..KBbbK..|...KbK...|...KbK...|....K....`, 4, 4],
  plumeSide: [`....KKKK.....|..KKLLBBKK...|.KLLBBBBBbKK.|KLBBBBBbbbbbK|.KBBBbbbbbbbK|..KKbbbKKbbbK|....KKK..KbK.|..........K..`, 4, 5],
};

function stampGrid(layer, dir, name, at, { flip = false, shade = false } = {}) {
  const [text, cx, cy] = GRIDS[name];
  const rows = text.split('|'), w = rows[0].length;
  rows.forEach((r, gy) => [...r].forEach((ch, gx) => {
    if (ch === '.') return;
    const c = shade ? DARKER[ch] || ch : ch;
    // flipped, column gx moves to w-1-gx and the anchor column to w-1-cx: the offset from the anchor just negates
    const dx = flip ? cx - gx : gx - cx;
    setPixel(layer, dir, at[0] + dx, at[1] + gy - cy, PRESET_PAL[c]);
  }));
}

// Horns and a blue plume, placed from each facing's reference anchor box (left/right edges relative to the point).
export function presetHornsAndPlume(boxes) {
  const horns = newLayer('Horns'), plume = newLayer('Plume'), farHorn = newLayer('Far horn');
  farHorn.behind = true;
  for (const dir of DIRS) {
    const b = boxes[dir];
    if (!b) continue;
    const l = b.left - b.ax, r = b.right - b.ax;
    if (dir === 'south' || dir === 'north') {
      const back = dir === 'north';
      stampGrid(horns, dir, 'hornFront', [l + 1, 7], { shade: back });
      stampGrid(horns, dir, 'hornFront', [r - 1, 7], { flip: true, shade: !back });
      stampGrid(plume, dir, back ? 'plumeBack' : 'plumeFront', [0, 1]);
    } else {
      const west = dir === 'west', side = west ? 1 : -1;
      stampGrid(farHorn, dir, 'hornSide', [side + (west ? 3 : -3), 6], { flip: !west, shade: true });
      stampGrid(plume, dir, 'plumeSide', [0, 1], { flip: !west });
      stampGrid(horns, dir, 'hornSide', [side - (west ? 3 : -3), 6], { flip: !west });
    }
  }
  return [farHorn, plume, horns];
}
