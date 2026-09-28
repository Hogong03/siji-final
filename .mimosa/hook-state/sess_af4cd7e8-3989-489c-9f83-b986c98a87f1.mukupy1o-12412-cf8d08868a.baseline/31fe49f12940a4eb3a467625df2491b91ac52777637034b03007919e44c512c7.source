/**
 * 版本日志数据段：3.9.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V39 = [
  {
    version: '3.9.0',
    date: '2026-09-17',
    title: '3.9.0 记录长文阅读页 + 左侧目录尺；六级技巧改成 4 章长文',
    summary: [
      '新增记录阅读页（pages/diary/read.vue）：长记录不再只有编辑框 —— 正文按章节切开，每节用 Markdown 渲染（标题 / 列表 / 加粗都正常），左侧配目录尺，点或拖刻度跳小节，拖动时显示小节名，滚动时视口指示跟随、当前小节高亮',
      '目录尺与聊天页对话尺同一手感：复用 utils/chat-ruler.js 的视口换算 / 取最近刻度 / 触摸坐标换算；差别只在长文没有虚拟窗口，跳转走 scroll-into-view 锚点，精确到位，无需扩窗补跳（章节少于 3 节不显示尺子）',
      '章节识别纯函数 utils/text-outline.js：支持 Markdown 标题（# ~ ####）、【标题】、编号标题（1. / 一、）三种写法，跳过围栏代码块，编号标题限长避免把正文句子当标题',
      '六级技巧从 12 条短技巧改成 4 章长文（写作 / 听力 / 阅读 / 翻译各一篇，每篇 5-6 个小节）：核心思路、具体做法、时间分配、常见坑、今日练习 —— 短技巧适合查，长文适合复习；内容仍对准实测短板（听力 140 视听一致、阅读 131 放弃选词填空、写作翻译 96 简单句优先）',
      '旧版 12 条短技巧自动撤掉（软删，可在回收站恢复），避免标签「技巧」下留两套；种子数据带 seed_v，以后改内容会自动刷新（用户删掉的不动）',
      '入口：记录详情右上角「阅读」（新建记录时不显示）；复习动线：记录 → 全部时间 → 标签「技巧」→ 点开 → 阅读 → 目录尺跳小节'
    ],
    categories: [
      {
        title: '记录阅读页与目录尺（3.9.0）',
        items: [
          'pages/diary/read.vue + read.scss（新增）：头部标题 / 字数 / 小节数 / 标签 / 编辑入口；正文 scroll-view 内每节一个锚点（#sec-view-N），<MarkdownRenderer> 渲染小节正文，小节标题左侧一道黑竖线区分章节',
          'utils/text-outline.js（新增，纯函数）：parseHeading（三种章节写法）/ extractOutline（逐行扫描 + 跳过代码块 + percent 换算）/ splitSections（切正文不丢内容，首节可为无标题前言）/ shouldShowOutline（门槛 OUTLINE_MIN_SECTIONS=3）/ buildOutlineTicks / titledSections',
          'composables/useOutlineRuler.js（新增）：目录尺状态与触摸编排，复用 chat-ruler 的 viewportRange / pickTickByPercent / pickTickByScroll / percentFromY，跳转用 scroll-into-view 锚点；拖动节流 120ms、轻点位移阈值 8px、预览停留 900ms',
          'pages.json：diary 分包注册 read 页（BOM 与 CRLF 未动）；pages/diary/detail.vue 顶部筛选行加「阅读」入口（有内容且非新建），detail.scss 同步样式与深色模式'
        ]
      },
      {
        title: '六级技巧改版（3.9.0）',
        items: [
          'utils/storage/cet6-tips.js：CET6_TIPS 改成 4 章（tip_cet6_ch_writing / ch_listening / ch_reading / ch_translation），每章正文用 ## 分小节；新增 CET6_SEED_MARK / CET6_SEED_VERSION / CET6_TIP_IDS_V1',
          'ensureCet6Tips 升级为「补 + 刷 + 撤」：缺的补、seed_v 旧于当前版本的刷新正文、3.8.0 的 12 条短技巧软删（superseded 计数）；软删记录既不复活的也不刷新；跨月判重仍扫近 13 个月分片'
        ]
      },
      {
        title: '测试（3.9.0）',
        items: [
          'tests/text-outline.test.js（新增 16 例）：三种章节写法、正文不误判（含限长）、代码块跳过、percent 单调且末行标题为 100、切分不丢内容、前言保留、无标题时单节、index 与锚点 id 对应、门槛与刻度生成、空输入不炸',
          'tests/cet6-tips.test.js（改写 13 例）：4 章落库且带种子标记与种子版本、每章都能解析出 ≥3 个小节（目录尺可用）、标签进学习种类、内容含视听一致/选词填空/简单句与分数、幂等、旧短技巧被软删、用户删过的不复活不刷新、seed_v 变化刷新正文、跨月不重复、追加不覆盖',
          '全量：72 文件 / 1043 用例全绿（npx vitest run --maxWorkers=2，exit 0）'
        ]
      }
    ]
  }
]
