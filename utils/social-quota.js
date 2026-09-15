/**
 * social-quota.js — 社交能量预算（3.5.14，PRODUCT_VISION「人际」铁律）
 *
 * 给「怕社交」的人一条止损线：每周自己定几次社交，用掉几次自己看得见。
 * 额度由用户自己设，不是系统派的；不催、不评、不扣分，没设额度就不显示（静止是合法状态）。
 *
 * 计数口径：同一天、同一个人只算一次社交（本周内去重）。
 */
import { getAllInteractions } from './relations.js'
import { weekRangeTsOf } from './plan-recur.js'

/** 每周社交额度（0 = 未设置，页面不显示） */
const QUOTA_KEY = 'siji_social_quota'
const MAX_QUOTA = 30

function dayKeyOfTs(ts) {
  const d = new Date(ts)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

/** 读取每周社交额度（未设置返回 0） */
export function getWeeklyQuota() {
  try {
    const n = parseInt(uni.getStorageSync(QUOTA_KEY), 10)
    if (!Number.isFinite(n) || n <= 0) return 0
    return Math.min(n, MAX_QUOTA)
  } catch (e) {
    return 0
  }
}

/** 设置每周社交额度（0 或非法值 = 关闭显示） */
export function setWeeklyQuota(n) {
  const v = Math.max(0, Math.min(MAX_QUOTA, parseInt(n, 10) || 0))
  try {
    uni.setStorageSync(QUOTA_KEY, v)
  } catch (e) {
    /* 存储失败不影响页面 */
  }
  return v
}

/**
 * 统计区间 [fromTs, toTs) 内的社交次数（纯函数；同一天同一个人算一次）
 * @returns {number}
 */
export function countSocialTouches(interactions, fromTs, toTs) {
  const seen = {}
  ;(Array.isArray(interactions) ? interactions : []).forEach(item => {
    if (!item || item.is_deleted === 1) return
    const ts = Number(item.date) || Number(item.created_at) || 0
    if (!ts || ts < fromTs || ts >= toTs) return
    const who = String(item.relation_id || item.relation_name || '')
    if (!who) return
    seen[who + '@' + dayKeyOfTs(ts)] = 1
  })
  return Object.keys(seen).length
}

/**
 * 一行额度文案（纯函数）：未设置返回空串，排满也不催
 * @returns {string}
 */
export function formatSocialQuotaLine(data) {
  if (!data || !(data.quota > 0)) return ''
  const head = '本周社交 ' + data.used + '/' + data.quota
  if (data.remaining > 0) return head + ' · 还能放 ' + data.remaining + ' 次'
  return head + ' · 排满了，剩下的下周再说也行'
}

/**
 * 本周社交额度状态
 * @param {Object} [opts]
 * @param {number} [opts.now]
 * @param {Array} [opts.interactions] - 便于测试注入
 * @returns {{ quota, used, remaining, reached, line }}
 */
export function buildSocialQuota({ now = Date.now(), interactions = null } = {}) {
  const quota = getWeeklyQuota()
  const range = weekRangeTsOf(now)
  const list = Array.isArray(interactions) ? interactions : getAllInteractions()
  const used = countSocialTouches(list, range.weekStart, range.weekEnd)
  const remaining = Math.max(0, quota - used)
  const data = { quota: quota, used: used, remaining: remaining, reached: quota > 0 && remaining === 0 }
  data.line = formatSocialQuotaLine(data)
  return data
}

/**
 * 三条「可以延后，但不会消失」的回复草稿（纯函数）
 * 语气铁律：不写检讨、不拉长、不承诺立刻回，也不假装热情。
 * @param {Object} [relation] - { name, role, scene }
 * @returns {Array<{ id, label, text }>}
 */
export function buildReplyDrafts(relation = {}) {
  const name = String(relation.name || '你').trim() || '你'
  const scene = String(relation.scene || '').trim()
  const tail = scene ? '（' + scene + '的事）' : ''
  return [
    {
      id: 'seen',
      label: '先接住',
      text: name + '，消息我看到了' + tail + '，今天先不展开，晚点回你。'
    },
    {
      id: 'delay',
      label: '约个时间',
      text: name + '，这两天我状态一般，周末再认真回你，不用等我。'
    },
    {
      id: 'short',
      label: '一句话结',
      text: '收到，就按你说的来，我这边没问题。'
    }
  ]
}

/** 交给 AI 起草的提示词（纯函数）：复制后到对话里粘贴 */
export function buildReplyPrompt(relation = {}) {
  const name = String(relation.name || '对方').trim() || '对方'
  const role = String(relation.role || '').trim()
  const scene = String(relation.scene || '').trim()
  const parts = ['帮我给' + name + (role ? '（' + role + '）' : '') + '起草一条回复']
  if (scene) parts.push('场景：' + scene)
  parts.push('要求：平静、具体、可以延后但不要消失；不写检讨、不过度热情，60 字以内，给 3 条备选。')
  return parts.join('。').replace('。。', '。')
}
