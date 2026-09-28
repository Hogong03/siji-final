/**
 * 版本日志数据段：4.4.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V44 = [
  {
    version: '4.4.0',
    date: '2026-09-23',
    title: '4.4.0 修滑动误触删除 + 聊天历史按预算裁剪 + 目录尺垂直居中 + 标签条可折叠可排序',
    summary: [
      '修：历史反馈列表**滑动时误触删除** —— 原生 @longpress 只看「按住 350ms」，不看手指有没有滑动，翻列表时按住再滑就弹删除确认；换成自研 usePressHold（按住 550ms 且位移不超过 10px 才算长按；触发后 600ms 内的 tap 一并忽略，避免弹窗同时跳进编辑页）',
      '性能：聊天历史改成**按字符预算裁剪**（单条上限 1200 字、总量 6000 字、保底最近 6 条）。4.3.0 上长文能力后，一条 AI 回复可能两三千字，历史又是「最近 20 条整段带」，聊过一篇长文之后每条消息都要把它重发一遍（工具循环每轮再发一次）—— 这是 AI 响应越来越慢的结构性来源',
      '记录页标签条：默认**只露一个「全部」**，点开铺开全部标签；新增「排序」模式，标签左右可挪位，顺序**落盘**（siji_tag_order），不会每次按频次重排又被冲掉',
      '记录阅读页：目录尺**垂直居中**（轨道高 88%，上下各留余量），刻度不再顶到屏幕上下边缘；触摸换算用的还是同一个轨道 DOM rect，跳转精度不变',
      '测试：新增 3 个文件 39 例（长按手势 11 / 标签顺序与折叠 18 / 历史预算 8 + 目录尺版式 2），全量 81 文件 1170 用例全绿'
    ],
    categories: [
      {
        title: '反馈列表滑动误触删除（4.4.0）',
        items: [
          'composables/usePressHold.js（新增）：长按判定纯逻辑 —— 按住超时 + 位移容差 + 触发后忽略 tap 的守卫窗口；坐标从事件里取（clientX → pageX 回落，touches → changedTouches 回落），便于单测',
          'pages/settings/sub/feedback-list.vue：删掉 @longpress 绑定，改绑 touchstart/touchmove/touchend/touchcancel；goEdit 增加 press.justFired() 守卫',
          '为什么不用原生 longpress：它不看手指是否滑动，滑动翻页时照样触发 —— 这正是用户反馈「滑动页面也会触发删除」的根因'
        ]
      },
      {
        title: 'AI 响应速度：历史预算（4.4.0）',
        items: [
          'utils/ai/chat-helpers.js：新增 trimHistory()（纯函数）与三个常量 HISTORY_MAX_CHARS=6000 / HISTORY_MAX_PER_MESSAGE=1200 / HISTORY_MIN_KEEP=6；getRecentHistory() 的两条返回路径都过预算',
          '规则：单条超限截断并留「…（内容过长已截断）」标记（模型知道这里被截过，不会当完整上下文用）；从最近往前累加，超预算就丢更早的；保底最近 6 条，避免「刚说的那件事」突然消失',
          '实测固定开销（临时测试量得，已删除）：系统提示词 9022 字符、38 个工具定义 14768 字符（14.4KB），除「≤14 字闲聊」外每条消息都进工具循环 → 每次回复至少两轮，固定开销翻倍',
          '未做（有理由）：没动工具定义与 CORE_ACTIONS 的重复 —— 项目约定「查询/创建类 action 两处都加」是为 JSON 兜底路径服务的，砍掉会让「模型不调工具直接回 JSON」那条路失效'
        ]
      },
      {
        title: '标签条折叠与排序（4.4.0）',
        items: [
          'utils/storage/tags.js：新增 TAG_ORDER_KEY / getTagOrder / setTagOrder / applyTagOrder / moveTagInList（后两个是纯函数）',
          'utils/storage.js：转出上述标签顺序接口',
          'composables/useDiaryList.js：新增 tagOrder / showAllTags / sortMode 三个状态与 tapAll / toggleSortMode / moveTag 三个动作；quickTags 改为「全部标签 + 用户顺序优先」，不再截前 8 个',
          'pages/diary/list.vue：标签条默认只渲染「全部」；点开铺开全部标签并多一个「排序 / 完成」开关；排序态下标签左右各一个移动键，点标签本体不再误触筛选',
          'pages/diary/list.scss：新增 .quick-tag.sorting / .tag-move / .tag-move.disabled / .quick-tag.sort-toggle 样式与深色覆盖'
        ]
      },
      {
        title: '目录尺垂直居中（4.4.0）',
        items: [
          'pages/diary/read.scss：.ruler-track 高度 100% → 88%；.read-ruler 本身是 align-items:center 的 flex 容器，改高度即垂直居中，刻度不再贴屏幕上下边缘',
          '换算一致性：刻度用轨道百分比定位、触摸跳转用同一个 #read-ruler-track 的 DOM rect，两边同时收缩，咬合关系不变'
        ]
      },
      {
        title: '测试（4.4.0）',
        items: [
          'tests/press-hold.test.js（新增 11 例）：按住到位触发 / 滑动超容差取消 / 容差内抖动仍触发 / 滑走又滑回不算 / 提前抬手取消 / tap 守卫窗口 / 三端坐标回落 / 反馈页静态回归（不再绑 @longpress）',
          'tests/tag-order.test.js（新增 18 例）：顺序套用与未知标签落位 / 重复名只认首位 / 左右挪位与边界 / 落盘读回与按类型分片 / 脏数据与坏 JSON 容错 / 页面与组合式函数的静态接线',
          'tests/history-budget.test.js（新增 8 例）：单条截断留标记 / 超预算丢更早的 / 保底条数与顺序 / 脏输入容错 / getRecentHistory 真的接上预算',
          'tests/text-outline.test.js：新增 2 例核对目录尺容器居中与轨道高度',
          '全量：81 文件 / 1170 用例全绿（npx vitest run --maxWorkers=2，exit 0）'
        ]
      }
    ]
  }
]
