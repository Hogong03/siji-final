# -*- coding: utf-8 -*-
"""
4.8.4 scoped 穿透修复：
scoped 内的 .theme-dark 编译成 .theme-dark[data-v-x]，挂 html 的类永远匹配不上。
改为 :global(html.theme-dark) { ... }（实验证明编译后为干净的 html.theme-dark，无 data-v 注入）。
范围：所有「含 theme-dark 且 .vue 带 scoped 或被 scoped .vue @import 的 .scss」文件，
把「.theme-dark {」替换为「:global(html.theme-dark) {」。App.vue 的 style 无 scoped，跳过。
幂等：已是 :global( 形态的跳过。
"""
import re, os, io, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

SKIP = ('node_modules', 'unpackage', '.trash', 'trash', '.zwork', '.git', '.hbuilderx', '.claude', '.mimosa', '.zcode', 'site', 'docs')

def walk(root):
    for dirpath, dirnames, filenames in os.walk(root):
        parts = [p for p in dirpath.replace('\\', '/').lstrip('./').split('/') if p]
        if any(p in SKIP for p in parts):
            dirnames[:] = []
            continue
        for fn in filenames:
            if fn.endswith(('.vue', '.scss')):
                yield os.path.join(dirpath, fn)

# 1) 找出 App.vue（全局无 scoped，跳过）与其余所有含裸 .theme-dark { 的文件
changed = 0
skipped = []
for path in sorted(walk('.')):
    rel = path.replace('\\', '/').lstrip('./')
    with open(path, 'rb') as f:
        raw = f.read().decode('utf-8', errors='replace')
    if 'theme-dark' not in raw:
        continue
    if rel == 'App.vue':
        skipped.append(rel + ' (全局样式，无需穿透)')
        continue
    # 替换所有裸 .theme-dark { （排除已在 :global( 内的）
    new = re.sub(r'(?<![:\w-])\.theme-dark\s*\{', ':global(html.theme-dark) {', raw)
    # 回退误替换：不要动 「:global(html.theme-dark)」 内部的文字（上面正则本身不会命中，因为前缀是 html.）
    if new != raw:
        with open(path, 'wb') as f:
            f.write(new.encode('utf-8'))
        n = len(re.findall(r':global\(html\.theme-dark\)\s*\{', new))
        changed += 1
        print('OK %s (%d 处)' % (rel, n))
    else:
        skipped.append(rel + ' (无可替换的裸 .theme-dark)')

print('=== 替换 %d 文件；跳过 %d ===' % (changed, len(skipped)))
for s in skipped:
    print('  skip:', s)
