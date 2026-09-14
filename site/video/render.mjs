// 思迹介绍片 · 逐帧渲染驱动（零依赖）
//
// 用法：
//   node --experimental-websocket site/video/render.mjs --from 0 --to 30
//   node --experimental-websocket site/video/render.mjs --frames 90,270,435   // 只渲染指定帧，用于抽查
//
// 原理：启动一次 headless Chrome，通过 CDP 复用同一个页面，
// 逐帧调用页面暴露的 window.__draw(frameIndex)，再用 Page.captureScreenshot 落盘 PNG。
// 依赖仅 Node 内置：fetch + WebSocket（--experimental-websocket 开启）、child_process、fs。

import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

const ARGS = parseArgs(process.argv.slice(2));
const num = (v, d) => (v === undefined || v === true ? d : Number(v));
const FPS = num(ARGS.fps, 30);
const PORT = num(ARGS.port, 9411);
const OUT = resolve(ARGS.out || join(tmpdir(), 'siji-intro-frames'));
const PAGE = pathToFileURL(resolve(ARGS.page || join(HERE, 'index.html'))).href;
const CHROME = ARGS.chrome || 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const WIDTH = num(ARGS.width, 1920);
const HEIGHT = num(ARGS.height, 1080);

const CHROME_FLAGS = [
  '--headless',
  '--disable-gpu',
  '--no-sandbox',
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  '--force-color-profile=srgb',
  '--font-render-hinting=none',
  '--disable-smooth-scrolling',
  '--disable-threaded-animation',
  '--disable-checker-imaging',
  '--run-all-compositor-stages-before-draw',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-extensions',
  '--no-first-run',
  '--no-default-browser-check',
  '--mute-audio',
  '--allow-file-access-from-files',
  '--window-size=' + WIDTH + ',' + HEIGHT,
  '--remote-debugging-port=' + PORT,
];

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    this.handlers = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { res, rej } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) rej(new Error('CDP ' + JSON.stringify(msg.error)));
        else res(msg.result);
      } else if (msg.method && this.handlers.has(msg.method)) {
        const fn = this.handlers.get(msg.method);
        this.handlers.delete(msg.method);
        fn(msg.params);
      }
    });
  }
  send(method, params, sessionId) {
    const id = ++this.seq;
    const payload = { id, method, params: params || {} };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((res, rej) => this.pending.set(id, { res, rej }));
  }
  once(method, timeoutMs = 20000) {
    return new Promise((res, rej) => {
      const timer = setTimeout(() => { this.handlers.delete(method); rej(new Error('等待超时: ' + method)); }, timeoutMs);
      this.handlers.set(method, (p) => { clearTimeout(timer); res(p); });
    });
  }
}

async function waitForDevtools(port, timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch('http://127.0.0.1:' + port + '/json/version');
      if (r.ok) return await r.json();
    } catch { /* 还没起来 */ }
    await sleep(200);
  }
  throw new Error('DevTools 端点未就绪，端口 ' + port);
}

function pngSize(buf) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function clock(ms) {
  const s = Math.round(ms / 1000);
  return Math.floor(s / 60) + '分' + String(s % 60).padStart(2, '0') + '秒';
}

async function main() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const profile = join(tmpdir(), 'siji-video-profile-' + PORT);
  rmSync(profile, { recursive: true, force: true });

  const chrome = spawn(CHROME, CHROME_FLAGS.concat(['--user-data-dir=' + profile, 'about:blank']), {
    stdio: 'ignore',
    windowsHide: true,
  });

  let ws;
  try {
    const version = await waitForDevtools(PORT);
    ws = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', () => rej(new Error('WebSocket 连接失败')), { once: true });
    });

    const cdp = new CDP(ws);
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });

    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false,
      screenWidth: WIDTH, screenHeight: HEIGHT,
    }, sessionId);
    await cdp.send('Emulation.setDefaultBackgroundColorOverride', {
      color: { r: 10, g: 10, b: 11, a: 1 },
    }, sessionId);

    const loaded = cdp.once('Page.loadEventFired');
    await cdp.send('Page.navigate', { url: PAGE }, sessionId);
    await loaded;
    const ready = await cdp.send('Runtime.evaluate', {
      expression: 'window.__ready', awaitPromise: true, returnByValue: true,
    }, sessionId);
    if (ready.exceptionDetails) throw new Error('页面初始化失败: ' + JSON.stringify(ready.exceptionDetails));

    const metaRaw = await cdp.send('Runtime.evaluate', {
      expression: 'JSON.stringify(window.__meta)', returnByValue: true,
    }, sessionId);
    const meta = JSON.parse(metaRaw.result.value);
    const FROM = num(ARGS.from, 0);
    const TO = num(ARGS.to, meta.frames);
    const only = ARGS.frames && ARGS.frames !== true
      ? String(ARGS.frames).split(',').map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < meta.frames)
      : null;
    const list = only || Array.from({ length: Math.max(0, TO - FROM) }, (_, i) => FROM + i);
    console.log('片子: ' + meta.frames + ' 帧 / ' + (meta.fps || FPS) + 'fps / ' + meta.size.join('x') + ' / ' + meta.duration.toFixed(1) + '秒');
    console.log(only ? '抽查 ' + list.length + ' 帧' : '渲染: 第 ' + FROM + ' 帧 → 第 ' + TO + ' 帧');

    const started = Date.now();
    let firstSize = null;
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      const drawn = await cdp.send('Runtime.evaluate', {
        expression: 'window.__draw(' + f + ')', awaitPromise: true, returnByValue: true,
      }, sessionId);
      if (drawn.exceptionDetails) throw new Error('第 ' + f + ' 帧渲染异常: ' + JSON.stringify(drawn.exceptionDetails));
      const shot = await cdp.send('Page.captureScreenshot', {
        format: 'png', fromSurface: true, captureBeyondViewport: false,
      }, sessionId);
      const buf = Buffer.from(shot.data, 'base64');
      if (!firstSize) {
        firstSize = pngSize(buf);
        const ok = firstSize.width === WIDTH && firstSize.height === HEIGHT;
        console.log('首帧尺寸: ' + firstSize.width + 'x' + firstSize.height + (ok ? ' 正确' : ' 与目标不符，请检查 setDeviceMetricsOverride'));
        if (buf.length < 5000) throw new Error('首帧体积异常（' + buf.length + ' 字节），页面可能是空白');
      }
      writeFileSync(join(OUT, 'frame_' + String(f).padStart(5, '0') + '.png'), buf);
      const done = i + 1;
      if (done % 60 === 0 || done === list.length) {
        const elapsed = Date.now() - started;
        const eta = (elapsed / done) * (list.length - done);
        console.log('  [' + done + '/' + list.length + '] 已用时 ' + clock(elapsed) + ' 预计还需 ' + clock(eta));
      }
    }

    console.log('完成：' + OUT);
  } finally {
    try { if (ws) ws.close(); } catch { /* 忽略 */ }
    try { chrome.kill(); } catch { /* 忽略 */ }
    try { execFileSync('taskkill', ['/F', '/T', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch { /* 已退出 */ }
    rmSync(profile, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('渲染失败：' + err.message);
  process.exit(1);
});
