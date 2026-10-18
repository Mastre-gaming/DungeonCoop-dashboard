// The three.js view: an orthographic camera in screen pixels. Left: the frame being painted, zoomed, with a pixel
// grid, the anchor point, the mirror line and a cursor. Right: one animated preview per facing.
import * as THREE from 'three';

const nearest = (tex) => { tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.colorSpace = THREE.SRGBColorSpace; return tex; };

function pixelCanvas(size) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  return { canvas, ctx: canvas.getContext('2d'), tex: nearest(new THREE.CanvasTexture(canvas)) };
}

function checkerTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 2;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3a3f4b'; ctx.fillRect(0, 0, 2, 2);
  ctx.fillStyle = '#323641'; ctx.fillRect(0, 0, 1, 1); ctx.fillRect(1, 1, 1, 1);
  const tex = nearest(new THREE.CanvasTexture(c));
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createView(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x1b1e25);
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10);

  const view = { renderer, scene, camera, zoom: 8, pan: { x: 0, y: 0 }, size: 64, W: 1, H: 1, previewW: 360, grid: true, cursor: null, mirror: null, anchor: null };

  // ---- paint frame
  const paint = pixelCanvas(64);
  const checker = checkerTexture();
  const back = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: checker }));
  const frame = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: paint.tex, transparent: true }));
  frame.position.z = 1;
  const gridMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07 });
  let gridLines = null;
  const cursor = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[0, 0], [1, 0], [1, 1], [0, 1]].map(([x, y]) => new THREE.Vector3(x, y, 0))),
    new THREE.LineBasicMaterial({ color: 0xffe28a }));
  cursor.position.z = 3;
  const anchorMark = new THREE.Group();
  for (const [a, b] of [[[-0.5, 0.5], [1.5, 0.5]], [[0.5, -0.5], [0.5, 1.5]]]) {
    anchorMark.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a, 0), new THREE.Vector3(...b, 0)]), new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.8 })));
  }
  anchorMark.position.z = 2.5;
  const mirrorLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0)]), new THREE.LineDashedMaterial({ color: 0xf472b6, dashSize: 0.02, gapSize: 0.02 }));
  mirrorLine.position.z = 2.6;
  scene.add(back, frame, cursor, anchorMark, mirrorLine);

  // ---- previews
  const previews = [0, 1, 2, 3].map(() => {
    const p = pixelCanvas(64);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: p.tex, transparent: true }));
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x262a33 }));
    mesh.position.z = 1;
    scene.add(bg, mesh);
    return { ...p, mesh, bg, size: 64, rect: null };
  });

  function setCanvasSize(p, size) {
    if (p.canvas.width === size) return;
    p.canvas.width = p.canvas.height = size;
    p.tex.dispose();
    p.tex = nearest(new THREE.CanvasTexture(p.canvas));
    p.mesh ? (p.mesh.material.map = p.tex) : (frame.material.map = p.tex);
  }

  function buildGrid(size) {
    if (gridLines) { scene.remove(gridLines); gridLines.geometry.dispose(); }
    const pts = [];
    for (let i = 0; i <= size; i++) { pts.push(i, 0, 0, i, size, 0, 0, i, 0, size, i, 0); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    gridLines = new THREE.LineSegments(g, gridMat);
    gridLines.position.z = 2;
    scene.add(gridLines);
  }

  // Where the frame's top-left corner is, in screen pixels (y down).
  view.frameOrigin = () => {
    const paintW = view.W - view.previewW, s = view.size * view.zoom;
    return { x: Math.round(paintW / 2 - s / 2 + view.pan.x), y: Math.round(view.H / 2 - s / 2 + view.pan.y) };
  };
  view.screenToPixel = (sx, sy) => {
    const o = view.frameOrigin();
    const x = Math.floor((sx - o.x) / view.zoom), y = Math.floor((sy - o.y) / view.zoom);
    return x >= 0 && y >= 0 && x < view.size && y < view.size ? { x, y } : null;
  };
  view.pixelToScreen = (x, y) => { const o = view.frameOrigin(); return { x: o.x + (x + 0.5) * view.zoom, y: o.y + (y + 0.5) * view.zoom }; };
  view.inPaintArea = (sx) => sx < view.W - view.previewW;
  view.fit = () => { view.zoom = Math.max(2, Math.floor(Math.min((view.W - view.previewW) * 0.86, view.H * 0.86) / view.size)); view.pan = { x: 0, y: 0 }; };

  view.setFrame = (pixels, size) => {
    if (size !== view.size) { view.size = size; buildGrid(size); view.fit(); }
    setCanvasSize(paint, size);
    paint.ctx.putImageData(new ImageData(pixels, size, size), 0, 0);
    paint.tex.needsUpdate = true;
  };
  view.setPreview = (i, pixels, size) => {
    const p = previews[i];
    setCanvasSize(p, size);
    p.size = size;
    p.ctx.putImageData(new ImageData(pixels, size, size), 0, 0);
    p.tex.needsUpdate = true;
  };
  view.previewCount = 4;
  view.previewRects = () => previews.map((p) => p.rect);

  // world y is up; convert from screen (y down)
  const place = (mesh, x, y, w, h) => { mesh.scale.set(w, h, 1); mesh.position.x = x + w / 2; mesh.position.y = view.H - (y + h / 2); };

  view.layout = () => {
    const r = host.getBoundingClientRect();
    view.W = Math.max(1, r.width); view.H = Math.max(1, r.height);
    view.previewW = Math.min(420, Math.max(240, Math.round(view.W * 0.3)));
    host.style.setProperty('--preview-w', `${view.previewW}px`);   // the HTML controls keep to their own column
    renderer.setSize(view.W, view.H, false);
    renderer.domElement.style.width = `${view.W}px`; renderer.domElement.style.height = `${view.H}px`;
    camera.right = view.W; camera.top = view.H; camera.updateProjectionMatrix();
  };

  view.render = () => {
    const o = view.frameOrigin(), s = view.size * view.zoom, z = view.zoom;
    place(back, o.x, o.y, s, s);
    checker.repeat.set(view.size / 2, view.size / 2);
    place(frame, o.x, o.y, s, s);
    if (gridLines) {
      gridLines.visible = view.grid && z >= 6;
      gridLines.scale.set(z, -z, 1);
      gridLines.position.set(o.x, view.H - o.y, 2);
    }
    cursor.visible = !!view.cursor;
    if (view.cursor) { cursor.scale.set(z, z, 1); cursor.position.set(o.x + view.cursor.x * z, view.H - o.y - (view.cursor.y + 1) * z, 3); }
    anchorMark.visible = !!view.anchor;
    if (view.anchor) { anchorMark.scale.set(z, -z, 1); anchorMark.position.set(o.x + view.anchor.x * z, view.H - o.y - view.anchor.y * z, 2.5); }
    mirrorLine.visible = view.mirror != null;
    if (view.mirror != null) {
      mirrorLine.scale.set(1, s, 1);
      mirrorLine.position.set(o.x + view.mirror * z, view.H - o.y - s, 2.6);
      mirrorLine.computeLineDistances();
      mirrorLine.material.dashSize = mirrorLine.material.gapSize = 4 / s;
    }
    // previews: 2 x 2 in the right column
    const pw = view.previewW, cell = Math.floor((pw - 30) / 2), top = 56;
    previews.forEach((p, i) => {
      const cx = view.W - pw + 10 + (i % 2) * (cell + 10), cy = top + Math.floor(i / 2) * (cell + 34);
      const k = Math.max(1, Math.floor(cell / p.size)), d = p.size * k;
      place(p.bg, cx, cy, cell, cell);
      place(p.mesh, cx + (cell - d) / 2, cy + (cell - d) / 2, d, d);
      p.rect = { x: cx, y: cy, w: cell, h: cell };
    });
    renderer.render(scene, camera);
  };

  view.layout();
  buildGrid(64);
  view.fit();
  return view;
}
