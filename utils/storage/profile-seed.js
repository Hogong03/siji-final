/**
 * profile-seed.js — 内置「个人画像」种子（4.28.0）
 *
 * 数据来源：用户本机 `Desktop/画像` 文件夹的画像材料（经历 / 23 岁画像总结 /
 * 能力与方向总结 / 3—6 个月学习计划 / MBTI 自评），按思迹内置记录的规矩落地。
 *
 * 种子数据的规矩（与 BKD 手册同一套）：
 *   - 每条带 seed: 'profile-seed' 与 seed_v，本文件是唯一来源
 *   - ensureProfileSeed() 幂等补发：缺的补、旧版（seed_v 小）的刷新
 *   - 用户删掉的（is_deleted=1）不复活、不刷新
 *   - 同时把画像关键维度写成个人信息卡「我的画像」（存在即不重写），
 *     但不动 enabled 开关 —— 是否注入 AI 由用户在设置页决定
 *
 * 复习入口：记录 → 标签「个人画像」→ 点开 → 右上「阅读」。
 */
import { getRawList, getMonthFromDate } from './helpers.js'
import { asyncSetStorageJSON } from '../store-helpers.js'
import { addCustomTag } from './tags.js'
import { getProfile, saveProfile } from '../profile.js'

/** 画像的标签：在记录页按这个标签筛 */
export const PROFILE_TAG = '个人画像'

/** 标签种类（生活） */
export const PROFILE_TAG_CATEGORY = 'life'

/** 种子标记与版本（改内容就 +1，ensureProfileSeed 据此刷新） */
export const PROFILE_SEED_MARK = 'profile-seed'
export const PROFILE_SEED_VERSION = 2

/* ────────────────────────── 第一篇：我的经历 ────────────────────────── */

const JOURNEY = [
  '# 我的经历：从求学一路走到现在',
  '',
  '## 家庭与家人',
  '家里经济状态很差，家人尽量避免让我知道，其实我大致猜出来了。',
  '和家人关系都不太好，主要和外公外婆关系好，和我妈关系近——因为我爸总是出去打工。',
  '',
  '## 小学与初中',
  '小时候偏调皮，成绩不算好。小学没什么印象，数学偏好，语文差点，英语很差。',
  '初一成绩较好，主要是数学（暑假补过课）；英语很差，但遇见一位很好的老师李红，慢慢补了上去。',
  '初二换了班，加上初一家里管得松、我带手机去学校玩等原因，成绩一落千丈。',
  '快初三的时候补课了，开始认真起来——因为我知道不认真读书就没有书读。',
  '物理化学成绩迅速起来，其他成绩也一并提升，想冲省重点高中，无奈差了 70 分。',
  '印象里化学历史考得最好，数学没及格，其他一般。',
  '',
  '## 高中与复读',
  '高中还是一样，不过遇见了疫情（高一寒假）。疫情在家学习，一点没学，成绩下降。',
  '高二班里同学很吵，学不进去；遇见一个知己，想谈恋爱，逞强自荐当了班长整顿班级。',
  '期间撞了头部，偏头痛，整个高三下部分都在承受偏头痛的影响。',
  '好在最后成绩还行，能上公办地方二本，但没去，选择了复读。',
  '复读效果很差：班级环境我不喜欢，抗干扰能力很差，最后刚过了一本线。',
  '',
  '## 现在的起点',
  '经历一路波折后走到今天：计算机专业，前端实习/软件开发，大量使用 AI 辅助编程，',
  '逐渐关注 AI、大模型与 AI 工程方向。'
].join('\n')

/* ────────────────────────── 第二篇：个人画像·23 岁 ────────────────────────── */

const PORTRAIT = [
  '# 个人画像 · 23 岁',
  '',
  '## 一、当前阶段',
  '正在经历「学生 → 社会人」「被照顾 → 开始承担责任」「想证明自己 → 想把生活过好」的过渡。',
  '价值排序正在变化：**身体 → 家庭 → 收入 → 技术成长 → 感情 → 更大的事业**。',
  '不是野心变小，而是开始意识到：真正的成功首先应该让自己和身边重要的人过得更好。',
  '',
  '## 二、核心性格',
  '**对自己能力有信心**：认真干一件事情，答案是"肯定能干出来"。问题不在相不相信自己，而在能不能持续认真。',
  '**最大的弱点不是笨，而是稳定性**：有明确目标/压力 → 爆发力很强；目标模糊/环境松散 → 容易放松。',
  '真正要解决的课题：**如何在没有危机的时候也能持续行动**。',
  '',
  '## 三、现实驱动力',
  '从"证明自己 > 赚钱 > 事业 > 自由 > 稳定"，变为：',
  '**照顾好自己 → 照顾家庭 → 经济安全感 → 技术能力 → 找到另一半 → 再考虑事业规模**。',
  '如果突然得到 100 万，第一反应是先照顾好自己——已经从少年式证明进入成年人式责任。',
  '',
  '## 四、金钱观',
  '最大的现实焦虑是钱：家庭需要用钱、奶奶病重、开始工作、想承担家庭责任。',
  '目标不是"千万资产"，而是：**20 万左右就会觉得人生明显不一样**。',
  '第一阶段目标：建立现金安全垫 → 提高职业收入上限 → 让技术能力产生额外收入/商业价值 → 条件成熟再创业。',
  '',
  '## 五、职业方向',
  '明确选择 **AI 工程** 而不是纯算法研究。能力结构匹配：计算机专业、有前端经验、JS 中等、TS 初级、',
  'Python/Java 有基础、能借助 AI 完成复杂开发、能查资料解决问题、认可 AI 行业前景。',
  '路线：**软件工程 → AI 工程 → 技术负责人 → 产品/商业 → 创业**。',
  '',
  '## 六、最大的技术问题',
  '不是"不会 AI"，而是"**AI 帮你写出来了，但你有时候还不知道为什么这么写**"——这会成为天花板。',
  '能力台阶：会写代码 → 理解代码 → 独立设计系统 → 解决复杂工程问题 → 判断什么值得做 → 把技术变成产品和钱。',
  '真正想达到的是第五、第六层。',
  '',
  '## 七、未来三年路线',
  '- **2026—2027**：毕业 + 找工作 + 软件工程基础（JS/TS、Node、后端、数据库、Git、Docker、Linux、Python、API、LLM API），目标成为合格的软件/AI 工程师。',
  '- **2027—2028**：AI 工程能力（RAG、Agent、LLM 应用、数据处理、部署、AI 产品），从"会调用 AI"变成"能做 AI 系统"。',
  '- **2028—2029**：建立技术壁垒（高级 AI 工程师 / Tech Lead / AI 产品 / 副业 / 创业），再决定具体方向。',
  '',
  '## 八、感情',
  '曾经非常在意高中"知己"，现在的评价："当时太冲动了，意气用事，不应该理她的。"',
  '正在从"为什么她离开我"转向"当时的我其实可以处理得更成熟"——这是成长。',
  '现在对感情的要求很简单：**找到另一半，拥有真正稳定的亲密关系**。',
  '',
  '## 九、最需要警惕的三个东西',
  '1. **"我还年轻，以后再说"**：很多事情知道应该做，但觉得"不着急"。',
  '2. **只靠危机驱动**：快不行了 → 爆发 → 解决 → 放松 → 再次拖延。真正厉害的人是平时就持续积累。',
  '3. **被 AI 替代自己的思考**：目标是从"让 AI 帮我写代码"变成"我知道系统应该怎么设计，让 AI 帮我提高执行速度"。',
  '',
  '## 十、真正想要的人生',
  '有能力、有钱、有自由、能照顾家人、有一个真正的伴侣、以后最好拥有自己的事业；',
  '最重要的是**回头看时不觉得自己白活了**。给 30 岁的自己留下的话："不要后悔。"',
  '',
  '## 十一、定位',
  '不是"聪明但懒"，而是"**还没有完成自我兑现的年轻人**"：一堆尚未兑现的可能性。',
  '接下来真正的问题只有一个：**能不能连续认真三年？**',
  '23 岁看到的自己和 26 岁看到的自己，很可能会是两个完全不同的人。',
  '',
  '## 十二、简版画像地图',
  '| 维度 | 现在的我 |',
  '| --- | --- |',
  '| 年龄 | 23 |',
  '| 当前阶段 | 学生 → 社会人 |',
  '| 最大现实压力 | 钱、家庭 |',
  '| 职业方向 | **AI 工程** |',
  '| 长期路线 | 技术 → 管理 → 创业 |',
  '| 最大优势 | 学习能力、问题解决、爆发力、自我信心 |',
  '| 最大短板 | 持续性、长期积累、容易觉得"不着急" |',
  '| 金钱目标 | 先获得安全感，约 20 万是心理节点 |',
  '| 家庭目标 | 有能力照顾家人 |',
  '| 感情目标 | 找到真正合适的另一半 |',
  '| 身体目标 | 先把自己照顾好 |',
  '| 人生核心诉求 | 成为一个有能力、能承担责任的人 |',
  '| 最重要的关键词 | **不要后悔** |',
  '| 当前最值得押注的方向 | **AI 工程** |',
  '| 未来 3 年核心任务 | 把"我相信我能做到"变成"我真的做到了" |',
  '',
  '> 23 岁，不需要证明自己有多牛；需要开始认真建设一个让 30 岁的自己不会后悔的人生。'
].join('\n')

/* ────────────────────────── 第三篇：学习计划与路线 ────────────────────────── */

const LEARNING = [
  '# 学习计划与路线（3—6 个月）',
  '',
  '## 一、定位',
  '前端打基础，Java 后端补短板，全栈项目做主线，AI 应用作为进阶方向。',
  '未来 3—6 个月最重要的事：把现有的 AI 辅助开发经验，转化为自己能理解、实现、调试和维护的工程能力。',
  '',
  '## 二、四阶段路线',
  '**阶段一：前端巩固与项目理解（第 1 个月）**',
  '不重新学全部前端，而是提高对现有项目的掌控：JS/TS 核心、框架组件与数据流、接口调用与异步、错误处理、',
  '开发者工具排错。实践：选一个熟悉的功能，弄懂"事件 → 函数 → 参数组装 → 接口 → 数据回页 → 排错入口"整条调用链。',
  '验收：能独立追踪一个完整前端功能并解释主要数据流。',
  '',
  '**阶段二：Java 后端与数据库（第 2 个月）**',
  '按顺序学：Java 基础 → Spring 基础 → Spring Boot → 数据库与 SQL → Mapper/Entity/DTO → 事务与异常。',
  '不要求学完再写接口，先学到能理解当前任务，立即实践。',
  '验收：能解释一个后端接口从请求进入到数据库查询再到返回的完整流程，能独立写简单接口。',
  '',
  '**阶段三：完整全栈项目（第 3 个月）**',
  '做一个业务逻辑完整的项目（任务管理/协作平台/个人知识管理）。',
  '至少包含：登录与权限、列表搜索分页、CRUD 与详情、前后端联调、校验异常日志、测试与部署文档。',
  '不要一上来就上微服务——先让单个系统完整可靠地跑起来。',
  '',
  '**阶段四：AI 应用开发（第 4—6 个月）**',
  '顺序：大模型 API 调用与结构化输出 → 流式/超时/重试 → 工具调用与 Agent 工作流 → RAG → 评估、日志、成本与安全。',
  '给前面的项目加一个 AI 功能：文档问答 / 知识库摘要 / 任务初稿 / 数据分析。',
  '验收：完成一个能运行、有明确业务用途、能解释架构的 AI 应用功能。',
  '',
  '## 三、微服务什么时候学',
  '公司项目有 Nacos/Zuul/OpenFeign/Hystrix，值得学但不作为主线，分三层：',
  '先懂业务请求链路 → 再懂服务关系（服务发现/网关/服务间调用）→ 最后学治理（负载均衡/熔断/降级/日志追踪）。',
  'Zuul 和 Hystrix 是较早一代组件，学习时也要知道现代技术栈的演进方向；不要为学新技术乱改公司依赖。',
  '',
  '## 四、每天怎么学',
  '**以成果为单位，时间为辅助**，不追求每天两三小时的高强度。',
  '- 正常下班、精力一般：完成一个小任务（看懂一个方法/实现一个接口参数）。',
  '- 精力较好：完成一个完整功能，或深入理解当天遇到的技术问题。',
  '- 加班或很疲惫：只整理当天的代码和问题，或休息，不强行补课。',
  '- 工作中遇到值得学的问题：优先学真实问题。',
  '',
  '每周完成三个结果：一个可验证的开发成果、一次代码理解（能用自己的话解释）、一份简短记录。',
  '每周问自己：我本周实际完成了什么？哪些代码现在能自己解释？下周最值得解决的一个技术问题是什么？',
  '',
  '## 五、怎么用 AI 才能真正提高',
  '| 场景 | 建议做法 |',
  '| --- | --- |',
  '| 简单重复的代码 | 直接让 AI 辅助生成，重点检查结果 |',
  '| 不熟悉的技术问题 | 先让 AI 解决，再要求解释关键原因 |',
  '| 反复出现的 Bug | 不只接受修复，还要弄清根本原因 |',
  '| 核心业务逻辑 | 要求 AI 说明数据流、依赖关系和异常情况 |',
  '| 完成重要功能后 | 不看解释，自己复述实现过程 |',
  '| 代码运行正常但不理解 | 至少弄懂核心逻辑和排错入口 |',
  '',
  '固定提示词：让 AI 按"业务目的 → 调用链位置 → 数据流 → 核心逻辑 → 异常与边界 → 排查顺序 → 小练习"的顺序讲代码，',
  '而不是直接给修改方案。',
  '',
  '## 六、防中断四规则',
  '1. **任务要小**：不写"学习 Java"，写"看懂一个 Controller 的请求参数和返回值"。',
  '2. **成果要明确**：每天结束能指出一个完成的功能、一个弄懂的问题、一段能解释的代码。',
  '3. **允许状态波动**：状态好时多做，状态差时完成最低目标即可。',
  '4. **中断后直接恢复**：不需要补完欠下的任务，只要重新确定下一个最小成果。',
  '',
  '## 七、怎么判断计划有效',
  '不看学了多少课程，看能力变化。第 3 个月检查：能否不依赖 AI 解释完整请求链路、能否独立写简单 Java 接口、',
  '能否在 AI 辅助下完成完整业务功能并检查边界、能否定位常见 Bug、能否讲清项目架构。',
  '',
  '> 如果只能先执行一件事：选定公司项目里一个熟悉的功能，画出它的前端调用链，并找到对应的 Java Controller。',
  '> 先把这条链路真正弄懂，再向后学 Service 和数据库——这是最贴近当前工作、最容易形成正向反馈的起点。'
].join('\n')

/* ────────────────────────── 第四篇：MBTI 性格自评 ────────────────────────── */

const MBTI = [
  '# MBTI 性格自评',
  '',
  '## 四个维度',
  '当前判断与依据：',
  '',
  '| 维度 | 当前判断 | 依据 |',
  '| --- | --- | --- |',
  '| I/E | 暂时偏 I | 休息时更倾向独处，但现实中也能主动社交 |',
  '| N/S | 偏 N | 喜欢思考整体架构、技术组合和长期发展 |',
  '| T/F | 略偏 T，仍不确定 | 职业决策重视效率和实际结果，但也重视关系与个人价值 |',
  '| J/P | 略偏 J，仍不确定 | 现实目标明确，倾向建立规划，但也愿意根据新信息调整 |',
  '',
  '> 参考维度：I/N/T/J 暂偏。MBTI 只作自我认知参考，不是固定标签。'
].join('\n')

/**
 * 全部内置篇目：4 篇（经历 / 画像 / 学习计划 / MBTI），顺序即记录列表里的先后
 * content 用 Markdown：## 小节标题 → 阅读页会切成小节，左侧目录尺按小节跳转
 */
export const PROFILE_ARTICLES = [
  { client_id: 'prof_journey', title: '我的经历：从求学一路走到现在', content: JOURNEY },
  { client_id: 'prof_portrait', title: '个人画像 · 23 岁', content: PORTRAIT },
  { client_id: 'prof_learning', title: '学习计划与路线（3—6 个月）', content: LEARNING },
  { client_id: 'prof_mbti', title: 'MBTI 性格自评', content: MBTI }
]

/** 全部篇目的 client_id（测试与排查用） */
export const PROFILE_ARTICLE_IDS = PROFILE_ARTICLES.map(a => a.client_id)

/** 画像卡（个人信息 v2 自定义卡，固定 id 保证幂等） */
export const PROFILE_CARD_ID = 'portrait'
export const PROFILE_CARD_TITLE = '我的画像'

/** 画像卡字段（AI 感知的画像维度，enabled 后注入对话上下文）
 *  分三层：我是谁 / 我要去哪 / 我怎么做（与 profile.vue 的 PROFILE_GROUPS 对齐）
 */
const PROFILE_CARD_FIELDS = {
  // 我是谁
  当前阶段: '23 岁，学生→社会人过渡，计算机专业，上班中；价值排序：身体→家庭→收入→技术成长→感情→事业',
  MBTI: 'I/N/T/J 暂偏（I 独处充电但能主动社交；N 看整体架构与长期；T/J 略偏，仍在确定中）',
  性格优势: '学习能力强、问题求解快、有目标时爆发力足、对自己能力有信心',
  主要短板: '长期执行稳定性不足，危机驱动型，容易觉得"还年轻、不着急"；AI 写出代码但有时不理解为什么',
  // 我要去哪
  职业方向: '全栈 → AI 工程（软件工程 → AI 工程 → 技术负责人 → 产品/商业 → 创业），2026-2029 三年路线',
  人生关键词: '不要后悔；回头看时不觉得白活了',
  金钱目标: '先建现金安全垫（约 20 万是心理节点），再提高职业收入上限，让技术产生额外收入',
  家庭目标: '有能力照顾家人，从"被照顾"转向"承担责任"',
  感情目标: '找到真正合适的另一半，拥有稳定亲密关系；从"为什么她离开我"转向"我可以更成熟"',
  // 我怎么做
  行动原则: '以成果为单位而非时间；不等待动力、建固定输出系统；做项目接触用户创造价值；不急创业，先积累技术、钱、人脉与行业理解；每年比去年强一点',
  产品意识: '动手前先调研需求，考虑用户、场景与价值，不是纯技术思维；从"会调用 AI"变成"能做 AI 系统"',
  创业潜力: '有，但路径清晰：先建技术壁垒 → 副业 → 条件成熟再创业；20 万安全垫是心理门槛，不裸辞不赌博'
}

/**
 * 可能装着手册的记录分片：近 13 个月 + getStorageInfoSync 列出的所有 diary_* key
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
    all.forEach(k => {
      if (typeof k === 'string' && k.indexOf('diary_') === 0) keys.add(k)
    })
  } catch (e) { /* 拿不到存储 key 列表就用近 13 个月 */ }
  return [...keys]
}

function scanSeedRecords(at) {
  const found = new Map()
  candidateDiaryKeys(at).forEach(key => {
    getRawList(key).forEach((item) => {
      if (item && item.client_id && !found.has(item.client_id)) {
        found.set(item.client_id, { item: item, key: key })
      }
    })
  })
  return found
}

/**
 * 内置个人画像（幂等）：记录补发/刷新 + 画像卡写入（存在即不重写，不动 enabled）
 * @param {number} [now] 生成时间（测试注入用）
 * @returns {{ added: number, updated: number, month: string, ids: string[], cardAdded: boolean }}
 */
export function ensureProfileSeed(now) {
  const at = Number(now) || Date.now()
  const month = getMonthFromDate(at)
  const key = 'diary_' + month
  const existing = scanSeedRecords(at)

  // 缺的补、旧 seed_v 的刷新（用户删掉的不动）
  const toAdd = []
  let updated = 0
  PROFILE_ARTICLES.forEach((a, i) => {
    const hit = existing.get(a.client_id)
    if (!hit) { toAdd.push(i); return }
    if (hit.item.is_deleted === 1) return
    if (Number(hit.item.seed_v) === PROFILE_SEED_VERSION) return
    const list = getRawList(hit.key)
    const target = list.find(x => x && x.client_id === a.client_id)
    if (!target) return
    target.title = a.title
    target.content = a.content
    target.tags = [PROFILE_TAG]
    target.record_type = 'note'
    target.seed = PROFILE_SEED_MARK
    target.seed_v = PROFILE_SEED_VERSION
    target.updated_at = at
    asyncSetStorageJSON(hit.key, list)
    updated++
  })

  if (toAdd.length > 0) {
    const raw = getRawList(key)
    const records = toAdd.map((i, n) => {
      const a = PROFILE_ARTICLES[i]
      return {
        client_id: a.client_id,
        title: a.title,
        content: a.content,
        record_type: 'note',
        type: 'diary',
        tags: [PROFILE_TAG],
        category: '',
        images: [],
        pinned: 0,
        emotion: '',
        ai_summary: '',
        ai_advice: '',
        seed: PROFILE_SEED_MARK,
        seed_v: PROFILE_SEED_VERSION,
        created_at: at + n,
        updated_at: at,
        is_deleted: 0
      }
    })
    asyncSetStorageJSON(key, raw.concat(records))
  }

  // 标签注册表补齐「个人画像」（归到「生活」种类）
  try {
    addCustomTag('diary', PROFILE_TAG, null, null, PROFILE_TAG_CATEGORY)
  } catch (e) { /* 标签表写失败不影响记录本身 */ }

  // 画像卡：不存在则新建；已存在则 merge 补缺失字段（用户已填的不覆盖，不动 enabled）
  let cardAdded = false
  try {
    const profile = getProfile()
    let card = (profile.cards || []).find(c => c.id === PROFILE_CARD_ID || c.title === PROFILE_CARD_TITLE)
    if (!card) {
      card = {
        id: PROFILE_CARD_ID,
        title: PROFILE_CARD_TITLE,
        icon: 'sparkle',
        fields: { ...PROFILE_CARD_FIELDS },
        source: 'ai_extracted',
        createdAt: at
      }
      profile.cards.push(card)
      cardAdded = true
    } else {
      card.fields = card.fields || {}
      let filled = false
      Object.keys(PROFILE_CARD_FIELDS).forEach(k => {
        if (!(k in card.fields) || card.fields[k] === '' || card.fields[k] == null) {
          card.fields[k] = PROFILE_CARD_FIELDS[k]
          filled = true
        }
      })
      if (filled) card.updatedAt = at
    }
    saveProfile(profile)
  } catch (e) { /* 画像卡写失败不影响记录本身 */ }

  return {
    added: toAdd.length,
    updated: updated,
    month: month,
    ids: toAdd.map(i => PROFILE_ARTICLES[i].client_id),
    cardAdded: cardAdded
  }
}
