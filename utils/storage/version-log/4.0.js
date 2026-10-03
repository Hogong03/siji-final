/**
 * 版本日志数据段：4.1.x / 4.0.x（新版本在前）
 *
 * 发布前合并：4.1.0~4.1.2 合并为一条 4.1.2，4.0.0~4.0.1 合并为一条 4.0.1
 * （应用未发布，补丁号变化的线合并降噪；title 注明整合范围，明细按主题归并，
 * 原文的文件名/技术结论/排坑记录保留）。
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V40 = [
  {
    version: '4.1.2',
    date: '2026-09-17',
    title: '4.1.2（整合 4.1.0~4.1.2，发布前合并）：六级复习资料入库 + 记录阅读页版式重做 + 目录尺修刻度归零并重画',
    summary: [
      '新增 6 篇六级复习资料（标签「复习资料」，与 4 章方法的「技巧」分开筛）：高频词速记/写作模板库/翻译高频词组/听力场景词/阅读同义替换表/考场时间分配；内容对准实测短板（听力 140 / 阅读 131 / 写作翻译 96）',
      '记录阅读页版式重做（本项目阅读模式的设计基线）：一屏三层信息 —— 封面头部 → 章节（编号 01 + 加粗标题）→ 正文（28rpx、行高 1.85）；顶部当前章节、底部 3rpx 进度条、滚过一屏出「回到顶部」、读完「— 读完 —」收尾',
      '修目录尺刻度全堆顶部的真因：splitSections 只返回 key/index/title/level/body 没有 percent，buildOutlineTicks 把每条都算成 0% —— 补上 percent（与 extractOutline 同一套行位置算法）并加回归测试钉死',
      '目录尺重画：刻度 10×2rpx 浅灰改 20×4rpx 深灰、当前章节 34×6rpx 纯黑；新增脊柱线；视口指示改 10rpx 圆角块（观感是「读到哪了」不是「滚动条」）；触控区 52→64rpx',
      '藏掉页面系统滚动条：阅读页 :show-scrollbar="false"（App/小程序）+ H5 条件编译藏 ::-webkit-scrollbar + .read-page overflow: hidden'
    ],
    categories: [
      {
        title: '六级复习资料（4.1.0）',
        items: [
          'utils/storage/cet6-material.js（新增，约 500 行纯数据）：VOCAB / WRITING_LIB / TRANSLATION_LIB / LISTENING_LIB / READING_LIB / EXAM_FLOW 六篇；每篇按 ## 分小节，阅读页目录尺可直接跳',
          'utils/storage/cet6-tips.js：CET6_TIPS 改「4 章方法 + 6 篇资料」（展开 CET6_MATERIALS），新增导出 CET6_MATERIAL_TAG，两个标签都注册进「学习」种类；CET6_SEED_VERSION 2→3（老用户自动补发）'
        ]
      },
      {
        title: '阅读页版式（4.1.0）',
        items: [
          'pages/diary/read.vue + read.scss：封面头部（字数/小节数/标签/当前章节/编辑）、章节编号（sectionNumbers 只给有标题的节编号）、正文交 MarkdownRenderer（:deep 兜字号行高）、读完收尾、回到顶部、底部进度条；深浅色两套色值给全',
          'utils/text-outline.js 新增 readingProgress（视口底部÷总高度，夹 0-100）与 sectionAtProgress（进度落在哪一节）；composables/useOutlineRuler.js 的 syncScroll 顺带算这两个 ref'
        ]
      },
      {
        title: '目录尺刻度修复（4.1.1）',
        items: [
          'utils/text-outline.js：splitSections 的 push 增加 percent —— 有标题的节取该标题在 extractOutline 里的 percent，前言节为 0；节与刻度一一对应',
          'tests/text-outline.test.js（+3 例）：节与 outline 的 percent 一一对齐、刻度单调递增且末条 > 70%、带前言的文档前言为 0；tests/cet6-tips.test.js（+1 例）：10 篇资料逐篇断言刻度数与末条位置'
        ]
      },
      {
        title: '目录尺重画与滚动条（4.1.2）',
        items: [
          'pages/diary/read.scss：.read-ruler 宽 52→64rpx、left 12→0；新增 .ruler-spine；.ruler-viewport 改 10rpx 圆角块（left 26rpx 与脊柱同心）；.ruler-bar 20×4rpx/#A1A1AA、激活 34×6rpx/#000000；.ruler-preview 起点 48→66rpx；深色同步（脊柱 #18181B、刻度 #52525B、激活纯白）',
          '系统滚动条：read.vue 的 scroll-view 加 :show-scrollbar="false"；.read-page 加 overflow: hidden；H5 专段（#ifdef H5）藏 ::-webkit-scrollbar'
        ]
      },
      {
        title: '测试（4.1.0）',
        items: [
          'tests/cet6-tips.test.js：篇目数 4→10、两套标签分开筛（方法 4 / 资料 6）、两个标签都进注册表、client_id 前缀 tip_/mat_ 都合法；tests/text-outline.test.js（+5 例）：readingProgress 四种取值与脏数据、sectionAtProgress 按进度落节',
          '全量 75 文件 / 1088 用例全绿（npx vitest run --maxWorkers=2，exit 0）'
        ]
      }
    ]
  },
  {
    version: '4.0.1',
    date: '2026-09-17',
    title: '4.0.1（整合 4.0.0~4.0.1，发布前合并）：版本号统一到 4.x 修「一直显示 1.0.0」+ 版本历史页区分「当前运行」与「日志最新」',
    summary: [
      '修版本号长期显示 v1.0.0：基座里 plus.runtime.version 是宿主 App 版本、H5 的 __uniConfig.versionName 不保证存在，两条路都回落默认值；现在以「编译进包的 manifest.versionName」为唯一事实来源（构建期内联，永远等于正在跑的代码）',
      '版本号跨过 3.x 直接用 4.0.0 作里程碑：3.x 累计了 Agent 工具循环 / 计划模型重做（主计划直含子计划）/ 记录长文阅读页与目录尺 / 读网址与读文件 / AI 效果自检 / 开场对话整合与到点提醒等成规模改动',
      '版本历史页不再把「日志最新」写成「当前版本」：分开展示「当前运行 vX」（getVersion）与「日志已到 vY」，不一致时下方直接给出下一步（删 unpackage/dist 重新编译 + 覆盖安装）',
      '保留 App 端资源包版本读取（primeAppVersion）：OTA 更新过 wgt 时以资源包版本为准'
    ],
    categories: [
      {
        title: '版本号（4.0.0）',
        items: [
          "utils/version-check.js：getCurrentVersion 改为「manifest.versionName 优先 → App 资源包版本（_appVersion）→ 平台自带版本 → 兜底」；小程序端仍优先平台版本号，H5 仍优先 __uniConfig",
          'manifest.json：versionName 4.0.0 / versionCode 400；版本日志新增分段 utils/storage/version-log/4.0.js 并在 version-data.js 顶部接线'
        ]
      },
      {
        title: '版本自证（4.0.1）',
        items: [
          'pages/settings/sub/version-history.vue：banner 改「当前运行 v{getVersion()}」；徽标在不一致时显示「日志已到 v{latest}」；新增 .outdated-hint 提示条（含深色模式样式）',
          'utils/version-check.js：新增 isRunningOlderThan(latest)（纯判定，compareVersion < 0，拿不到日志版本时不误报）—— 为「更新不生效」（旧包没装上去）准备的提示'
        ]
      },
      {
        title: '测试',
        items: [
          'tests/version-check.test.js：断言 getVersion() 等于 manifest.versionName（再被回落成 1.0.0 会立刻红）+ isRunningOlderThan 四种情形（日志更旧/相同/更高/空值不误报）',
          'tests/version-history.test.js：默认历史首条与 manifest.versionName 对齐（跨分段后继续生效）；全量 75 文件 / 1083 用例全绿'
        ]
      }
    ]
  }
]
