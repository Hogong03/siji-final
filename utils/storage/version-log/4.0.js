/**
 * 版本日志数据段：4.0.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V40 = [
  {
    version: '4.1.0',
    date: '2026-09-17',
    title: '4.1.0 六级复习资料入库（6 篇）+ 记录阅读页版式重做（进度条 / 当前章节 / 目录尺细化）',
    summary: [
      '新增 6 篇六级复习资料，标签「复习资料」（与 4 章方法的「技巧」分开筛）：高频词速记（6 大话题按搭配记）/ 写作模板库（骨架 + 万能句 10 条 + 过渡词 + 替换词）/ 翻译高频词组（文化教育经济社会 + 万能句型 6 条）/ 听力场景词（校园职场交通医疗购物 + 讲座框架词）/ 阅读同义替换表（动词名词连接词 40 组 + 三个选项陷阱）/ 考场时间分配与流程（整卷顺序、取舍、考前一周与当天）',
      '内容对准实测短板：听力 140（场景词 + 视听一致）、阅读 131（同义替换 + 选词填空限时 5 分钟）、写作翻译 96（模板句 + 简单句优先）；每篇按 ## 分小节，阅读页目录尺可直接跳',
      '阅读页版式重做（本项目阅读模式的设计基线）：一屏只有三层信息 —— 封面头部（元信息 + 大标题 + 编辑）/ 章节（两位编号 01 + 加粗标题，去掉上一版的粗黑竖线）/ 正文（28rpx、行高 1.85、左 40rpx 留白，有尺时 76rpx）',
      '阅读辅助三件：顶部右侧常驻「当前章节 3/8」（滚动跟着变）、底部 3rpx 阅读进度条（按视口底部 ÷ 总高度算）、滚过一屏出现「回到顶部」；目录尺刻度细化（未选中 10rpx 浅灰 / 选中 22rpx 纯黑），拖动时浮出小节名',
      '最后加一句「— 读完 —」收尾，读完有结束感；深浅色两套色值都给全'
    ],
    categories: [
      {
        title: '六级复习资料（4.1.0）',
        items: [
          'utils/storage/cet6-material.js（新增，约 500 行纯数据）：VOCAB / WRITING_LIB / TRANSLATION_LIB / LISTENING_LIB / READING_LIB / EXAM_FLOW 六篇 + CET6_MATERIALS 清单',
          'utils/storage/cet6-tips.js：CET6_TIPS 改为「4 章方法 + 6 篇资料」（展开 CET6_MATERIALS）；每篇带自己的 tag；新增导出 CET6_MATERIAL_TAG（复习资料）；落库与刷新时按各自 tag 打标签；两个标签都注册进「学习」种类；CET6_SEED_VERSION 2 → 3（老用户自动补发这 6 篇）',
        ]
      },
      {
        title: '阅读页版式（4.1.0）',
        items: [
          'pages/diary/read.vue + read.scss：封面头部（字数 / 小节数 / 标签 / 当前章节 / 编辑）、章节编号（sectionNumbers 只给有标题的节编号）、正文交给 MarkdownRenderer（:deep 兜字号行高）、读完收尾、回到顶部按钮、底部进度条',
          'utils/text-outline.js：新增 readingProgress（视口底部 ÷ 总高度，夹在 0-100）与 sectionAtProgress（进度落在哪一节）',
          'composables/useOutlineRuler.js：syncScroll 顺带算 readProgress 与 activeSection；对外多返回这两个 ref'
        ]
      },
      {
        title: '测试（4.1.0）',
        items: [
          'tests/cet6-tips.test.js：篇目数 4 → 10、两套标签分开筛（方法 4 / 资料 6）、两个标签都进注册表、client_id 前缀 tip_ / mat_ 都合法',
          'tests/text-outline.test.js（+5 例）：readingProgress 的四种取值与脏数据、sectionAtProgress 按进度落节与空输入',
          '全量：75 文件 / 1088 用例全绿（npx vitest run --maxWorkers=2，exit 0）'
        ]
      }
    ]
  },
  {
    version: '4.0.1',
    date: '2026-09-17',
    title: '4.0.1 版本历史页不再把「日志最新」写成「当前版本」（旧构建一眼可辨）',
    summary: [
      '真 Bug：版本历史页顶部那行写着「当前版本 vX」，显示的却是版本日志里最新的一条 —— 用户在自己的 3.5.16 构建上看到「当前版本 v3.5.16」，据此以为项目版本低',
      '现在分开展示：「当前运行 v4.0.1」（来自 getVersion，编译进包的 manifest）与「日志已到 vY」；两者不一致时下方直接给出下一步（删 unpackage/dist 重新编译 + 覆盖安装）',
      'utils/version-check.js 新增 isRunningOlderThan(latest)：用已有的 compareVersion 判定运行版本是否落后，拿不到日志版本时不误报',
      '背景：用户手机上装的是 9/15 打的 3.5.16 包 —— 9/17 的 01:29 / 14:53 / 14:57 三个新包都没装上去；这条提示就是为这种「更新不生效」准备的'
    ],
    categories: [
      {
        title: '版本自证（4.0.1）',
        items: [
          'pages/settings/sub/version-history.vue：banner 改为「当前运行 v{getVersion()}」；徽标在不一致时显示「日志已到 v{latest}」；新增 .outdated-hint 提示条（含深色模式样式）',
          'utils/version-check.js：新增 isRunningOlderThan(latest)（纯判定，compareVersion < 0）'
        ]
      },
      {
        title: '测试（4.0.1）',
        items: [
          'tests/version-check.test.js：新增一例覆盖 isRunningOlderThan 的四种情形（日志更旧 / 相同 / 更高 / 空值不误报）',
          '全量：75 文件 / 1083 用例全绿（npx vitest run --maxWorkers=2，exit 0）'
        ]
      }
    ]
  },
  {
    version: '4.0.0',
    date: '2026-09-17',
    title: '4.0.0 版本号统一到 4.x：修「版本号一直显示 1.0.0」，并给 3.x 的改动一个明确的里程碑号',
    summary: [
      '修版本号：设置页与开发者反馈导出长期显示 v1.0.0 —— 基座里 plus.runtime.version 是宿主 App 的版本、H5 的 __uniConfig.versionName 也不保证存在，两条路都回落到了默认值 1.0.0；现在以「编译进包的 manifest.versionName」为唯一事实来源（构建期内联，永远等于正在跑的这份代码）',
      '版本号跨过 3.x：3.x 这一线累计了 Agent 工具循环 / 计划模型重做（主计划直含子计划）/ 记录长文阅读页与目录尺 / 读网址与读文件 / AI 效果自检 / 开场对话整合与到点提醒等成规模改动，用 4.0.0 作为里程碑',
      '这一版起，关于页、版本历史页、开发者反馈导出头部显示的版本号与 manifest.json 一致，不再出现 1.0.0',
      '同时保留 App 端资源包版本读取（primeAppVersion）：OTA 更新过 wgt 时以资源包版本为准'
    ],
    categories: [
      {
        title: '版本号（4.0.0）',
        items: [
          'utils/version-check.js：新增 import manifest from \'@/manifest.json\'；getCurrentVersion 改为「manifest.versionName 优先 → App 资源包版本（_appVersion）→ 平台自带版本 → 兜底」；小程序端仍优先用平台版本号，H5 仍优先 __uniConfig',
          'manifest.json：versionName 4.0.0 / versionCode 400；版本日志新增分段 utils/storage/version-log/4.0.js 并在 version-data.js 顶部接线'
        ]
      },
      {
        title: '测试（4.0.0）',
        items: [
          'tests/version-check.test.js：新增一例断言 getVersion() 等于 manifest.versionName（版本号再被回落成 1.0.0 会立刻红）',
          'tests/version-history.test.js：默认历史首条与 manifest.versionName 对齐（原有断言，跨分段后继续生效）'
        ]
      }
    ]
  }
]
