// A headless browser you can drive: full-size screenshots as real PNG files, and a way to ask the page things.
// It uses the Edge (or Chrome) already on the machine and Node's own WebSocket: nothing to install.
//
//   node core/tools/shots.mjs <skill | url | file> [out.png] [--size=1600x900] [--query=spot=title] [--wait=1500]
//        [--eval="dbg.go('title'); dbg.advance(2)"] [--until="window.ready === true"]
//
// A skill name means that skill's demo.html. Without an out file the picture goes to shots/<name>.png.
//   --query   added to the address (?spot=title is how a page is sent to a named viewpoint)
//   --eval    JavaScript run in the page before the picture (it may be async)
//   --until   wait until this expression is true before the picture (at most 30 s)
//   --wait    then wait this many more milliseconds (real time)
// The page runs in real time, drawn with the graphics card (software drawing cannot keep up with a 3D page).
// For a picture of an exact moment, do not wait on the clock: step the game there (dbg.advance) in --eval.
//
// From another script:
//   const page = await openPage(url, { size: '1600x900' });
//   await page.eval('dbg.go("title")');  await page.waitFor('document.documentElement.dataset.test');  await page.shot('out.png');
//   page.errors   (what the page threw or logged as an error);   await page.close();
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BROWSERS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/microsoft-edge', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function browserPath() {
  const found = BROWSERS.find((p) => fs.existsSync(p));
  if (!found) throw new Error('No Edge or Chrome found: add its path to BROWSERS in core/tools/shots.mjs');
  return found;
}

// Where a target is: a skill's demo, a file, or an address as given.
export function address(target, query = '') {
  let url = target;
  if (!/^[a-z]+:\/\//i.test(target)) {
    const file = fs.existsSync(path.join(ROOT, target, 'demo.html')) ? path.join(ROOT, target, 'demo.html') : path.resolve(target);
    if (!fs.existsSync(file)) throw new Error(`Nothing at ${target}`);
    url = pathToFileURL(file).href;
  }
  return query ? `${url}${url.includes('?') ? '&' : '?'}${query}` : url;
}

export async function openPage(url, { size = '1600x900', software = false, timeout = 30000 } = {}) {
  const [width, height] = size.split('x').map(Number), profile = fs.mkdtempSync(path.join(os.tmpdir(), 'shots-'));
  const child = spawn(browserPath(), [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, `--window-size=${width},${height}`,
    '--hide-scrollbars', '--mute-audio', '--no-first-run', '--disable-extensions', '--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files',
    ...(software ? ['--disable-gpu', '--enable-unsafe-swiftshader'] : process.platform === 'win32' ? ['--use-angle=d3d11'] : []),
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  // The browser says where to reach it on its error output.
  const endpoint = await new Promise((resolve, reject) => {
    let text = '';
    const timer = setTimeout(() => reject(new Error('The browser did not start')), timeout);
    child.stderr.on('data', (d) => { text += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(text); if (m) { clearTimeout(timer); resolve(m[1]); } });
    child.on('exit', () => { clearTimeout(timer); reject(new Error('The browser closed before it could be reached')); });
  });
  const ws = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = () => reject(new Error('Could not connect to the browser')); });

  let next = 1, session = null;
  const waiting = new Map(), errors = [], listeners = [];
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && waiting.has(msg.id)) { const { resolve, reject } = waiting.get(msg.id); waiting.delete(msg.id); msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result); return; }
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    for (const fn of listeners) fn(msg);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = next++; waiting.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params, ...(session ? { sessionId: session } : {}) })); });
  const event = (method) => new Promise((resolve) => { const fn = (msg) => { if (msg.method === method) { listeners.splice(listeners.indexOf(fn), 1); resolve(msg.params); } }; listeners.push(fn); });

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  session = (await send('Target.attachToTarget', { targetId, flatten: true })).sessionId;
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  const loaded = event('Page.loadEventFired');
  await send('Page.navigate', { url });
  await Promise.race([loaded, sleep(timeout)]);

  const page = {
    errors,
    // A raw DevTools call on this page (Profiler.start, Performance.getMetrics...).
    send: (method, params = {}) => send(method, params),
    // Run JavaScript in the page and get its value back (it may return a promise).
    async eval(expression) {
      const { result, exceptionDetails } = await send('Runtime.evaluate', { expression: `(async () => (${expression}\n))()`, awaitPromise: true, returnByValue: true });
      if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
      return result.value;
    },
    async waitFor(expression, limit = 30000) {
      const start = Date.now();
      for (;;) {
        const value = await page.eval(expression).catch(() => null);
        if (value) return value;
        if (Date.now() - start > limit) return null;
        await sleep(100);
      }
    },
    async shot(out) {
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
      fs.writeFileSync(out, Buffer.from(data, 'base64'));
      return out;
    },
    async close() {
      session = null;
      try { await Promise.race([send('Browser.close'), sleep(1500)]); } catch {}
      try { ws.close(); } catch {}
      try { child.kill(); } catch {}
      await sleep(200);
      try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
    },
  };
  return page;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), flag = (name, fallback) => (args.find((a) => a.startsWith(`--${name}=`)) || '').split('=').slice(1).join('=') || fallback;
  const [target, given] = args.filter((a) => !a.startsWith('--'));
  if (!target) { console.error('What of? (a skill name, a file or an address)'); process.exit(1); }
  const out = path.resolve(given || path.join(ROOT, 'shots', `${path.basename(target).replace(/\W+/g, '_')}.png`));
  const page = await openPage(address(target, flag('query', '')), { size: flag('size', '1600x900'), software: args.includes('--software') });
  try {
    if (flag('until', '')) await page.waitFor(flag('until', ''));
    if (flag('eval', '')) await page.eval(flag('eval', ''));
    await sleep(Number(flag('wait', 1500)));
    await page.shot(out);
    console.log(out);
    if (page.errors.length) console.log(`the page reported:\n- ${page.errors.join('\n- ')}`);
  } finally { await page.close(); }
  process.exit(0);
}
