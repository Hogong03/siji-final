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
      { id: 'deepseek-v4-flash', name: 'V4 Flash', desc: '快速响应·日常对话', tag: '⚡', vision: false },
      { id: 'deepseek-v4-pro', name: 'V4 Pro', desc: '深度推理·复杂任务', tag: '🧠', vision: false },
      { id: 'deepseek-v4-flash-vision-exp', name: 'V4 Flash Vision(实验)', desc: '视觉理解·实验模型', tag: '👁', vision: true }
    ],
    visionModels: ['deepseek-v4-flash-vision-exp'],
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    keyLabel: 'DeepSeek API Key',
    keyPlaceholder: 'sk-xxxxxxxxxxxxxxxx',
    supportsResponseFormat: true,
    supportsStructuredOutput: true,
    streamNoResponseFormat: true, // V4 流式 + json_object 空回复硬约束（实测坑），流式路径禁用 response_format
    supportsContextCache: false,
    supportsToolCalling: true,
    docs: 'https://platform.deepseek.com/'
  },
  zhipu: {
    id: 'zhipu',
    name: '智谱 GLM',
    short: 'ZG',
    color: '#52525B',
    models: [
      { id: 'glm-5.3', name: 'GLM-5.3', desc: '最新旗舰·1M上下文·强制思考', tag: '🌟', vision: false, thinking: 'forced', reasoningEfforts: ['low', 'high', 'max'], structured: true },
      { id: 'glm-5.3-flash', name: 'GLM-5.3 Flash', desc: '原生多模态·高性价比·1M', tag: '⚡', vision: true, thinking: 'forced', reasoningEfforts: ['low', 'high', 'max'], structured: true },
      { id: 'glm-5.2', name: 'GLM-5.2', desc: '旗舰·1M上下文', tag: '🧠', vision: false, thinking: 'optional', reasoningEfforts: ['low', 'high', 'max'], structured: true },
      { id: 'glm-5.1', name: 'GLM-5.1', desc: '高速版·400T/s', tag: '⚡', vision: false },
      { id: 'glm-4.7-flash', name: 'GLM-4.7 Flash', desc: '编程专用·代码强', tag: '🧠', vision: false },
      { id: 'glm-4-flash', name: 'GLM-4 Flash', desc: '极速免费·对话', tag: '⚡', vision: false }
    ],
    visionModels: ['glm-5.3-flash'], // 原生多模态，替代旧 glm-4v-flash
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    keyLabel: '智谱 API Key',
    keyPlaceholder: 'xxxxxxxxxxxxxxxx.xxxxxxxx',
    supportsResponseFormat: false,  // 历史标记：部分模型 json_object 不稳定；结构化输出按模型级 structured 字段路由
    supportsStructuredOutput: false, // 厂商默认关闭；GLM-5.2 等支持模型在模型级 structured 字段开启（D3 按模型路由）
    supportsContextCache: true,      // GLM 上下文缓存自动触发（命中半价），无需请求参数
    supportsToolCalling: true,
    asrModels: ['glm-asr-2512'],     // 语音识别（≤30s / ≤25MB，multipart 直传）
    asrEndpoint: 'https://open.bigmodel.cn/api/paas/v4/audio/transcriptions',
    asrMode: 'multipart',
    docs: 'https://open.bigmodel.cn/'
  },
  qwen: {
    id: 'qwen',
    name: '通义千问',
    short: 'QW',
    color: '#00BFFF',
    models: [
      { id: 'qwen3.8-flash', name: 'Qwen3.8 Flash', desc: '最新快模型·高性价比', tag: '⚡', vision: false },
      { id: 'qwen3.7-plus', name: 'Qwen3.7 Plus', desc: '均衡能力·中量任务', tag: '🧠', vision: false },
      { id: 'qwen3.8-max', name: 'Qwen3.8 Max', desc: '最新旗舰·复杂推理', tag: '🌟', vision: false },
      { id: 'qwen3.5-omni-plus', name: 'Qwen3.5 Omni Plus', desc: '多模态·视觉理解', tag: '👁', vision: true }
    ],
    visionModels: ['qwen3.5-omni-plus'],
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    keyLabel: '通义 API Key',
    keyPlaceholder: 'sk-xxxxxxxxxxxxxxxx',
    supportsResponseFormat: false,  // json mode 待验证，靠 prompt 约束
    supportsStructuredOutput: false,
    supportsContextCache: false,
    supportsToolCalling: true,
    asrModels: ['qwen-audio-3.0-asr-flash-filetrans'],  // 文件转写需公网音频 URL（服务端网关），客户端暂不可直传
    asrEndpoint: 'https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcriptions',
    asrMode: 'url',
    docs: 'https://help.aliyun.com/zh/model-studio/'
  },
  moonshot: {
    id: 'moonshot',
    name: 'Moonshot',
    short: 'MS',
    color: '#3F3F46',
    models: [
      { id: 'kimi-k3', name: 'Kimi K3', desc: '最新旗舰·2.8T·1M上下文', tag: '🌟', vision: true, thinking: 'effort', reasoningEfforts: ['low', 'high', 'max'], structured: true },
      { id: 'kimi-k2.7-code', name: 'Kimi K2.7 Code', desc: '编程旗舰·智能体', tag: '🧠', vision: true },
      { id: 'kimi-k2.7-code-highspeed', name: 'K2.7 Code 高速版', desc: '编程极速·约180T/s', tag: '⚡', vision: false },
      { id: 'kimi-k2.6', name: 'Kimi K2.6', desc: '原生多模态·256K', tag: '👁', vision: true }
    ],
    visionModels: ['kimi-k3', 'kimi-k2.7-code', 'kimi-k2.6'],
    endpoint: 'https://api.moonshot.cn/v1/chat/completions',
    keyLabel: 'Moonshot API Key',
    keyPlaceholder: 'sk-xxxxxxxxxxxxxxxx',
    supportsResponseFormat: true,
    supportsStructuredOutput: true,
    supportsContextCache: true, // Kimi K3 自动上下文缓存
    supportsToolCalling: true,
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
  // D3: 结构化输出按模型能力路由（模型级 structured 字段 > 厂商级 supportsStructuredOutput）
  if (supportsStructuredOutput(providerId, model)) {
    data.response_format = { type: 'json_object' }
  }
  // D4: 推理分级 — 支持思考的模型按任务强度注入 thinking/reasoning_effort
  const reasoning = getReasoningConfig(providerId, model, 'chat')
  if (reasoning) Object.assign(data, reasoning)
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

// ==================== D3 能力位 ====================

/** 获取模型条目（未找到返回 null） */
export function getModelEntry(providerId, modelId) {
  const provider = getProvider(providerId)
  if (!provider || !Array.isArray(provider.models)) return null
  return provider.models.find(m => m.id === modelId) || null
}

/**
 * 该模型是否支持结构化输出（response_format）
 * 优先级：模型级 structured 字段 > 厂商级 supportsStructuredOutput > 旧字段 supportsResponseFormat
 */
export function supportsStructuredOutput(providerId, modelId) {
  const provider = getProvider(providerId)
  const entry = getModelEntry(providerId, modelId)
  if (entry && typeof entry.structured === 'boolean') return entry.structured
  if (typeof provider.supportsStructuredOutput === 'boolean') return provider.supportsStructuredOutput
  return !!provider.supportsResponseFormat
}

/**
 * 流式模式下是否启用 response_format（json_object）
 * 部分厂商流式 + json_object 组合会返回空内容（DeepSeek V4 实测硬约束），
 * 非流式路径仍可用（supportsStructuredOutput），流式路径必须走此判断
 */
export function supportsStreamStructuredOutput(providerId, modelId) {
  const provider = getProvider(providerId)
  if (provider.streamNoResponseFormat) return false
  return supportsStructuredOutput(providerId, modelId)
}

/** 该厂商是否支持上下文缓存（自动机制，无需请求参数） */
export function supportsContextCache(providerId) {
  return !!getProvider(providerId).supportsContextCache
}

// ==================== D4 推理分级 ====================

/**
 * 按任务类型返回思考参数（GLM 5.x：thinking.type=enabled + reasoning_effort）
 * @param {string} providerId
 * @param {string} modelId
 * @param {string} taskType - chat(日常) | complex(工具/决策) | deep(深度推理)
 * @returns {object|null} { thinking: { type: 'enabled' }, reasoning_effort } 或 null（不支持思考）
 */
export function getReasoningConfig(providerId, modelId, taskType = 'chat') {
  const entry = getModelEntry(providerId, modelId)
  if (!entry || !entry.thinking) return null
  const efforts = entry.reasoningEfforts || ['low', 'high', 'max']
  const effortMap = { chat: 'low', complex: 'high', deep: 'max' }
  const effort = efforts.includes(effortMap[taskType]) ? effortMap[taskType] : 'low'
  // effort：始终推理，仅传顶层 reasoning_effort（如 Kimi K3，禁止传 thinking 对象）
  if (entry.thinking === 'effort') {
    return { reasoning_effort: effort }
  }
  // forced：模型强制开启思考（如 GLM-5.3），任何任务都传
  if (entry.thinking === 'forced') {
    return { thinking: { type: 'enabled' }, reasoning_effort: effort }
  }
  // optional：仅复杂任务才开启，日常对话保持低延迟
  if (taskType === 'complex' || taskType === 'deep') {
    return { thinking: { type: 'enabled' }, reasoning_effort: efforts.includes(effortMap[taskType]) ? effortMap[taskType] : 'high' }
  }
  return null
}

// ==================== C 语音识别能力位 ====================

/** 该厂商是否配置了 ASR 语音识别 */
export function supportsAsr(providerId) {
  const provider = getProvider(providerId)
  return !!(provider.asrModels && provider.asrModels.length && provider.asrEndpoint)
}

/** 获取厂商 ASR 默认模型 ID */
export function getAsrModel(providerId) {
  const provider = getProvider(providerId)
  return (provider.asrModels && provider.asrModels[0]) || ''
}

/** 获取厂商 ASR 端点 */
export function getAsrEndpoint(providerId) {
  return getProvider(providerId).asrEndpoint || ''
}

/** 获取厂商 ASR 上传模式：multipart(直传) | url(需公网链接) */
export function getAsrMode(providerId) {
  return getProvider(providerId).asrMode || 'multipart'
}

/**
 * 选择当前可用的 ASR 厂商
 * 优先 multipart 直传（智谱 GLM-ASR-2512），无 key 时回退 qwen（url 模式需网关）
 * @returns {string} providerId 或 ''（无可用厂商）
 */
export function getAsrProvider() {
  const keys = getProviderKeys()
  if (keys.zhipu && supportsAsr('zhipu') && getAsrMode('zhipu') === 'multipart') return 'zhipu'
  if (keys.qwen && supportsAsr('qwen')) return 'qwen'
  return ''
}
