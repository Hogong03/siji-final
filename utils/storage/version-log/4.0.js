/**
 * 版本日志数据段：4.0.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V40 = [
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
