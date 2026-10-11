// 思迹介绍片 · 音轨生成（旁白 + 配乐 + 音效）
//
// 为什么用合成而不是找现成素材：
//   商用素材的授权要逐个核对，网络上「免费」的几乎都不可商用；
//   这里的配乐是脚本按和声算出来的（PCM 直接生成），旁白走系统中文语音，
//   音效是正弦/噪声包络 —— 全部自产，没有任何第三方版权牵连。
//
// 用法：
//   node site/video/make-audio.mjs                     // 生成音轨并 mux 进成片
//   node site/video/make-audio.mjs --mux off           // 只生成 site/video/audio/mix.m4a
//   node site/video/make-audio.mjs --vo off            // 去掉旁白（只留配乐与音效）
//   node site/video/make-audio.mjs --voice 康康         // 换旁白声音
//
// 产物：
//   site/video/audio/bgm.wav      配乐
//   site/video/audio/vo_*.wav     旁白逐句
//   site/video/audio/sfx_*.wav    音效
//   site/video/audio/mix.m4a      混好的整条音轨
//   site/assets/siji-intro.mp4    成片（带音轨，视频流直接 copy 不重编码）

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const AUDIO = join(HERE, 'audio');
const FPS = 30;
const SR = 44100;

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
const WANT_VO = ARGS.vo !== 'off';
const WANT_MUX = ARGS.mux !== 'off';
const VOICE = typeof ARGS.voice === 'string' ? ARGS.voice : 'Microsoft Yaoyao';
const DURATION = 54.0;

/* ---------- 1. 配乐：A 小调四和弦铺底 + 稀疏铃声 ---------- */

/* 和弦按音名给频率（只用到低中音区，做铺底不抢旁白） */
const NOTE = {
  A2: 110.0, C3: 130.81, E3: 164.81, G3: 196.0, A3: 220.0, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F2: 87.31, F3: 174.61, G2: 98.0, G4: 392.0,
  A4: 440.0, C5: 523.25, E5: 659.26, D5: 587.33,
};

const CHORDS = [
  { at: 0, notes: ['A2', 'C4', 'E4', 'G4'], bell: ['A4', 'C5', 'E5'] },
  { at: 13.5, notes: ['F2', 'C4', 'E4', 'A4'], bell: ['C5', 'A4', 'E5'] },
  { at: 27.0, notes: ['C3', 'E3', 'G3', 'B3'], bell: ['E5', 'G4', 'C5'] },
  { at: 40.5, notes: ['G2', 'B3', 'D4', 'E4'], bell: ['D5', 'G4', 'B3'] },
];

function synthBgm(totalSec) {
  const n = Math.floor(totalSec * SR);
  const L = new Float32Array(n);
  const R = new Float32Array(n);

  for (const chord of CHORDS) {
    const start = Math.floor(chord.at * SR);
    const len = Math.min(n - start, Math.floor(13.5 * SR));
    if (len <= 0) continue;
    for (let v = 0; v < chord.notes.length; v++) {
      const f = NOTE[chord.notes[v]];
      if (!f) continue;
      const pan = v % 2 === 0 ? 0.45 : 0.55;
      /* 轻微失谐的两层叠加：比单正弦厚一点，但不做 chorus 效果 */
      const det = [1.0, 1.0022];
      for (let d = 0; d < det.length; d++) {
        const w = f * det[d];
        for (let i = 0; i < len; i++) {
          const t = i / SR;
          /* 慢起慢落：单和弦本身不形成鼓点 */
          const env = Math.min(1, t / 2.6) * Math.min(1, (len / SR - t) / 3.2);
          const lfo = 0.86 + 0.14 * Math.sin(2 * Math.PI * 0.09 * t + v);
          const s = Math.sin(2 * Math.PI * w * t) * env * lfo * (d ? 0.35 : 1);
          L[start + i] += s * pan * 0.16;
          R[start + i] += s * (1 - pan) * 0.16;
        }
      }
    }
    /* 铃声：每 3.375 秒一次，指数衰减，音量压得很低 */
    for (let k = 0; k < 4; k++) {
      const bf = NOTE[chord.bell[k % chord.bell.length]];
      if (!bf) continue;
      const bs = start + Math.floor((k * 3.375 + 0.4) * SR);
      const blen = Math.min(n - bs, Math.floor(1.6 * SR));
      if (blen <= 0) continue;
      for (let i = 0; i < blen; i++) {
        const t = i / SR;
        const env = Math.exp(-3.4 * t) * Math.min(1, t / 0.012);
        const s = (Math.sin(2 * Math.PI * bf * t) + 0.3 * Math.sin(2 * Math.PI * bf * 2 * t)) * env;
        L[bs + i] += s * 0.075;
        R[bs + i] += s * 0.062;
      }
    }
  }

  /* 首尾淡入淡出 */
  const fi = Math.floor(1.6 * SR);
  const fo = Math.floor(3.2 * SR);
  for (let i = 0; i < fi && i < n; i++) { const g = i / fi; L[i] *= g; R[i] *= g; }
  for (let i = 0; i < fo && i < n; i++) { const g = i / fo; L[n - 1 - i] *= g; R[n - 1 - i] *= g; }

  /* 归一化到 -20 dBFS 左右，留足余量给旁白 */
  let peak = 1e-9;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const gain = 0.1 / peak;
  for (let i = 0; i < n; i++) { L[i] *= gain; R[i] *= gain; }

  return interleave(L, R);
}

/* ---------- 2. 音效 ---------- */

function synthTick() {
  const n = Math.floor(0.035 * SR);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const s = Math.sin(2 * Math.PI * 1650 * t) * Math.exp(-70 * t);
    L[i] = s * 0.16;
    R[i] = s * 0.13;
  }
  return interleave(L, R);
}

function synthDing() {
  const n = Math.floor(0.9 * SR);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.exp(-4.2 * t) * Math.min(1, t / 0.008);
    const s = Math.sin(2 * Math.PI * 880 * t) * 0.6 + Math.sin(2 * Math.PI * 1320 * t) * 0.4;
    L[i] = s * env * 0.2;
    R[i] = s * env * 0.18;
  }
  return interleave(L, R);
}

function synthWhoosh() {
  const n = Math.floor(0.5 * SR);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.sin(Math.PI * (t / 0.5));
    const noise = Math.random() * 2 - 1;
    /* 一阶低通，截止随包络缓升缓降 —— 听感是「唰」而不是白噪声 */
    const cut = 0.02 + 0.18 * env;
    lp += (noise - lp) * cut;
    L[i] = lp * env * 0.3;
    R[i] = lp * env * 0.26;
  }
  return interleave(L, R);
}

/* ---------- WAV 读写 ---------- */

function interleave(L, R) {
  const out = new Float32Array(L.length * 2);
  for (let i = 0; i < L.length; i++) { out[i * 2] = L[i]; out[i * 2 + 1] = R[i]; }
  return out;
}

function writeWav(path, samples) {
  const dataBytes = samples.length * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  writeFileSync(path, buf);
}

function readWavMono(path) {
  const buf = readFileSync(path);
  const channels = buf.readUInt16LE(22);
  const bits = buf.readUInt16LE(34);
  const rate = buf.readUInt32LE(24);
  let offset = 12;
  let dataOffset = 44;
  let dataLen = buf.length - 44;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === 'data') { dataOffset = offset + 8; dataLen = size; break; }
    offset += 8 + size + (size % 2);
  }
  const bytes = bits / 8;
  const count = Math.floor(dataLen / bytes / channels);
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    let acc = 0;
    for (let c = 0; c < channels; c++) {
      const p = dataOffset + (i * channels + c) * bytes;
      acc += bits === 16 ? buf.readInt16LE(p) / 32768 : (buf.readUInt8(p) - 128) / 128;
    }
    out[i] = acc / channels;
  }
  return { samples: out, rate };
}

/* ---------- 3. 旁白：Windows 系统中文语音 ---------- */

/* 每句的起点按分镜给（秒）；窗口 = 该幕长度，留给旁白的是窗口内前段 */
const VO_LINES = [
  { id: 's1', at: 0.9, text: '思迹，对话式生活助手。' },
  { id: 's2', at: 5.4, text: '不用挑模块，说一句话，它就整理成账单、计划或者记录。说错了，直接改。' },
  { id: 's3', at: 17.4, text: '长记录自动分章节，左边目录尺一拖就到。旧记录，每天翻给你看。' },
  { id: 's4', at: 29.2, text: '计划只拆到今天能动的那一小步。到点会提醒，应用没开也收得到。' },
  { id: 's5', at: 38.4, text: '五件事，一个入口。' },
  { id: 's6', at: 44.2, text: '你只做两件事：说话，点确认。' },
  { id: 's7', at: 50.2, text: '思迹，把想变成做。' },
];

function speakToWav(text, voice, rate, outPath) {
  const esc = text.replace(/'/g, "''");
  const ps = [
    'Add-Type -AssemblyName System.Speech',
    '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    '$names = $s.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }',
    `$want = '${voice}'`,
    'if ($names -contains $want) { $s.SelectVoice($want) }',
    `$s.Rate = ${rate}`,
    `$s.SetOutputToWaveFile('${outPath.replace(/'/g, "''")}')`,
    `$s.Speak('${esc}')`,
    '$s.Dispose()',
  ].join('\r\n');
  const psFile = join(AUDIO, '_tts.ps1');
  writeFileSync(psFile, '\ufeff' + ps, 'utf8');
  execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psFile], { stdio: 'inherit' });
  rmSync(psFile, { force: true });
}

/* ---------- 主流程 ---------- */

function main() {
  mkdirSync(AUDIO, { recursive: true });
  const ffmpeg = process.env.FFMPEG || 'ffmpeg';

  console.log('1/4 生成配乐…');
  writeWav(join(AUDIO, 'bgm.wav'), synthBgm(DURATION));

  console.log('2/4 生成音效…');
  writeWav(join(AUDIO, 'sfx_tick.wav'), synthTick());
  writeWav(join(AUDIO, 'sfx_ding.wav'), synthDing());
  writeWav(join(AUDIO, 'sfx_whoosh.wav'), synthWhoosh());

  const inputs = ['-i', join(AUDIO, 'bgm.wav')];
  const filters = [];
  const mixLabels = [];

  /* 配乐作为底：压到 -22 dB 附近 */
  filters.push('[0:a]aformat=channel_layouts=stereo,volume=0.5[bg]');
  mixLabels.push('[bg]');

  let idx = 1;

  if (WANT_VO) {
    console.log('3/4 合成旁白（' + VOICE + '）…');
    for (const line of VO_LINES) {
      const p = join(AUDIO, 'vo_' + line.id + '.wav');
      speakToWav(line.text, VOICE, 0, p);
      const { samples, rate } = readWavMono(p);
      const dur = samples.length / rate;
      const window = windowFor(line.id);
      const fits = line.at + dur <= window.end;
      console.log(
        '   ' + line.id + '  ' + dur.toFixed(2) + 's  起点 ' + line.at.toFixed(1) + 's  ' +
        '窗口到 ' + window.end.toFixed(1) + 's  ' + (fits ? '放得下' : '超出 ' + (line.at + dur - window.end).toFixed(2) + 's')
      );
      inputs.push('-i', p);
      const delayMs = Math.round(line.at * 1000);
      /* 旁白增益 1.2：再高会在 AAC 编码后出现 0 dBFS 削波（实测 1.9 时 439 个采样点触顶、1.35 时仍有 79 个） */
      filters.push('[' + idx + ':a]aformat=channel_layouts=stereo,adelay=' + delayMs + '|' + delayMs + ',volume=1.2[v' + idx + ']');
      mixLabels.push('[v' + idx + ']');
      idx++;
    }
  } else {
    console.log('3/4 跳过旁白（--vo off）');
  }

  /* 音效：打字声跟着 S2 的三段输入，提示音跟着「已更新」，两条嗖声在幕切换处 */
  const SFX = [
    { file: 'sfx_whoosh.wav', at: 16.3, gain: 0.7 },
    { file: 'sfx_whoosh.wav', at: 28.3, gain: 0.6 },
    { file: 'sfx_tick.wav', at: 4.9, gain: 0.9 },
    { file: 'sfx_tick.wav', at: 5.15, gain: 0.7 },
    { file: 'sfx_tick.wav', at: 5.4, gain: 0.8 },
    { file: 'sfx_tick.wav', at: 8.6, gain: 0.9 },
    { file: 'sfx_tick.wav', at: 8.85, gain: 0.7 },
    { file: 'sfx_ding.wav', at: 9.35, gain: 0.85 },
  ];
  for (const s of SFX) {
    inputs.push('-i', join(AUDIO, s.file));
    const delayMs = Math.round(s.at * 1000);
    filters.push('[' + idx + ':a]aformat=channel_layouts=stereo,adelay=' + delayMs + '|' + delayMs + ',volume=' + s.gain + '[x' + idx + ']');
    mixLabels.push('[x' + idx + ']');
    idx++;
  }

  console.log('4/4 混音…');
  const chain = filters.join(';') + ';' + mixLabels.join('') +
    'amix=inputs=' + mixLabels.length + ':duration=longest:normalize=0,alimiter=limit=0.82:attack=1:release=20[aout]';
  const mixPath = join(AUDIO, 'mix.m4a');
  execFileSync(ffmpeg, [
    '-y', '-hide_banner', '-loglevel', 'error',
    ...inputs,
    '-filter_complex', chain,
    '-map', '[aout]',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '44100',
    mixPath,
  ], { stdio: 'inherit' });
  console.log('   音轨: ' + join('site', 'video', 'audio', 'mix.m4a') + '  ' + (statSync(mixPath).size / 1048576).toFixed(2) + ' MB');

  if (!WANT_MUX) return;

  const video = join(ROOT, 'site', 'assets', 'siji-intro.mp4');
  if (!existsSync(video)) { console.log('成片不存在，跳过 mux：' + video); return; }
  const tmp = video.replace(/\.mp4$/, '.audio.mp4');
  execFileSync(ffmpeg, [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', video, '-i', mixPath,
    '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
    '-shortest', '-movflags', '+faststart',
    tmp,
  ], { stdio: 'inherit' });
  rmSync(video, { force: true });
  renameSync(tmp, video);
  console.log('   成片已带上音轨: site/assets/siji-intro.mp4');
}

function windowFor(id) {
  const w = {
    s1: { end: 4.4 }, s2: { end: 16.4 }, s3: { end: 28.4 }, s4: { end: 37.4 },
    s5: { end: 43.4 }, s6: { end: 49.4 }, s7: { end: 54.0 },
  };
  return w[id] || { end: DURATION };
}

main();
