/**
 * AI 配置 Store — 管理多厂商 API Key、当前厂商/模型、自定义模型
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { AI_PROVIDERS, getProviderDefaultModel, getProviderModels } from '@/utils/api.js'
import { encryptKeys, decryptKeys, encryptKey, decryptKey } from '@/utils/crypto.js'
import { asyncSetStorage, asyncSetStorageJSON } from '@/utils/store-helpers.js'

export const useAiConfigStore = defineStore('aiConfig', () => {
  const providerKeys = ref({})       // { deepseek: 'sk-xxx', openai: 'sk-yyy' }
  const aiProvider = ref('deepseek')  // 当前厂商 id
  const aiModel = ref('deepseek-v4-flash') // 当前模型 id

  // ==================== Getters ====================
  const hasApiKey = computed(() => !!(providerKeys.value[aiProvider.value]))
  const currentProviderName = computed(() => {
    if (AI_PROVIDERS[aiProvider.value]) return AI_PROVIDERS[aiProvider.value].name
    // 查找自定义厂商
    try {
      const custom = JSON.parse(uni.getStorageSync('siji_custom_providers') || '{}')
      if (custom[aiProvider.value]) return custom[aiProvider.value].name
    } catch {}
    return AI_PROVIDERS.deepseek.name
  })
  const modelLabel = computed(() => {
    let p = AI_PROVIDERS[aiProvider.value]
    if (!p) {
      try {
        const custom = JSON.parse(uni.getStorageSync('siji_custom_providers') || '{}')
        p = custom[aiProvider.value]
      } catch {}
    }
    const m = p?.models?.find(m => m.id === aiModel.value)
    return m ? `${p?.name || ''}/${m.name}` : aiModel.value
  })
  const modelName = computed(() => {
    let p = AI_PROVIDERS[aiProvider.value]
    if (!p) {
      try {
        const custom = JSON.parse(uni.getStorageSync('siji_custom_providers') || '{}')
        p = custom[aiProvider.value]
      } catch {}
    }
    const m = p?.models?.find(m => m.id === aiModel.value)
    return m ? m.name : aiModel.value
  })
  const aiConfig = computed(() => ({
    provider: aiProvider.value,
    model: aiModel.value,
    apiKey: providerKeys.value[aiProvider.value] || '',
  }))

  // ==================== Actions ====================
  function setProviderKey(provider, key) {
    providerKeys.value = { ...providerKeys.value, [provider]: key }
    // 加密后存储
    asyncSetStorage('siji_provider_keys', encryptKeys(providerKeys.value))
    // 兼容旧版（也加密）
    if (provider === 'deepseek') asyncSetStorage('siji_api_key', encryptKey(key))
  }

  function setAiProvider(provider) {
    aiProvider.value = provider
    asyncSetStorage('siji_ai_provider', provider)
    // 自动切到该厂商默认模型
    const defaultModel = getProviderDefaultModel(provider)
    if (defaultModel) {
      aiModel.value = defaultModel
      asyncSetStorage('siji_ai_model', defaultModel)
    }
  }

  function setAiModel(model) {
    aiModel.value = model
    asyncSetStorage('siji_ai_model', model)
  }

  function setCustomModel(provider, modelName) {
    const key = `siji_custom_model_${provider}`
    if (modelName && modelName.trim()) {
      asyncSetStorage(key, modelName.trim())
    } else {
      uni.removeStorageSync(key)
    }
  }

  function getCustomModel(provider) {
    return uni.getStorageSync(`siji_custom_model_${provider}`) || ''
  }

  function getAvailableModels(provider) {
    // 合并预设厂商和自定义厂商
    let custom = {}
    try {
      const raw = uni.getStorageSync('siji_custom_providers')
      custom = raw ? JSON.parse(raw) : {}
    } catch {}
    const p = AI_PROVIDERS[provider] || custom[provider]
    const preset = (p?.models || []).map(m => ({ ...m, custom: false }))
    const customName = getCustomModel(provider)
    if (customName) {
      return [...preset, { id: customName, name: customName, desc: '自定义模型', tag: '', custom: true }]
    }
    return preset
  }

  /** 从 Storage 恢复 AI 配置（兼容旧版数据迁移） */
  function restoreFromStorage() {
    try {
      // 解密读取
      providerKeys.value = decryptKeys(uni.getStorageSync('siji_provider_keys') || '{}')
    } catch { providerKeys.value = {} }
    // 兼容旧版明文数据迁移
    const legacyKey = uni.getStorageSync('siji_api_key')
    if (legacyKey && !providerKeys.value.deepseek) {
      providerKeys.value.deepseek = decryptKey(legacyKey)
      // 用加密格式重新存储
      asyncSetStorage('siji_provider_keys', encryptKeys(providerKeys.value))
      asyncSetStorage('siji_api_key', encryptKey(providerKeys.value.deepseek))
    }

    const pRaw = uni.getStorageSync('siji_ai_provider')
    // 旧版国外厂商（openai 等已被移除）→ 回退到 deepseek
    if (pRaw && pRaw !== 'deepseek' && pRaw !== 'zhipu' && pRaw !== 'qwen' && pRaw !== 'moonshot') {
      // 自定义厂商或已移除厂商一律回退
      if (!AI_PROVIDERS[pRaw]) {
        aiProvider.value = 'deepseek'
        asyncSetStorage('siji_ai_provider', 'deepseek')
      } else {
        aiProvider.value = pRaw
      }
    } else {
      aiProvider.value = pRaw || 'deepseek'
    }

    const model = uni.getStorageSync('siji_ai_model')
    // 旧版模型名映射
    const MODEL_MIGRATION = {
      'qwen-turbo-latest': 'qwen-turbo',
      'qwen-plus-latest': 'qwen-plus',
      'qwen-max-latest': 'qwen-max',
      'glm-4.7': 'glm-4.7-flash',
    }
    const resolvedModel = MODEL_MIGRATION[model] || model

    if (resolvedModel && resolvedModel.includes('-')) {
      const availableModels = getProviderModels(aiProvider.value)
      const modelExists = availableModels.some(m => m.id === resolvedModel)
      aiModel.value = modelExists ? resolvedModel : (availableModels[0]?.id || 'deepseek-v4-flash')
    } else if (resolvedModel === '1' || resolvedModel === 1) {
      const models = AI_PROVIDERS[aiProvider.value]?.models || []
      aiModel.value = models[1]?.id || getProviderDefaultModel(aiProvider.value)
    } else {
      aiModel.value = getProviderDefaultModel(aiProvider.value)
    }
    // 迁移后的模型回写
    if (aiModel.value !== model) {
      asyncSetStorage('siji_ai_model', aiModel.value)
    }
  }

  return {
    // state
    providerKeys, aiProvider, aiModel,
    // getters
    hasApiKey, currentProviderName, modelLabel, modelName, aiConfig,
    // actions
    setProviderKey, setAiProvider, setAiModel,
    setCustomModel, getCustomModel, getAvailableModels,
    restoreFromStorage,
  }
})
