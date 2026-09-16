/**
 * cet6-tips.js — 内置的六级技巧记录（3.8.0）
 *
 * 为什么要内置：复习时最需要的是「一条能立刻用的技巧」，而不是再去翻攻略。
 * 这里把技巧写成 12 条记录（写作 / 阅读 / 听力 / 翻译各 3 条），标签统一是「技巧」，
 * 在记录页按标签筛一下就能集中复习。内容对应用户实测分数里最吃亏的三块：
 * 听力 140（视听一致最容易短时间提）、阅读 131（选词填空该放弃）、写作翻译 96（简单句优先）。
 *
 * 增量补发（与 ensureDefaultTemplates 同一套路）：按 client_id 判断是否已存在，
 * 老用户、以后新增技巧都能自动补齐；用 getRawList 比对（含软删），
 * 用户自己删掉的技巧不会被重新塞回来。
 *
 * 判重是**跨月**的：记录按月分片，若只看当月，换个月份启动就会再补一份，
 * 标签筛选里出现两套一样的技巧。这里把近 13 个月的分片都扫一遍（再并上
 * getStorageInfoSync 给出的 key），确保「技巧」全局只有一份。
 * 复习入口：记录 → 时间范围选「全部时间」→ 标签筛「技巧」。
 */
import { getRawList, getMonthFromDate } from './helpers.js'
import { asyncSetStorageJSON } from '../store-helpers.js'
import { addCustomTag } from './tags.js'

/** 统一的标签名：在记录页按这个标签筛 */
export const CET6_TIP_TAG = '技巧'

/** 技巧归属的标签种类（学习） */
export const CET6_TIP_CATEGORY = 'study'

/**
 * 12 条技巧。content 里的换行是给记录详情页直接读的，别写 markdown 语法（详情页不保证渲染）。
 * created_at 由 ensureCet6Tips 统一按传入时间生成，这里只给顺序（数组顺序 = 列表里的先后）。
 */
export const CET6_TIPS = [
  /* ── 写作 ── */
  {
    client_id: 'tip_cet6_writing_1',
    title: '写作·三段式骨架（别自由发挥）',
    content: [
      '首段两句：改写题目 + 表明立场。',
      '中段四句：两个理由，每个理由后面跟一句具体例子。',
      '尾段一句：重申立场，不加新内容。',
      '',
      '全文 150-180 词。不满 150 词按低档给分；超过 200 词，错一处就是双倍代价。',
      '考前把这三段的句子数背下来，考场上只管填内容。'
    ].join('\n')
  },
  {
    client_id: 'tip_cet6_writing_2',
    title: '写作·简单句优先（作文+翻译只拿 96 的解法）',
    content: [
      '宁写短句，不写错句。主谓宾齐全、时态一致、单复数对。',
      '「China economy grows fast.」这种小学句照样给分，「I is」直接扣。',
      '',
      '写完留 2 分钟只干一件事：通读找三单、时态、拼写。',
      '不要为了显得高级去写长从句——阅卷只看你有没有错。'
    ].join('\n')
  },
  {
    client_id: 'tip_cet6_writing_3',
    title: '写作·只背三个句型',
    content: [
      '① 观点句：There is no denying that …',
      '② 举例句：Take … for example, …',
      '③ 让步句：Although …, …',
      '',
      '三个循环用，比背 20 个记不住强。',
      '模板句要「换词不换结构」：结构照抄，名词和动词换成本题话题的词。'
    ].join('\n')
  },

  /* ── 阅读 ── */
  {
    client_id: 'tip_cet6_reading_1',
    title: '阅读·选词填空限时 5 分钟',
    content: [
      '选词填空 15 选 10，全国正确率不到 30%，每题约 3.5 分；仔细阅读每题 14 分。',
      '',
      '策略：选词填空只给 5 分钟；做不完就全选同一个选项（别留空），',
      '省下的 10 分钟全部给仔细阅读。这是性价比最高的一次取舍。'
    ].join('\n')
  },
  {
    client_id: 'tip_cet6_reading_2',
    title: '阅读·仔细阅读：题干定位 + 同义替换',
    content: [
      '先读题干，圈定位词（数字、大写、专有名词），回原文找「同义替换」而不是找原词。',
      '答案通常在定位句本身，或紧接的下一句。',
      '',
      '两个陷阱：选项里出现原文原词（多是干扰项）；选项里出现太绝对的词',
      '（must / never / all / only）——先怀疑它。'
    ].join('\n')
  },
  {
    client_id: 'tip_cet6_reading_3',
    title: '阅读·段落匹配：先扫题干再配段落',
    content: [
      '不要先读全文。',
      '① 先把 10 个题干各圈一个关键词；',
      '② 再逐段只扫首句和尾句，配上一个就划掉一个；',
      '③ 剩下的用排除法收尾——段落数多于题干数，剩下的段落本来就是干扰。'
    ].join('\n')
  },

  /* ── 听力 ── */
  {
    client_id: 'tip_cet6_listening_1',
    title: '听力·视听一致：听到什么选什么（最该练的一条）',
    content: [
      '90% 的答案就在选项里：听到选项里的词，就选它。不要推理，不要等听懂全文。',
      '',
      '你现在听力 140 分，这一条是短期内最容易涨的分。',
      '练法：真题音频放着，只做「听到选项词就打勾」，不查生词、不回听。'
    ].join('\n')
  },
  {
    client_id: 'tip_cet6_listening_2',
    title: '听力·用读题时间预读选项',
    content: [
      '每题开始前的 5-8 秒，快速扫选项，圈名词和动词。',
      '长对话重点看第二个人的回答（考点常在回应里）；',
      '讲座 / 篇章题先看选项里的专有名词，听到就定位。',
      '',
      '读题不是「看一眼」，是把选项里的差异点圈出来。'
    ].join('\n')
  },
  {
    client_id: 'tip_cet6_listening_3',
    title: '听力·答案常在这三处',
    content: [
      '① 开头句——新闻听力的导语往往就是第一题答案；',
      '② 转折词后——however / but / in fact / actually 后面十有八九是考点；',
      '③ 结尾句——讲话人收尾时爱重复观点。',
      '',
      '听到转折词立刻打起精神，这三个位置比「听懂全文」划算得多。'
    ].join('\n')
  },

  /* ── 翻译 ── */
  {
    client_id: 'tip_cet6_translation_1',
    title: '翻译·简单句 + 绝不空着',
    content: [
      '一句一主一谓。长句拆成两句，比写错从句强。',
      '词汇不会就替换：不会 the Spring Festival，就写 a big Chinese holiday。',
      '',
      '空着一句就是零分，写完就有分。宁可朴素，不要空白。'
    ].join('\n')
  },
  {
    client_id: 'tip_cet6_translation_2',
    title: '翻译·中国文化高频词准备',
    content: [
      '六级翻译爱考这几类：传统节日、饮食、教育、经济、科技。',
      '',
      '每类准备 5 个词，考试时往句子里套：',
      'traditional / culture / symbol / develop / improve / festival / economy / education。',
      '单词不必难，拼对、用对才是分。'
    ].join('\n')
  },
  {
    client_id: 'tip_cet6_translation_3',
    title: '翻译·写完只查三件事',
    content: [
      '① 主谓一致（第三人称单数别漏 s）；',
      '② 时态统一——拿不准就全用一般现在时；',
      '③ 单复数与拼写。',
      '',
      '这三条能捞回 10 分以上，比多背一百个单词管用。'
    ].join('\n')
  }
]

/** 全部技巧的 client_id（测试与排查用） */
export const CET6_TIP_IDS = CET6_TIPS.map(t => t.client_id)

/**
 * 可能装着技巧的记录分片：近 13 个月 + getStorageInfoSync 列出的所有 diary_* key
 * 近 13 个月够覆盖 App 自己种下的那批（技巧只在安装 / 升级时补发）
 * @param {number} at
 * @returns {string[]}
 */
function candidateDiaryKeys(at) {
  const base = new Date(at)
  const keys = new Set()
  for (let i = 0; i <= 12; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1)
    keys.add('diary_' + getMonthFromDate(d.getTime()))
  }
  try {
    const info = (typeof uni !== 'undefined' && uni.getStorageInfoSync) ? uni.getStorageInfoSync() : null
    const all = (info && info.keys) || []
    all.forEach(k => { if (/^diary_\d{4}-\d{2}$/.test(k)) keys.add(k) })
  } catch (e) { /* 拿不到存储清单也不影响：近 13 个月已经覆盖 */ }
  return Array.from(keys)
}

/**
 * 全局扫一遍已存在的 client_id（含软删：用户删掉的技巧不再补回来）
 * @param {number} at
 * @returns {Set<string>}
 */
function existingIdsAcrossMonths(at) {
  const found = new Set()
  candidateDiaryKeys(at).forEach(key => {
    getRawList(key).forEach(item => { if (item && item.client_id) found.add(item.client_id) })
  })
  return found
}

/**
 * 补发缺失的六级技巧记录（幂等）
 * @param {number} [now] 生成时间（测试注入用）
 * @returns {{ added: number, month: string, ids: string[] }}
 */
export function ensureCet6Tips(now) {
  const at = Number(now) || Date.now()
  const month = getMonthFromDate(at)
  const key = 'diary_' + month
  const raw = getRawList(key)
  // 跨月判重（含软删）：既不会换个月再补一份，也不会把用户删掉的塞回来
  const existing = existingIdsAcrossMonths(at)
  const missing = CET6_TIPS.filter(t => !existing.has(t.client_id))
  if (missing.length === 0) return { added: 0, month: month, ids: [] }

  const records = missing.map((t, i) => ({
    client_id: t.client_id,
    title: t.title,
    content: t.content,
    // note = 随手记：技巧是「查得到」的东西，不需要打卡或情绪字段
    record_type: 'note',
    type: 'diary',
    tags: [CET6_TIP_TAG],
    category: '',
    images: [],
    pinned: 0,
    emotion: '',
    ai_summary: '',
    ai_advice: '',
    // 同一批技巧按数组顺序依次排列（列表按 created_at 倒序，这里保持正序可读）
    created_at: at + i,
    updated_at: at,
    is_deleted: 0
  }))

  asyncSetStorageJSON(key, raw.concat(records))

  // 标签注册表补齐「技巧」（归到「学习」种类），记录页筛标签时才看得到
  try {
    addCustomTag('diary', CET6_TIP_TAG, null, null, CET6_TIP_CATEGORY)
  } catch (e) { /* 标签表写失败不影响记录本身 */ }

  return { added: records.length, month: month, ids: records.map(r => r.client_id) }
}