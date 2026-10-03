/**
 * 版本日志数据段：4.12.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V412 = [
  {
    version: '4.12.0',
    date: '2026-10-04',
    title: '4.12.0 初始对话重设计：进入消息从纯文本升级为结构化简报卡（指标格 + 唯一主按钮 + 次级 chips + 问候变化池）',
    summary: [
      '方案：保持 4.5.0 的「进入收敛为一条消息」语义与落盘/签名机制不动，渲染层卡片化 —— 解决旧版「问候+一串列表行+最多 10 个平铺按钮」信息无层级、按钮无主次、模板句式每天一字不差的问题',
      '结构化 payload：enter-dialogue.js 新增 buildBriefing（纯函数可单测）产出 _briefing 挂在进入消息上（_briefingVersion: 2）；文本 content 照旧生成（老版本回落渲染 + AI 历史窗口都吃它），存量旧消息无该字段自动回落旧渲染，零迁移',
      '指标格：昨日支出（useEnterSummary 新增 readYesterdayExpense）/ 连续打卡（≥2 才上格）/ 新记录 / 新进展，最多 3 格、无数据不渲染',
      '主按钮唯一化：一屏只推一件事，优先级 上班卡 > 过时/快到期计划 > 下一步；其余降为状态行与 chips（上限 3 个）；按钮事件仍走 handleEnterButton 统一通道',
      '问候变化池：按时段（深夜/早/午/下午/晚）× 年积日轮换，同一天同句、隔天换句，本地零成本不调 AI',
      '新组件 components/chat/EnterBriefing.vue（MessageBubble 按 _briefingVersion===2 整卡渲染，替代文本正文与页级按钮行；样式进组件 scoped，深色块 html.theme-dark 嵌套 + MP @media 双路）',
      '测试 92 文件 / 1296 用例全绿（enter-dialogue 新增简报卡 7 例：v2 标记/指标规则/主按钮优先级/chips 收口/兼容回落/问候池/空状态）',
    ],
    categories: [
      {
        title: '简报卡数据层（4.12.0）',
        items: [
          'utils/enter-dialogue.js：新增 BRIEFING_VERSION/isBriefingV2/buildBriefingGreeting（GREETING_POOL 五时段轮换）/buildBriefingMetrics/buildBriefingPrimary（上班卡 > 计划 > 下一步）/buildBriefingChips（去主按钮截 3 个）/buildBriefing；buildEnterSummaryMessage 挂 _briefingVersion + _briefing',
          'composables/useEnterSummary.js：新增 readYesterdayExpense（按昨日月份分片读账单过滤合计，异常吞掉返回 0）进 summary',
          'store/chat/persist.js：落盘白名单加 _briefingVersion / _briefing（丢了重启后回落旧版文本渲染）',
          'pages/chat/index.vue：MessageBubble 增加 @briefing-action 转发；页级按钮行条件加 !isBriefingV2(msg)（v2 按钮在卡内，旧消息照旧）',
        ],
      },
      {
        title: '简报卡渲染（4.12.0）',
        items: [
          'components/chat/EnterBriefing.vue（新增）：问候行（away 来源加「回来了」）→ 指标格 → 主按钮（黑底唯一 primary）→ 状态行（圆点列表）→ 下一步/低落软行 → 次级 chips；点击只 emit action，跳转/预填/打卡仍由页面统一处理',
          '样式硬编码双主题：浅色（#F4F4F5 格子底 / #000 主按钮）+ html.theme-dark 嵌套深色块（H5/App）+ MP @media（#ifdef MP-WEIXIN）双路，theme-mode 守卫通过',
        ],
      },
      {
        title: '验证记录（4.12.0）',
        items: [
          '全量 NODE_OPTIONS=--max-old-space-size=4096 + vitest run --maxWorkers=2：92 文件 / 1296 用例全绿',
          '浏览器验收被开发环境卡住：HBuilder X dev 进程僵死（splash 报「连接服务器超时」，非项目源码问题，重启 dev 进程即恢复）—— 简报卡的实际渲染由真机/HBuilder 重启后目检（打开新对话即见）',
        ],
      },
    ],
  },
]
