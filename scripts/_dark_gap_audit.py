# -*- coding: utf-8 -*-
# 深色覆盖缺口审计：找「浅色白底容器类，但 theme-dark 块里没有对应覆盖」的文件
import re, os, io, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

SKIP = ('node_modules', 'unpackage', '.trash', 'trash', '.zwork', '.git', '.hbuilderx', '.claude', '.mimosa', '.zcode', 'site', 'docs')
WHITE = re.compile(r'#(FFF|FFFFFF|FAFAFA|F4F4F5|f4f4f5|fafafa|fff)\b', re.I)

def walk(root):
    for dirpath, dirnames, filenames in os.walk(root):
        rel = dirpath.replace('\\', '/').lstrip('./')
        parts = [p for p in rel.split('/') if p]
        if any(p in SKIP for p in parts):
            dirnames[:] = []
            continue
        for fn in filenames:
            if fn.endswith(('.vue', '.scss')):
                yield os.path.join(dirpath, fn)

issues = []
for path in walk('.'):
    with open(path, 'rb') as f:
        raw = f.read().decode('utf-8', errors='replace')
    if 'theme-dark' not in raw:
        continue
    # 找所有顶层选择器块（非嵌套）：selector { ... } 且含白底；排除 .theme-dark 自身（块内反白是深色设计）
    for m in re.finditer(r'(?m)^([ \t]*)(\.[A-Za-z][\w-]*)\s*\{', raw):
        indent, cls = m.group(1), m.group(2)
        if indent or cls == '.theme-dark':  # 只看顶层且排除深色块自身
            continue
        brace = m.end() - 1
        depth, i = 0, brace
        while i < len(raw):
            if raw[i] == '{':
                depth += 1
            elif raw[i] == '}':
                depth -= 1
                if depth == 0:
                    break
            i += 1
        body = raw[brace:i]
        if not WHITE.search(body):
            continue
        # theme-dark 块里有没有这个类的深色覆盖（全文任一 theme-dark 块）
        covered = False
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
            block_body = raw[db:i]
            if re.search(re.escape(cls) + r'\s*[\{,]', block_body):
                covered = True
                break
        if not covered:
            issues.append('%s: %s 有白底但 theme-dark 未覆盖' % (path.replace('\\', '/').lstrip('./'), cls))

seen = set()
for line in issues:
    key = line.split(':')[0] + line.split(': ')[-1].split(' ')[0] if ': ' in line else line
    if key not in seen:
        seen.add(key)
        print(line)
print('--- 共 %d 处 ---' % len(issues))
