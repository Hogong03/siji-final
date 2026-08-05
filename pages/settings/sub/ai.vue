<script setup>
/**
 * AI 配置子页面 — 厂商、模型、自定义模型、自定义厂商、连接测试
 * 使用系统导航栏（pages.json 已配置 navigationBarTitleText）
 */

import { ref, computed, onMounted } from 'vue'
import { useAppStore } from '@/store/index.js'
import { AI_PROVIDERS, getProviderDefaultModel, chatRequest, isOnline, getConfiguredProviderIds, supportsVision } from '@/utils/api.js'
// getApiKey 已废弃 — 直接从 store.providerKeys 读取（已由 crypto.js 解密）
import { asyncSetStorage, asyncSetStorageJSON } from '@/utils/store-helpers.js'

const store = useAppStore()

/* ---- 厂商 Logo 路径映射 ---- */
const PROVIDER_LOGO_MAP = {
  deepseek: 'ds',
  zhipu: 'zg',
  qwen: 'qw',
  moonshot: 'ms',
  openai: 'oa'
}
function getProviderLogo(pid) {
  const suffix = PROVIDER_LOGO_MAP[pid] || 'oa'
  return `/static/icons/provider-${suffix}.png`
}

/* ---- 编辑状态 ---- */
const editingProvider = ref(store.aiProvider)
const editingKey = ref('')
const editingModel = ref(store.aiModel)
const testingKey = ref(false)
const expandedProvider = ref(null)
const customModelInput = ref('')
const showVisionWarn = ref(false)

const currentModels = computed(() => store.getAvailableModels(editingProvider.value))
const currentProviderName = computed(() => {
  if (AI_PROVIDERS[editingProvider.value]) return AI_PROVIDERS[editingProvider.value].name
  try {
    const custom = JSON.parse(uni.getStorageSync('siji_custom_providers') || '{}')
    return custom[editingProvider.value]?.name || editingProvider.value
  } catch { return editingProvider.value }
})
const currentKeyPlaceholder = computed(() => {
  const p = allProviders.value[editingProvider.value]
  return p?.keyPlaceholder || 'sk-...'
})
const needApply = computed(() => editingProvider.value !== store.aiProvider || editingModel.value !== store.aiModel)

/** 检查模型是否支持图片识别 */
function modelSupportsVision(providerId, modelId) {
  const p = AI_PROVIDERS[providerId]
  if (!p || !p.visionModels) return false
  return p.visionModels.includes(modelId)
}

/** 检查厂商是否支持图片识别 */
function providerHasVision(providerId) {
  return supportsVision(providerId)
}

const providerKeys = ref({})

/* ---- 自定义厂商状态 ---- */
const showCustomForm = ref(false)
const customForm = ref({
  id: '',
  name: '',
  endpoint: '',
  key: '',
  model: ''
})

/* ---- 自定义厂商列表（从 Storage 读取） ---- */
const customProviders = ref({})
const allProviders = computed(() => {
  const result = { ...AI_PROVIDERS, ...customProviders.value }
  return result
})
const providerList = computed(() => Object.values(allProviders.value))

onMounted(() => {
  const ids = getConfiguredProviderIds()
  // 直接从 store 读取已解密的 providerKeys
  providerKeys.value = { ...store.providerKeys }
  editingKey.value = store.providerKeys[store.aiProvider] || ''
  editingModel.value = store.aiModel
  expandedProvider.value = store.aiProvider
  customModelInput.value = store.getCustomModel(store.aiProvider)
  loadCustomProviders()
})

function loadCustomProviders() {
  try {
    const raw = uni.getStorageSync('siji_custom_providers')
    customProviders.value = raw ? JSON.parse(raw) : {}
  } catch {
    customProviders.value = {}
  }
}

function saveCustomProviders() {
  asyncSetStorageJSON('siji_custom_providers', customProviders.value)
}

/* ---- 厂商选择 ---- */
function selectProvider(pid) {
  if (expandedProvider.value === pid) {
    expandedProvider.value = null
    return
  }
  expandedProvider.value = pid
  editingProvider.value = pid
  editingKey.value = store.providerKeys[pid] || ''
  const storedModel = uni.getStorageSync(`siji_model_${pid}`)
  const available = allProviders.value[pid]?.models || []
  const storedValid = storedModel && available.some(m => m.id === storedModel)
  editingModel.value = storedValid ? storedModel : (available[0]?.id || '')
  customModelInput.value = store.getCustomModel(pid)
}

/* ---- Key 操作 ---- */
function saveProviderKey() {
  const key = editingKey.value.trim()
  store.setProviderKey(editingProvider.value, key)
  providerKeys.value = { ...providerKeys.value, [editingProvider.value]: key }
  uni.showToast({ title: key ? `${currentProviderName.value} Key 已保存` : 'Key 已清除', icon: 'success' })
}

/* ---- 模型切换 ---- */
function switchModel(mid) {
  editingModel.value = mid
  store.setAiModel(mid)
  asyncSetStorage(`siji_model_${editingProvider.value}`, mid)
  const m = currentModels.value.find(m => m.id === mid)
  uni.showToast({ title: `已切换至 ${m?.name || mid}`, icon: 'none' })
}

/* ---- 自定义模型 ---- */
function saveCustomModel() {
  const name = customModelInput.value.trim()
  store.setCustomModel(editingProvider.value, name)
  if (name) {
    editingModel.value = name
    store.setAiModel(name)
    uni.showToast({ title: `已设置自定义模型: ${name}`, icon: 'success' })
  } else {
    const fallback = getProviderDefaultModel(editingProvider.value) || allProviders.value[editingProvider.value]?.models?.[0]?.id
    editingModel.value = fallback
    store.setAiModel(fallback)
    uni.showToast({ title: '已恢复预设模型', icon: 'none' })
  }
}

/* ---- 自定义厂商 ---- */
function startAddCustomProvider() {
  showCustomForm.value = true
  customForm.value = { id: '', name: '', endpoint: '', key: '', model: '' }
}

function saveCustomProvider() {
  const { name, endpoint, key, model } = customForm.value
  if (!name.trim()) return uni.showToast({ title: '请输入厂商名称', icon: 'none' })
  if (!endpoint.trim()) return uni.showToast({ title: '请输入 API Endpoint', icon: 'none' })
  if (!model.trim()) return uni.showToast({ title: '请输入模型 ID', icon: 'none' })

  const pid = `custom_${Date.now()}`
  const provider = {
    id: pid,
    name: name.trim(),
    short: name.trim().slice(0, 2).toUpperCase(),
    color: '#18181B',
    models: [{ id: model.trim(), name: model.trim(), desc: '自定义模型', tag: '' }],
    endpoint: endpoint.trim(),
    keyLabel: `${name.trim()} API Key`,
    keyPlaceholder: 'sk-...',
    supportsJsonFormat: false,
    docs: '',
    custom: true
  }
  customProviders.value = { ...customProviders.value, [pid]: provider }
  saveCustomProviders()

  // 保存 Key
  if (key.trim()) {
    store.setProviderKey(pid, key.trim())
    providerKeys.value = { ...providerKeys.value, [pid]: key.trim() }
  }

  // 自动切换到新厂商
  store.setAiProvider(pid)
  store.setAiModel(model.trim())
  asyncSetStorage(`siji_model_${pid}`, model.trim())

  showCustomForm.value = false
  expandedProvider.value = pid
  editingProvider.value = pid
  editingKey.value = key.trim()
  editingModel.value = model.trim()
  uni.showToast({ title: `已添加 ${name.trim()}`, icon: 'success' })
}

function deleteCustomProvider(pid) {
  const p = customProviders.value[pid]
  if (!p) return
  uni.showModal({
    title: '删除厂商',
    content: `确定删除「${p.name}」吗？相关 Key 和配置将被清除。`,
    success(res) {
      if (res.confirm) {
        const next = { ...customProviders.value }
        delete next[pid]
        customProviders.value = next
        saveCustomProviders()
        store.setProviderKey(pid, '')
        delete providerKeys.value[pid]
        if (store.aiProvider === pid) {
          store.setAiProvider('deepseek')
          store.setAiModel(getProviderDefaultModel('deepseek'))
        }
        uni.showToast({ title: '已删除', icon: 'none' })
      }
    }
  })
}

/* ---- 应用切换 ---- */
function applyProvider() {
  store.setAiProvider(editingProvider.value)
  store.setAiModel(editingModel.value)
  uni.showToast({ title: `已应用 ${currentProviderName.value}`, icon: 'success' })
}

/* ---- 测试连接 ---- */
async function testConnection() {
  const key = editingKey.value.trim() || providerKeys.value[editingProvider.value]
  if (!key) return uni.showToast({ title: '请先填写 Key', icon: 'none' })
  if (!(await isOnline())) return uni.showToast({ title: '无网络', icon: 'none' })
  testingKey.value = true
  try {
    const providerObj = allProviders.value[editingProvider.value]
    const endpoint = providerObj?.endpoint
    const r = await chatRequest('你好', null, '', {
      provider: editingProvider.value,
      model: editingModel.value,
      apiKey: key,
      endpoint: endpoint
    })
    uni.showToast({ title: r?.reply ? `连接成功` : `失败: ${r?.error || '未知'}`, icon: r?.reply ? 'success' : 'none' })
  } catch (e) {
    uni.showToast({ title: '失败: ' + e.message, icon: 'none' })
  } finally {
    testingKey.value = false
  }
}
</script>

<template>
  <view class="ai-page">
    <!-- 厂商列表 -->
    <view class="provider-list">
      <view
        v-for="p in providerList" :key="p.id"
        class="provider-card"
        :class="{ expanded: expandedProvider === p.id }"
      >
        <!-- 厂商头部 -->
        <view class="provider-header" @tap="selectProvider(p.id)">
          <image
            :src="getProviderLogo(p.id)"
            mode="aspectFit"
            class="provider-logo"
          />
          <view class="provider-info">
            <text class="provider-name">{{ p.name }}</text>
            <text class="provider-desc">{{ p.models.map(m => m.name).join(' / ') }}{{ store.getCustomModel(p.id) ? ' / 自定义' : '' }}</text>
          </view>
          <view class="provider-status">
            <view class="key-dot" :class="providerKeys[p.id] ? 'ok' : 'none'" />
            <text class="key-label">{{ providerKeys[p.id] ? '已配置' : '未配置' }}</text>
          </view>
          <text class="provider-arrow" :class="{ rotated: expandedProvider === p.id }">›</text>
        </view>

        <!-- 展开内容 -->
        <view class="provider-body" v-if="expandedProvider === p.id">
          <!-- 当前激活标识 -->
          <view class="active-badge" v-if="store.aiProvider === p.id && store.aiModel === editingModel">
            <text>当前使用中</text>
          </view>

          <!-- API Key 输入 -->
          <view class="config-section">
            <text class="config-label">{{ p.keyLabel || 'API Key' }}</text>
            <view class="key-input-row">
              <input
                v-model="editingKey"
                class="key-input"
                type="password"
                :placeholder="p.keyPlaceholder || 'sk-...'"
                :maxlength="200"
              />
              <text class="key-action save" @tap="saveProviderKey">保存</text>
              <text class="key-action test" @tap="testConnection">{{ testingKey ? '...' : '测试' }}</text>
            </view>
          </view>

          <!-- 图片识别提示 -->
          <view class="vision-notice" v-if="!providerHasVision(expandedProvider)" @tap="showVisionWarn = !showVisionWarn">
            <text class="vision-notice-icon">⚠</text>
            <text v-if="showVisionWarn" class="vision-notice-text">该厂商不支持图片识别，发送图片时会提示切换</text>
          </view>

          <!-- 模型选择 -->
          <view class="config-section" v-if="currentModels.length > 0">
            <text class="config-label">选择模型</text>
            <view class="model-grid">
              <view
                v-for="m in currentModels" :key="m.id"
                class="model-item"
                :class="{ active: editingModel === m.id, custom: m.custom }"
                @tap="switchModel(m.id)"
              >
                <view class="model-detail">
                  <view class="model-name-row">
                    <text class="model-name">{{ m.name }}</text>
                    <text class="model-vision-badge" v-if="modelSupportsVision(expandedProvider, m.id)">📷</text>
                    <text class="model-no-vision-badge" v-else-if="!m.custom && providerHasVision(expandedProvider)">无图</text>
                  </view>
                  <text class="model-desc">{{ m.desc }}</text>
                </view>
                <view class="model-check" v-if="editingModel === m.id">
                  <text>✓</text>
                </view>
              </view>
            </view>
          </view>

          <!-- 自定义模型 -->
          <view class="config-section">
            <text class="config-label">自定义模型名称</text>
            <text class="config-hint">输入厂商支持的模型 ID（如 glm-5.2、kimi-k2.7-code 等）</text>
            <view class="key-input-row">
              <input
                v-model="customModelInput"
                class="key-input"
                type="text"
                placeholder="留空则使用上方预设模型"
                :maxlength="100"
              />
              <text class="key-action save" @tap="saveCustomModel">设置</text>
            </view>
          </view>

          <!-- 删除自定义厂商 -->
          <view class="config-section" v-if="p.custom">
            <text class="delete-provider" @tap="deleteCustomProvider(p.id)">删除此厂商</text>
          </view>

          <!-- 应用按钮 -->
          <view class="apply-btn" v-if="needApply && store.aiProvider !== editingProvider" @tap="applyProvider">
            <text>切换至 {{ p.name }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 添加自定义厂商 -->
    <view class="add-custom-btn" @tap="startAddCustomProvider" v-if="!showCustomForm">
      <text>+ 添加自定义厂商</text>
    </view>

    <!-- 自定义厂商表单 -->
    <view class="custom-form" v-if="showCustomForm">
      <view class="form-title">添加自定义 AI 厂商</view>
      <text class="form-hint">适用于不在预设列表中的 AI 服务商，需填写兼容 OpenAI 格式的 API 地址</text>

      <view class="form-field">
        <text class="field-label">厂商名称</text>
        <input v-model="customForm.name" class="field-input" placeholder="如：百川、零一万物" maxlength="20" />
      </view>

      <view class="form-field">
        <text class="field-label">API Endpoint</text>
        <input v-model="customForm.endpoint" class="field-input" placeholder="https://api.example.com/v1/chat/completions" maxlength="200" />
      </view>

      <view class="form-field">
        <text class="field-label">API Key</text>
        <input v-model="customForm.key" class="field-input" type="password" placeholder="sk-..." maxlength="200" />
      </view>

      <view class="form-field">
        <text class="field-label">模型 ID</text>
        <input v-model="customForm.model" class="field-input" placeholder="如：baichuan2-53b、yi-large" maxlength="100" />
      </view>

      <view class="form-actions">
        <button class="btn-cancel" @tap="showCustomForm = false">取消</button>
        <button class="btn-save" @tap="saveCustomProvider">保存并切换</button>
      </view>
    </view>

    <!-- 说明 -->
    <view class="tips-card">
      <text class="tips-title">说明</text>
      <text class="tips-text">• 每个厂商需独立申请 API Key</text>
      <text class="tips-text">• Key 仅存储在本地，不会上传</text>
      <text class="tips-text">• 可同时配置多个厂商，随时切换</text>
      <text class="tips-text">• 自定义模型可填写厂商最新模型 ID</text>
      <text class="tips-text">• 自定义厂商需填写兼容 OpenAI 格式的 API 地址</text>
      <text class="tips-text">• 测试连接会消耗少量 Token</text>
    </view>

    <view style="height: 60rpx" />
  </view>
</template>

<style lang="scss" scoped>
@import './ai.scss';
</style>
