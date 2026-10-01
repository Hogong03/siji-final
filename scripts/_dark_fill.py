# -*- coding: utf-8 -*-
"""
4.8.2 深色缺口批量补齐（终版）：
把 theme-dark 块之前、且 theme-dark 内无覆盖的「含白底/浅边框」顶层类，
复制进 theme-dark 块，按 Zinc 深色映射改写颜色：
  背景 #FFFFFF/#FFF/#F4F4F5 -> #27272A   （白卡/灰输入 -> 深卡）
  背景 #FAFAFA              -> #18181B   （浅灰底 -> 页面底）
  边框 #E4E4E7/#F4F4F5      -> #3F3F46   （浅边框 -> 深边框）
  文字 #18181B              -> #FAFAFA   （深字 -> 白字）
  背景 #000000 主按钮/FAB   -> #FAFAFA   （品牌反白，按类名 INVERT 判定）
幂等：theme-dark 内已有同名类则跳过。
"""
import re, os, io, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

SKIP = ('node_modules', 'unpackage', '.trash', 'trash', '.zwork', '.git', '.hbuilderx', '.claude', '.mimosa', '.zcode', 'site', 'docs')
TARGET_WHITE = re.compile(r'background(?:-color)?\s*:\s*#(?:FFF\b|FFFFFF|FAFAFA|F4F4F5)', re.I)
TOP_CLS = re.compile(r'(?m)^\.([A-Za-z][\w-]*)\s*\{')
INVERT = ('btn-save', 'btn-confirm', 'btn-primary', 'fab', 'btn-send', 'btn-use')

# 声明级颜色映射：给一行 CSS，返回映射后的行
BG_MAP = {
    '#FFFFFF': '#27272A', '#FFF': '#27272A',
    '#F4F4F5': '#27272A',
    '#FAFAFA': '#18181B',
}
BORDER_MAP = {
    '#E4E4E7': '#3F3F46',
    '#F4F4F5': '#3F3F46',
    '#D4D4D8': '#52525B',
}
TEXT_MAP = {
    '#18181B': '#FAFAFA',
    '#000000': '#FAFAFA',
}

def map_line(ln, cls):
    low = ln.lower()
    c = cls.lower()
    invert = any(k in c for k in INVERT)
    # 背景
    def bg_repl(m):
        v = m.group(0).upper()
        if invert and v in ('#000000', '#18181B'):
            return '#FAFAFA'  # 反白主按钮
        return BG_MAP.get(v, v)
    if re.search(r'background(?:-color)?\s*:', low):
        ln = re.sub(r'#[0-9A-Fa-f]{3,6}\b', bg_repl, ln)
        return ln
    # 边框
    if re.search(r'border[^:]*\s*:', low):
        def bd_repl(m):
            v = m.group(0).upper()
            return BORDER_MAP.get(v, v)
        ln = re.sub(r'#[0-9A-Fa-f]{3,6}\b', bd_repl, ln)
        return ln
    # 文字色
    if re.search(r'\bcolor\s*:', low):
        def tx_repl(m):
            v = m.group(0).upper()
            return TEXT_MAP.get(v, v)
        ln = re.sub(r'#[0-9A-Fa-f]{3,6}\b', tx_repl, ln)
        return ln
    return ln

def map_body(body, cls):
    out = []
    for ln in body.split('\n'):
        out.append(map_line(ln.rstrip('\r'), cls))
    return out

def block_span(raw, open_idx):
    depth, i = 0, open_idx
    while i < len(raw):
        if raw[i] == '{':
            depth += 1
        elif raw[i] == '}':
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return -1

def walk(root):
    for dirpath, dirnames, filenames in os.walk(root):
        parts = [p for p in dirpath.replace('\\', '/').lstrip('./').split('/') if p]
        if any(p in SKIP for p in parts):
            dirnames[:] = []
            continue
        for fn in filenames:
            if fn.endswith(('.vue', '.scss')):
                yield os.path.join(dirpath, fn)

total = 0
for path in sorted(walk('.')):
    with open(path, 'rb') as f:
        raw = f.read().decode('utf-8', errors='replace')
    dm = re.search(r'\.theme-dark\s*\{', raw)
    if not dm:
        continue
    dk_open = dm.end() - 1
    dk_close = block_span(raw, dk_open)
    if dk_close < 0:
        continue
    dk_body = raw[dk_open:dk_close + 1]

    pending = []
    for m in TOP_CLS.finditer(raw):
        cls = m.group(1)
        if cls == 'theme-dark':
            break
        if m.start() > dk_open:
            break
        cls_sel = '.' + cls
        brace = raw.find('{', m.start())
        close = block_span(raw, brace)
        if close < 0 or close <= m.start():
            continue
        body = raw[brace + 1:close]
        if not TARGET_WHITE.search(body):
            continue
        if re.search(re.escape(cls_sel) + r'\s*[\{,]', dk_body):
            continue
        pending.append((cls_sel, body))

    if not pending:
        continue
    nl = '\r\n' if '\r\n' in raw else '\n'
    add = ''
    for cls_sel, body in pending:
        mapped = map_body(body, cls_sel)
        add += '  ' + cls_sel + ' {' + nl
        for ln in mapped:
            if not ln.strip():
                continue
            add += '    ' + ln.strip() + nl
        add += '  }' + nl
    raw2 = raw[:dk_close] + nl + add.rstrip() + nl + raw[dk_close:]
    with open(path, 'wb') as f:
        f.write(raw2.encode('utf-8'))
    total += len(pending)
    print('OK %s (+%d: %s)' % (path.replace('\\', '/').lstrip('./'), len(pending), ', '.join(c for c, _ in pending)))

print('=== 共补 %d 类 ===' % total)
