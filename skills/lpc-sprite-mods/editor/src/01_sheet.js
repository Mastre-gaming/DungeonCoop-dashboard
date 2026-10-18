// An imported LPC sheet: where every animation is, which frames have something in them, and where the anchor part
// (a hat, or the head) is in each frame, found by diffing the sheet against the same character without that part.
export const DIRS = ['north', 'west', 'south', 'east'];
const F = 64;

// The 54 standard rows (the generator's ANIMATION_OFFSETS), and how one-row animations face.
const BASE = [
  ['spellcast', 0, 4], ['thrust', 4, 4], ['walk', 8, 4], ['slash', 12, 4], ['shoot', 16, 4], ['hurt', 20, 1], ['climb', 21, 1],
  ['idle', 22, 4], ['jump', 26, 4], ['sit', 30, 4], ['emote', 34, 4], ['run', 38, 4], ['combat', 42, 4], ['backslash', 46, 4], ['halfslash', 50, 4],
];
const ONE_ROW = { hurt: 'south', climb: 'north' };
// Frame sizes of the generator's extra blocks (sources/custom-animations.ts), stacked below row 54 in the order added.
export const CUSTOM_SIZES = {
  wheelchair: 64, tool_rod: 128, slash_128: 128, backslash_128: 128, halfslash_128: 128, thrust_oversize: 192, slash_oversize: 192,
  walk_128: 128, thrust_128: 128, slash_reverse_oversize: 192, whip_oversize: 192, tool_whip: 192, tool_axe: 128, tool_hammer: 128,
};
// Frames that make the loop (the generator's cycles); the rest play every frame found.
const CYCLES = { walk: [1, 2, 3, 4, 5, 6, 7, 8], idle: [0, 0, 1], combat: [0, 0, 1], sit: [0, 0, 0, 1, 1, 1, 2, 2, 2], emote: [0, 0, 0, 1, 1, 1, 2, 2, 2] };

export async function loadImage(url) {
  const img = new Image();
  img.src = window.__EMBED?.[url] || url;   // the single-file demo carries its sheets inside
  await img.decode();
  return img;
}

export function pixelsOf(img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, c.width, c.height);
}

export function buildSheet(meta, full, bare) {
  const anims = [];
  for (const [id, row, n] of BASE) {
    if ((row + n) * F > full.height) continue;
    anims.push({ id, size: F, y: row * F, rows: n === 1 ? [ONE_ROW[id]] : DIRS });
  }
  let y = 54 * F;
  for (const name of meta.custom || []) {
    const size = CUSTOM_SIZES[name] || 128;
    if (y + size * 4 > full.height) break;
    anims.push({ id: name, size, y, rows: DIRS, big: true });
    y += size * 4;
  }
  for (const a of anims) {
    a.frames = [];   // a.frames[r][f] = { box } or null (empty frame)
    a.count = 0;
    a.rows.forEach((dir, r) => {
      const list = [];
      const across = Math.floor(full.width / a.size);
      for (let f = 0; f < across; f++) {
        const x0 = f * a.size, y0 = a.y + r * a.size;
        if (!hasPixels(full, x0, y0, a.size)) { list.push(null); continue; }
        list.push({ x0, y0, box: anchorBox(full, bare, x0, y0, a.size) });
      }
      while (list.length && !list[list.length - 1]) list.pop();
      a.frames.push(list);
      a.count = Math.max(a.count, list.length);
    });
    a.cycle = (CYCLES[a.id] || [...Array(a.count).keys()]).filter((f) => f < a.count);
    a.found = a.frames.flat().filter((f) => f?.box).length;
    a.total = a.frames.flat().filter(Boolean).length;
  }
  return { meta, width: full.width, height: full.height, full, bare, anims: anims.filter((a) => a.total > 0) };
}

function hasPixels(img, x0, y0, size) {
  const d = img.data, w = img.width;
  for (let y = y0; y < y0 + size; y++) for (let x = x0; x < x0 + size; x++) if (d[(y * w + x) * 4 + 3]) return true;
  return false;
}

// The anchor part = the pixels that differ between the two sheets. Its point is the top centre.
export function anchorBox(full, bare, x0, y0, size) {
  const a = full.data, b = bare.data, w = full.width, mask = new Uint8Array(size * size);
  let top = Infinity, n = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = ((y0 + y) * w + x0 + x) * 4;
      if (a[i + 3] && (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3])) {
        mask[y * size + x] = 1; n++;
        if (y < top) top = y;
      }
    }
  }
  if (n < 4) return null;
  let left = Infinity, right = -Infinity;
  for (let y = top; y <= Math.min(size - 1, top + 6); y++) {
    for (let x = 0; x < size; x++) if (mask[y * size + x]) { left = Math.min(left, x); right = Math.max(right, x); }
  }
  return { top, left, right, ax: Math.floor((left + right) / 2), ay: top, mask };
}
