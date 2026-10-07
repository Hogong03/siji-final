import os
os.chdir(r"C:\Users\c3798\Desktop\思迹")

# 1. 撤掉 4.14.js 里我加的 4.14.3 条目
with open('utils/storage/version-log/4.14.js', 'r', encoding='utf-8') as f:
    c = f.read()

# 找到我加的条目块并删除
start_marker = "  {\n    version: '4.14.3',"
end_marker = "  },\n  {\n    version: '4.14.2',"
si = c.find(start_marker)
ei = c.find(end_marker)
if si >= 0 and ei > si:
    c = c[:si] + c[ei + len("  },\n"):]
    with open('utils/storage/version-log/4.14.js', 'w', encoding='utf-8') as f:
        f.write(c)
    print("OK: removed 4.14.3 entry from 4.14.js")
else:
    print("skip: 4.14.3 entry not found")

# 2. manifest 升到 4.16.1 / 4161
with open('manifest.json', 'r', encoding='utf-8') as f:
    m = f.read()
m = m.replace('"versionName" : "4.14.3"', '"versionName" : "4.16.1"')
m = m.replace('"versionCode" : "4143"', '"versionCode" : "4161"')
with open('manifest.json', 'w', encoding='utf-8') as f:
    f.write(m)
print("OK: manifest -> 4.16.1 / 4161")

# 3. 4.16.js 顶部加 4.16.1 条目
with open('utils/storage/version-log/4.16.js', 'r', encoding='utf-8') as f:
    c = f.read()

new_entry = '''  {
    version: '4.16.1',
    date: '2026-10-07',
    title: '功能图标统一重画（plan/bill/diary/edit/calendar）+ 版本历史图标去重 + 功能页图标调大',
    summary: [
      'plan 旧版与 calendar 都是日历图形几乎重复；bill 用 $ 符号不贴合中文场景；diary 与 edit 笔形重复',
      '统一重画为 2px 线性风格：plan→清单待办、bill→钱包、diary→打开的书、edit→笔在方框上、calendar→日历格子；SijiIcon 加 v3 映射，PIL 紧裁剪去四周留白',
      '设置页版本历史图标从 info 改为 clock（与关于思迹的 info 区分）；功能页入口图标 size 从 md 提到 xl',
    ],
    categories: [
      {
        title: '图标优化（4.16.1）',
        items: [
          'static/icons/：新增 plan-v3 / bill-v3 / diary-v3 / edit-v3 / calendar-v3 及对应 -dark.png',
          'components/common/SijiIcon.vue：V3 集合映射，这 5 个图标走 v3 版本路径',
          'pages/settings/index.vue：版本历史图标 info→clock',
          'pages/functions/index.vue：入口卡片图标 size md→xl',
        ],
      },
    ],
  },
'''

c = c.replace(
    'export const V416 = [\n',
    'export const V416 = [\n' + new_entry,
    1
)
with open('utils/storage/version-log/4.16.js', 'w', encoding='utf-8') as f:
    f.write(c)
print("OK: added 4.16.1 entry to 4.16.js")
