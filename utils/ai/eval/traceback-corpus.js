/**
 * traceback-corpus.js — 关系回溯「触发范围」评估语料（4.41.0）
 *
 * 目的：4.40.0 有了回溯能力，但用户能否自然触发它决定了这项能力是否真的有用。
 * 本文件是**离线评估语料**：每条用例自带数据前置（有哪些人、各有哪些互动），
 * 因此任何人在任何机器上跑都能得到同一结果，不需要真实对话日志、不需要调模型。
 *
 * 断言字段：
 *   message          用户输入
 *   relations        数据前置：[{ name, role?, interactions: [{ daysAgo, scene?, content?, result?, emotion? }] }]
 *   expect.intent    期望意图识别命中（true/false）
 *   expect.injection 期望注入回溯上下文（true=必须注入 / false=必须不注入 / 'optional'=可接受两种）
 *   expect.person    注入时期望关联到的人物（多个人物被提及时见 expect.multiPerson）
 *   expect.multiPerson 多人场景标记：期望**不要静默只选一个人**
 *   expect.contains / expect.notContains  安全断言（必须出现 / 绝不出现的文本）
 *
 * 类别（与评估报告一一对应）：
 *   explicit_change  明确关系变化（"我和阿伟疏远了"）
 *   implicit_change  含蓄关系变化（"阿伟最近怪怪的"）
 *   doubt_attitude   怀疑对方态度（"他是不是不想理我了"）
 *   history_ask      询问历史事件（"上次和阿伟聊得怎么样"）
 *   general_mood     一般情绪倾诉（"最近心情不太好"）
 *   generic_talk     泛化讨论（"为什么有些人会越来越冷淡"）
 *   multi_person     多人场景
 *   unknown_person   无记录人物 / 关系归属容易搞错（第三人关系）
 */

/** 造一条互动（评估用简写） */
function itx(daysAgo, extra = {}) {
  return { daysAgo, scene: extra.scene || '日常', content: extra.content || '见了一面', result: extra.result || '', emotion: extra.emotion || '' }
}

/** 常用前置：阿伟有 2 条互动，小王有 1 条 */
const AWAY_AND_XIAOWANG = [
  { name: '阿伟', role: '朋友', interactions: [itx(2, { scene: '午餐', content: '和阿伟吃了午饭', result: '聊得还行', emotion: '开心' }), itx(9, { scene: '微信', content: '问他借书', result: '没回', emotion: '失望' })] },
  { name: '小王', role: '同事', interactions: [itx(1, { scene: '会议', content: '一起开了个会', result: '', emotion: '平静' })] }
]

/** 三人前置：给「超过上限」的用例用（阿伟最近、小王次之、小李最久没互动） */
const AWAY_XIAOWANG_XIAOLI = [
  { name: '阿伟', role: '朋友', interactions: [itx(1, { scene: '午餐', content: '和阿伟吃饭', emotion: '开心' })] },
  { name: '小王', role: '同事', interactions: [itx(20, { scene: '会议', content: '和小王开会', emotion: '平静' })] },
  { name: '小李', role: '同学', interactions: [itx(60, { scene: '聚会', content: '和小李聚会', emotion: '开心' })] }
]

export const TRACEBACK_CORPUS = [
  // ───────── 明确关系变化：必须触发且关联正确人物 ─────────
  {
    id: 'explicit-away',
    category: 'explicit_change',
    message: '我感觉和阿伟最近疏远了',
    relations: AWAY_AND_XIAOWANG,
    expect: { intent: true, injection: true, person: '阿伟' }
  },
  {
    id: 'explicit-cold',
    category: 'explicit_change',
    message: '阿伟最近对我很冷淡',
    relations: AWAY_AND_XIAOWANG,
    expect: { intent: true, injection: true, person: '阿伟' }
  },
  {
    id: 'explicit-worse',
    category: 'explicit_change',
    message: '我和阿伟的关系是不是变差了',
    relations: AWAY_AND_XIAOWANG,
    expect: { intent: true, injection: true, person: '阿伟' }
  },
  {
    id: 'explicit-ignore',
    category: 'explicit_change',
    message: '为什么阿伟最近不理我了',
    relations: AWAY_AND_XIAOWANG,
    expect: { intent: true, injection: true, person: '阿伟' }
  },
  {
    id: 'explicit-no-reply',
    category: 'explicit_change',
    message: '阿伟怎么最近都不回我消息',
    relations: AWAY_AND_XIAOWANG,
    expect: { intent: true, injection: true, person: '阿伟' }
  },

  // ───────── 含蓄关系变化：① 明确双方关系状态变化（触发）② 描述双方交流变化（触发） ③ 含糊无指向（不触发） ─────────
  {
    id: 'implicit-not-like-before',
    category: 'implicit_change',
    message: '感觉和阿伟不如以前了',
    relations: AWAY_AND_XIAOWANG,
    // 「和/跟 + 人名」的双方指向 + 「不如以前」的变化线索
    expect: { intent: true, injection: true, person: '阿伟' }
  },
  {
    id: 'implicit-no-topic',
    category: 'implicit_change',
    message: '和小王聊天越来越没话说了',
    relations: AWAY_AND_XIAOWANG,
    // 双方交流变化
    expect: { intent: true, injection: true, person: '小王' }
  },
  {
    id: 'implicit-not-close',
    category: 'implicit_change',
    message: '我和阿伟没以前那么亲近了',
    relations: AWAY_AND_XIAOWANG,
    expect: { intent: true, injection: true, person: '阿伟' }
  },
  {
    id: 'implicit-no-punctuation',
    category: 'implicit_change',
    message: '我跟阿伟没以前那么亲近了',
    relations: AWAY_AND_XIAOWANG,
    // 无标点的口语表达也要能识别（不依赖分句结构）
    expect: { intent: true, injection: true, person: '阿伟' }
  },
  {
    id: 'implicit-talk-less',
    category: 'implicit_change',
    message: '最近我跟阿伟越来越没话说了',
    relations: AWAY_AND_XIAOWANG,
    expect: { intent: true, injection: true, person: '阿伟' }
  },
  {
    id: 'implicit-weird',
    category: 'implicit_change',
    message: '阿伟最近有点怪怪的',
    relations: AWAY_AND_XIAOWANG,
    // 含糊但缺少「用户与他的关系」指向：只是描述状态 → 4.44.0 明确为**不触发**
    //（人物门能构建上下文，但意图门必须挡住）
    expect: { intent: false, injection: false }
  },

  // ───────── 怀疑对方态度：有人物指向才注入 ─────────
  {
    id: 'doubt-no-person',
    category: 'doubt_attitude',
    message: '他是不是不想理我了',
    relations: AWAY_AND_XIAOWANG,
    // 没人名指向：意图可以命中，但绝不能挑一个关系去注入
    expect: { intent: true, injection: false }
  },
  {
    id: 'doubt-with-person',
    category: 'doubt_attitude',
    message: '小王是不是讨厌我了',
    relations: AWAY_AND_XIAOWANG,
    expect: { intent: true, injection: true, person: '小王' }
  },

  // ───────── 询问历史事件：可注入回溯，也可走 query_interaction（两种都算合格） ─────────
  {
    id: 'history-how-was-it',
    category: 'history_ask',
    message: '上次我和阿伟聊得怎么样？',
    relations: AWAY_AND_XIAOWANG,
    expect: { intent: 'optional', injection: 'optional' }
  },
  {
    id: 'history-when',
    category: 'history_ask',
    message: '我上次和阿伟见面是什么时候',
    relations: AWAY_AND_XIAOWANG,
    expect: { intent: 'optional', injection: 'optional' }
  },

  // ───────── 一般情绪倾诉：不能自动归因到某段关系 ─────────
  {
    id: 'mood-bad',
    category: 'general_mood',
    message: '最近心情不太好',
    relations: AWAY_AND_XIAOWANG,
    expect: { intent: false, injection: false }
  },
  {
    id: 'mood-tired',
    category: 'general_mood',
    message: '今天好累啊',
    relations: AWAY_AND_XIAOWANG,
    expect: { intent: false, injection: false }
  },

  // ───────── 泛化讨论：没有人名时不得误注入任何具体人物 ─────────
  {
    id: 'generic-why-cold',
    category: 'generic_talk',
    message: '为什么有些人会越来越冷淡？',
    relations: AWAY_AND_XIAOWANG,
    // 意图层可能命中（词面相同），但**注入层必须为 false**
    expect: { intent: 'optional', injection: false }
  },
  {
    id: 'generic-colleague-cold',
    category: 'generic_talk',
    message: '同事之间冷淡是正常的吗',
    relations: AWAY_AND_XIAOWANG,
    expect: { intent: 'optional', injection: false }
  },
  {
    id: 'generic-movie',
    category: 'generic_talk',
    message: '电影里那种关系变差得很突然的情节挺多的',
    relations: AWAY_AND_XIAOWANG,
    expect: { intent: 'optional', injection: false }
  },

  // ───────── 多人场景：不许静默只挑一个人；上限与顺序都必须确定 ─────────
  {
    id: 'multi-implicit',
    category: 'multi_person',
    message: '阿伟和小王最近都不太对劲',
    relations: AWAY_AND_XIAOWANG,
    // 「不对劲」属缺口 1 的含蓄说法：本轮不放宽意图门，保持不注入
    expect: { intent: false, injection: false }
  },
  {
    id: 'multi-explicit',
    category: 'multi_person',
    message: '为什么我和阿伟、小王都疏远了',
    relations: AWAY_AND_XIAOWANG,
    // 两人都明确与用户的关系在变化 → 两段都要注入
    expect: { intent: true, injection: true, multiPerson: true, persons: ['阿伟', '小王'] }
  },
  {
    id: 'multi-order-appearance',
    category: 'multi_person',
    message: '我和小王、阿伟都疏远了',
    relations: AWAY_AND_XIAOWANG,
    // 顺序按消息里出现的先后，而不是「谁最近互动过」（阿伟的 last_interaction 更新）
    expect: { intent: true, injection: true, multiPerson: true, persons: ['小王', '阿伟'] }
  },
  {
    id: 'multi-passing-mention',
    category: 'multi_person',
    message: '阿伟最近对我很冷淡，顺便说一句小王升职了',
    relations: AWAY_AND_XIAOWANG,
    // 小王只是顺带提及，不在关系变化句里 → 不注入他的回溯
    expect: { intent: true, injection: true, persons: ['阿伟'] }
  },
  {
    id: 'multi-one-third-party',
    category: 'multi_person',
    message: '阿伟说他跟女朋友闹矛盾了，小王最近对我很冷淡',
    relations: AWAY_AND_XIAOWANG,
    // 阿伟那段是第三人关系（缺口 3 的归属判断），只有小王该被回溯
    expect: { intent: true, injection: true, persons: ['小王'] }
  },
  {
    id: 'multi-three-cap',
    category: 'multi_person',
    message: '我最近和阿伟、小王、小李都疏远了',
    relations: AWAY_XIAOWANG_XIAOLI,
    // 三人符合 → 上限 2，按出现顺序取（阿伟最近互动、小王次之、小李最久没互动）
    expect: { intent: true, injection: true, multiPerson: true, persons: ['阿伟', '小王'] }
  },
  {
    id: 'multi-three-cap-order',
    category: 'multi_person',
    message: '我最近和小李、小王、阿伟都疏远了',
    relations: AWAY_XIAOWANG_XIAOLI,
    // 同样三人，但小李写在最前 → 必须取「小李、小王」，证明上限选择与互动时间无关
    expect: { intent: true, injection: true, multiPerson: true, persons: ['小李', '小王'] }
  },

  // ───────── 反例：有相似字面但没有「用户自身关系变化」语义 ─────────
  {
    id: 'counter-vague-state',
    category: 'counter',
    message: '阿伟最近怪怪的',
    relations: AWAY_AND_XIAOWANG,
    // 状态描述，没有双方指向 → 不触发
    expect: { intent: false, injection: false }
  },
  {
    id: 'counter-third-party-paraphrase',
    category: 'counter',
    message: '小王说阿伟变了',
    relations: AWAY_AND_XIAOWANG,
    // 转述他人状态，不是用户与阿伟的关系变化 → 不触发
    expect: { intent: false, injection: false }
  },
  {
    id: 'counter-third-party-pair',
    category: 'counter',
    message: '小王说他跟阿伟没以前那么亲近了',
    relations: AWAY_AND_XIAOWANG,
    // 有「跟 + 人名 + 没以前」的双方指向，但那是小王与阿伟的关系 → 归属过滤挡下
    expect: { intent: 'optional', injection: false }
  },
  {
    id: 'counter-irrelevant-buru',
    category: 'counter',
    message: '我以前不如现在会处理关系',
    relations: AWAY_AND_XIAOWANG,
    // 「不如」出现在无关语境，且没有人名指向 → 不注入
    expect: { intent: 'optional', injection: false }
  },
  {
    id: 'counter-not-about-anyone',
    category: 'counter',
    message: '这家店的服务越来越客气了',
    relations: AWAY_AND_XIAOWANG,
    expect: { intent: 'optional', injection: false }
  },

  // ───────── 标点边界：归属判定必须按分句隔离，不能因标点变化串联不同人物 ─────────
  {
    id: 'boundary-semicolon',
    category: 'boundary',
    message: '阿伟最近对我很冷淡；小王挺好的',
    relations: AWAY_AND_XIAOWANG,
    expect: { intent: true, injection: true, persons: ['阿伟'] }
  },
  {
    id: 'boundary-period',
    category: 'boundary',
    message: '阿伟最近对我很冷淡。小王挺好的',
    relations: AWAY_AND_XIAOWANG,
    expect: { intent: true, injection: true, persons: ['阿伟'] }
  },
  {
    id: 'boundary-question',
    category: 'boundary',
    message: '阿伟最近对我很冷淡？小王呢',
    relations: AWAY_AND_XIAOWANG,
    expect: { intent: true, injection: true, persons: ['阿伟'] }
  },

  // ───────── 第三人关系：话题不是「我和他」，不得把用户的互动时间线套上去 ─────────
  {
    id: 'third-party-relationship',
    category: 'third_party',
    message: '阿伟说他跟女朋友关系变差了',
    relations: AWAY_AND_XIAOWANG,
    // 话题是「阿伟与别人」：注入我的互动时间线属错误归属
    expect: { intent: 'optional', injection: false }
  },
  {
    id: 'third-party-i-think',
    category: 'third_party',
    message: '我觉得阿伟最近跟女朋友闹矛盾了',
    relations: AWAY_AND_XIAOWANG,
    expect: { intent: 'optional', injection: false }
  },
  {
    id: 'third-party-family',
    category: 'third_party',
    message: '阿伟说他最近和家里人不太和睦',
    relations: AWAY_AND_XIAOWANG,
    expect: { intent: 'optional', injection: false }
  },
  {
    id: 'third-party-reported-quarrel',
    category: 'third_party',
    message: '阿伟跟我说，他最近不太想理女朋友',
    relations: AWAY_AND_XIAOWANG,
    expect: { intent: 'optional', injection: false }
  },
  {
    id: 'third-party-say-another-person',
    category: 'third_party',
    message: '阿伟说他跟小王关系变差了',
    relations: AWAY_AND_XIAOWANG,
    // 对象是另一个人名（不是「我」）→ 同样属第三人关系
    expect: { intent: 'optional', injection: false }
  },
  {
    id: 'self-still-triggers-after-fix',
    category: 'explicit_change',
    message: '我最近觉得和阿伟疏远了',
    relations: AWAY_AND_XIAOWANG,
    // 修第三人归属不能误伤用户自己的关系
    expect: { intent: true, injection: true, person: '阿伟' }
  },
  {
    id: 'implicit-baseline-unchanged',
    category: 'implicit_change',
    message: '阿伟最近有点怪怪的',
    relations: AWAY_AND_XIAOWANG,
    // 本轮只修第三人归属，不通放宽含蓄触发：这条必须保持当前基线行为（不注入）
    expect: { intent: false, injection: false }
  },

  // ───────── 无记录人物 / 归属易错 ─────────
  {
    id: 'unknown-person',
    category: 'unknown_person',
    message: '我觉得老李最近变了',
    relations: AWAY_AND_XIAOWANG,
    // 老李不在关系库里：不注入、更不许拿别人（阿伟/小王）的历史来顶
    expect: { intent: 'optional', injection: false }
  },
  {
    id: 'unknown-person-cold',
    category: 'unknown_person',
    message: '老李对我越来越冷淡了',
    relations: AWAY_AND_XIAOWANG,
    expect: { intent: 'optional', injection: false }
  },
  {
    id: 'empty-history',
    category: 'unknown_person',
    message: '为什么阿伟最近不理我了',
    // 阿伟存在但没有任何互动记录 → 必须如实说没记录，不许编
    relations: [{ name: '阿伟', role: '朋友', interactions: [] }],
    expect: {
      intent: true,
      injection: true,
      person: '阿伟',
      // 只断言「上下文有没有如实说明 + 有没有给出禁令」；
      // 不能断言 notContains('他变冷淡了') —— 【表达规则】里那句话本身就是反面例句，
      // 上下文含该字串属正常。回复级安全（不许说出这类结论）由真实模型语料守：
      // utils/ai/eval/cases.js 的 relation-traceback-facts-not-verdicts（replyExcludes）。
      contains: ['没有记录到', '不能', '不许说']
    }
  }
]
