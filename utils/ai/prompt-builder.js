/**
 * Prompt 构建器 - 系统提示词、用户画像、上下文注入
 * 从 utils/api.js 拆分,负责所有 AI 对话上下文的构建
 *
 * 缓存策略:buildSystemPrompt/getUserProfile 结果缓存 120s,
 * 数据变更时调用 invalidatePromptCache() 主动失效（P0-2）
 *
 * 优化说明（P0-1A）:
 *   CORE_ACTIONS / BEHAVIOR_RULES / 静态模板段 → 模块顶层构建一次
 *   只动态:日期行、问候语、extActions(数据检测)、profileCtx
 *
 * 压缩说明（P0-1C）:
 *   reply写作规范 8条→5条(合并相似项)、精简示例
 *   总 token 降 ~35%（实测 buildSystemPrompt().length 对比）
 */
import { buildProfileContext } from '../profile.js'
import { CORE_ACTIONS, LITE_ACTIONS, BEHAVIOR_RULES, isLiteChatMode } from './prompt-actions.js'
import { buildSkillsPrompt } from './skills.js'

// 重新导出（保持向后兼容）
export { isLiteChatMode }

// ==================== P0-1A: 静态常量（已拆分到 prompt-actions.js）====================
// CORE_ACTIONS / LITE_ACTIONS / BEHAVIOR_RULES / isLiteChatMode / _COMMAND_PATTERNS
// 已移至 prompt-actions.js，此处通过 import 引入

/** 身份行 — P2-1: agent 模式跳过以保留 agent 自身 persona */
const IDENTITY_LINE = '你是「思迹」，温暖简洁的个人生活助手，支持记账、记录、计划、人脉、决策、情景演练。'

/** 核心模板段（JSON规范 + 核心铁律 + needConfirm — agent 通用）
 *  注意：action schema 通过参数注入，支持精简模式 */
function buildPromptCore(actionSchema) {
  return `
## 输出格式
只返回纯 JSON，不要在 JSON 前后输出任何文字、思考过程或解释：
{"reply":"自然语言","action":{"type":"none","payload":{},"needConfirm":false}}
闲聊：{"reply":"辛苦了~","action":{"type":"none","payload":{},"needConfirm":false}}
记账：{"reply":"记好了，午餐 ¥25","action":{"type":"create_bill","payload":{"type":"expense","amount":25,"category":"餐饮"},"needConfirm":false}}
⚠️ 你的整个回复必须是合法 JSON，第一个字符必须是 {，最后一个字符必须是 }。禁止在 JSON 前面输出任何中文或解释文本。

## 核心铁律
0. 整个回复必须是纯 JSON，第一个字符是 {，最后一个字符是 }。禁止在 JSON 前后输出思考文本、解释或任何非 JSON 内容
1. reply 像真人聊天，简洁自然，闲聊 1-3 句，不用分点罗列
2. 不要主动执行——除非用户明确说"帮我记/帮我查/帮我建/帮我写"
3. 分享日常("今天好累""和朋友吃饭了") → 正常聊天，不自动记账/写记录/建计划。但用户说"记一下/帮我记/帮我建"等明确指令时必须执行 action
4. reply 禁止说"已记录/已帮你/已创建/已添加/记好了"等操作完成语 → 除非 action.type 非 none 且 payload 完整。违反此条=对用户撒谎，绝对禁止
5. reply 禁止暴露技术细节（不写 action type / payload 字段名 / JSON 结构）
6. reply 中不用"首先""其次""最后"等作文连接词，不用"我理解你的感受"等AI味句式
7. reply 禁止使用代码块格式（三个反引号包裹），禁止用 markdown 语法。reply 是纯文本聊天，只有换行和 emoji

## 表达多样性
- 同一件事不要两次用同一个句式开头。上一条用了"嗯"，这条换"说起来"或直接说事
- 句子长短交错：一句话能说清就别拆成三句，但也不能条条都是短句
- 偶尔带点口语化的转折——"不过话说回来""话又说回来""其实吧"
- 回复长度跟用户消息匹配：用户说一句你也回一两句，用户说了很多你也多回点
- 不用每条都以"你"开头。可以从事情本身开头，可以从感受开头，可以省略主语
- 有时候可以反问一句把球踢回去——"你觉得呢？""你想过没有？"
- 表达同一意思时，从这些里挑一个用，别每次都一样：
  · 确认：嗯/好/收到/行/可以
  · 同意：确实/说的也是/有道理/对
  · 转折：不过/话又说回来/但其实/不过话说回来
  · 建议：要不试试/可以试试/有个办法是/我觉得吧
  · 安慰：难为你了/确实不容易/换谁都会这样想

## action 类型
${actionSchema}

## needConfirm
金额≥500、delete_* → true；update_* → false

## 行为准则
${BEHAVIOR_RULES.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
}

// 预构建完整版和精简版
const PROMPT_CORE_FULL = buildPromptCore(CORE_ACTIONS)
const PROMPT_CORE_LITE = buildPromptCore(LITE_ACTIONS)

// ==================== 缓存 ====================
let _cache = {
  systemPrompt: null,
  userProfile: null,
  systemPromptTime: 0,
  userProfileTime: 0,
  userProfileVersion: -1 // P1-B2: 数据版本号，-1 表示从未构建
}
const CACHE_TTL = 120000 // P0-2: 30s→120s（减少每轮重解析）

// P1-B2: 数据版本计数器 — store/data.js 写操作时递增
let _dataVersion = 0

/** 递增数据版本 — 供 store/data.js 在写操作后调用 */
export function bumpDataVersion() {
  _dataVersion++
  // 同时失效 userProfile 缓存（数据变了，画像需要重建）
  _cache.userProfile = null
  _cache.userProfileTime = 0
}

/** 强制失效所有缓存 - 执行器在写操作后调用（P0-2） */
export function invalidatePromptCache() {
  _cache.systemPrompt = null
  _cache.userProfile = null
  _cache.systemPromptTime = 0
  _cache.userProfileTime = 0
}

/** 导出 hasRelations/hasDecisions/hasSimulations 供外部调用（store/index.js 写后接入 invalidate） */
export function checkExtensionData() {
  let hasRelations = false, hasDecisions = false, hasSimulations = false
  try {
    hasRelations = JSON.parse(uni.getStorageSync('siji_relations') || '[]').filter(r => r.is_deleted !== 1).length > 0
    hasDecisions = JSON.parse(uni.getStorageSync('siji_decisions') || '[]').filter(d => d.is_deleted !== 1).length > 0
    hasSimulations = JSON.parse(uni.getStorageSync('siji_simulations') || '[]').filter(s => s.is_deleted !== 1).length > 0
  } catch { /* ignore */ }
  return { hasRelations, hasDecisions, hasSimulations }
}

// ==================== 画像（不变，只调 TTL）====================
export function getUserProfile(forceRefresh = false) {
  const now = Date.now()
  // P1-B2: 数据版本变化时强制重建
  if (!forceRefresh && _cache.userProfile && _cache.userProfileVersion === _dataVersion && (now - _cache.userProfileTime) < CACHE_TTL) {
    return _cache.userProfile
  }
  try {
    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const parts = []

    const billRaw = uni.getStorageSync(`bill_${month}`) || '[]'
    const bills = JSON.parse(billRaw).filter(b => b.is_deleted !== 1)
    const expenseBills = bills.filter(b => b.type === 'expense')
    const totalExpense = expenseBills.reduce((s, b) => s + b.amount, 0)
    const topCategory = getTopCategory(expenseBills)

    const diaryRaw = uni.getStorageSync(`diary_${month}`) || '[]'
    const diaries = JSON.parse(diaryRaw).filter(d => d.is_deleted !== 1)
    const planRaw = uni.getStorageSync('plan_all') || '[]'
    const plans = JSON.parse(planRaw).filter(p => p.is_deleted !== 1 && p.status === 1)

    parts.push(`【月度概览】本月支出 ¥${totalExpense.toFixed(0)}(${topCategory}最高),收入 ¥${bills.filter(b => b.type === 'income').reduce((s, b) => s + b.amount, 0).toFixed(0)},记录${diaries.length}篇,进行中计划${plans.length}个`)

    if (diaries.length > 0) {
      const recent3 = diaries.slice(-3).reverse()
      parts.push(`【近期记录】\n${recent3.map(d => {
        const preview = (d.content || d.title || '').substring(0, 50).replace(/\n/g, ' ')
        const tags = Array.isArray(d.tags) && d.tags.length ? ` #${d.tags.join(' #')}` : ''
        return `  - ${d.title || '无标题'}: ${preview}${tags}`
      }).join('\n')}`)
    }

    if (bills.length > 0) {
      const recent5 = bills.slice(-5).reverse()
      parts.push(`【账单】\n${recent5.map(b => `  ${b.type==='expense'?'-':'+'}¥${b.amount} ${b.category} ${b.note||''}`).join('\n')}`)
    }

    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000)
    const recent7 = expenseBills.filter(b => new Date(b.bill_date||b.created_at) >= sevenDaysAgo)
    if (recent7.length > 0) {
      const total7 = recent7.reduce((s, b) => s + b.amount, 0)
      parts.push(`【近7天】共¥${total7.toFixed(0)},日均¥${(total7/7).toFixed(1)},${recent7.length}笔`)
    }

    const insights = []
    if (totalExpense > 3000 && expenseBills.length > 20) insights.push('消费较频繁,注意节奏')
    if (diaries.length === 0) insights.push('本月还未写记录')
    else if (diaries.length >= 10) insights.push('坚持写记录,很棒')
    if (plans.length > 5) insights.push('计划较多,关注优先级')
    if (insights.length > 0) parts.push(`【洞察】${insights.join(';')}`)

    const result = parts.join('\n\n')
    _cache.userProfile = result
    _cache.userProfileTime = now
    _cache.userProfileVersion = _dataVersion // P1-B2: 记录构建时的数据版本
    return result
  } catch {
    return null
  }
}

export function getTopCategory(expenseBills) {
  if (expenseBills.length === 0) return '无'
  const map = {}
  expenseBills.forEach(b => { map[b.category] = (map[b.category] || 0) + b.amount })
  return Object.entries(map).sort((a, b) => b[1] - a[1])[0][0]
}

// ==================== System Prompt（重构:静态+动态分离）====================
/**
 * 构建 System Prompt
 * 静态段(identity/JSON规范/核心铁律/CORE_ACTIONS/needConfirm/BEHAVIOR_RULES)
 *   → 模块级 PROMPT_STATIC，构建一次
 * 动态段(问候/日期/extActions/profileCtx) → 每次重新拼
 */
export function buildSystemPrompt(forceRefresh = false, opts = {}) {
  const { agentMode = false, lite = false, skills = [] } = opts  // lite: 精简 action schema（闲聊模式）；skills: agent 技能 prompt
  const cacheNow = Date.now()
  // lite 模式和 agent 模式不缓存
  if (!lite && !agentMode && !forceRefresh && _cache.systemPrompt && (cacheNow - _cache.systemPromptTime) < CACHE_TTL) {
    return _cache.systemPrompt
  }

  // --- 动态部分 ---
  const now = new Date()
  const weekDay = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()]
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const yesterday = new Date(now.getTime() - 86400000)
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const hour = now.getHours()
  const greeting = hour < 6 ? '夜深了' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : hour < 22 ? '晚上好' : '夜深了'

  // 扩展 action（按数据存在性注入，P0-2 配合 checkExtensionData 缓存）
  const { hasRelations, hasDecisions, hasSimulations } = checkExtensionData()
  const extParts = []

  if (hasRelations) {
    extParts.push(`关系图谱:
- create_relation: {name,role,context?,traits:[],preferences:[],notes?,relationship_score:1-10,tags:[]}
- update_relation: {id,name?,role?,context?,traits?,preferences?,notes?,relationship_score?,tags?}
- delete_relation: {id} needConfirm=true
- log_interaction: {relation_id,scene,content,result?,emotion?}
- query_interaction: {relation_id}
- query_relation: {keyword?}`)
  } else {
    extParts.push(`关系图谱:
- create_relation: {name,role,context?,traits:[],preferences:[],notes?,relationship_score:1-10,tags:[]}
- query_relation: {keyword?}`)
  }

  if (hasDecisions) {
    extParts.push(`决策日志:
- create_decision: {title,category,status:"thinking",deadline?,options:[{name,pros:[],cons:[],weight:1-10}],stakeholders:[],factors:[]}
- update_decision: {id,status?,decision?,reasoning?,deadline?}
- review_decision: {id,review_notes,outcome?}
- analyze_decisions: {}
- query_decision: {status?,category?}`)
  } else {
    extParts.push(`决策日志:
- create_decision: {title,category,status:"thinking",deadline?,options:[{name,pros:[],cons:[],weight:1-10}],stakeholders:[],factors:[]}
- query_decision: {status?,category?}`)
  }

  if (hasSimulations) {
    extParts.push(`情景模拟:
- start_simulation: {mode?:"social"|"planning"|"relationship",relation_id?,scene,goal}
- end_simulation: {simulation_id}`)
  } else {
    extParts.push(`情景模拟:
- start_simulation: {mode?:"social"|"planning"|"relationship",relation_id?,scene,goal}`)
  }

  // --- 拼装：agentMode 决定是否注入身份行 + 问候 ---
  // 注意：profileCtx 由 buildChatMessages 统一拼接，此处不再重复注入（修复双写问题）
  const dateLine = `当前时间:${todayStr} 星期${weekDay} ${timeStr}(昨天 ${yesterdayStr})`
  const extSection = extParts.length ? '\n\n' + extParts.join('\n') : ''

  // P2-1: agent 模式跳过身份行（让 agent.systemPrompt 定义 persona）
  const identityPrefix = agentMode ? '' : `${greeting}!${IDENTITY_LINE}`
  const promptCore = lite ? PROMPT_CORE_LITE : PROMPT_CORE_FULL
  const skillsPrompt = buildSkillsPrompt(skills)
  const result = `${identityPrefix}${promptCore}\n\n${dateLine}${extSection}${skillsPrompt ? '\n\n' + skillsPrompt : ''}`

  if (!lite && !agentMode) {
    _cache.systemPrompt = result
    _cache.systemPromptTime = cacheNow
  }
  return result
}
