// 聊天页 · 打开会话面板并切到演示会话
// 冷启动每次都会新建一条对话（3.10.0 的设计），所以要截图里的对话内容，
// 必须像真人一样：点右上角菜单 → 在列表里点「和阿伟吃饭」。
(async function () {
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  var btn = document.querySelector('.nav-menu-btn');
  if (!btn) return '找不到菜单按钮 .nav-menu-btn';
  btn.click();
  await sleep(800);

  var rows = Array.prototype.slice.call(document.querySelectorAll('.conv-item'));
  if (!rows.length) {
    var alt = Array.prototype.slice.call(document.querySelectorAll('[class*="conv-item"]'));
    return '面板里没有 .conv-item，候选：' + alt.map(function (e) { return (e.className || '') + ':' + (e.innerText || '').slice(0, 10); }).join(' / ');
  }

  var target = rows.filter(function (r) { return (r.innerText || '').indexOf('和阿伟吃饭') >= 0; })[0];
  if (!target) return '列表里没有演示会话，现有：' + rows.map(function (r) { return (r.innerText || '').slice(0, 12); }).join(' / ');

  target.click();
  await sleep(1000);
  return '已切到：' + (target.innerText || '').slice(0, 20);
})();
