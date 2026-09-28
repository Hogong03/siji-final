/**
 * 版本日志数据段：3.8.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V38 = [
  {
    version: '3.8.0',
    date: '2026-09-17',
    title: '3.8.0 内置 12 条六级技巧（标签：技巧），复习时直接翻记录',
    summary: [
      '记录里内置 12 条六级技巧，标签统一是「技巧」，写作 / 阅读 / 听力 / 翻译各 3 条 —— 复习入口：记录 → 时间范围选「全部时间」→ 点标签「技巧」，12 条一次看全',
      '内容对准实测分数里最吃亏的三块：听力 140（视听一致：听到什么选什么，最容易短期提分）、阅读 131（选词填空限时 5 分钟、做不完全选同一项，把时间让给仔细阅读）、写作+翻译 96（简单句优先、绝不空着、写完只查主谓一致 / 时态 / 单复数）',
      '落进当月记录分片，按 client_id 增量补发（与 plan 的内置模板同一套路）：以后加技巧自动补，用户删掉的不会被塞回来',
      '判重是跨月的：记录按月分片，只看当月会导致换月启动再补一份、标签筛选出现两套一样的技巧 —— 现在扫近 13 个月分片再判，全局只留一份',
      '「技巧」标签写进标签注册表并归到「学习」种类，标签筛选与标签色都能直接用'
    ],
    categories: [
      {
        title: '内置六级技巧（3.8.0）',
        items: [
          'utils/storage/cet6-tips.js（新增）：CET6_TIPS 12 条（写作·三段式骨架 / 写作·简单句优先 / 写作·只背三个句型；阅读·选词填空限时 5 分钟 / 阅读·题干定位与同义替换 / 阅读·段落匹配先扫题干；听力·视听一致 / 听力·预读选项 / 听力·答案常在三处；翻译·简单句不空着 / 翻译·中国文化高频词 / 翻译·写完只查三件事）',
          'utils/storage/cet6-tips.js：ensureCet6Tips(now) 幂等补发（返回 { added, month, ids }）；candidateDiaryKeys 取近 13 个月分片 + getStorageInfoSync 的 diary_* key；existingIdsAcrossMonths 用含软删的原始列表判重；写入时按数组顺序给 created_at 递增，列表里顺序稳定',
          'utils/storage.js：门面转出 ensureCet6Tips / CET6_TIPS / CET6_TIP_IDS / CET6_TIP_TAG；App.vue 的 appReady 里在 ensureDefaultTemplates() 之后、rebuildIndex() 之前调用，搜索索引能带上它们'
        ]
      },
      {
        title: '测试（3.8.0）',
        items: [
          'tests/cet6-tips.test.js（新增 11 例）：12 条全写进当月分片且都带「技巧」标签 / 标签进注册表并归到学习 / 四类题型各 3 条 / client_id 唯一且前缀正确 / 内容含视听一致与选词填空等关键结论 / 重复调用 added 为 0 / 用户删掉的（软删）不复活 / 已有用户记录时是追加不覆盖 / 只补缺的那几条 / 跨月不重复 / 近 13 个月之外的旧技巧也不重复补',
          '全量：71 文件 / 1025 用例全绿（npx vitest run --maxWorkers=2，exit 0）'
        ]
      }
    ]
  }
]
