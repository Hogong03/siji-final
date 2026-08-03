/**
 * AI 厂商注册表
 *
 * 集中管理所有第三方 AI 厂商的元数据、端点、模型列表
 * 仅做配置查询，不做业务逻辑
 */

import { decryptKeys } from '@/utils/crypto.js'

/** 厂商/模型注册表（仅国内厂商，国外需自定义） */
export const AI_PROVIDERS = {
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    short: 'DS',
    color: '#18181B',
    models: [
      { id: 'deepseek-v4-flash', name: 'V4 Flash', desc: '快速响应·日常对话', tag: '⚡', vision: true },
      { id: 'deepseek-v4-pro', name: 'V4 Pro', desc: '深度推理·复杂任务', tag: '🧠', vision: false }
    ],
    visionModels: ['deepseek-v4-flash'],
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    keyLabel: 'DeepSeek API Key',
    keyPlaceholder: 'sk-xxxxxxxxxxxxxxxx',
    supportsResponseFormat: true,
    docs: 'https://platform.deepseek.com/'
  },
  zhipu: {
    id: 'zhipu',
    name: '智谱 GLM',
    short: 'ZG',
    color: '#52525B',
    models: [
      { id: 'glm-4-flash', name: 'GLM-4 Flash', desc: '极速免费·对话', tag: '⚡', vision: false },
      { id: 'glm-4.7-flash', name: 'GLM-4.7 Flash', desc: '编程专用·代码强', tag: '🧠', vision: false },
      { id: 'glm-5.1', name: 'GLM-5.1', desc: '高速版·400T/s', tag: '⚡', vision: false },
      { id: 'glm-5.2', name: 'GLM-5.2', desc: '最新旗舰·1M上下文', tag: '🌟', vision: false }
    ],
    visionModels: ['glm-4v-flash'],
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    keyLabel: '智谱 API Key',
    keyPlaceholder: 'xxxxxxxxxxxxxxxx.xxxxxxxx',
    supportsResponseFormat: false,  // zhipu 部分模型 json_object 行为不稳定，靠 prompt 约束
    docs: 'https://open.bigmodel.cn/'
  },
  qwen: {
    id: 'qwen',
    name: '通义千问',
    short: 'QW',
    color: '#00BFFF',
    models: [
      { id: 'qwen-turbo', name: 'Qwen Turbo', desc: '高性价比·快速响应', tag: '⚡', vision: false },
      { id: 'qwen-plus', name: 'Qwen Plus', desc: '均衡能力·中量任务', tag: '🧠', vision: false },
      { id: 'qwen-max', name: 'Qwen Max', desc: '最强旗舰·复杂推理', tag: '🌟', vision: false },
      { id: 'qwen-long', name: 'Qwen Long', desc: '超长文本·百万上下文', tag: '📚', vision: false }
    ],
    visionModels: ['qwen-vl-plus', 'qwen-vl-max'],
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    keyLabel: '通义 API Key',
    keyPlaceholder: 'sk-xxxxxxxxxxxxxxxx',
    supportsResponseFormat: false,  // qwen 部分模型 json_object 行为不稳定，靠 prompt 约束
    docs: 'https://help.aliyun.com/zh/model-studio/'
  },
  moonshot: {
    id: 'moonshot',
    name: 'Moonshot',
    short: 'MS',
    color: '#3F3F46',
    models: [
      { id: 'kimi-k2.7-code', name: 'Kimi K2.7 Code', desc: '编程旗舰·智能体', tag: '🌟', vision: true },
      { id: 'kimi-k2.6', name: 'Kimi K2.6', desc: '原生多模态·256K', tag: '🧠', vision: true },
      { id: 'kimi-k2.5', name: 'Kimi K2.5', desc: '多模态·编程强', tag: '⚡', vision: true }
    ],
    visionModels: ['kimi-k2.7-code', 'kimi-k2.6', 'kimi-k2.5'],
    endpoint: 'https://api.moonshot.cn/v1/chat/completions',
    keyLabel: 'Moonshot API Key',
    keyPlaceholder: 'sk-xxxxxxxxxxxxxxxx',
    supportsResponseFormat: true,
    docs: 'https://platform.moonshot.cn/'
  }
}

export function getConfiguredProviderIds() {
  try {
    const raw = uni.getStorageSync('siji_provider_keys')
    if (!raw) return []
    const keys = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Object.keys(keys).filter(id => keys[id])
  } catch {
    return []
  }
}

/** 获取已解密的厂商 API Key 映射 { providerId: apiKey } */
export function getProviderKeys() {
  return decryptKeys(uni.getStorageSync('siji_provider_keys') || '{}')
}

/** 获取厂商配置（含自定义） */
export function getProvider(providerId) {
  if (AI_PROVIDERS[providerId]) return AI_PROVIDERS[providerId]
  try {
    const custom = JSON.parse(uni.getStorageSync('siji_custom_providers') || '{}')
    if (custom[providerId]) return custom[providerId]
  } catch {}
  return AI_PROVIDERS.deepseek
}

export function getProviderModels(providerId) {
  return getProvider(providerId).models
}

export function getProviderDefaultModel(providerId) {
  return getProviderModels(providerId)[0]?.id || ''
}

export function getProviderVisionModel(providerId) {
  const models = getProvider(providerId).visionModels
  if (!models || models.length === 0) return null
  return models[0]
}

export function supportsVision(providerId) {
  return !!(getProvider(providerId).visionModels?.length)
}

export function getDefaultConfig() {
  const provider = uni.getStorageSync('siji_ai_provider') || 'deepseek'
  const storeModel = uni.getStorageSync('siji_ai_model') || ''
  const model = storeModel || getProviderDefaultModel(provider)
  const keys = getProviderKeys()
  const apiKey = keys[provider] || ''
  return { provider, model, apiKey }
}

export function buildProviderRequest(providerId, model, messages, apiKey, temperature) {
  const provider = getProvider(providerId)
  const data = { model, messages, temperature: temperature ?? 0.7 }
  // P1-1: 重命名 + 按真值标记，不再硬编码 exclude
  if (provider.supportsResponseFormat) {
    data.response_format = { type: 'json_object' }
  }
  return {
    url: provider.endpoint,
    method: 'POST',
    header: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    data,
    timeout: 45000
  }
}
