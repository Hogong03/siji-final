// 思迹 H5 实机截图 · CDP 驱动（零依赖）
//
// 用途：把本地跑的 H5 版（vite dev，默认 http://localhost:5173）用手机视口打开，
// 逐路由截图，并打印页面可见文本 —— 因为宣传片要的是"真实界面"，
// 而截图之外的排版状态只能靠 DOM 文本来判断。
//
// 用法：
//   node site/video/capture-app.mjs --probe
//   node site/video/capture-app.mjs --routes "chat=#/pages/chat/index,diary=#/pages/diary/list"
//   node site/video/capture-app.mjs --js "localStorage.setItem('k','v')" --routes "diary=#/pages/diary/list"
//
// 参数：
//   --url    起始地址（默认 http://localhost:5173）
//   --out    截图目录（默认 site/video/app-shots）
//   --routes "名字=hash,名字=hash"
//   --js     每次导航前注入的脚本（可重复，用 ; 分隔的表达式请自行包成 IIFE）
//   --js-file  同上，从文件读取（建议用这个，避免命令行转义）
//   --after  每次导航并稳定后执行的脚本（用于点掉引导层、切换页面状态）
//   --after-file  同上，从文件读取（支持 async：用 awaitPromise 等它跑完）
//   --dump   打印某个 localStorage 键的原始值（判断数据结构，便于铺垫演示数据）
//   --probe  只打开首页并打印 hash 与可见文本，用来判断挡在哪一步
//   --full   整页长截图（captureBeyondViewport），成片里用来做"在手机屏里滚动"的动效
//   --tall   把视口拉高到指定像素再截图（uni-app 的页面是内部滚动容器，文档不会变高；
//            拉高视口才能一次拍下全部内容，成片里再在手机屏窗口内滚动它）
//   --width / --height / --dpr  视口（默认 390x844@3）

import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
const BASE = typeof ARGS.url === 'string' ? ARGS.url : 'http://localhost:5173';
const OUT = resolve(typeof ARGS.out === 'string' ? ARGS.out : join(HERE, 'app-shots'));
const WIDTH = num(ARGS.width, 390);
const HEIGHT = num(ARGS.height, 844);
const DPR = num(ARGS.dpr, 3);
const PORT = num(ARGS.port, 9413);
const CHROME = ARGS.chrome || 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const SETTLE = num(ARGS.settle, 900);

const CHROME_FLAGS = [
  '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--force-device-scale-factor=' + DPR, '--force-color-profile=srgb',
  '--font-render-hinting=none', '--disable-smooth-scrolling',
  '--disable-threaded-animation', '--run-all-compositor-stages-before-draw',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-extensions', '--no-first-run', '--no-default-browser-check',
  '--mute-audio', '--window-size=' + WIDTH + ',' + HEIGHT,
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
  once(method, timeoutMs = 25000) {
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
  throw new Error('DevTools 未就绪，端口 ' + port);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const profile = join(tmpdir(), 'siji-capture-profile-' + PORT);
  rmSync(profile, { recursive: true, force: true });

  const chrome = spawn(CHROME, CHROME_FLAGS.concat(['--user-data-dir=' + profile, 'about:blank']), {
    stdio: 'ignore', windowsHide: true,
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
      width: WIDTH, height: HEIGHT, deviceScaleFactor: DPR, mobile: true,
      screenWidth: WIDTH, screenHeight: HEIGHT,
    }, sessionId);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, sessionId);
    await cdp.send('Emulation.setDefaultBackgroundColorOverride', {
      color: { r: 255, g: 255, b: 255, a: 1 },
    }, sessionId);

    const evalJs = async (expr) => {
      const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sessionId);
      if (r.exceptionDetails) throw new Error('脚本异常: ' + JSON.stringify(r.exceptionDetails.exception || r.exceptionDetails));
      return r.result && r.result.value;
    };

    const openRoute = async (hash) => {
      const current = String(await evalJs('location.href') || '');
      if (current.indexOf(BASE) === 0) {
        /* 同一个 SPA 文档：改 hash 不会触发 load 事件，直接切路由 */
        await evalJs('location.hash = ' + JSON.stringify(hash.replace(/^#/, '')));
      } else {
        const loaded = cdp.once('Page.loadEventFired');
        await cdp.send('Page.navigate', { url: BASE + '/' + hash }, sessionId);
        /* 首屏 load 事件偶发不回报（SPA 已渲染但事件早于监听），超时不致命 */
        await loaded.catch(() => {});
      }
      /* H5 版是 SPA：等 uni 页面挂上，再留一段稳定时间 */
      for (let i = 0; i < 40; i++) {
        const ok = await evalJs("!!document.querySelector('uni-page-body, uni-app, .uni-app--showtabbar')");
        if (ok) break;
        await sleep(150);
      }
      await sleep(SETTLE);
    };

    const runAfter = async () => {
      let src = '';
      if (typeof ARGS['after-file'] === 'string') {
        if (!existsSync(ARGS['after-file'])) throw new Error('after 脚本不存在: ' + ARGS['after-file']);
        src = readFileSync(ARGS['after-file'], 'utf8');
      } else if (typeof ARGS.after === 'string') {
        src = ARGS.after;
      }
      if (!src) return;
      const v = await evalJs(src);
      console.log('after 脚本返回: ' + JSON.stringify(v));
      await sleep(500);
    };

    if (ARGS.dump && typeof ARGS.dump === 'string') {
      await openRoute('#/pages/chat/index');
      await runAfter();
      const raw = await evalJs('localStorage.getItem(' + JSON.stringify(ARGS.dump) + ')');
      console.log('=== ' + ARGS.dump + ' ===');
      console.log(raw === null ? '(空)' : String(raw).slice(0, 3000));
      return;
    }

    const injectSource = (() => {
      if (typeof ARGS['js-file'] === 'string') {
        if (!existsSync(ARGS['js-file'])) throw new Error('注入脚本不存在: ' + ARGS['js-file']);
        return readFileSync(ARGS['js-file'], 'utf8');
      }
      if (typeof ARGS.js === 'string') return ARGS.js;
      return '';
    })();
    if (injectSource) {
      /* 注入的脚本在每次导航前跑（用于跳过首启门槛 / 铺垫数据） */
      await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: injectSource }, sessionId);
      console.log('已注入前置脚本（' + injectSource.length + ' 字符）');
    }

    if (ARGS.probe) {
      await openRoute('#/pages/chat/index');
      await runAfter();
      console.log('hash: ' + await evalJs('location.hash'));
      const txt = await evalJs('document.body.innerText');
      console.log('可见文本（前 700 字）:\n' + String(txt).slice(0, 700));
      console.log('localStorage keys: ' + await evalJs('Object.keys(localStorage).slice(0,30).join(", ")'));
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, sessionId);
      writeFileSync(join(OUT, 'probe.png'), Buffer.from(shot.data, 'base64'));
      console.log('截图: ' + join(OUT, 'probe.png'));
      return;
    }

    if (ARGS.tall && ARGS.tall !== true) {
      const tallH = Number(ARGS.tall);
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: WIDTH, height: tallH, deviceScaleFactor: DPR, mobile: true,
        screenWidth: WIDTH, screenHeight: tallH,
      }, sessionId);
      console.log('视口已拉高到 ' + tallH + 'px');
    }

    const routes = typeof ARGS.routes === 'string'
      ? ARGS.routes.split(',').map((s) => {
        const i = s.indexOf('=');
        return { name: s.slice(0, i).trim(), hash: s.slice(i + 1).trim() };
      }).filter((r) => r.name && r.hash)
      : [{ name: 'chat', hash: '#/pages/chat/index' }];

    for (const r of routes) {
      await openRoute(r.hash);
      await runAfter();
      const txt = String(await evalJs('document.body.innerText')).replace(/\s*\n\s*/g, ' | ');
      console.log('\n=== ' + r.name + '  ' + r.hash + ' ===');
      console.log('hash: ' + await evalJs('location.hash'));
      console.log('文本: ' + txt.slice(0, ARGS.full ? 120 : 500));
      if (ARGS.full) {
        const m = await cdp.send('Page.getLayoutMetrics', {}, sessionId);
        const h = Math.min(4000, Math.ceil(m.cssContentSize.height));
        console.log('整页高度: ' + h + 'px（视口 ' + HEIGHT + 'px）');
        await cdp.send('Emulation.setDeviceMetricsOverride', {
          width: WIDTH, height: h, deviceScaleFactor: DPR, mobile: true,
          screenWidth: WIDTH, screenHeight: h,
        }, sessionId);
        await sleep(400);
      }
      const shot = await cdp.send('Page.captureScreenshot', {
        format: 'png', fromSurface: true, captureBeyondViewport: !!ARGS.full,
      }, sessionId);
      const buf = Buffer.from(shot.data, 'base64');
      writeFileSync(join(OUT, r.name + '.png'), buf);
      console.log('截图: ' + r.name + '.png  ' + (buf.length / 1024).toFixed(1) + 'KB');
    }
  } finally {
    try { if (ws) ws.close(); } catch { /* 忽略 */ }
    try { chrome.kill(); } catch { /* 忽略 */ }
    try { execFileSync('taskkill', ['/F', '/T', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch { /* 已退出 */ }
    rmSync(profile, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('失败：' + err.message);
  process.exit(1);
});
