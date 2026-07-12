/**
 * Prompt 构建器 — 系统提示词、用户画像、上下文注入
 * 从 utils/api.js 拆分，负责所有 AI 对话上下文的构建
 *
 * 缓存策略：buildSystemPrompt/getUserProfile 结果缓存 30s，
 * 数据变更时调用 invalidatePromptCache() 主动失效
 */
import { buildProfileContext } from '../profile.js'

// === 缓存 ===
let _cache = {
  systemPrompt: null,
  userProfile: null,
  systemPromptTime: 0,
  userProfileTime: 0
}
const CACHE_TTL = 30000 // 30s，窗口期内的连续请求复用同一份提示词

/** 强制失效所有缓存 — 执行器在写操作后调用 */
export function invalidatePromptCache() {
  _cache.systemPrompt = null
  _cache.userProfile = null
  _cache.systemPromptTime = 0
  _cache.userProfileTime = 0
}

/** 获取用户近期数据画像（增强版）
 * 注入：月度概览 + 最近3篇日记摘要 + 最近5笔账单 + 近7天消费趋势 + 习惯洞察
 */
export function getUserProfile(forceRefresh = false) {
  const now = Date.now()
  if (!forceRefresh && _cache.userProfile && (now - _cache.userProfileTime) < CACHE_TTL) {
    return _cache.userProfile
  }
  try {
    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const parts = []

    // === 1. 月度概览 ===
    const billRaw = uni.getStorageSync(`bill_${month}`) || '[]'
    const bills = JSON.parse(billRaw).filter(b => b.is_deleted !== 1)
    const expenseBills = bills.filter(b => b.type === 'expense')
    const totalExpense = expenseBills.reduce((s, b) => s + b.amount, 0)
    const topCategory = getTopCategory(expenseBills)

    const diaryRaw = uni.getStorageSync(`diary_${month}`) || '[]'
    const diaries = JSON.parse(diaryRaw).filter(d => d.is_deleted !== 1)
    const recentMood = diaries.length > 0 ? diaries[diaries.length - 1].mood : '未知'

    const planRaw = uni.getStorageSync('plan_all') || '[]'
    const plans = JSON.parse(planRaw).filter(p => p.is_deleted !== 1 && p.status === 1)

    parts.push(`【月度概览】本月支出 ¥${totalExpense.toFixed(0)}（${topCategory}占比最高），收入 ¥${bills.filter(b => b.type === 'income').reduce((s, b) => s + b.amount, 0).toFixed(0)}，日记 ${diaries.length} 篇（最近心情: ${recentMood}），进行中计划 ${plans.length} 个`)

    // === 2. 最近3篇日记摘要 ===
    if (diaries.length > 0) {
      const recent3 = diaries.slice(-3).reverse()
      const diaryLines = recent3.map(d => {
        const title = d.title || '无标题'
        const mood = d.mood || '平静'
        const preview = (d.content || '').substring(0, 40).replace(/\n/g, ' ')
        return `  - ${title}（${mood}）: ${preview}...`
      })
      parts.push(`【最近日记】\n${diaryLines.join('\n')}`)
    }

    // === 3. 最近5笔账单 ===
    if (bills.length > 0) {
      const recent5 = bills.slice(-5).reverse()
      const billLines = recent5.map(b => {
        const sign = b.type === 'expense' ? '-' : '+'
        return `  ${sign}¥${b.amount} ${b.category} ${b.note || ''}`.trim()
      })
      parts.push(`【最近账单】\n${billLines.join('\n')}`)
    }

    // === 4. 近7天消费趋势 ===
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const recent7Expense = expenseBills.filter(b => {
      const billDate = new Date(b.bill_date || b.created_at)
      return billDate >= sevenDaysAgo
    })
    if (recent7Expense.length > 0) {
      const avg7 = recent7Expense.reduce((s, b) => s + b.amount, 0) / 7
      const total7 = recent7Expense.reduce((s, b) => s + b.amount, 0)
      parts.push(`【近7天消费】共 ¥${total7.toFixed(0)}，日均 ¥${avg7.toFixed(1)}，${recent7Expense.length} 笔`)
    }

    // === 5. 习惯洞察 ===
    const insights = []
    if (totalExpense > 3000 && expenseBills.length > 20) {
      insights.push('本月消费较频繁，建议关注支出节奏')
    }
    if (diaries.length === 0) {
      insights.push('本月还没有写日记，可以鼓励用户记录生活')
    } else if (diaries.length >= 10) {
      insights.push('用户坚持写日记，值得鼓励')
    }
    const badMoods = diaries.filter(d => d.mood === '难过' || d.mood === '焦虑' || d.mood === '愤怒')
    if (badMoods.length > diaries.length * 0.4 && diaries.length >= 3) {
      insights.push('近期负面情绪较多，建议温柔关怀')
    }
    if (plans.length > 5) {
      insights.push('进行中计划较多，可以帮用户关注优先级')
    }
    if (insights.length > 0) {
      parts.push(`【洞察建议】${insights.join('；')}`)
    }

    const result = parts.join('\n\n')
    _cache.userProfile = result
    _cache.userProfileTime = now
    return result
  } catch {
    return null
  }
}

/** 找出支出占比最高的分类 */
export function getTopCategory(expenseBills) {
  if (expenseBills.length === 0) return '无'
  const map = {}
  expenseBills.forEach(b => {
    map[b.category] = (map[b.category] || 0) + b.amount
  })
  return Object.entries(map).sort((a, b) => b[1] - a[1])[0][0]
}

/**
 * 构建 System Prompt — 统一模式，AI 自动识别意图
 * 包含：意图识别规则、JSON 格式规范、needConfirm 高风险确认规则
 * 重要：必须注入当前日期，否则 AI 无法理解"今天/昨天/上周"等相对时间
 */
export function buildSystemPrompt(forceRefresh = false) {
  const cacheNow = Date.now()
  if (!forceRefresh && _cache.systemPrompt && (cacheNow - _cache.systemPromptTime) < CACHE_TTL) {
    return _cache.systemPrompt
  }

  const now = new Date()
  const weekDay = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()]
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const yesterday = new Date(now.getTime() - 86400000)
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const hour = now.getHours()
  const greeting = hour < 6 ? '深夜了' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : hour < 22 ? '晚上好' : '夜深了'

  // === 动态检测扩展功能是否有数据 ===
  let hasRelations = false, hasDecisions = false, hasSimulations = false
  try {
    hasRelations = JSON.parse(uni.getStorageSync('siji_relations') || '[]').filter(r => r.is_deleted !== 1).length > 0
    hasDecisions = JSON.parse(uni.getStorageSync('siji_decisions') || '[]').filter(d => d.is_deleted !== 1).length > 0
    hasSimulations = JSON.parse(uni.getStorageSync('siji_simulations') || '[]').filter(s => s.is_deleted !== 1).length > 0
  } catch { /* ignore */ }

  // === 核心 action（始终注入）===
  const coreActions = `日记：
- create_diary: {title, content(≥30字第一人称), mood(开心/平静/难过/焦虑/愤怒/满足/疲惫/兴奋), tags:[]}
- update_diary: {client_id, title?, content?, mood?}
- delete_diary: {client_id} needConfirm=true
- query_diary: {keyword?, month?}

记账：
- create_bill: {type:"expense"|"income", amount:数字(无¥), category:"餐饮/交通/购物/娱乐/医疗/住房/工资/兼职/红包/其他", note?, bill_date?默认今天}
- update_bill: {client_id, amount?, category?, note?, bill_date?, type?}
- delete_bill: {client_id} needConfirm=true
- query_bill: {month?, category?}
- query_stat: {month?}

计划：
- create_plan: {title, description, priority:0-2, subtasks:[{title}], tags:[], deadline?, estimated_time?, parent_id?}
- update_plan: {client_id, title?, description?, priority?, status?, deadline?, estimated_time?, start_time?, end_time?, subtasks?, parent_id?}
- update_plan_subtask: {client_id, subtask_id, done:bool}
- delete_plan: {client_id} needConfirm=true
- create_plan_template: {name, icon, color, description, priority, subtasks}
- query_plan: {status:"active"|"completed"|"all"}

个人信息：
- smart_update_profile: {updates:[{card,field,value}], remove:[{card,field,value}], createCard:[{id,title,icon}]}
- update_profile: {nickname?, gender?, birthday?, occupation?, location?, bio?, budget?, sleepTime?, hobbies:[], dietary:[], custom:[]}
- get_profile: {}
- clear_profile: {card?, field?} needConfirm=true
- toggle_profile: {enabled:bool}

通用：
- undo_last: {}`

  // === 扩展 action：核心 CRUD 始终注入，高级操作按数据条件注入 ===
  const extActions = []
  // 关系图谱
  let relActions = `关系图谱：\n- create_relation: {name, role(家人/朋友/同事/领导/伴侣/其他), context?, traits:[], preferences:[], notes?, relationship_score:1-10, tags:[]}\n- query_relation: {keyword?}`
  if (hasRelations) {
    relActions += `\n- update_relation: {id, name?, role?, context?, traits?, preferences?, notes?, relationship_score?, tags?}\n- delete_relation: {id} needConfirm=true\n- log_interaction: {relation_id, scene, content, result?, emotion?}\n- query_interaction: {relation_id}`
  }
  extActions.push(relActions)
  // 决策日志
  let decActions = `决策日志：\n- create_decision: {title, category(职业/感情/财务/生活/其他), status:"thinking", deadline?, options:[{name,pros:[],cons:[],weight:1-10}], stakeholders:[], factors:[]}\n- query_decision: {status?, category?}`
  if (hasDecisions) {
    decActions += `\n- update_decision: {id, title?, category?, status?(thinking/decided/acted/abandoned), decision?, reasoning?, deadline?}\n- review_decision: {id, review_notes, outcome?}\n- analyze_decisions: {}`
  }
  extActions.push(decActions)
  // 情景模拟
  let simActions = `情景模拟：\n- start_simulation: {mode?:"social"|"planning"|"relationship", relation_id?, relation_name?, scene, goal}`
  if (hasSimulations) {
    simActions += `\n- end_simulation: {conversation_id}`
  }
  extActions.push(simActions)

  // === 行为准则（动态）===
  const behaviorRules = [
    '闲聊/倾诉/问好/吐槽 → action.type 必须是 "none"，不要强行创建操作',
    '仅在用户明确请求操作时（"帮我记"/"帮我查"/"帮我建"等）才执行 action',
    '用户透露个人信息 → 先友好回应，再在 reply 末尾问"需要我帮你记录吗？"，用户同意后才 smart_update_profile',
    '用户说"改/删除/撤销" → 对应 update_*/delete_*/undo_last，不确定目标时先 query',
    '创建计划必须含 subtasks(3-8个) + description，尽量填 deadline',
    '日记 content 整理为用户原话的完整段落',
    '修改操作理解错别字（如"心别"="性别"）',
    '消息开头标记如 [¥记账] 必须按标记执行',
    '用户提到新人物 → 主动 create_relation',
    '用户提到要做重要决定 → 主动 create_decision',
    '用户说"模拟演练"/"练习对话"→ start_simulation'
  ]

  const basePrompt = `${greeting}！你是「思迹」，一个温暖简洁的个人生活助手，支持记账、日记、计划、人脉管理、决策记录、情景演练。\n\n当前时间：${todayStr} 星期${weekDay} ${timeStr}（昨天 ${yesterdayStr}）\n\n## ⚠️ 输出格式（必须遵守）\n你必须返回纯 JSON，不要包含任何多余文本、markdown 或代码块标记。\nJSON 结构：\n{"reply":"给用户的自然语言回复","action":{"type":"none","payload":{},"needConfirm":false}}\n\n示例1（闲聊）：\n用户：今天好累\n你：{"reply":"辛苦了，早点休息吧~","action":{"type":"none","payload":{},"needConfirm":false}}\n\n示例2（记账）：\n用户：午饭花了25\n你：{"reply":"已帮你记下午餐 ¥25","action":{"type":"create_bill","payload":{"type":"expense","amount":25,"category":"餐饮","bill_date":"${todayStr}"},"needConfirm":false}}\n\n## 核心铁律\n1. reply 是第一优先级：温暖、简洁、自然，闲聊 1-3 句\n2. 不要为了执行操作而强行解读用户意图——先聊天，再确认\n3. reply 中说"已记录/已更新/已帮你"等词 → action.type 必须非 none，且 payload 必须完整\n4. 禁止在 reply 中写 [执行结果: xxx] 或任何 JSON/代码\n5. 默认 action.type = "none"，除非用户明确要求你执行某操作\n6. 用户告知个人信息时，先友好回应并询问"需要我帮你记录吗？"，用户同意后才执行 smart_update_profile\n\n## action 类型\n${coreActions}${extActions.length ? '\n\n' + extActions.join('\n') : ''}\n\n## needConfirm\n- 金额≥500、所有 delete_* → true；update_* → false\n\n## client_id\n执行结果中 ID=xxx 即 client_id\n\n## 行为准则\n${behaviorRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}`

  const profileCtx = buildProfileContext()
  const result = profileCtx ? basePrompt + '\n\n' + profileCtx : basePrompt
  _cache.systemPrompt = result
  _cache.systemPromptTime = cacheNow
  return result
}
