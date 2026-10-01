# -*- coding: utf-8 -*-
# 专项审计：所有页面壳类（*page*）的浅色白底是否在 theme-dark 有覆盖
import re, os, io, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

SKIP = ('node_modules', 'unpackage', '.trash', 'trash', '.zwork', '.git', '.hbuilderx', '.claude', '.mimosa', '.zcode', 'site', 'docs')
WHITE = re.compile(r'background(?:-color)?\s*:\s*#(?:FFF\b|FFFFFF|FAFAFA|F4F4F5)', re.I)
PAGE_CLS = re.compile(r'(?m)^\.([\w-]*page[\w-]*)\s*\{', re.I)

def theme_dark_blocks(raw):
    out = []
    for dm in re.finditer(r'\.theme-dark\s*\{', raw):
        db = dm.end() - 1
        depth, i = 0, db
        while i < len(raw):
            if raw[i] == '{':
                depth += 1
            elif raw[i] == '}':
                depth -= 1
                if depth == 0:
                    break
            i += 1
        out.append(raw[db:i + 1])
    return out

def walk(root):
    for dirpath, dirnames, filenames in os.walk(root):
        parts = [p for p in dirpath.replace('\\', '/').lstrip('./').split('/') if p]
        if any(p in SKIP for p in parts):
            dirnames[:] = []
            continue
        for fn in filenames:
            if fn.endswith(('.vue', '.scss')):
                yield os.path.join(dirpath, fn)

count = 0
for path in walk('.'):
    with open(path, 'rb') as f:
        raw = f.read().decode('utf-8', errors='replace')
    if 'theme-dark' not in raw:
        continue
    blocks = theme_dark_blocks(raw)
    for m in PAGE_CLS.finditer(raw):
        cls = '.' + m.group(1)
        # 浅色声明体（从类声明起的第一个块）
        brace = raw.find('{', m.start())
        if brace < 0:
            continue
        depth, i = 0, brace
        while i < len(raw):
            if raw[i] == '{':
                depth += 1
            elif raw[i] == '}':
                depth -= 1
                if depth == 0:
                    break
            i += 1
        if not WHITE.search(raw[brace:i]):
            continue
        covered = any(re.search(re.escape(cls) + r'\s*[\{,]', b) for b in blocks)
        if not covered:
            count += 1
            print('%s: %s 白底页面壳未盖' % (path.replace('\\', '/').lstrip('./'), cls))
print('--- 页面壳缺口共 %d 处 ---' % count)
