/**
 * 版本日志数据段：4.11.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V411 = [
  {
    version: '4.11.1',
    date: '2026-10-04',
    title: '4.11.1 修聊天页五处「静态出现」：气泡外的开场按钮/引导卡/恢复卡/快捷建议没有入场动画，统一补 chatRiseIn',
    summary: [
      '用户实测：进入聊天页时初始对话的几个预置按钮（去打卡/下一步等）瞬间固定在那里，不像其他气泡一样有弹跳入场 —— 根因是它们渲染在 MessageBubble 外面（气泡内的欢迎 chips 跟着容器动画没问题），而 .enter-actions/.enter-btn 样式里没有任何入场动画',
      '修复：chat.scss 新增与气泡 bubbleIn 同款动效语言的 chatRiseIn keyframes（上移 16rpx + 0.96 缩放淡入），开场按钮逐钮延迟 0.1/0.16/0.22s 形成弹出节奏',
      '同类排查另修三处：无 Key 引导卡（4.11.0 新增时漏了）、回去接着聊卡、快捷建议条 —— 全部补同款入场；回到底部按钮已有 bbFadeIn 淡入，不动',
      '浏览器实测：3 个开场按钮 computed animation = chatRiseIn（scoped keyframes 编译正确），延迟逐钮递增；测试 92 文件 / 1289 用例全绿',
    ],
    categories: [
      {
        title: '入场动画补齐（4.11.1）',
        items: [
          'pages/chat/chat.scss：新增 @keyframes chatRiseIn（与 MessageBubble.scss 的 bubbleIn 同参数：translateY(16rpx) scale(0.96) → 0/1，0.3s cubic-bezier(0.4,0,0.2,1)）',
          '.enter-actions .enter-btn：chatRiseIn both + nth-child 逐钮延迟（0.1s/0.16s/0.22s/0.28s）；「返回旧对话」按钮同享（v-for 插入时自然播放入场）',
          '.no-key-card / .resume-card / .suggestions-bar：补 chatRiseIn（引导卡与恢复卡 0.05s 延迟，建议条即时）',
          '结论沉淀：MessageBubble 气泡内的内容自动跟随容器动画，凡是渲染在气泡外的兄弟块都要自查入场动画（本次 4 处遗漏均属此类）',
        ],
      },
    ],
  },
  {
    version: '4.11.0',
    date: '2026-10-04',
    title: '4.11.0 竞品差距收口：免 Key 引导流 + 自动本地备份 + 照片日记 + 心情曲线 + 月报长图 + 引导追问与语音入口',
    summary: [
      '竞品调研（docs/竞品对比与差距方案.md）后按差距落地六项：思迹的最大差距不是功能广度（全域对话式无对标），而是开箱即用度、数据安全网与记录的富媒体/回顾体验',
      '免 Key 引导流（P0）：新用户无 Key 时对话页出引导卡 → 「连接 AI」页四厂商卡（申请页直达 + 两步说明 + Key 验证后自动保存切换）；AI 效果自检的无 Key 提示也改成可跳转弹窗',
      '自动本地备份（P0）：App 端每天静默备份全量 JSON 到 _doc/siji-backup/（保留 3 份），数据管理页可手动备份/查看/恢复 —— 纯本地的「换机即丢」风险兜底',
      '照片日记 + 心情打分（P1）：记录可附最多 9 张照片（三端各自持久化，选图/九宫格/预览），AI 记录时自动打心情分（1~5），账单统计页新增月度情绪曲线卡',
      '月度报告长图（P1）：当月支出/收入/记录/打卡/心情聚合为可保存分享的分享长图（三端保存到相册/下载），记录列表页新增入口 —— 对标竞品 Wrapped 式传播物料',
      '引导追问 + 语音入口（P2）：AI 能力注册表扩到 13 项 —— 「引导追问」（记录类回复末尾 AI 主动附一个深入追问，默认开）与「语音转文字」（输入区麦克风，走智谱 ASR，默认关，模块 2.3 已有本次接回入口）',
      '测试 92 文件 / 1289 用例全绿（新增 key-verify / report-data 两文件 + backup 扩展 17 例 + executor mood/images 收口用例）',
    ],
    categories: [
      {
        title: '免 Key 引导流（P0）',
        items: [
          'utils/ai/key-verify.js（新增）：verifyProviderKey 按厂商 endpoint 发一次 max_tokens=1 的真实请求验证 Key，错误翻译成可读原因（Key 无效/模型不可用/网络不通）+ PROVIDER_CONSOLE_URLS 四家申请页地址',
          'pages/settings/sub/key-guide.vue（新增）：四厂商卡（特点一句话 + 打开申请页：App openURL / H5 window.open / MP 复制链接）+ Key 粘贴验证保存（通过后 setProviderKey + setAiProvider 自动切换）',
          'pages/chat/index.vue：providerKeys 全空时冷启动区显示「连接 AI」引导卡（在 resume 卡上方）；pages/settings/sub/ai.vue 加引导文字链；ai-eval.vue 的无 Key toast 改为可跳转弹窗',
        ],
      },
      {
        title: '自动本地备份（P0，App 端）',
        items: [
          'utils/storage/backup.js（新增）：纯函数可单测（文件名/24h 判定/留 3 份筛选）+ App 文件层（_doc/siji-backup/，目录自动创建，exportBackup 全量 JSON 落盘）；非 App 端安全降级',
          'App.vue appReady 接线：App 端且开关开（siji_auto_backup 默认开）且距上次 ≥24h → 静默备份；pages/settings/sub/data.vue 新增「自动备份」卡（开关/立即备份/备份列表/确认恢复），卡片整体 #ifdef APP-PLUS',
          '边界：日记照片文件本轮不进备份（JSON 里存路径，v1 已注明）；恢复为合并写入（先不清库，防恢复中途失败丢数据）',
        ],
      },
      {
        title: '照片日记与心情（P1）',
        items: [
          'store/executors/diary.js：create_diary/update_diary 新增 mood（clampMood 收口 1~5，非法不落分）与 images（normalizeImages 去重上限 9 张）字段，update 可改可清',
          'utils/diary-image.js（新增）：三端选图持久化统一入口 —— App 拷贝 _doc/diary-img/、MP 存 USER_DATA_PATH、H5 canvas 压缩长边 1280 存 dataURL；页面零平台分支',
          'pages/diary/detail.vue：编辑态照片九宫格（选图/删除）+ 心情 5 档表情点选（可取消）；详情态九宫格缩略图 + uni.previewImage；pages/diary/list.vue：列表/时间线卡片右上角 88rpx 首图缩略（多图数字角标）',
          'pages/bill/stats.vue：月度情绪曲线卡（mood 按日去重升序，SijiChart 折线 + 平均心情；打分日 <2 整卡隐藏）',
        ],
      },
      {
        title: '月度报告（P1）',
        items: [
          'utils/report-data.js（新增）：buildMonthlyReport 纯函数聚合当月账单（支出/收入/笔数/分类 top3，round2 防浮点尾差）、记录（篇数/字数/mood 均值）、打卡次数（软删除计划不计，取不到标 null 不编数）',
          'pages/stats/report.vue（新增，自定义导航）：canvas 2d 绘制 750×1100 分享长图（大数字 2×2 + 分类横条 + 心情均值 + 底部水印），深浅两套调色板 watch 重绘；保存三端分支：App plus.gallery.save / MP canvasToTempFilePath + saveImageToPhotosAlbum / H5 toDataURL 下载；记录列表页加「月报」入口',
        ],
      },
      {
        title: '引导追问与语音入口（P2）',
        items: [
          'utils/ai/features.js：AI_FEATURES 11 → 13 项 —— guide_ask（引导追问，care 组默认开）：开关控制 prompt-builder 注入一句行为指令（记录类回复末尾附一个深入追问，闲聊/纯查询不加）；voice（语音转文字，input 组默认关）',
          'components/chat/InputArea.vue：voice 开关驱动麦克风按钮显隐，录音走既有 utils/ai/recorder.js + transcribe.js（智谱 ASR，25s 限时），转写结果填入输入框不自动发送，无智谱 Key 时 toast 引导；按钮为 CSS 线框麦克风（SijiIcon 无 mic 资源，零新增图片）',
        ],
      },
      {
        title: '边界与验证记录（4.11.0）',
        items: [
          '未做（需决策/资源）：AI 试用额度代理（需服务端与风控）、WebDAV 云同步（需加密依赖与同步策略决策）、桌面小组件/系统分享（需原生插件）—— 见 docs/竞品对比与差距方案.md 第四节',
          '未真机验证：App 端备份写盘与恢复、canvas 长图保存相册、录音权限与 mp3 直传智谱 ASR、H5 MediaRecorder webm 格式是否被智谱接受 —— 全部列入 docs/真机验证清单.md 待跑',
          '全量 NODE_OPTIONS=--max-old-space-size=4096 + vitest run --maxWorkers=2：92 文件 / 1289 用例全绿',
        ],
      },
    ],
  },
]
