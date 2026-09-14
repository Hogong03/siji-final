// 思迹介绍片 · 帧序列编码（ffmpeg 包装）
//
// 用法：
//   node site/video/encode.mjs --frames <帧目录> --out site/assets/siji-intro.mp4 --fps 30
//
// 默认在编码完成后删除帧目录，加 --keep 保留以便单独检查某一帧。

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

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

function resolveFfmpeg(explicit) {
  if (explicit && explicit !== true) return explicit;
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try {
    const found = execFileSync('where', ['ffmpeg'], { encoding: 'utf8' }).split(/\r?\n/)[0].trim();
    if (found && existsSync(found)) return found;
  } catch { /* PATH 里没有，继续找 */ }
  const fallbacks = [
    'C:\\Users\\c3798\\AppData\\Local\\Programs\\Python\\Python313\\ffmpeg.exe',
    'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
  ];
  for (const p of fallbacks) if (existsSync(p)) return p;
  throw new Error('找不到 ffmpeg，请用 --ffmpeg 指定完整路径');
}

const ARGS = parseArgs(process.argv.slice(2));
const FRAMES = resolve(ARGS.frames && ARGS.frames !== true ? ARGS.frames : join(tmpdir(), 'siji-intro-frames'));
const OUT = resolve(ARGS.out && ARGS.out !== true ? ARGS.out : 'site/assets/siji-intro.mp4');
const FPS = Number(ARGS.fps === undefined || ARGS.fps === true ? 30 : ARGS.fps);
const CRF = String(ARGS.crf === undefined || ARGS.crf === true ? 18 : ARGS.crf);
const FFMPEG = resolveFfmpeg(ARGS.ffmpeg);

if (!existsSync(FRAMES)) throw new Error('帧目录不存在：' + FRAMES);
const frames = readdirSync(FRAMES).filter((f) => f.endsWith('.png')).sort();
if (!frames.length) throw new Error('帧目录里没有 PNG：' + FRAMES);

const first = frames[0];
const last = frames[frames.length - 1];
const pad = first.match(/(\d+)\.png$/)[1].length;
const pattern = join(FRAMES, 'frame_%0' + pad + 'd.png');

console.log('编码: ' + frames.length + ' 帧 / ' + FPS + 'fps / ' + (frames.length / FPS).toFixed(1) + ' 秒');
console.log('  起 ' + first + '  止 ' + last);

execFileSync(FFMPEG, [
  '-y', '-hide_banner', '-loglevel', 'warning',
  '-framerate', String(FPS),
  '-i', pattern,
  '-c:v', 'libx264',
  '-preset', 'slow',
  '-crf', CRF,
  '-pix_fmt', 'yuv420p',
  '-profile:v', 'high',
  '-level', '4.1',
  '-movflags', '+faststart',
  '-an',
  OUT,
], { stdio: 'inherit' });

const mb = (statSync(OUT).size / 1048576).toFixed(2);
console.log('输出: ' + OUT + '  ' + mb + ' MB');

if (!ARGS.keep) {
  rmSync(FRAMES, { recursive: true, force: true });
  console.log('已清理帧目录');
}
