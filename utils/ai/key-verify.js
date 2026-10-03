/**
 * Key 校验模块（免 Key 引导流）
 *
 * 用一次最小请求（max_tokens:1，"ping"）验证厂商 Key 是否可用，
 * 把 HTTP 错误翻译成用户能懂的中文。endpoint 与鉴权头统一从 providers.js 取
 * （四家都是 Authorization: Bearer + OpenAI 兼容 chat/completions，
 * 智谱的 id.secret 形式 Key 同样走 Bearer，与 buildProviderRequest 同一口径）。
 *
 * 只做校验，不落库 —— 保存动作由调用方（key-guide 页）经 store 完成。
 */

import { getProvider, getProviderDefaultModel } from './providers.js'
import { logger } from '../logger.js'

const VERIFY_TIMEOUT = 12000

/** 各厂商控制台地址（key-guide 页「打开申请页」用，写死不经配置） */
export const PROVIDER_CONSOLE_URLS = {
  deepseek: 'https://platform.deepseek.com/',
  zhipu: 'https://open.bigmodel.cn/',
  qwen: 'https://bailian.console.aliyun.com/',
  moonshot: 'https://platform.moonshot.cn/'
}

/**
 * 校验厂商 API Key
 * @param {string} providerId - 厂商 id（deepseek/zhipu/qwen/moonshot）
 * @param {string} apiKey - 用户输入的 Key
 * @param {string} [model] - 可选模型 id，缺省取该厂商注册表默认模型
 * @returns {Promise<{ok:boolean, message:string}>}
 */
export function verifyProviderKey(providerId, apiKey, model) {
  const key = String(apiKey || '').trim()
  if (!key) {
    return Promise.resolve({ ok: false, message: '请先输入 Key' })
  }
  const provider = getProvider(providerId)
  const usedModel = model || getProviderDefaultModel(providerId)
  if (!provider || !provider.endpoint || !usedModel) {
    return Promise.resolve({ ok: false, message: '该厂商配置不完整，无法校验' })
  }
  return new Promise((resolve) => {
    uni.request({
      url: provider.endpoint,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      data: {
        model: usedModel,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        stream: false
      },
      timeout: VERIFY_TIMEOUT,
      success(res) {
        if (res.statusCode === 200) {
          resolve({ ok: true, message: '验证通过' })
          return
        }
        logger.warn('[key-verify] verify failed', providerId, res.statusCode, res.data)
        resolve({ ok: false, message: translateHttpError(res.statusCode, res.data) })
      },
      fail(err) {
        logger.warn('[key-verify] network error', providerId, err && err.errMsg)
        resolve({ ok: false, message: '网络不通，稍后再试' })
      }
    })
  })
}

/** HTTP 状态码 → 可读原因（厂商原始报错能拿到就拼在后面） */
function translateHttpError(statusCode, raw) {
  const detail = extractProviderMessage(raw)
  if (statusCode === 401 || statusCode === 403) {
    return detail ? `Key 无效或未生效（${detail}）` : 'Key 无效或未生效'
  }
  if (statusCode === 404) {
    return detail ? `模型名不可用（${detail}）` : '模型名不可用'
  }
  if (detail) return `验证失败：${detail}`
  return `验证失败（HTTP ${statusCode}）`
}

/** 从响应体里提取厂商报错（error.message / message / msg） */
function extractProviderMessage(raw) {
  if (!raw) return ''
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (data && data.error && data.error.message) return String(data.error.message)
    if (data && data.message) return String(data.message)
    if (data && data.msg) return String(data.msg)
  } catch { /* 非 JSON 响应体忽略 */ }
  return ''
}
