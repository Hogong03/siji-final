/**
 * next-step.js — 对话收尾的「最小行动」单卡（3.5.13）
 *
 * 愿景 P1 的验收口径：一次对话后，屏幕上有一个可点的下一步。
 * 取今日行动条里最小的一件（collectDailySuggestions 同一口径：未完成、未冷藏、最小叶子），
 * 每天最多出现一次、随时可关、不追问 —— 铁律 7：静止是合法状态。
 * 注意：这不是「建议发送的话」（那是 chat-suggestion 的职责），而是一个可点入口。
 */
import { getPlanList } from './storage.js'
import { collectDailySuggestions } from './plan-daily.js'

/** 已展示日期（YYYY-MM-DD）：每天最多给一次 */
const SHOWN_KEY = 'siji_next_step_shown'

function ymdOf(ts) {
  const d = new Date(ts)
  const pad = n => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

function readShown() {
  try {
    return String(uni.getStorageSync(SHOWN_KEY) || '')
  } catch (e) {
    return ''
  }
}

/**
 * 今天最小的一件（无候选返回 null）
 * @param {Array} [plans] - 默认 getPlanList()
 * @returns {{ client_id: string, title: string, minutes: number, sourceTitle: string }|null}
 */
export function pickNextStep(plans = getPlanList()) {
  const list = collectDailySuggestions(plans, { limit: 1 })
  const item = list && list[0]
  if (!item || !item.client_id) return null
  return {
    client_id: item.client_id,
    title: item.title || '未命名计划',
    minutes: item.eff || 0,
    sourceTitle: item.sourceTitle || ''
  }
}

/** 今天是否还没给过（每天最多一次） */
export function shouldOfferNextStep(now = Date.now()) {
  return readShown() !== ymdOf(now)
}

/** 标记今天已给过（展示即标记，避免同一天反复冒出来） */
export function markNextStepShown(now = Date.now()) {
  try {
    uni.setStorageSync(SHOWN_KEY, ymdOf(now))
  } catch (e) {
    /* 存储失败不影响对话 */
  }
}
