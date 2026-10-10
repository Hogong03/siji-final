/**
 * 版本日志数据段：4.22.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V422 = [
  {
    version: '4.22.0',
    date: '2026-10-08',
    title: '计划提醒应用外可达（本地推送预注册）+ 聊天页顶部计划速览面板 + 启动即查提醒',
    summary: [
      '计划到期提醒不再只依赖 App 活着：新增本地推送预注册 —— 启动/回前台时按当前提醒配置把未来 7 天内的全部命中点注册成系统级延迟推送（plus.push.createMessage + delay），App 被杀或退后台也能在通知栏收到（iOS 走系统通知中心；个别激进 ROM 杀后台可能失效，属已知边界）',
      '启动即查：原来启动后要等 5 秒轮询计时器才查第一次提醒，现在 appReady 立即查一次 —— 计划到期进 App 马上见到提醒弹窗（直达打卡/推迟），不再先干等「正在启动」',
      '聊天页顶部新增计划按钮：点击底部弹出「我的计划」速览面板（进行中列表 / 截止时间 / 已到期红色标注 / 今日已打卡标记），点条目直达计划详情，底部「打开计划页」进计划 Tab',
      '「工作日」重复档说明：重复提醒档位（不重复/每天/每周/工作日）4.5.0 已上线，入口在计划详情页编辑表单的「重复」区，本次未改',
    ],
    categories: [
      {
        title: '提醒可达（4.22.0）',
        items: [
          '新增 utils/reminder/push-schedule.js：registerPlanPushes 清旧 + 重注册未来 7 天滚动窗口（60s 节流；总开关关闭则不注册；全部纯本地 API 零插件）',
          'utils/reminder/scheduler.js：新增 computeUpcomingFires 纯函数（未来 N 天逐档命中扫描：daily 每天 / weekly 同星期 / weekdays 周一至五 / none 一次性，剔除已过与超出计划截止）',
          'App.vue：appReady 启动即查一次 + 注册本地推送；onShow 回前台重注册（配置变更后窗口自动对齐）',
          '点击通知栏推送拉起 App 后，由现有轮询补弹 ActionSheet（直达打卡 / 三档推迟 / 查看计划）',
        ],
      },
      {
        title: '聊天页计划速览（4.22.0）',
        items: [
          'pages/chat/index.vue：顶部导航新增计划按钮 + 底部弹出面板（蒙层 + chatRiseIn 入场 + safe-area 底距，与全站弹出面板同一套规矩）',
          'pages/chat/chat.scss：.nav-plan-btn 与 .plan-sheet 全套样式 + 深色两套块（theme-dark / MP media）',
          '面板数据现拉现算（最多 20 条进行中），点条目跳详情、底部按钮 switchTab 进计划页',
        ],
      },
      {
        title: '测试',
        items: [
          '新增 tests/reminder-push-schedule.test.js 7 例：未来命中逐档扫描（daily/weekly/weekdays/none）、窗口边界、enabled=false、非 App 环境安全返回、60s 节流',
          '全量 101 文件 / 1373 用例全绿',
        ],
      },
    ],
  },
]
