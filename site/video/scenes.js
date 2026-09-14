/* 思迹介绍片 · 时间轴
 *
 * 全片动效是"时间的纯函数"：draw(t) 根据绝对时间算出每个元素的 opacity / transform。
 * 不使用 CSS transition 或 requestAnimationFrame 动画，
 * 因此同一帧号任何时候渲染都得到同一张画面，便于逐帧导出与增量重渲染。
 *
 * 时间轴（秒）：
 *   0.0 -  4.4  品牌开场
 *   4.4 - 15.9  对话即记录（记录 / 账单 / 计划 / 修正）
 *  15.9 - 24.4  计划只给小步（打卡与打卡描述）
 *  24.4 - 30.4  一个入口五件事
 *  30.4 - 39.4  三条设计原则
 *  39.4 - 44.0  收尾
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

  /* 逐字打字：把整句按进度截断 */
  function type(el, text, t, at, dur) {
    if (!el) return;
    el.textContent = text.slice(0, Math.round(raw(t, at, dur) * text.length));
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
      phone: $('s2-phone'), chat: $('s2-chat'), eyebrow: $('s2-eyebrow'), title: $('s2-title'), lead: $('s2-lead'),
      b1: $('s2-b1'), b2: $('s2-b2'), b3: $('s2-b3'),
      m1: $('s2-m1'), m2: $('s2-m2'), m3: $('s2-m3'), m4: $('s2-m4'), m5: $('s2-m5'), m6: $('s2-m6'),
      c1: $('s2-c1'), c1v: $('s2-c1-v'), c1tag: $('s2-c1-tag'), c2: $('s2-c2'),
    },
    s3: {
      card: $('s3-card'), eyebrow: $('s3-eyebrow'), title: $('s3-title'),
      r1: $('s3-r1'), r2: $('s3-r2'), r3: $('s3-r3'),
      check1: $('s3-check1'), t1: $('s3-t1'), note1: $('s3-note1'),
      check2: $('s3-check2'), t2: $('s3-t2'), note2: $('s3-note2'), foot: $('s3-foot'),
    },
    s4: {
      eyebrow: $('s4-eyebrow'), title: $('s4-title'), foot: $('s4-foot'),
      cards: [$('s4-c1'), $('s4-c2'), $('s4-c3'), $('s4-c4'), $('s4-c5')],
    },
    s5: { l1: $('s5-l1'), l2: $('s5-l2'), l3: $('s5-l3'), foot: $('s5-foot') },
    s6: { logo: $('s6-logo'), name: $('s6-name'), tag: $('s6-tag'), sub: $('s6-sub') },
  };

  var AI_1 = '记下了：餐饮 · 168 元。';
  var AI_2 = '拆成三小步，先动起来。';
  var AI_3 = '已改成 ¥198 · 分类不变。';

  var scrollMax = 0;

  /* 量一次聊天区溢出高度，用来驱动手机内的滚动 */
  function measure() {
    var screen = document.querySelector('#s2 .phone__screen');
    if (!screen || !E.s2.chat) return;
    var avail = screen.clientHeight - 52;
    scrollMax = Math.max(0, Math.round(E.s2.chat.scrollHeight - avail + 16));
  }

  /* ---------- 分镜 ---------- */
  function drawS1(t) {
    enter(E.s1.logo, prog(t, 0.30, 0.70), 10, 0, 0.10);
    enter(E.s1.name, prog(t, 0.70, 0.60), 18);
    enter(E.s1.sub, prog(t, 1.10, 0.60), 14);
    var rp = prog(t, 1.55, 0.70);
    E.s1.rule.style.opacity = String(rp);
    E.s1.rule.style.transform = 'scaleX(' + rp + ')';
    enter(E.s1.tag, prog(t, 1.90, 0.70), 16);
  }

  function drawS2(t) {
    enter(E.s2.phone, prog(t, -0.20, 0.90), 40);
    enter(E.s2.eyebrow, prog(t, 0.35, 0.50), 12);
    enter(E.s2.title, prog(t, 0.50, 0.60), 18);
    enter(E.s2.lead, prog(t, 0.75, 0.60), 16);
    enter(E.s2.b1, prog(t, 3.00, 0.50), 14);
    enter(E.s2.b2, prog(t, 7.10, 0.50), 14);
    enter(E.s2.b3, prog(t, 5.80, 0.50), 14);

    enter(E.s2.m1, prog(t, 0.90, 0.35), 14);
    enter(E.s2.m2, prog(t, 1.80, 0.30), 10);
    type(E.s2.m2, AI_1, t, 1.85, 0.80);
    enter(E.s2.c1, prog(t, 2.70, 0.45), 16);
    enter(E.s2.m3, prog(t, 4.10, 0.35), 14);
    enter(E.s2.m4, prog(t, 4.80, 0.30), 10);
    type(E.s2.m4, AI_2, t, 4.85, 0.60);
    enter(E.s2.c2, prog(t, 5.60, 0.50), 18);
    enter(E.s2.m5, prog(t, 7.30, 0.35), 14);
    enter(E.s2.m6, prog(t, 8.10, 0.30), 10);
    type(E.s2.m6, AI_3, t, 8.15, 0.70);

    /* 数字就地改：不改记录结构，只改金额 */
    var fixed = t >= 9.30;
    E.s2.c1v.textContent = fixed ? '-¥198' : '-¥168';
    E.s2.c1tag.textContent = fixed ? '已更新' : '已保存';
    var bump = pulse(t, 9.30, 0.70);
    E.s2.c1.style.borderColor = bump > 0.4 ? '#FFFFFF' : '';
    E.s2.c1.style.background = bump > 0.4 ? '#27272A' : '';

    E.s2.chat.style.transform = 'translateY(' + (-scrollMax * ramp(t, [[8.10, 0], [9.60, 1]])) + 'px)';
  }

  function drawS3(t) {
    enter(E.s3.eyebrow, prog(t, 0.20, 0.50), 12);
    enter(E.s3.title, prog(t, 0.35, 0.60), 18);
    enter(E.s3.card, prog(t, 0.25, 0.70), 28);
    enter(E.s3.r1, prog(t, 1.50, 0.50), 14);
    enter(E.s3.r2, prog(t, 2.50, 0.50), 14);
    enter(E.s3.r3, prog(t, 3.50, 0.50), 14);
    enter(E.s3.foot, prog(t, 4.60, 0.50), 12);

    var p1 = pulse(t, 2.20, 0.45);
    E.s3.check1.textContent = '✓';
    E.s3.check1.className = t >= 2.20 ? 'check check--on' : 'check';
    E.s3.check1.style.transform = 'scale(' + (1 + 0.22 * p1) + ')';
    E.s3.t1.className = t >= 2.20 ? 'steprow__title steprow__title--done' : 'steprow__title';
    enter(E.s3.note1, prog(t, 2.60, 0.40), 8);

    var p2 = pulse(t, 5.60, 0.45);
    E.s3.check2.textContent = '✓';
    E.s3.check2.className = t >= 5.60 ? 'check check--on' : 'check';
    E.s3.check2.style.transform = 'scale(' + (1 + 0.22 * p2) + ')';
    E.s3.t2.className = t >= 5.60 ? 'steprow__title steprow__title--done' : 'steprow__title';
    enter(E.s3.note2, prog(t, 6.00, 0.40), 8);
  }

  function drawS4(t) {
    enter(E.s4.eyebrow, prog(t, 0.15, 0.50), 12);
    enter(E.s4.title, prog(t, 0.30, 0.60), 18);
    enter(E.s4.foot, prog(t, 2.30, 0.50), 12);

    for (var i = 0; i < E.s4.cards.length; i++) {
      var card = E.s4.cards[i];
      var p = prog(t, 0.70 + i * 0.13, 0.55);
      var at = 3.00 + i * 0.38;
      var lit = Math.max(0, pulse(t, at, 0.55));
      card.style.opacity = String(p);
      card.style.transform = 'translateY(' + (24 * (1 - p) - 8 * lit) + 'px)';
      card.style.borderColor = lit > 0.45 ? '#FFFFFF' : '';
      card.style.background = lit > 0.45 ? '#27272A' : '';
    }
  }

  function drawS5(t) {
    var line = function (el, at, targetY) {
      var p = prog(t, at, 0.70);
      el.style.opacity = String(p);
      el.style.transform = 'translateY(' + lerp(0, targetY - 540, p) + 'px)';
    };
    line(E.s5.l1, 0.40, 400);
    line(E.s5.l2, 3.00, 540);
    line(E.s5.l3, 5.60, 680);
    enter(E.s5.foot, prog(t, 7.20, 0.60), 12);
  }

  function drawS6(t) {
    enter(E.s6.logo, prog(t, 0.10, 0.70), 10, 0, 0.10);
    enter(E.s6.name, prog(t, 0.45, 0.60), 16);
    enter(E.s6.tag, prog(t, 0.85, 0.60), 14);
    enter(E.s6.sub, prog(t, 1.35, 0.60), 12);
  }

  var SCENES = [
    { el: $('s1'), at: 0.0, dur: 4.4, out: 0.35, draw: drawS1 },
    { el: $('s2'), at: 4.4, dur: 11.5, out: 0.35, draw: drawS2 },
    { el: $('s3'), at: 15.9, dur: 8.5, out: 0.35, draw: drawS3 },
    { el: $('s4'), at: 24.4, dur: 6.0, out: 0.35, draw: drawS4 },
    { el: $('s5'), at: 30.4, dur: 9.0, out: 0.35, draw: drawS5 },
    { el: $('s6'), at: 39.4, dur: 4.6, out: 1.10, draw: drawS6 },
  ];

  var DURATION = 44.0;

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
