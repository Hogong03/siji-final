/**
 * AI 厂商注册表
 *
 * 集中管理所有第三方 AI 厂商的元数据、端点、模型列表
 * 仅做配置查询，不做业务逻辑
 */

/** 厂商/模型注册表 */
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
    visionModels: ['gpt-4o'],
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
    visionModels: ['glm-4-flash'],
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
    visionModels: ['qwen-vl-plus', 'qwen-vl-max'],
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    keyLabel: '通义 API Key',
    keyPlaceholder: 'sk-xxxxxxxxxxxxxxxx',
    supportsJsonFormat: true,
    docs: 'https://help.aliyun.com/zh/model-studio/'
  }
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

export function getProviderKeys() {
  try {
    return JSON.parse(uni.getStorageSync('siji_provider_keys') || '{}')
  } catch { return {} }
}

export function getDefaultConfig() {
  const provider = uni.getStorageSync('siji_ai_provider') || 'deepseek'
  const storeModel = uni.getStorageSync('siji_ai_model') || ''
  const model = storeModel || getProviderDefaultModel(provider)
  const keys = getProviderKeys()
  return { provider, model, apiKey: keys[provider] || '' }
}

export function buildProviderRequest(providerId, model, messages, apiKey, temperature) {
  const p = getProvider(providerId)
  const data = { model, messages, temperature: temperature ?? 0.7 }
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
