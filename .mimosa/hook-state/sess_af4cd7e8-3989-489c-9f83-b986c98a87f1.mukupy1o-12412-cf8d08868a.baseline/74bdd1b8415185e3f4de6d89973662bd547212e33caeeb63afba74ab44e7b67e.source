/**
 * cet6-tips.js — 内置的六级技巧（3.8.0 首版 12 条短技巧；3.9.0 改为 4 章长文）
 *
 * 4.1.0：方法 4 章之外，加入 6 篇复习资料（高频词 / 写作模板库 / 翻译词组 / 听力场景词 /
 *        阅读同义替换表 / 考场流程），标签「复习资料」；两套内容在记录页分别筛。
 *
 * 3.9.0 改版原因：12 条短技巧适合「查」，不适合「复习」。
 * 现在按章节组织成 4 篇长文（写作 / 听力 / 阅读 / 翻译），每篇内部用 Markdown 标题分小节，
 * 在记录阅读页（pages/diary/read.vue）里配左侧目录尺，按小节跳转。
 *
 * 内容对准用户实测分数里最吃亏的三块：
 *   听力 140（视听一致最容易短期提分）、阅读 131（选词填空该放弃）、写作翻译 96（简单句优先）。
 *
 * 种子数据的规矩：
 *   - 每条带 seed: 'cet6' 与 seed_v，本文件是唯一来源
 *   - ensureCet6Tips() 幂等补发：缺的补、旧版（seed_v 小）的刷新
 *   - 用户删掉的（is_deleted=1）不复活、不刷新
 *   - 3.9.0 起旧版 12 条短技巧（CET6_TIP_IDS_V1）会被软删，避免留下两套
 *
 * 复习入口：记录 → 时间范围「全部时间」→ 标签「技巧」→ 点开 → 右上「阅读」。
 */
import { getRawList, getMonthFromDate } from './helpers.js'
import { CET6_MATERIALS } from './cet6-material.js'
import { asyncSetStorageJSON } from '../store-helpers.js'
import { addCustomTag } from './tags.js'

/** 方法篇的标签：在记录页按这个标签筛 */
export const CET6_TIP_TAG = '技巧'

/** 复习资料篇的标签（4.1.0）：与「技巧」分开筛 —— 技巧是方法，资料是查得到的料 */
export const CET6_MATERIAL_TAG = '复习资料'

/** 技巧归属的标签种类（学习） */
export const CET6_TIP_CATEGORY = 'study'

/** 种子标记与版本（改内容就 +1，ensureCet6Tips 据此刷新） */
export const CET6_SEED_MARK = 'cet6'
export const CET6_SEED_VERSION = 3

/** 3.8.0 那批短技巧的 client_id：改了章节版之后要把它们撤掉 */
export const CET6_TIP_IDS_V1 = [
  'tip_cet6_writing_1', 'tip_cet6_writing_2', 'tip_cet6_writing_3',
  'tip_cet6_reading_1', 'tip_cet6_reading_2', 'tip_cet6_reading_3',
  'tip_cet6_listening_1', 'tip_cet6_listening_2', 'tip_cet6_listening_3',
  'tip_cet6_translation_1', 'tip_cet6_translation_2', 'tip_cet6_translation_3'
]

const WRITING = [
  '## 一、这一章只解决一件事',
  '把「作文」从扣分项变成稳定得分项。你现在写作+翻译合计 96 分（满分 212），扣的 116 分里，绝大多数不是不会写，而是写错——错一句减一档。',
  '所以整章的规矩只有一句：**宁可朴素，不要出错。**',
  '',
  '## 二、三段式骨架（照这个结构填内容就行）',
  '1. 首段两句：把题目改写一遍 + 给出你的立场。改写题目是白送的分数，别跳过。',
  '2. 中段四句：两个理由，每个理由后面跟一句具体例子。理由要「大路货」，例子要具体到人/事/数字。',
  '3. 尾段一句：重申立场。不加新观点，不写长句。',
  '',
  '全文控制在 150-180 词。少于 150 词按低档给分；超过 200 词，每多一句就多一次出错机会。',
  '',
  '## 三、只背三个句型（多了记不住，考场上也用不出来）',
  '- 观点句：There is no denying that … （没人能否认……）',
  '- 举例句：Take … for example, … （以……为例）',
  '- 让步句：Although …, … （虽然……，但是……）',
  '',
  '三个句型循环用，结构照抄、名词动词换成本题话题的词。',
  '',
  '## 四、常见坑',
  '- 全程一个时态最安全：一般现在时。想写过去的事，整段都改成过去时，别混。',
  '- 第三人称单数、名词复数、冠词——这三样最容易漏，也最容易扣分。',
  '- 不要为了「显得高级」写长从句。阅卷老师只看有没有错，不看你写得多花。',
  '',
  '## 五、今天怎么练（15 分钟）',
  '1. 拿一套真题作文题，只写首段两句（3 分钟）。',
  '2. 再写中段两个理由 + 两个例子（8 分钟），写完数一遍词数。',
  '3. 留 4 分钟专查三件事：三单、时态、拼写。把查出来的错抄在下面一行，考前再看一遍。'
].join('\n')

const LISTENING = [
  '## 一、这一章只解决一件事',
  '把听力从「试图听懂全文」改成「在选项里找答案」。你现在听力 140（满分 249），这是四块里最容易在短期内提分的一块。',
  '',
  '## 二、视听一致：听到什么选什么',
  '六级听力 90% 的正确答案，在你听到的音频里都有「同样的词或同义替换」出现在选项里。',
  '做法：读选项时把每个选项的关键词圈出来，听到哪个词就盯哪个选项，对上就选，不推理、不等听懂全文。',
  '',
  '拿不准的时候选「听到的词最多的那个选项」——这是平均期望最高的猜法。',
  '',
  '## 三、答案常在这三处',
  '1. 开头句：新闻听力的导语往往就是第一题答案，开头没听清后面白搭。',
  '2. 转折词后：however / but / in fact / actually 后面十有八九是考点。',
  '3. 结尾句：讲话人收尾时爱重复观点，也是常考位置。',
  '',
  '听到转折词立刻打起精神——这三个位置比「听懂全文」划算得多。',
  '',
  '## 四、用读题时间预读选项',
  '- 每题开始前的 5-8 秒，快速扫选项，圈名词和动词。',
  '- 长对话重点看第二个人的回答：考点常在回应里，不在提问里。',
  '- 讲座 / 篇章题先看选项里的专有名词，听到就定位。',
  '',
  '读题不是「看一眼」，是把选项之间的差异点圈出来。',
  '',
  '## 五、常见坑',
  '- 一个词没听懂就停下来想，结果后面三句全丢。听不懂就跳过，跟着音频走。',
  '- 把「同义替换」当成没听到：选项写 reduce，音频说 cut down，这也是视听一致，要选。',
  '- 数字题听到一个数字就选：注意音频里常给两个数字，问的是后一个（或两者之差）。',
  '',
  '## 六、今天怎么练（15 分钟）',
  '1. 拿一套真题听力，不查生词、不回听，只做「听到选项词就打勾」（10 分钟）。',
  '2. 对答案，统计「我圈中的词出现在正确答案里的比例」——这个比例就是你视听一致的命中率（3 分钟）。',
  '3. 把没选出来的题对照原文找转折词位置，记下它出现在第几句（2 分钟）。'
].join('\n')

const READING = [
  '## 一、这一章只解决一件事',
  '把时间从「性价比最低的题」搬到「性价比最高的题」。你阅读 131（满分 249），真正的短板不是读不懂，而是时间分配。',
  '',
  '## 二、先做一次取舍：选词填空只给 5 分钟',
  '- 选词填空 10 题，每题约 3.5 分，全国正确率不到 30%。',
  '- 仔细阅读每题 14 分，是选词填空的 4 倍。',
  '',
  '做法：选词填空**限时 5 分钟**；做不完就全选同一个选项（别留空），省下的 10 分钟全部给仔细阅读。',
  '这是整张卷子里性价比最高的一次取舍。',
  '',
  '## 三、仔细阅读：题干定位 + 同义替换',
  '1. 先读题干，圈定位词：数字、大写、专有名词。',
  '2. 回原文找**同义替换**，而不是找原词。',
  '3. 答案通常在定位句本身，或紧接的下一句。',
  '',
  '两个陷阱：',
  '- 选项里出现原文原词——多半是干扰项（正确项常做同义改写）。',
  '- 选项里出现太绝对的词（must / never / all / only）——先怀疑它。',
  '',
  '## 四、段落匹配：先扫题干再配段落',
  '1. 先把 10 个题干各圈一个关键词（不要先读全文）。',
  '2. 逐段只扫首句和尾句，配上一个就划掉一个。',
  '3. 剩下的用排除法收尾——段落数多于题干数，剩下的本来就是干扰。',
  '',
  '## 五、常见坑',
  '- 在一道题上反复回读，超过 2 分钟就猜一个往下走。',
  '- 靠「常识」选答案：答案必须能在原文找到依据。',
  '- 先通读全文再做题：时间不够时这是最亏的顺序。',
  '',
  '## 六、今天怎么练（20 分钟）',
  '1. 拿一套真题的仔细阅读，计时 15 分钟做完两篇（含涂卡）。',
  '2. 对答案，把每道错题的「定位词」和「原文同义替换」写在旁边（5 分钟）。',
  '3. 记一句话：错题不是因为读不懂，是因为没找到那句同义替换。'
].join('\n')

const TRANSLATION = [
  '## 一、这一章只解决一件事',
  '让翻译从「大片空白」变成「每句都有分」。翻译和写作共用 212 分，你的 96 分里翻译丢得最多。',
  '',
  '## 二、简单句 + 绝不空着',
  '- 一句一主一谓。长句拆成两句，比写错从句强得多。',
  '- 词汇不会就替换：不会 the Spring Festival，就写 a big Chinese holiday。',
  '',
  '空着一句就是零分，写完就有分。宁可朴素，不要空白。',
  '',
  '## 三、高频话题词汇（每类记 5 个就够）',
  '- 传统节日：traditional / festival / celebrate / custom / symbol',
  '- 饮食文化：food / culture / taste / popular / healthy',
  '- 教育：education / student / knowledge / skill / improve',
  '- 经济科技：economy / develop / technology / industry / progress',
  '',
  '单词不必难，拼对、用对才是分。考试时先把话题词往里套，再补主语谓语。',
  '',
  '## 四、常考的三种句式',
  '1. 「……是一个有着悠久历史的国家」→ China is a country with a long history.',
  '2. 「随着……的发展，人们越来越……」→ With the development of …, people are more and more …',
  '3. 「不仅……而且……」→ not only … but also …（写不对就拆成两句，一样得分）',
  '',
  '## 五、写完只查三件事',
  '1. 主谓一致（第三人称单数别漏 s）。',
  '2. 时态统一——拿不准就全用一般现在时。',
  '3. 单复数与拼写。',
  '',
  '这三条能捞回 10 分以上，比多背一百个单词管用。',
  '',
  '## 六、今天怎么练（15 分钟）',
  '1. 找一段真题翻译（3 句），按「一句一主一谓」写一遍（8 分钟）。',
  '2. 对照参考译文，只标两件事：我漏了哪个词、哪个句子结构写错了（4 分钟）。',
  '3. 把写错的那句重写一遍到能背下来（3 分钟）。'
].join('\n')

/**
 * 全部内置篇目：4 章方法（技巧） + 6 篇资料（复习资料），顺序即记录列表里的先后
 * content 用 Markdown：## 小节标题 → 阅读页会切成小节，左侧目录尺按小节跳转
 */
export const CET6_TIPS = [
  { client_id: 'tip_cet6_ch_writing', title: '六级·写作章：三段式骨架 + 只背三个句型', chapter: '写作', tag: CET6_TIP_TAG, content: WRITING },
  { client_id: 'tip_cet6_ch_listening', title: '六级·听力章：视听一致（听到什么选什么）', chapter: '听力', tag: CET6_TIP_TAG, content: LISTENING },
  { client_id: 'tip_cet6_ch_reading', title: '六级·阅读章：放弃选词填空，时间给仔细阅读', chapter: '阅读', tag: CET6_TIP_TAG, content: READING },
  { client_id: 'tip_cet6_ch_translation', title: '六级·翻译章：简单句 + 绝不空着', chapter: '翻译', tag: CET6_TIP_TAG, content: TRANSLATION },
  ...CET6_MATERIALS.map(m => ({
    client_id: m.client_id,
    title: m.title,
    chapter: m.chapter,
    tag: CET6_MATERIAL_TAG,
    content: m.content
  }))
]

/** 全部技巧的 client_id（测试与排查用） */
export const CET6_TIP_IDS = CET6_TIPS.map(t => t.client_id)

/**
 * 可能装着技巧的记录分片：近 13 个月 + getStorageInfoSync 列出的所有 diary_* key
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
 * 扫近 13 个月的分片，把「client_id → { item, key, idx }」摊平（含软删）
 * @param {number} at
 * @returns {Map<string, {item: Object, key: string, idx: number}>}
 */
function scanSeedRecords(at) {
  const found = new Map()
  candidateDiaryKeys(at).forEach(key => {
    getRawList(key).forEach((item, idx) => {
      if (item && item.client_id && !found.has(item.client_id)) {
        found.set(item.client_id, { item: item, key: key, idx: idx })
      }
    })
  })
  return found
}

/**
 * 补发 / 刷新六级技巧（幂等）
 * @param {number} [now] 生成时间（测试注入用）
 * @returns {{ added: number, updated: number, superseded: number, month: string, ids: string[] }}
 */
export function ensureCet6Tips(now) {
  const at = Number(now) || Date.now()
  const month = getMonthFromDate(at)
  const key = 'diary_' + month
  const existing = scanSeedRecords(at)

  // 1. 撤掉 3.8.0 的 12 条短技巧（换成章节版，别留两套）；用户删掉过的跳过
  let superseded = 0
  CET6_TIP_IDS_V1.forEach(id => {
    const hit = existing.get(id)
    if (!hit || hit.item.is_deleted === 1) return
    const list = getRawList(hit.key)
    const target = list.find(x => x && x.client_id === id)
    if (!target) return
    target.is_deleted = 1
    target.updated_at = at
    asyncSetStorageJSON(hit.key, list)
    superseded++
  })

  // 2. 章节版：缺的补、旧 seed_v 的刷新（用户删掉的不动）
  const toAdd = []
  let updated = 0
  CET6_TIPS.forEach((t, i) => {
    const hit = existing.get(t.client_id)
    if (!hit) { toAdd.push(i); return }
    if (hit.item.is_deleted === 1) return
    if (Number(hit.item.seed_v) === CET6_SEED_VERSION) return
    const list = getRawList(hit.key)
    const target = list.find(x => x && x.client_id === t.client_id)
    if (!target) return
    target.title = t.title
    target.content = t.content
    target.tags = [t.tag || CET6_TIP_TAG]
    target.record_type = 'note'
    target.seed = CET6_SEED_MARK
    target.seed_v = CET6_SEED_VERSION
    target.updated_at = at
    asyncSetStorageJSON(hit.key, list)
    updated++
  })

  if (toAdd.length > 0) {
    const raw = getRawList(key)
    const records = toAdd.map((i, n) => {
      const t = CET6_TIPS[i]
      return {
        client_id: t.client_id,
        title: t.title,
        content: t.content,
        record_type: 'note',
        type: 'diary',
        tags: [t.tag || CET6_TIP_TAG],
        category: '',
        images: [],
        pinned: 0,
        emotion: '',
        ai_summary: '',
        ai_advice: '',
        seed: CET6_SEED_MARK,
        seed_v: CET6_SEED_VERSION,
        created_at: at + n,
        updated_at: at,
        is_deleted: 0
      }
    })
    asyncSetStorageJSON(key, raw.concat(records))
  }

  // 标签注册表补齐「技巧」与「复习资料」（都归到「学习」种类）
  try {
    addCustomTag('diary', CET6_TIP_TAG, null, null, CET6_TIP_CATEGORY)
    addCustomTag('diary', CET6_MATERIAL_TAG, null, null, CET6_TIP_CATEGORY)
  } catch (e) { /* 标签表写失败不影响记录本身 */ }

  return {
    added: toAdd.length,
    updated: updated,
    superseded: superseded,
    month: month,
    ids: toAdd.map(i => CET6_TIPS[i].client_id)
  }
}