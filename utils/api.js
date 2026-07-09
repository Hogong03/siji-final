/**
 * API 错误分类 — 统一错误处理
 */
import { buildMemoryContext } from '@/utils/memory.js'
import { logger } from './logger.js'
import { buildProfileContext } from '@/utils/profile.js'
export class ApiError extends Error {
  constructor(message, type, statusCode, retryable) {
    super(message);
    this.name = 'ApiError';
    this.type = type;         // 'network' | 'auth' | 'rateLimit' | 'server' | 'client' | 'timeout'
    this.statusCode = statusCode || 0;
    this.retryable = retryable !== undefined ? retryable : false;
  }
}

﻿/**
 * HTTP 请求封装 (uni.request + 重试)
 *
 * BASE_URL 配置：
 *   H5 开发: /api (Vite proxy → localhost:3000)
 *   APP 生产: https://your-server.ucloud.cn/api
 */

// TODO: 部署时改为 UCloud 地址
const BASE_URL = '/api'

/** 通用请求 */
export function request(options) {
  const { url, method = 'GET', data, timeout = 15000 } = options
  const deviceId = uni.getStorageSync('siji_device_id') || ''

  return new Promise((resolve, reject) => {
    uni.request({
      url: BASE_URL + url,
      method,
      data,
      timeout,
      header: {
        'Content-Type': 'application/json',
        'X-Device-Id': deviceId
      },
      success(res) {
        const { statusCode, data: body } = res
        if (statusCode === 200 && body && body.code === 0) {
          resolve(body.data)
        } else {
          reject(new Error(body?.message || `HTTP ${statusCode}`))
        }
      },
      fail(err) {
        reject(new Error(err.errMsg || 'Network error'))
      }
    })
  })
}

/** GET 请求 */
export function get(url, params = {}, timeout) {
  const query = Object.keys(params)
    .filter(k => params[k] !== undefined && params[k] !== null)
    .map(k => `${k}=${encodeURIComponent(params[k])}`)
    .join('&')
  return request({ url: query ? `${url}?${query}` : url, method: 'GET', timeout })
}

/** POST 请求 */
export function post(url, data, timeout) {
  return request({ url, method: 'POST', data, timeout })
}

/** PUT 请求 */
export function put(url, data, timeout) {
  return request({ url, method: 'PUT', data, timeout })
}

/** DELETE 请求 */
export function del(url, timeout) {
  return request({ url, method: 'DELETE', timeout })
}

/**
 * DeepSeek 聊天请求 (直接调用 DeepSeek API)
 * 优化：AI 自动识别意图，无需手动切换模式
 * 支持：用户画像注入、对话上下文、needConfirm 高风险确认、自动重试、离线降级
 */
export function chatRequest(message, contextType, conversationId, config, history) {
  // 兼容旧调用：config 为字符串时当作 deepseek apiKey
  const cfg = typeof config === 'string'
    ? { provider: 'deepseek', model: 'deepseek-v4-flash', apiKey: config }
    : (config || getDefaultConfig())
  return chatRequestWithRetry(message, conversationId, cfg, 0, history)
}

/**
 * 带重试的聊天请求 — 最多重试 2 次
 * 重试策略：网络错误重试，429/500+ 重试，400/401 不重试，空回复自动重试
 */
function chatRequestWithRetry(message, conversationId, cfg, retryCount, history) {
  const maxRetries = 2
  const providerName = getProvider(cfg.provider).name
  const apiKey = cfg.apiKey || getProviderKeys()[cfg.provider] || uni.getStorageSync('siji_api_key') || ''

  return new Promise((resolve, reject) => {
    const chatHistory = history || getRecentHistory()
    const messages = buildChatMessages(message, chatHistory, cfg)
    const reqOpts = buildProviderRequest(cfg.provider, cfg.model, messages, apiKey, cfg.temperature)

    uni.request({
      ...reqOpts,
      success(res) {
        if (res.statusCode === 200 && res.data?.choices) {
          const raw = res.data.choices[0]?.message?.content || ''
          const parsed = parseAiResponse(raw, conversationId)

          // 空回复自动重试 — 模型偶发返回空内容
          if (!parsed.reply || !parsed.reply.trim() || parsed.reply.includes('走神了')) {
            if (retryCount < maxRetries) {
              // Layer 3: 第二次重试时精简用户消息，去掉标记和冗余内容
              const simplifiedMsg = retryCount === 0
                ? message
                : message.replace(/^\[[^\]]+\]\s*/g, '').trim().substring(0, 100)
              logger.warn(`[${providerName} Empty Reply] Auto retry ${retryCount + 1}/${maxRetries}, msg: "${simplifiedMsg.substring(0, 30)}..."`)
              setTimeout(() => {
                chatRequestWithRetry(simplifiedMsg, conversationId, cfg, retryCount + 1, chatHistory)
                  .then(resolve).catch(reject)
              }, 1000)
              return
            }
          }

          resolve(parsed)
        } else {
          const errMsg = res.data?.error?.message || res.data?.message || `HTTP ${res.statusCode}`
          logger.error(`[${providerName} API Error]`, res.statusCode, JSON.stringify(res.data))

          if ((res.statusCode === 429 || res.statusCode >= 500) && retryCount < maxRetries) {
            // 优先使用服务端 Retry-After header
            const retryAfter = res.header?.['Retry-After'] || res.header?.['retry-after']
            const delay = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, retryCount) * 1500
            logger.warn(`[${providerName} Retry] ${res.statusCode}, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`)
            setTimeout(() => {
              chatRequestWithRetry(message, conversationId, cfg, retryCount + 1, chatHistory)
                .then(resolve).catch(reject)
            }, delay)
            return
          }

          if (res.statusCode === 401) {
            reject(new ApiError(`${providerName} API Key 无效，请在设置页检查配置`, 'auth', 401, false))
            return
          }

          if (res.statusCode === 400) {
            logger.error(`[${providerName} 400 Detail]`, errMsg)
            // 400 可能是 response_format 不兼容 — 去掉 response_format 重试一次
            if (retryCount < maxRetries) {
              logger.warn(`[${providerName} 400] Retry without response_format`)
              const retryCfg = { ...cfg }
              setTimeout(() => {
                chatRequestWithRetryNoFormat(message, conversationId, retryCfg, chatHistory)
                  .then(resolve).catch(reject)
              }, 1000)
              return
            }
            resolve(fallbackResponse(message, `请求格式错误: ${errMsg}`))
            return
          }

          reject(new ApiError(errMsg, 'server', res.statusCode, false))
        }
      },
      fail(err) {
        logger.error(`[${providerName} Network Error]`, err.errMsg)

        if (retryCount < maxRetries) {
          const delay = Math.pow(2, retryCount) * 1500
          logger.warn(`[${providerName} Retry] Network error, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`)
          setTimeout(() => {
            chatRequestWithRetry(message, conversationId, cfg, retryCount + 1, chatHistory)
              .then(resolve).catch(reject)
          }, delay)
          return
        }

        logger.warn(`[${providerName} Fallback] Max retries exceeded, returning offline response`)
        resolve(fallbackResponse(message, '网络连接失败，请稍后再试'))
      }
    })
  })
}

/**
 * 无 response_format 重试 — 用于 400 错误的降级
 */
function chatRequestWithRetryNoFormat(message, conversationId, cfg, history) {
  const providerName = getProvider(cfg.provider).name
  const apiKey = cfg.apiKey || getProviderKeys()[cfg.provider] || ''
  const chatHistory = history || getRecentHistory()
  const messages = buildChatMessages(message, chatHistory, cfg)
  const provider = getProvider(cfg.provider)

  return new Promise((resolve, reject) => {
    const data = { model: cfg.model, messages, temperature: cfg.temperature ?? 0.8 }
    // 不设置 response_format

    uni.request({
      url: provider.endpoint,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      data,
      timeout: 45000,
      success(res) {
        if (res.statusCode === 200 && res.data?.choices) {
          const raw = res.data.choices[0]?.message?.content || ''
          resolve(parseAiResponse(raw, conversationId))
        } else {
          resolve(fallbackResponse(message, `请求失败: HTTP ${res.statusCode}`))
        }
      },
      fail() {
        resolve(fallbackResponse(message, '网络连接失败'))
      }
    })
  })
}

/**
 * 降级响应 — AI 不可用时的兜底回复
 * 尝试从用户消息中提取简单意图，否则返回友好提示
 */
function fallbackResponse(userMessage, errorDetail) {
  // 尝试简单意图匹配（不依赖 AI）
  const msg = userMessage.toLowerCase()

  // 金额提取
  const amountMatch = userMessage.match(/(\d+(?:\.\d+)?)\s*[块元¥]/)
  if (amountMatch) {
    const amount = parseFloat(amountMatch[1])
    let category = '其他'
    if (/餐|饭|吃|外卖|午饭|晚饭|早饭/.test(userMessage)) category = '餐饮'
    else if (/车|打车|地铁|公交|加油/.test(userMessage)) category = '交通'
    else if (/咖啡|奶茶|饮料|茶/.test(userMessage)) category = '餐饮'
    else if (/买|购|超市|商品/.test(userMessage)) category = '购物'
    else if (/电影|游戏|玩|KTV/.test(userMessage)) category = '娱乐'
    else if (/药|医院|看病|诊/.test(userMessage)) category = '医疗'
    else if (/房租|水电|物业/.test(userMessage)) category = '住房'

    // 尝试离线记账
    try {
      const now = new Date()
      const billDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const bill = {
        client_id: `bill_offline_${Date.now()}`,
        type: 'expense',
        amount,
        category,
        note: userMessage.substring(0, 50),
        bill_date: billDate,
        created_at: now.getTime(),
        updated_at: now.getTime(),
        is_deleted: 0
      }
      // 存入待同步队列
      const queue = JSON.parse(uni.getStorageSync('siji_offline_queue') || '[]')
      queue.push({ type: 'bill', data: bill })
      uni.setStorageSync('siji_offline_queue', JSON.stringify(queue))

      return {
        reply: `🌐 离线模式：已暂存记账 ${category} ¥${amount}，网络恢复后自动同步。`,
        action: null,
        actions: [],
        suggestions: ['查看本月账单', '再记一笔'],
        conversation_id: '',
        offline: true,
        error: errorDetail
      }
    } catch {
      return {
        reply: `🌐 离线模式：识别到记账 ${category} ¥${amount}，但暂存失败。请网络恢复后重试。`,
        action: null,
        actions: [],
        conversation_id: '',
        offline: true,
        error: errorDetail
      }
    }
  }

  // 日记意图
  if (/心情|日记|记录|今天|开心|难过|累/.test(userMessage)) {
    return {
      reply: `🌐 离线模式：我现在无法处理你的消息。\n你可以直接在「功能」页手动写日记，等网络恢复后再通过对话记录。`,
      action: null,
      actions: [],
      suggestions: [],
      conversation_id: '',
      offline: true,
      error: errorDetail
    }
  }

  // 默认降级
  return {
    reply: `抱歉，我现在暂时无法回复。${errorDetail ? `（${errorDetail}）` : ''}\n请检查网络或 API Key 配置后重试。`,
    action: null,
    actions: [],
    suggestions: [],
    conversation_id: '',
    offline: true,
    error: errorDetail
  }
}

/**
 * 构建聊天上下文消息
 * 优化：不再依赖 contextType 区分模式，AI 自动识别意图
 * 增强：注入用户画像数据，让 AI 更个性化
 * 支持自定义 Agent 系统提示词（cfg.systemPrompt）
 */
function buildChatMessages(userMessage, history, cfg) {
  // 始终使用 buildSystemPrompt() 作为基础（包含 JSON 格式、意图识别、action 定义等核心指令）
  // 如果 Agent 提供了自定义系统提示词，作为人设前缀拼接到基础提示词前面
  let system = buildSystemPrompt()
  if (cfg && cfg.systemPrompt) {
    system = cfg.systemPrompt + '\n\n---\n\n' + system
  }

  // 注入用户画像上下文（合并到同一个 system 消息中）
  const profile = getUserProfile()
  if (profile) {
    system += `\n\n---\n用户近期数据：\n${profile}`
  }

  // 注入长期记忆
  const memoryContext = buildMemoryContext()
  if (memoryContext) {
    system += memoryContext
  }

  const messages = [{ role: 'system', content: system }]

  // ===== 对话摘要压缩：有摘要时用摘要替换早期消息 =====
  const convSummary = cfg && cfg.convSummary ? cfg.convSummary : null
  const summaryIndex = cfg && cfg.summaryIndex ? cfg.summaryIndex : 0

  if (convSummary && summaryIndex > 0 && history && history.length > summaryIndex) {
    // 注入摘要作为上下文
    messages.push({ role: 'system', content: `【对话历史摘要】${convSummary}` })
    // 只保留摘要之后的消息
    const recentHistory = history.slice(summaryIndex)
    recentHistory.forEach(msg => messages.push(msg))
  } else if (history && history.length > 0) {
    // 无摘要时走原有截断逻辑
    const MAX_HISTORY_TOKENS = 4000
    const MIN_KEEP = 6
    const MAX_KEEP = 12  // 从 20 降到 12，减少上下文噪音

    const truncated = []
    let tokenEstimate = 0
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i]
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      const msgTokens = content.length * 2 + 10
      if (tokenEstimate + msgTokens > MAX_HISTORY_TOKENS && truncated.length >= MIN_KEEP) break
      truncated.unshift(msg)
      tokenEstimate += msgTokens
      if (truncated.length >= MAX_KEEP) break
    }
    truncated.forEach(msg => messages.push(msg))
  }

  messages.push({ role: 'user', content: userMessage })
  return messages
}

/**
 * 生成对话摘要 — 用 AI 压缩早期消息为简短摘要
 * 当对话超过 15 条时异步调用，摘要存储在会话中供后续请求使用
 */
export async function generateConversationSummary(messages, cfg) {
  if (!messages || messages.length < 8) return null

  // 构建对话文本（只取前 N-6 条，保留最新 6 条不压缩）
  const toSummarize = messages.slice(0, -6)
  const dialogue = toSummarize
    .map(m => {
      if (m.role === 'user') return `用户: ${m.content || ''}`
      const text = ((m.aiReply || m.content || '')).replace(/\[执行结果:.*?\]/gs, '').trim()
      return text ? `AI: ${text}` : null
    })
    .filter(Boolean)
    .join('\n')

  if (!dialogue.trim()) return null

  try {
    const result = await chatRequest(
      '用2-3句话总结以上对话：用户做了什么操作（记账/日记/计划，保留ID）、说了哪些个人信息、有哪些重要上下文。只输出总结不要JSON。',
      null, null,
      { ...cfg, temperature: 0.2 },
      []  // 空历史，只做总结
    )
    const summary = result?.reply?.trim()
    if (summary && summary.length > 10 && summary.length < 500) {
      return summary
    }
  } catch (e) {
    logger.warn('[思迹] 对话摘要生成失败:', e)
  }
  return null
}

/**
 * 获取用户近期数据画像（增强版）
 * 注入：月度概览 + 最近3篇日记摘要 + 最近5笔账单 + 近7天消费趋势 + 习惯洞察
 */
function getUserProfile() {
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

    return parts.join('\n\n')
  } catch {
    return null
  }
}

/** 找出支出占比最高的分类 */
function getTopCategory(expenseBills) {
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
function buildSystemPrompt() {
  const now = new Date()
  const weekDay = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()]
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const yesterday = new Date(now.getTime() - 86400000)
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const hour = now.getHours()
  const greeting = hour < 6 ? '深夜了' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : hour < 22 ? '晚上好' : '夜深了'

  const basePrompt = `你是「思迹」，一个温暖简洁的个人生活助手。用户可以跟你聊天、记账、写日记、做计划。

当前时间：${todayStr} 星期${weekDay} ${timeStr}（昨天 ${yesterdayStr}）

## 输出格式（严格遵守）
纯 JSON，无 markdown 包裹，无 <think> 标签：
{"reply": "回复内容", "action": {"type": "...", "payload": {}, "needConfirm": false}}
多意图用 actions 数组：{"reply": "...", "actions": [...]}

## 核心铁律
1. reply 必须存在，闲聊用 type:"none"
2. **reply 中说"已记录/已更新/已帮你"等操作词 → action/actions 必须非空**，禁止空谈
3. **禁止在 reply 中写 [执行结果: xxx]**，系统会自动生成
4. 回复简洁：操作类一句话，闲聊 1-3 句

## action 类型（仅提供 payload 关键字段）

日记：
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
  固定卡片: basic(昵称/性别/生日/职业/所在地/自我介绍), lifestyle(预算/作息/爱好/饮食)
  自定义卡片存 MBTI/血型/星座等；标量覆盖，数组追加去重
- update_profile: {nickname?, gender?, birthday?, occupation?, location?, bio?, budget?, sleepTime?, hobbies:[], dietary:[], custom:[]}
- get_profile: {}
- clear_profile: {card?, field?} needConfirm=true
- toggle_profile: {enabled:bool}

通用：
- undo_last: {}

## needConfirm
- 金额≥500、所有 delete_* → true
- update_* → false（用户可撤销）

## client_id 获取
执行结果中 [执行结果: ... ID=xxx] 即为 client_id。上下文有 ID 直接使用，无 ID 则先 query 再操作。

## 关键行为准则
- 用户透露个人信息（名字/地点/爱好/饮食/MBTI/血型等）→ 主动 smart_update_profile
- 用户说"改/删除/撤销" → 对应 update_*/delete_*/undo_last，不确定目标时先 query
- 创建计划必须含 subtasks(3-8个) + description，尽量填 deadline
- 日记 content 整理为用户原话的完整段落
- 修改操作理解错别字（如"心别"="性别"）
- 消息开头标记如 [¥记账] 必须按标记执行
- 当前时段：${greeting}`

  const profileCtx = buildProfileContext()
  return profileCtx ? basePrompt + '\n\n' + profileCtx : basePrompt
}

/**
 * 获取最近对话历史（从 Storage 中转）
 */
function getRecentHistory() {
  try {
    // 优先从多会话存储读取当前活跃会话的历史
    const convRaw = uni.getStorageSync('siji_conversations')
    if (convRaw) {
      const convs = JSON.parse(convRaw)
      if (Array.isArray(convs) && convs.length > 0) {
        const activeId = uni.getStorageSync('siji_active_conversation')
        const conv = activeId
          ? convs.find(c => c.id === activeId)
          : convs[0]
        if (conv && conv.messages && conv.messages.length > 0) {
          // 取最近 15 条有效消息，过滤掉 loading/空消息
          const recent = conv.messages
            .filter(m => {
              if (m.role === 'user') return m.content && m.content.trim()
              if (m.role === 'assistant') return m.aiReply || (m.content && m.content.trim())
              return false
            })
            .slice(-20)
          return recent.map(m => ({
            role: m.role,
            // 优先用 aiReply（纯 AI 回复），避免 displayContent 含执行结果后缀污染上下文
            content: m.aiReply || m.content
          }))
        }
      }
    }
    // 降级：旧格式
    const raw = uni.getStorageSync('siji_chat_history') || '[]'
    const all = JSON.parse(raw)
    return all.slice(-15).map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? (m.aiReply || m.content) : JSON.stringify(m.content)
    }))
  } catch {
    return []
  }
}

/**
 * 解析 AI 响应 — 容错处理，支持单意图/复合意图/撤销
 */
function parseAiResponse(raw, conversationId) {
  // 空内容兜底
  if (!raw || !raw.trim()) {
    logger.warn('[思迹] AI 返回空内容，返回友好兜底')
    return {
      reply: '抱歉，我刚才走神了，能再说一次吗？',
      action: null,
      actions: [],
      suggestions: [],
      conversation_id: conversationId || ''
    }
  }

  let cleaned = raw.trim()

  // 剥离 <think>...</think> 思考链标签（部分模型如 DeepSeek-R1 会返回）
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()

  // 剥离 <thinking>...</thinking> 变体
  cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim()

  // 清理可能的 markdown 代码块包裹
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  }

  let parsed
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    // 尝试从文本中提取 JSON 对象（贪婪匹配最后一个 { ... }）
    const jsonMatches = cleaned.match(/\{[\s\S]*\}/g)
    if (jsonMatches) {
      // 从后往前尝试，取第一个能解析成功的
      for (let i = jsonMatches.length - 1; i >= 0; i--) {
        try {
          parsed = JSON.parse(jsonMatches[i])
          break
        } catch {
          continue
        }
      }
    }
    if (!parsed) {
      // 非 JSON → 当作纯文本回复
      return {
        reply: cleaned,
        action: null,
        actions: [],
        conversation_id: conversationId || ''
      }
    }
  }

  // JSON 解析成功但 reply 为空 → 兜底
  let reply = parsed.reply || parsed.message || parsed.content || ''
  if (!reply.trim()) {
    logger.warn('[思迹] AI 返回 JSON 但 reply 为空:', raw.substring(0, 200))
    reply = '抱歉，我没能理解，能换个方式说说吗？'
  }
  let action = null
  let actions = []

  // 复合意图 — actions 数组
  if (Array.isArray(parsed.actions) && parsed.actions.length > 0) {
    actions = parsed.actions
      .filter(a => a && a.type && a.type !== 'none')
      .map(a => ({
        type: a.type,
        payload: a.payload || {},
        needConfirm: a.needConfirm === true
      }))
    if (actions.length > 0) {
      action = {
        type: 'multi',
        payload: {},
        needConfirm: actions.some(a => a.needConfirm)
      }
    }
  } else if (parsed.action && parsed.action.type && parsed.action.type !== 'none') {
    action = {
      type: parsed.action.type,
      payload: parsed.action.payload || {},
      needConfirm: parsed.action.needConfirm === true
    }
    actions = [action]
  }

  // 兜底：AI 回复含操作词但未返回 action 时，尝试从 reply 中检测
  if (!action && (!actions || actions.length === 0)) {
    const opWords = /已记录|已更新|已帮你|已记下|记下了|已经记|已经帮|已经更新|已经修改|帮你记|帮你更新|帮你修改/
    if (opWords.test(reply)) {
      logger.warn('[AI] reply 含操作词但未返回 action，尝试兜底')
      // 无法从 reply 精确提取参数，只能提示用户
      // 不自动构造 action，因为无法确定具体要更新什么
    }
  }

  return {
    reply,
    action,
    actions,
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3).map(s => String(s)).filter(Boolean) : [],
    conversation_id: conversationId || ''
  }
}

/**
 * 模拟流式输出 — 先获取完整响应，再逐字回调
 * 在 uni.request 不支持 SSE 的情况下，这是最兼容的方案
 * @param {string} message 用户消息
 * @param {string} conversationId 会话ID
 * @param {string} apiKey API Key
 * @param {function} onChunk 每次回调 (chunkText) => void
 * @returns {Promise<object>} 完整解析结果
 */
export function chatRequestStream(message, conversationId, config, onChunk, history) {
  const cfg = typeof config === 'string'
    ? { provider: 'deepseek', model: 'deepseek-v4-flash', apiKey: config }
    : (config || getDefaultConfig())

  // H5 环境优先使用真实 SSE 流式
  // #ifdef H5
  if (typeof fetch !== 'undefined' && typeof ReadableStream !== 'undefined') {
    return chatRequestRealStream(message, conversationId, cfg, onChunk, history)
  }
  // #endif

  // 非 H5 环境降级为模拟流式
  return simulatedStream(message, conversationId, cfg, onChunk, history)
}

/**
 * 真实 SSE 流式输出 — 基于 fetch + ReadableStream
 * 支持所有兼容 OpenAI 格式的 API（DeepSeek/OpenAI/Moonshot/智谱/通义）
 */
async function chatRequestRealStream(message, conversationId, cfg, onChunk, history) {
  const provider = getProvider(cfg.provider)
  const apiKey = cfg.apiKey || getProviderKeys()[cfg.provider] || ''
  const chatHistory = history || getRecentHistory()
  const messages = buildChatMessages(message, chatHistory, cfg)
  const stopSignal = cfg.stopSignal || null  // { stopped: false } 引用，外部可设置为 true 终止输出

  const body = { model: cfg.model, messages, temperature: cfg.temperature ?? 0.7, stream: true }
  // 仅 OpenAI 官方模型稳定支持 response_format，其他厂商靠系统提示词约束
  // Layer 1 (stream): 同步 buildProviderRequest 的 response_format 策略
  const streamProvider = getProvider(cfg.provider)
  if (streamProvider.supportsJsonFormat && cfg.provider !== 'qwen' && cfg.provider !== 'zhipu') {
    body.response_format = { type: 'json_object' }
  }
  if (!body.response_format) {
    messages.push({ role: 'system', content: '请只返回纯JSON，不要任何额外文字。' })
  }

  try {
    const resp = await fetch(provider.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    })

    if (!resp.ok) {
      // 非流式错误 — 降级到普通请求
      logger.warn(`[Stream] HTTP ${resp.status}, fallback to normal request`)
      const result = await chatRequest(message, null, conversationId, cfg)
      const reply = result.reply || ''
      if (onChunk && reply) onChunk(reply)
      return result
    }

    const reader = resp.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let fullContent = ''
    let conversationIdResult = ''

    while (true) {
      if (stopSignal?.stopped) break
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // 处理 SSE 数据行
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // 保留最后不完整的行

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith(':')) continue // 空行或注释
        if (!trimmed.startsWith('data:')) continue

        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') continue

        try {
          const json = JSON.parse(data)
          const delta = json.choices?.[0]?.delta?.content || ''
          if (delta) {
            fullContent += delta
            if (onChunk) onChunk(delta)
          }
          if (json.id) conversationIdResult = json.id
        } catch (e) {
          // JSON 解析失败 — 可能是分片不完整，跳过
        }
      }
    }

    // 处理 buffer 中剩余数据
    if (buffer.trim().startsWith('data:')) {
      const data = buffer.trim().slice(5).trim()
      if (data && data !== '[DONE]') {
        try {
          const json = JSON.parse(data)
          const delta = json.choices?.[0]?.delta?.content || ''
          if (delta) {
            fullContent += delta
            if (onChunk) onChunk(delta)
          }
        } catch (e) { /* 忽略 */ }
      }
    }

    // 解析完整的 AI 响应（可能被中途停止）
    const result = parseAiResponse(fullContent, conversationId)
    if (conversationIdResult) result.conversation_id = conversationIdResult
    if (stopSignal?.stopped) result.stopped = true

    return result
  } catch (e) {
    logger.warn('[Stream] Real stream failed, fallback to simulated:', e.message)
    return simulatedStream(message, conversationId, cfg, onChunk)
  }
}

/**
 * 模拟流式输出 — 逐字推送（加速版）
 */
async function simulatedStream(message, conversationId, cfg, onChunk, history) {
  try {
    const result = await chatRequest(message, null, conversationId, cfg, history)
    const reply = result.reply || ''

    if (result.offline) {
      if (onChunk) onChunk(reply)
      return result
    }

    if (onChunk && reply) {
      // 按词组推送（每 2-3 个字一组），更自然
      const chars = reply.split('')
      let i = 0
      while (i < chars.length) {
        const groupSize = Math.min(3, chars.length - i)
        const chunk = chars.slice(i, i + groupSize).join('')
        onChunk(chunk)
        i += groupSize
        // 标点符号后稍长停顿，模拟思考节奏
        const lastChar = chars[i - 1]
        const delay = /[。，！？、；：\n]/.test(lastChar) ? 30 : 6
        await new Promise(r => setTimeout(r, delay))
      }
    }

    return result
  } catch (e) {
    throw e
  }
}

/**
 * 检测网络状态
 */
export function isOnline() {
  return new Promise((resolve) => {
    uni.getNetworkType({
      success(res) {
        resolve(res.networkType !== 'none')
      },
      fail() {
        resolve(false)
      }
    })
  })
}

// ==================== AI 厂商注册表 ====================

/**
 * 支持的 AI 厂商及模型列表
 * 多数中国厂商使用 OpenAI 兼容接口格式
 */
export const AI_PROVIDERS = {
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    short: 'DS',
    color: '#18181B',
    models: [
      { id: 'deepseek-v4-flash', name: 'V4 Flash', desc: '快速响应·日常对话', tag: '⚡' },
      { id: 'deepseek-v4-pro', name: 'V4 Pro', desc: '深度推理·复杂任务', tag: '🧠' }
    ],
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    keyLabel: 'DeepSeek API Key',
    keyPlaceholder: 'sk-xxxxxxxxxxxxxxxx',
    supportsJsonFormat: true,
    docs: 'https://platform.deepseek.com/'
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    short: 'OA',
    color: '#10A37F',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', desc: '高性价比·多模态', tag: '⚡' },
      { id: 'gpt-5', name: 'GPT-5', desc: '旗舰·博士级推理', tag: '🧠' },
      { id: 'gpt-5.5', name: 'GPT-5.5', desc: '最新旗舰·Agent级', tag: '🌟' }
    ],
    endpoint: 'https://api.openai.com/v1/chat/completions',
    keyLabel: 'OpenAI API Key',
    keyPlaceholder: 'sk-proj-...',
    supportsJsonFormat: true,
    docs: 'https://platform.openai.com/'
  },
  moonshot: {
    id: 'moonshot',
    name: 'Moonshot',
    short: 'MS',
    color: '#3F3F46',
    models: [
      { id: 'kimi-k2.6', name: 'Kimi K2.6', desc: '最新旗舰·256K上下文', tag: '🌟' },
      { id: 'kimi-k2.5', name: 'Kimi K2.5', desc: '多模态·编程强', tag: '🧠' },
      { id: 'moonshot-v1-128k', name: 'Kimi 128K', desc: '超长文本理解', tag: '⚡' }
    ],
    endpoint: 'https://api.moonshot.cn/v1/chat/completions',
    keyLabel: 'Moonshot API Key',
    keyPlaceholder: 'sk-xxxxxxxxxxxxxxxx',
    supportsJsonFormat: true,
    docs: 'https://platform.moonshot.cn/'
  },
  zhipu: {
    id: 'zhipu',
    name: '智谱 GLM',
    short: 'ZG',
    color: '#52525B',
    models: [
      { id: 'glm-4-flash', name: 'GLM-4 Flash', desc: '极速免费', tag: '⚡' },
      { id: 'glm-4.7', name: 'GLM-4.7', desc: '编程专用·代码强', tag: '🧠' },
      { id: 'glm-5.1', name: 'GLM-5.1', desc: '高速版·400T/s', tag: '⚡' },
      { id: 'glm-5.2', name: 'GLM-5.2', desc: '最新旗舰·1M上下文', tag: '🌟' }
    ],
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    keyLabel: '智谱 API Key',
    keyPlaceholder: 'xxxxxxxxxxxxxxxx.xxxxxxxx',
    supportsJsonFormat: true,
    docs: 'https://open.bigmodel.cn/'
  },
  qwen: {
    id: 'qwen',
    name: '通义千问',
    short: 'QW',
    color: '#00BFFF',
    models: [
      { id: 'qwen-turbo', name: 'Qwen Turbo', desc: '高性价比·快速', tag: '⚡' },
      { id: 'qwen-plus', name: 'Qwen Plus', desc: '均衡能力', tag: '🧠' },
      { id: 'qwen3.7-plus', name: 'Qwen3.7 Plus', desc: '多模态智能体', tag: '🧠' },
      { id: 'qwen3.7-max', name: 'Qwen3.7 Max', desc: '最新旗舰·全球第二', tag: '🌟' }
    ],
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    keyLabel: '通义 API Key',
    keyPlaceholder: 'sk-xxxxxxxxxxxxxxxx',
    supportsJsonFormat: true,
    docs: 'https://help.aliyun.com/zh/model-studio/'
  }
}

/** 获取厂商配置 */
export function getProvider(providerId) {
  if (AI_PROVIDERS[providerId]) return AI_PROVIDERS[providerId]
  // 查找自定义厂商
  try {
    const custom = JSON.parse(uni.getStorageSync('siji_custom_providers') || '{}')
    if (custom[providerId]) return custom[providerId]
  } catch {}
  return AI_PROVIDERS.deepseek
}

/** 获取厂商的模型列表 */
export function getProviderModels(providerId) {
  return getProvider(providerId).models
}

/** 获取厂商默认模型（第一个） */
export function getProviderDefaultModel(providerId) {
  return getProviderModels(providerId)[0]?.id || ''
}

/** 从 storage 读取所有厂商的 API Key */
export function getProviderKeys() {
  try {
    return JSON.parse(uni.getStorageSync('siji_provider_keys') || '{}')
  } catch { return {} }
}

/** 获取当前默认配置（兼容旧版未选中的情况） */
function getDefaultConfig() {
  const provider = uni.getStorageSync('siji_ai_provider') || 'deepseek'
  const storeModel = uni.getStorageSync('siji_ai_model') || ''
  const model = storeModel || getProviderDefaultModel(provider)
  const keys = getProviderKeys()
  return { provider, model, apiKey: keys[provider] || '' }
}

/** 构建厂商请求参数（统一 OpenAPI 兼容格式） */
function buildProviderRequest(providerId, model, messages, apiKey, temperature) {
  const p = getProvider(providerId)
  const data = { model, messages, temperature: temperature ?? 0.7 }
  // Layer 1: response_format — openai/deepseek/moonshot 稳定支持；智谱/通义靠提示词约束
  const provider = getProvider(providerId)
  if (provider.supportsJsonFormat && providerId !== 'qwen' && providerId !== 'zhipu') {
    data.response_format = { type: 'json_object' }
  } else {
    messages.push({ role: 'system', content: '请只返回纯JSON，不要任何额外文字。' })
  }
  return {
    url: p.endpoint,
    method: 'POST',
    header: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    data,
    timeout: 45000
  }
}
