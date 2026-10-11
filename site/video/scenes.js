/* 思迹介绍片 · 时间轴
 *
 * 全片动效是"时间的纯函数"：draw(t) 根据绝对时间算出每个元素的 opacity / transform。
 * 不使用 CSS transition 或 requestAnimationFrame 动画，
 * 因此同一帧号任何时候渲染都得到同一张画面，便于逐帧导出与增量重渲染。
 *
 * 时间轴（秒）：
 *   0.0 -  4.4  品牌开场
 *   4.4 - 16.4  对话即记录（记录 / 账单 / 计划 / 修正）
 *  16.4 - 28.4  记录能读（阅读页 + 目录尺 + 回顾）
 *  28.4 - 37.4  计划只给小步（打卡 + 提醒外送达）
 *  37.4 - 43.4  一个入口五件事
 *  43.4 - 49.4  三条设计原则
 *  49.4 - 54.0  收尾
 */
(function () {
  'use strict';

  var FPS = 30;
  var $ = function (id) { return document.getElementById(id); };
  var clamp = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  var ease = function (x) { return 1 - Math.pow(1 - x, 3); };
  var prog = function (t, at, dur) { return dur <= 0 ? (t >= at ? 1 : 0) : ease(clamp((t - at) / dur)); };
  var raw = function (t, at, dur) { return clamp((t - at) / dur); };
  var lerp = function (a, b, p) { return a + (b - a) * p; };
  var smooth = function (x) { return x * x * (3 - 2 * x); };
  var pulse = function (t, at, dur) { return t <= at || t >= at + dur ? 0 : Math.sin((Math.PI * (t - at)) / dur); };

  /* 入场：p=0 时按 offset 位移并缩放，p=1 时归位 */
  function enter(el, p, dy, dx, scale) {
    if (!el) return;
    var k = 1 - p;
    el.style.opacity = String(p);
    el.style.transform =
      'translate(' + (dx || 0) * k + 'px,' + (dy || 0) * k + 'px) scale(' + (1 + (scale || 0) * k) + ')';
  }

  /* 分段折线：按时间在若干停靠点之间平滑插值，用于列表滚动这类连续量 */
  function ramp(t, stops) {
    if (t <= stops[0][0]) return stops[0][1];
    for (var i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        return lerp(stops[i - 1][1], stops[i][1], smooth((t - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0])));
      }
    }
    return stops[stops.length - 1][1];
  }

  /* ---------- 元素索引 ---------- */
  var E = {
    s1: { logo: $('s1-logo'), name: $('s1-name'), sub: $('s1-sub'), rule: $('s1-rule'), tag: $('s1-tag') },
    s2: {
      device: $('s2-device'), shot: $('s2-shot'), eyebrow: $('s2-eyebrow'), title: $('s2-title'), lead: $('s2-lead'),
      b1: $('s2-b1'), b2: $('s2-b2'), b3: $('s2-b3'),
    },
    s3: {
      eyebrow: $('s3-eyebrow'), title: $('s3-title'), lead: $('s3-lead'),
      device: $('s3-device'), shot: $('s3-shot'),
      r1: $('s3-r1'), r2: $('s3-r2'), r3: $('s3-r3'), r4: $('s3-r4'),
    },
    s4: {
      device: $('s4-device'), shot: $('s4-shot'),
      eyebrow: $('s4-eyebrow'), title: $('s4-title'), lead: $('s4-lead'),
      r1: $('s4-r1'), r2: $('s4-r2'), r3: $('s4-r3'),
    },
    s5: {
      eyebrow: $('s5-eyebrow'), title: $('s5-title'), foot: $('s5-foot'),
      cards: [$('s5-c1'), $('s5-c2'), $('s5-c3'), $('s5-c4'), $('s5-c5')],
    },
    s6: { l1: $('s6-l1'), l2: $('s6-l2'), l3: $('s6-l3'), foot: $('s6-foot') },
    s7: { logo: $('s7-logo'), name: $('s7-name'), tag: $('s7-tag'), sub: $('s7-sub') },
  };

  /* 屏内可滚动距离 = 长图高度 − 手机屏窗口高度（真机截图比屏幕高，正好用来做滚动） */
  var chatScroll = 0;
  var readScroll = 0;
  var planScroll = 0;

  function shotScroll(img) {
    if (!img || !img.parentElement) return 0;
    return Math.max(0, Math.round(img.offsetHeight - img.parentElement.clientHeight));
  }

  function measure() {
    chatScroll = shotScroll(E.s2.shot);
    readScroll = shotScroll(E.s3.shot);
    planScroll = shotScroll(E.s4.shot);
  }

  /* ---------- 分镜 ---------- */
  function drawS1(t) {
    /* logo 从第 0 帧就在淡入（起点 -0.15s）：开场是「从暗处浮起」，
       顺带保证首帧不是全黑 —— 全黑首帧没法当海报用 */
    enter(E.s1.logo, prog(t, -0.15, 0.70), 10, 0, 0.10);
    enter(E.s1.name, prog(t, 0.70, 0.60), 18);
    enter(E.s1.sub, prog(t, 1.10, 0.60), 14);
    var rp = prog(t, 1.55, 0.70);
    E.s1.rule.style.opacity = String(rp);
    E.s1.rule.style.transform = 'scaleX(' + rp + ')';
    enter(E.s1.tag, prog(t, 1.90, 0.70), 16);
  }

  function drawS2(t) {
    enter(E.s2.device, prog(t, -0.20, 0.90), 40);
    enter(E.s2.eyebrow, prog(t, 0.35, 0.50), 12);
    enter(E.s2.title, prog(t, 0.50, 0.60), 18);
    enter(E.s2.lead, prog(t, 0.75, 0.60), 16);
    enter(E.s2.b1, prog(t, 3.00, 0.50), 14);
    enter(E.s2.b2, prog(t, 7.10, 0.50), 14);
    enter(E.s2.b3, prog(t, 5.80, 0.50), 14);
    /* 真机界面在屏内缓缓下滚：账单卡 → 计划卡 → 改错后的金额 */
    E.s2.shot.style.transform = 'translateY(' + (-chatScroll * ramp(t, [[1.00, 0], [10.20, 1]])) + 'px)';
  }

  function drawS3(t) {
    enter(E.s3.eyebrow, prog(t, 0.20, 0.50), 12);
    enter(E.s3.title, prog(t, 0.35, 0.60), 18);
    enter(E.s3.device, prog(t, 0.25, 0.75), 30);
    enter(E.s3.r1, prog(t, 1.70, 0.50), 14);
    enter(E.s3.r2, prog(t, 2.70, 0.50), 14);
    enter(E.s3.r3, prog(t, 3.70, 0.50), 14);
    enter(E.s3.r4, prog(t, 4.60, 0.50), 14);
    enter(E.s3.lead, prog(t, 5.40, 0.55), 12);
    /* 真机阅读页：六个章节一路读下去，左侧目录尺跟着走 */
    E.s3.shot.style.transform = 'translateY(' + (-readScroll * ramp(t, [[1.40, 0], [10.40, 1]])) + 'px)';
  }

  function drawS4(t) {
    enter(E.s4.eyebrow, prog(t, 0.20, 0.50), 12);
    enter(E.s4.title, prog(t, 0.35, 0.60), 18);
    enter(E.s4.device, prog(t, 0.25, 0.70), 28);
    enter(E.s4.r1, prog(t, 1.50, 0.50), 14);
    enter(E.s4.r2, prog(t, 2.50, 0.50), 14);
    enter(E.s4.r3, prog(t, 3.50, 0.50), 14);
    enter(E.s4.lead, prog(t, 4.30, 0.55), 12);
    /* 真机计划页：滚到三小步，最后停住 */
    E.s4.shot.style.transform = 'translateY(' + (-planScroll * ramp(t, [[1.20, 0], [6.60, 1]])) + 'px)';
  }

  function drawS5(t) {
    enter(E.s5.eyebrow, prog(t, 0.15, 0.50), 12);
    enter(E.s5.title, prog(t, 0.30, 0.60), 18);
    enter(E.s5.foot, prog(t, 2.30, 0.50), 12);

    for (var i = 0; i < E.s5.cards.length; i++) {
      var card = E.s5.cards[i];
      var p = prog(t, 0.70 + i * 0.13, 0.55);
      var at = 3.00 + i * 0.38;
      var lit = Math.max(0, pulse(t, at, 0.55));
      card.style.opacity = String(p);
      card.style.transform = 'translateY(' + (24 * (1 - p) - 8 * lit) + 'px)';
      card.style.borderColor = lit > 0.45 ? '#FFFFFF' : '';
      card.style.background = lit > 0.45 ? '#27272A' : '';
    }
  }

  function drawS6(t) {
    var line = function (el, at, targetY) {
      var p = prog(t, at, 0.70);
      el.style.opacity = String(p);
      el.style.transform = 'translateY(' + lerp(0, targetY - 540, p) + 'px)';
    };
    line(E.s6.l1, 0.40, 400);
    line(E.s6.l2, 3.00, 540);
    line(E.s6.l3, 5.60, 680);
    enter(E.s6.foot, prog(t, 7.20, 0.60), 12);
  }

  function drawS7(t) {
    enter(E.s7.logo, prog(t, 0.10, 0.70), 10, 0, 0.10);
    enter(E.s7.name, prog(t, 0.45, 0.60), 16);
    enter(E.s7.tag, prog(t, 0.85, 0.60), 14);
    enter(E.s7.sub, prog(t, 1.35, 0.60), 12);
  }

  var SCENES = [
    { el: $('s1'), at: 0.0, dur: 4.4, out: 0.35, draw: drawS1 },
    { el: $('s2'), at: 4.4, dur: 12.0, out: 0.35, draw: drawS2 },
    { el: $('s3'), at: 16.4, dur: 12.0, out: 0.35, draw: drawS3 },
    { el: $('s4'), at: 28.4, dur: 9.0, out: 0.35, draw: drawS4 },
    { el: $('s5'), at: 37.4, dur: 6.0, out: 0.35, draw: drawS5 },
    { el: $('s6'), at: 43.4, dur: 6.0, out: 0.35, draw: drawS6 },
    { el: $('s7'), at: 49.4, dur: 4.6, out: 1.10, draw: drawS7 },
  ];

  var DURATION = 54.0;

  function draw(t) {
    for (var i = 0; i < SCENES.length; i++) {
      var s = SCENES[i];
      var local = t - s.at;
      if (local <= -0.5 || local >= s.dur + 0.5) {
        s.el.style.opacity = '0';
        continue;
      }
      var rootP = prog(local, -0.40, 0.50) * (1 - prog(local, s.dur - s.out, s.out));
      s.el.style.opacity = String(rootP);
      if (rootP > 0.002) s.draw(local < 0 ? 0 : local);
    }
  }

  window.__meta = { fps: FPS, duration: DURATION, frames: Math.round(DURATION * FPS), size: [1920, 1080] };
  window.__draw = function (frame) {
    draw(frame / FPS);
    return Promise.race([
      new Promise(function (r) { requestAnimationFrame(function () { r(true); }); }),
      new Promise(function (r) { setTimeout(function () { r(true); }, 40); }),
    ]);
  };

  window.__ready = (function () {
    draw(0);
    return document.fonts.ready.then(function () {
      measure();
      draw(0);
      return Promise.race([
        new Promise(function (r) { requestAnimationFrame(function () { r(true); }); }),
        new Promise(function (r) { setTimeout(function () { r(true); }, 60); }),
      ]);
    });
  })();
})();
