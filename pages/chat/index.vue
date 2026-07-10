<script setup>
/**
 * 思迹首页 - AI 对话核心 Tab
 *
 * UI: 极简未来 - 纯黑白 + AI 单色聚焦
 * 架构: 核心逻辑抽至 composables/useChatEngine.js，本文件只处理 UI 渲染 + 交互状态
 */
import { ref, nextTick, onMounted, computed } from 'vue'
import { onShow, onLoad, onHide } from '@dcloudio/uni-app'
import { useAppStore } from '@/store/index.js'
import { AI_PROVIDERS } from '@/utils/api.js'
import { getPlanList, getDiaryList } from '@/utils/storage.js'
import MessageBubble from '@/components/chat/MessageBubble.vue'
import SijiIcon from '@/components/common/SijiIcon.vue'
import AgentAvatar from '@/components/common/AgentAvatar.vue'
import InputArea from '@/components/chat/InputArea.vue'
import { useChatEngine } from '@/composables/useChatEngine.js'

const store = useAppStore()
const inputText = ref('')
const inputAreaRef = ref(null)

// ===== 聊天核心逻辑（从 composable 引入） =====
const {
  isSending, stopSignal, pendingAction, pendingActions, pendingReply, currentSuggestions,
  simulationMode,
  getWelcomeMessage, handleSend: engineSend, handleStop, autoExecuteAndDisplay,
  handleConfirmAction, handleCancelAction, initSimulation
} = useChatEngine()

const editingMessage = ref(null)

// ==================== 页面生命周期 ====================
// 接收模拟演练参数（onLoad 仅首次加载时触发）
onLoad((options) => {
  if (options && options.simulation) {
    // 不预先创建空对话 — initSimulation 内部会创建专用会话
    initSimulation({
      simulation: options.simulation,
      mode: options.mode || 'social',
      relation_id: options.relation_id || '',
      name: options.name ? decodeURIComponent(options.name) : '',
      scene: options.scene ? decodeURIComponent(options.scene) : '',
      goal: options.goal ? decodeURIComponent(options.goal) : '',
      resume: options.resume === '1'
    })
  }
})

// switchTab 跳转时通过事件传递模拟参数
let _pendingSimParams = null
const _simHandler = (params) => { _pendingSimParams = params }
uni.$on('init-simulation', _simHandler)

onShow(() => {
  if (_pendingSimParams) {
    const params = _pendingSimParams
    _pendingSimParams = null
    // 不预先创建空对话 — initSimulation 内部会创建专用会话
    initSimulation(params)
  }
})

onHide(() => {
  // 页面隐藏时清除待处理参数
  _pendingSimParams = null
})

// ==================== 滚动控制 ====================
const scrollTopValue = ref(0)
const isAtBottom = ref(true)
const showBackToBottom = ref(false)
const scrollContentHeight = ref(0)
const scrollClientHeight = ref(0)

function handleScroll(e) {
  const { scrollTop, scrollHeight } = e.detail
  savedScrollTop = scrollTop
  const distanceFromBottom = scrollHeight - scrollTop - (scrollClientHeight.value || 0)
  const wasAtBottom = isAtBottom.value
  isAtBottom.value = distanceFromBottom <= 80
  const hasScrolledEnough = scrollHeight > (scrollClientHeight.value || 0) * 1.5 && distanceFromBottom > 300
  showBackToBottom.value = !isAtBottom.value && hasScrolledEnough
}

let scrollTick = 0
let lastScrollTime = 0

function scrollToBottom(force = false) {
  nextTick(() => {
    if (!force && !isAtBottom.value) return
    const now = Date.now()
    if (!force && now - lastScrollTime < 80) return
    lastScrollTime = now
    const query = uni.createSelectorQuery()
    query.select('#chat-scroll').boundingClientRect()
    query.select('#chat-scroll').scrollOffset()
    query.exec(res => {
      if (res && res[0] && res[1]) {
        scrollClientHeight.value = res[0].height
        scrollContentHeight.value = res[1].scrollHeight
        scrollTick++
        scrollTopValue.value = res[1].scrollHeight + scrollTick
      }
    })
  })
}

function backToBottom() {
  isAtBottom.value = true
  showBackToBottom.value = false
  scrollToBottom(true)
}

onMounted(() => {
  if (store.conversations.length === 0) store.createConversation()
  // 模拟模式下不显示欢迎语（initSimulation 已在 onLoad 中添加了开场白）
  // 同时检查 _pendingSimParams（switchTab 跳转时 onShow 可能在 onMounted 之后才处理）
  if (store.messages.length === 0 && !simulationMode.value && !_pendingSimParams) {
    store.addMessage({ role: 'assistant', content: getWelcomeMessage() })
  }
  const sysInfo = uni.getSystemInfoSync()
  statusBarHeight.value = sysInfo.statusBarHeight || 0
})

/** 发送消息 — 包装 engine 的 handleSend，注入 inputAreaRef 和 scrollToBottom */
const pendingImage = ref(null)

function handleSend(text) {
  const message = text || inputText.value.trim()
  if (!message || isSending.value) return
  const img = pendingImage.value
  engineSend(message, inputAreaRef, scrollToBottom, img)
  pendingImage.value = null
}

function onImageSelected(data) {
  pendingImage.value = data
}

function onImageCleared() {
  pendingImage.value = null
}

/** 点击自己消息的编辑按钮 */
function handleEditOwn(content) {
  if (!content) return
  inputAreaRef.value?.setText(content)
}

function startEdit(index) { editingMessage.value = index }

function saveEdit(formData) {
  if (editingMessage.value === null) return
  const msg = store.messages[editingMessage.value]
  const execResult = msg?.execResult
  if (!execResult?.detail || !formData) return
  const detail = execResult.detail
  let ok = true
  if (detail.type === 'bill') {
    const month = detail.bill_date ? String(detail.bill_date).substring(0, 7) : undefined
    ok = store.updateBill(detail.id, { amount: parseFloat(formData.amount) || 0, category: formData.category }, month)
    if (ok) {
      msg.execResult.detail.amount = parseFloat(formData.amount) || 0
      msg.execResult.detail.category = formData.category
      msg.execResult.message = `已记账 -¥${formData.amount} (${formData.category})`
    }
  } else if (detail.type === 'diary') {
    const month = detail.created_at
      ? (() => { const d = new Date(detail.created_at); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })()
      : undefined
    ok = store.updateDiary(detail.id, { title: formData.title, mood: formData.mood }, month)
    if (ok) {
      msg.execResult.detail.title = formData.title
      msg.execResult.detail.mood = formData.mood
    }
  } else if (detail.type === 'plan') {
    store.updatePlan(detail.id, { title: formData.title })
    msg.execResult.detail.title = formData.title
  }
  uni.showToast({ title: ok ? '已更新' : '保存失败', icon: ok ? 'success' : 'none' })
  if (ok) editingMessage.value = null
}

function cancelEdit() { editingMessage.value = null }

function handleSuggestion(text) {
  currentSuggestions.value = []
  handleSend(text)
}

function handleUpdateTags({ detail, tags }) {
  if (!detail || !tags) return
  let ok = false
  if (detail.type === 'diary') {
    const month = detail.created_at
      ? (() => { const d = new Date(detail.created_at); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })()
      : undefined
    ok = store.updateDiary(detail.id, { tags: [...tags] }, month)
  } else if (detail.type === 'plan') {
    store.updatePlan(detail.id, { tags: [...tags] })
    ok = true
  }
  if (!ok) uni.showToast({ title: '标签保存失败', icon: 'none' })
}

/** 执行结果卡片点击跳转 */
function handleConfirmActionCard(card) {
  if (!card) return
  const detail = card.payload || {}
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const billMonth = detail.bill_date ? String(detail.bill_date).substring(0, 7) : thisMonth
  const diaryMonth = detail.created_at
    ? (() => { const d = new Date(detail.created_at); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })()
    : thisMonth
  const routes = {
    create_diary: `/pages/diary/detail?clientId=${detail.id || 'new'}&month=${diaryMonth}`,
    create_bill: `/pages/bill/edit?id=${detail.id || ''}&month=${billMonth}`,
    create_plan: `/pages/plan/detail?clientId=${detail.id || 'new'}`,
    update_bill: `/pages/bill/edit?id=${detail.id || ''}&month=${billMonth}`,
    update_diary: `/pages/diary/detail?clientId=${detail.id || 'new'}&month=${diaryMonth}`,
    update_plan: `/pages/plan/detail?clientId=${detail.id || 'new'}`,
    query_diary: '/pages/diary/list',
    query_bill: '/pages/bill/index',
    query_plan: '/pages/plan/index',
    query_stat: '/pages/bill/index'
  }
  const url = routes[card.type]
  if (url) uni.navigateTo({ url })
}

// ==================== UI Modal / Panel 状态 ====================
const showGuide = ref(false)
function showGuideModal() { showGuide.value = true }
function closeGuide() { showGuide.value = false }
function goToFullHelp() { showGuide.value = false; uni.navigateTo({ url: '/pages/settings/sub/help' }) }

const statusBarHeight = ref(0)
const showAgentSwitch = ref(false)
const showConvList = ref(false)
const showModelSwitch = ref(false)

const sortedConversations = computed(() => [...store.conversations].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)))

const simBannerTitle = computed(() => {
  if (!simulationMode.value) return ''
  const modeMap = { social: '社交沙盘', planning: '规划推演', relationship: '关系处理' }
  const modeLabel = modeMap[simulationMode.value.mode] || '模拟演练'
  const name = simulationMode.value.relationName || ''
  return name ? `${modeLabel} · ${name}` : modeLabel
})

function exitSimulation() {
  if (simulationMode.value) {
    const prev = simulationMode.value.previousAgentId
    simulationMode.value = null
    if (prev && store.activeAgentId !== prev) store.setActiveAgent(prev)
    uni.switchTab({ url: '/pages/settings/index' })
  }
}

function toggleConvList() { showConvList.value = !showConvList.value }

function handleNewConversation() {
  const current = store.activeConversation
  if (current && current.messages.length === 0) { showConvList.value = false; return }
  const count = store.conversations.length
  const defaultName = count === 0 ? '对话' : `对话${count + 1}`
  uni.showModal({
    title: '新建对话', editable: true,
    placeholderText: `输入对话名称（留空则用「${defaultName}」）`, content: '',
    success(res) {
      const title = (res.confirm && res.content && res.content.trim()) ? res.content.trim() : defaultName
      store.createConversation(title)
      showConvList.value = false
      uni.showToast({ title: '对话已创建', icon: 'none' })
    }
  })
}

function handleSwitchConversation(id) {
  store.switchConversation(id)
  showConvList.value = false
  isAtBottom.value = true
  showBackToBottom.value = false
  nextTick(() => scrollToBottom(true))
}

function handleDeleteConversation(conv) {
  uni.showModal({
    title: '删除对话', content: `确定删除「${conv.title || '未命名对话'}」吗?`,
    success(res) {
      if (res.confirm) {
        store.deleteConversation(conv.id)
        if (store.conversations.length === 0) {
          store.createConversation()
          store.addMessage({ role: 'assistant', content: getWelcomeMessage() })
        }
        if (store.messages.length === 0) {
          store.addMessage({ role: 'assistant', content: getWelcomeMessage() })
        }
        uni.showToast({ title: '已删除', icon: 'none' })
        isAtBottom.value = true
        showBackToBottom.value = false
        nextTick(() => scrollToBottom(true))
      }
    }
  })
}

function handleRenameConversation(conv) {
  uni.showModal({
    title: '重命名对话', editable: true, placeholderText: '输入新名称', content: conv.title || '',
    success(res) {
      if (res.confirm && res.content) {
        store.renameConversation(conv.id, res.content.trim())
        uni.showToast({ title: '已重命名', icon: 'none' })
      }
    }
  })
}

function formatConvTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const that = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (today === that) return time
  return that.substring(5)
}

function toggleAgentSwitch() { showAgentSwitch.value = !showAgentSwitch.value }
function quickSwitchAgent(agentId) {
  store.setActiveAgent(agentId)
  showAgentSwitch.value = false
  const a = store.agents.find(a => a.id === agentId)
  uni.showToast({ title: `已切换至 ${a?.name}`, icon: 'none' })
}
function goToAgentConfig() { showAgentSwitch.value = false; uni.navigateTo({ url: '/pages/settings/sub/agent' }) }

const switchableProviders = computed(() => {
  const customRaw = uni.getStorageSync('siji_custom_providers')
  let custom = {}
  try { custom = customRaw ? JSON.parse(customRaw) : {} } catch {}
  const all = { ...AI_PROVIDERS, ...custom }
  return Object.values(all).filter(p => store.providerKeys[p.id])
})
const switchableModels = computed(() => store.getAvailableModels(store.aiProvider))

function toggleModelSwitch() { showModelSwitch.value = !showModelSwitch.value }
function quickSwitchProvider(pid) { store.setAiProvider(pid) }
function quickSwitchModel(mid) {
  store.setAiModel(mid)
  showModelSwitch.value = false
  uni.showToast({ title: '已切换模型', icon: 'none' })
}
function goToAiConfig() { showModelSwitch.value = false; uni.navigateTo({ url: '/pages/settings/sub/ai' }) }

// ==================== onShow: 同步标签 + 恢复滚动位置 ====================
let savedScrollTop = 0

onShow(() => {
  syncAllMessageTags()
  // 恢复上次滚动位置（不强制滚到底部）
  if (savedScrollTop > 0) {
    nextTick(() => {
      setTimeout(() => {
        scrollTick++
        scrollTopValue.value = savedScrollTop + scrollTick
      }, 100)
    })
  }
})

function syncAllMessageTags() {
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  let plans = null
  let diaries = null
  for (const msg of store.messages) {
    const detail = msg?.execResult?.detail
    if (!detail || !detail.id) continue
    if (detail.type !== 'plan' && detail.type !== 'diary') continue
    let storedTags = null
    try {
      if (detail.type === 'plan') {
        if (!plans) plans = getPlanList()
        const plan = plans.find(p => p.client_id === detail.id)
        if (plan) storedTags = plan.tags
      } else if (detail.type === 'diary') {
        let month = thisMonth
        if (detail.created_at) {
          const d = new Date(detail.created_at)
          if (!isNaN(d.getTime())) month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        }
        let monthDiaries = diaries
        if (!monthDiaries || month !== thisMonth) {
          monthDiaries = getDiaryList(month)
          if (month === thisMonth) diaries = monthDiaries
        }
        const diary = monthDiaries.find(item => item.client_id === detail.id)
        if (diary) storedTags = diary.tags
      }
    } catch (e) { /* 静默忽略 */ }
    if (storedTags != null) {
      if (typeof storedTags === 'string') {
        try { const p = JSON.parse(storedTags); storedTags = Array.isArray(p) ? p : [] } catch { storedTags = [] }
      }
      if (Array.isArray(storedTags)) detail.tags = [...storedTags]
    }
  }
}
</script>

<template>
  <view class="chat-page">
    <!-- 极简导航栏 -->
    <view class="custom-nav" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <view class="nav-menu-btn" @tap="toggleConvList">
          <SijiIcon name="menu" size="md" />
        </view>
        <view class="nav-brand">
          <text class="nav-title">思迹</text>
        </view>
        <text class="nav-subtitle">{{ store.activeAgent.name || 'AI 生活助手' }}</text>
        <view class="nav-badge" @tap="toggleAgentSwitch">
          <AgentAvatar :name="store.activeAgent.name" size="48" />
          <text class="badge-text">{{ store.activeAgent.name }} ▾</text>
        </view>
        <view class="nav-guide-btn" @tap="showGuideModal">
          <text class="guide-icon">?</text>
        </view>
      </view>
    </view>

    <!-- 模拟模式标识条 -->
    <view v-if="simulationMode" class="sim-banner">
      <view class="sim-banner-left" @tap="exitSimulation">
        <SijiIcon name="arrow-left" size="sm" />
        <text class="sim-banner-text">{{ simBannerTitle }} · 模拟中</text>
      </view>
      <text class="sim-banner-hint">说「复盘」结束</text>
    </view>

    <!-- 消息列表 -->
    <scroll-view id="chat-scroll" class="chat-scroll" scroll-y :scroll-with-animation="true" :scroll-top="scrollTopValue" @scroll="handleScroll">
      <view class="messages-list">
        <MessageBubble
          v-for="(msg, i) in store.messages" :key="i"
          :message="msg" :is-editing="editingMessage === i"
          @confirm-action="handleConfirmActionCard"
          @confirm-pending="handleConfirmAction"
          @cancel-pending="handleCancelAction"
          @start-edit="startEdit(i)"
          @save-edit="saveEdit"
          @cancel-edit="cancelEdit"
          @update-tags="handleUpdateTags"
          @edit-own="handleEditOwn"
        />
        <view id="chat-bottom" style="height: 16rpx" />
      </view>
    </scroll-view>

    <!-- 回到底部按钮 -->
    <view v-if="showBackToBottom" class="back-to-bottom" @tap="backToBottom">
      <SijiIcon name="arrow-down" size="sm" color="var(--text-secondary)" />
    </view>

    <!-- 快捷建议按钮 -->
    <view v-if="currentSuggestions.length > 0 && !isSending" class="suggestions-bar">
      <view
        v-for="(s, i) in currentSuggestions"
        :key="i"
        class="suggestion-chip"
        @tap="handleSuggestion(s)"
      >
        <text>{{ s }}</text>
      </view>
    </view>

    <!-- 输入区 -->
    <InputArea ref="inputAreaRef" v-model="inputText" :disabled="isSending" :is-sending="isSending" @send="handleSend" @stop="handleStop" @image-selected="onImageSelected" @image-cleared="onImageCleared" />

    <!-- AI 使用说明 Modal -->
    <view v-if="showGuide" class="modal-mask" @tap="closeGuide">
      <view class="modal-container" @tap.stop>
        <view class="modal-header">
          <text class="modal-title">使用说明</text>
          <view class="modal-close" @tap="closeGuide"><SijiIcon name="close" size="md" /></view>
        </view>
        <scroll-view class="modal-body" scroll-y>
          <view class="guide-section">
            <text class="guide-section-title">说话示例</text>
          </view>
          <view class="guide-item">
            <text class="gi-tag bill">记账</text>
            <text class="gi-text">"午饭花了35" → 自动记账</text>
          </view>
          <view class="guide-item">
            <text class="gi-tag diary">日记</text>
            <text class="gi-text">"今天心情不错" → 自动写日记</text>
          </view>
          <view class="guide-item">
            <text class="gi-tag plan">计划</text>
            <text class="gi-text">"下周完成报告" → 自动建计划</text>
          </view>
          <view class="guide-item">
            <text class="gi-tag multi">复合</text>
            <text class="gi-text">"买咖啡15,顺便定健身计划" → 同时执行</text>
          </view>
          <view class="guide-item">
            <text class="gi-tag query">查询</text>
            <text class="gi-text">"这个月花了多少" → 查账单</text>
          </view>
          <view class="guide-item">
            <text class="gi-tag undo">撤销</text>
            <text class="gi-text">"撤销刚才的操作" → 回退</text>
          </view>
          <view class="guide-section">
            <text class="guide-section-title">小贴士</text>
          </view>
          <view class="guide-tip">
            <text>· 快捷短语点击追加文本,不会覆盖已输入内容</text>
          </view>
          <view class="guide-tip">
            <text>· 点击记账/日记/计划按钮插入标签,可多次插入</text>
          </view>
          <view class="guide-tip">
            <text>· 金额 ≥ 500 元需确认,防误操作</text>
          </view>
          <view class="guide-tip">
            <text>· 执行结果可编辑,点击「查看 →」跳转详情</text>
          </view>
          <view class="guide-more" @tap="goToFullHelp">
            <text>查看完整使用说明 ›</text>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 模型快速切换 Modal -->
    <view v-if="showModelSwitch" class="modal-mask" @tap="toggleModelSwitch">
      <view class="modal-container model-switch-container" @tap.stop>
        <view class="modal-header">
          <text class="modal-title">切换模型</text>
          <view class="modal-close" @tap="toggleModelSwitch"><SijiIcon name="close" size="md" /></view>
        </view>
        <scroll-view class="modal-body" scroll-y>
          <text class="switch-section-label">厂商</text>
          <view class="switch-provider-grid">
            <view
              v-for="p in switchableProviders" :key="p.id"
              class="switch-provider-item"
              :class="{ active: store.aiProvider === p.id }"
              @tap="quickSwitchProvider(p.id)"
            >
              <text class="switch-provider-name">{{ p.name }}</text>
            </view>
          </view>
          <text class="switch-section-label" v-if="switchableProviders.length === 0">未配置任何 API Key</text>
          <view class="switch-empty" v-if="switchableProviders.length === 0">
            <text class="switch-empty-text">请在设置中配置至少一个厂商的 API Key</text>
            <view class="switch-empty-btn" @tap="goToAiConfig">
              <text>去配置</text>
            </view>
          </view>
          <template v-if="switchableProviders.length > 0">
            <text class="switch-section-label">模型</text>
            <view class="switch-model-list">
              <view
                v-for="m in switchableModels" :key="m.id"
                class="switch-model-item"
                :class="{ active: store.aiModel === m.id }"
                @tap="quickSwitchModel(m.id)"
              >
                <view class="switch-model-info">
                  <text class="switch-model-name">{{ m.name }}</text>
                  <text class="switch-model-desc">{{ m.desc }}</text>
                </view>
                <SijiIcon name="check" size="sm" class="switch-model-check" v-if="store.aiModel === m.id" />
              </view>
            </view>
            <view class="switch-config-btn" @tap="goToAiConfig">
              <SijiIcon name="settings" size="sm" class="switch-config-icon" />
              <text>高级配置</text>
            </view>
          </template>
        </scroll-view>
      </view>
    </view>

    <!-- Agent 快速切换 Modal -->
    <view v-if="showAgentSwitch" class="modal-mask" @tap="toggleAgentSwitch">
      <view class="modal-container model-switch-container" @tap.stop>
        <view class="modal-header">
          <text class="modal-title">切换 Agent</text>
          <view class="modal-close" @tap="toggleAgentSwitch"><SijiIcon name="close" size="md" /></view>
        </view>
        <scroll-view class="modal-body" scroll-y>
          <view class="switch-model-list">
            <view
              v-for="a in store.agents" :key="a.id"
              class="switch-model-item"
              :class="{ active: store.activeAgentId === a.id }"
              @tap="quickSwitchAgent(a.id)"
            >
              <view class="switch-model-info switch-agent-info">
                <AgentAvatar :name="a.name" size="56" />
                <view class="switch-agent-text">
                  <text class="switch-model-name">{{ a.name }}</text>
                  <text class="switch-model-desc">{{ a.description || '自定义 Agent' }}</text>
                </view>
              </view>
              <SijiIcon name="check" size="sm" class="switch-model-check" v-if="store.activeAgentId === a.id" />
            </view>
          </view>
          <view class="switch-config-btn" @tap="goToAgentConfig">
            <SijiIcon name="settings" size="sm" class="switch-config-icon" /><text>管理 Agent</text>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 会话列表抽屉 -->
    <view v-if="showConvList" class="conv-mask" @tap="toggleConvList">
      <view class="conv-drawer" @tap.stop>
        <view class="conv-drawer-header">
          <text class="conv-drawer-title">对话列表</text>
        </view>
        <scroll-view class="conv-list-scroll" scroll-y>
          <view
            v-for="conv in sortedConversations" :key="conv.id"
            class="conv-item"
            :class="{ active: conv.id === store.activeConversationId }"
            @tap="handleSwitchConversation(conv.id)"
            @longpress="handleDeleteConversation(conv)"
          >
            <view class="conv-item-info">
              <view class="conv-item-title-row">
                <text class="conv-item-title">{{ conv.title }}</text>
              </view>
              <text class="conv-item-time">{{ formatConvTime(conv.updatedAt) }}</text>
            </view>
            <view class="conv-item-actions">
              <view class="conv-item-rename" @tap.stop="handleRenameConversation(conv)"><SijiIcon name="edit" size="sm" /></view>
              <text class="conv-item-msgs">{{ conv.messages.length }} 条</text>
            </view>
          </view>
          <view v-if="sortedConversations.length === 0" class="conv-empty">
            <text class="conv-empty-text">暂无对话</text>
          </view>
          <view class="conv-new-divider" @tap="handleNewConversation">
            <view class="conv-divider-line" />
            <text class="conv-new-divider-text">新对话</text>
            <view class="conv-divider-line" />
          </view>
          <view class="conv-shortcuts">
            <view class="conv-shortcut-item" @tap="uni.navigateTo({ url: '/pages/settings/sub/profile' })">
              <SijiIcon name="user" size="md" class="conv-shortcut-icon" />
              <text class="conv-shortcut-text">我的信息</text>
            </view>
            <view class="conv-shortcut-item" @tap="uni.navigateTo({ url: '/pages/settings/sub/ai' })">
              <SijiIcon name="settings" size="md" class="conv-shortcut-icon" />
              <text class="conv-shortcut-text">AI 配置</text>
            </view>
          </view>
          <view class="conv-bottom-spacer" />
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-card);
  position: relative;
  overflow: hidden;
}

.custom-nav {
  position: relative;
  z-index: 1;
  background: var(--bg-card);
  border-bottom: 1rpx solid var(--border-color);
  flex-shrink: 0;
}

.sim-banner {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12rpx 24rpx;
  background: var(--accent, #000000);
  flex-shrink: 0;
}
.sim-banner-left { display: flex; align-items: center; gap: 8rpx; }
.sim-banner-text { font-size: 24rpx; color: var(--bg-card, #FFFFFF); font-weight: 500; }
.sim-banner-hint { font-size: 22rpx; color: rgba(255,255,255,0.6); }

.nav-content {
  display: flex;
  align-items: center;
  height: 88rpx;
  padding: 0 $spacing-md;
  box-sizing: border-box;
  overflow: hidden;
}

.nav-brand {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  min-width: 0;
  overflow: hidden;
}

.nav-title {
  font-size: 36rpx;
  font-weight: 800;
  color: var(--color-ai);
  letter-spacing: 1rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-subtitle {
  font-size: $font-xs;
  color: var(--text-hint);
  margin-left: $spacing-sm;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 1;
  min-width: 0;
}

.nav-badge {
  margin-left: auto;
  max-width: 45%;
  overflow: hidden;
  flex-shrink: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8rpx;
  background: var(--bg-input);
  padding: 4rpx 16rpx 4rpx 4rpx;
  border-radius: 24rpx;
  border: 1rpx solid var(--border-color);

  .badge-text {
    font-size: $font-xs;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
    box-sizing: border-box;
  }
}

.nav-menu-btn {
  margin-right: $spacing-sm;
  width: 56rpx;
  height: 56rpx;
  min-width: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  flex-shrink: 0;
  box-sizing: border-box;

  .menu-icon {
    font-size: 32rpx;
    color: var(--text-primary);
  }

  &:active {
    transform: scale(0.9);
    opacity: 0.8;
  }
}

.nav-guide-btn {
  margin-left: $spacing-sm;
  width: 56rpx;
  height: 56rpx;
  min-width: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--bg-input);
  flex-shrink: 0;
  box-sizing: border-box;

  .guide-icon {
    font-size: 32rpx;
    font-weight: 700;
    color: var(--text-secondary);
  }

  &:active {
    background: var(--border-color);
    transform: scale(0.92);
  }
}

.chat-scroll {
  flex: 1;
  overflow-y: auto;
  position: relative;
  z-index: 1;
}

.back-to-bottom {
  position: absolute;
  right: 24rpx;
  bottom: 240rpx;
  width: 56rpx;
  height: 56rpx;
  border-radius: 100%;
  background: var(--bg-card);
  border: 1rpx solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: $shadow-sm;
  z-index: 5;
  opacity: 0;
  animation: bbFadeIn 0.3s ease 0.3s forwards;
  transition: all 0.15s;

  &:active {
    transform: scale(0.9);
    background: var(--bg-input);
  }
}

@keyframes bbFadeIn {
  from { opacity: 0; transform: translateY(8rpx); }
  to { opacity: 0.6; transform: translateY(0); }
}

.messages-list {
  padding: $spacing-md 0;
}

.modal-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-container {
  width: 86%;
  max-width: 640rpx;
  max-height: 72vh;
  background: var(--bg-card);
  border-radius: 16rpx;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-md $spacing-lg;
  border-bottom: 1rpx solid var(--border-color);
  flex-shrink: 0;
  box-sizing: border-box;

  .modal-title {
    font-size: 32rpx;
    font-weight: 700;
    color: var(--color-ai);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }
  .modal-close {
    font-size: 36rpx;
    color: var(--text-hint);
    padding: 0 8rpx;
    line-height: 1;
    flex-shrink: 0;
  }
}

.modal-body {
  padding: $spacing-md $spacing-lg;
  flex: 1;
  overflow-y: auto;
  box-sizing: border-box;
}

.guide-section {
  margin-top: $spacing-sm;
  margin-bottom: 4rpx;

  .guide-section-title {
    font-size: $font-xs;
    font-weight: 700;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 1rpx;
  }

  &:first-child { margin-top: 0; }
}

.guide-item {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-xs 0;
  border-bottom: 1rpx solid var(--bg-input);

  &:last-of-type { border-bottom: none; }

  .gi-tag {
    flex-shrink: 0;
    font-size: 20rpx;
    font-weight: 600;
    padding: 4rpx 14rpx;
    border-radius: 4rpx;
    min-width: 56rpx;
    text-align: center;

    &.bill { background: var(--bg-input); color: var(--color-bill); }
    &.diary { background: var(--bg-input); color: var(--color-warning); }
    &.plan { background: var(--bg-input); color: var(--color-plan); }
    &.multi { background: var(--bg-input); color: var(--text-primary); }
    &.query { background: var(--bg-input); color: var(--color-info); }
    &.undo { background: var(--bg-input); color: var(--color-danger); }
  }

  .gi-text {
    flex: 1;
    font-size: $font-xs;
    color: var(--text-strong);
    line-height: 1.6;
  }
}

.guide-tip {
  padding: 6rpx 0;

  text {
    font-size: $font-xs;
    color: var(--text-secondary);
    line-height: 1.7;
  }
}

.guide-more {
  margin-top: $spacing-sm;
  padding: $spacing-xs $spacing-sm;
  text-align: center;
  border-radius: 8rpx;
  background: var(--bg-input);

  text {
    font-size: $font-xs;
    color: var(--color-ai);
    font-weight: 600;
  }
}

.model-switch-container {
  max-height: 68vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.switch-section-label {
  font-size: $font-xs;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 1rpx;
  display: block;
  margin: $spacing-sm 0 $spacing-xs;
}

.switch-provider-grid {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-xs;
  overflow: hidden;
}

.switch-provider-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
  padding: $spacing-xs $spacing-sm;
  border-radius: $radius-sm;
  background: var(--bg-input);
  border: 2rpx solid transparent;
  min-width: 100rpx;
  max-width: calc(50% - #{$spacing-xs} / 2);
  box-sizing: border-box;
  overflow: hidden;

  &:active { transform: scale(0.95); }

  &.active {
    border-color: var(--color-ai);
    background: var(--bg-card);
  }

  .switch-provider-name {
    font-size: $font-xs;
    font-weight: 600;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }
}

.switch-model-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;
}

.switch-model-item {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-sm;
  border-radius: $radius-sm;
  background: var(--bg-input);
  border: 2rpx solid transparent;
  box-sizing: border-box;
  overflow: hidden;

  &:active { transform: scale(0.98); }

  &.active {
    border-color: var(--color-ai);
    background: var(--bg-card);
  }

  .switch-model-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2rpx;
    min-width: 0;
    overflow: hidden;
  }

  .switch-agent-info {
    flex-direction: row;
    align-items: center;
    gap: 16rpx;
  }

  .switch-agent-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2rpx;
    min-width: 0;
    overflow: hidden;

    .switch-model-name {
      font-size: $font-sm;
      font-weight: 600;
      color: var(--text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .switch-model-desc {
      font-size: $font-xs;
      color: var(--text-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .switch-model-check {
    font-size: $font-md;
    font-weight: 700;
    color: var(--color-ai);
    flex-shrink: 0;
  }
}

.switch-config-btn {
  margin-top: $spacing-md;
  padding: $spacing-sm;
  text-align: center;
  border-radius: $radius-sm;
  background: var(--bg-input);
  box-sizing: border-box;
  overflow: hidden;

  text {
    font-size: $font-xs;
    color: var(--color-ai);
    font-weight: 600;
    display: inline-block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }
}

.switch-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-md;
  padding: $spacing-lg 0;

  .switch-empty-text {
    font-size: $font-xs;
    color: var(--text-secondary);
  }

  .switch-empty-btn {
    padding: $spacing-xs $spacing-lg;
    background: var(--color-ai);
    border-radius: $radius-sm;

    text {
      font-size: $font-xs;
      color: var(--bg-card);
      font-weight: 600;
    }
  }
}

.conv-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 999;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.conv-drawer {
  width: 100%;
  height: 70vh;
  background: var(--bg-card);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
  border-radius: $radius-xl $radius-xl 0 0;
  animation: sheetSlideUp 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes sheetSlideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.conv-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-md;
  border-bottom: 1rpx solid var(--border-color);
  flex-shrink: 0;
  box-sizing: border-box;
  position: relative;

  .conv-drawer-title {
    font-size: $font-lg;
    font-weight: 700;
    color: var(--text-primary);
  }
}

/* 底部 Sheet 拖拽指示器 */
.conv-drawer-header::before {
  content: '';
  position: absolute;
  top: -16rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 64rpx;
  height: 8rpx;
  border-radius: 4rpx;
  background: var(--text-hint);
  opacity: 0.3;
}

.conv-new-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-sm;
  padding: $spacing-md $spacing-lg;
  margin-top: $spacing-sm;
  box-sizing: border-box;

  .conv-divider-line {
    flex: 1;
    height: 1rpx;
    border-top: 2rpx dashed var(--border-color);
  }

  .conv-new-divider-text {
    font-size: $font-sm;
    color: var(--text-secondary);
    white-space: nowrap;
    padding: 0 $spacing-xs;
  }

  &:active .conv-new-divider-text {
    color: var(--text-primary);
    font-weight: 600;
  }
}

.conv-list-scroll {
  flex: 1;
  overflow: hidden;
}

.conv-item {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-md;
  border-bottom: 1rpx solid var(--border-color);
  box-sizing: border-box;
  overflow: hidden;

  &:active { background: var(--bg-input); }
  &.active {
    background: var(--bg-input);
    border-left: 6rpx solid #000000;
  }
}

.conv-item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  min-width: 0;
  overflow: hidden;
}

.conv-item-title-row {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  min-width: 0;
  overflow: hidden;
}

.conv-item-actions {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  flex-shrink: 0;
}

.conv-item-rename {
  font-size: 32rpx;
  color: var(--text-hint, #999);
  padding: 4rpx 8rpx;

  &:active { color: var(--text-primary); }
}

.conv-item-title {
  font-size: $font-md;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conv-item-time {
  font-size: $font-xs;
  color: var(--text-hint, #999);
}

.conv-item-msgs {
  font-size: $font-xs;
  color: var(--text-hint, #999);
  flex-shrink: 0;
  white-space: nowrap;
}

.conv-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $spacing-lg 0;

  .conv-empty-text {
    font-size: $font-sm;
    color: var(--text-hint, #999);
  }
}

.conv-bottom-spacer {
  height: 60rpx;
  flex-shrink: 0;
}

.conv-shortcuts {
  display: flex;
  gap: 24rpx;
  padding: 16rpx 24rpx;
  margin-top: 8rpx;
}
.conv-shortcut-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 20rpx 0;
  background: var(--bg-card);
  border-radius: 16rpx;
  border: 1rpx solid var(--border-color);
  box-sizing: border-box;
}
.conv-shortcut-item:active {
  opacity: 0.6;
}
.conv-shortcut-icon {
  font-size: 28rpx;
}
.conv-shortcut-text {
  font-size: 24rpx;
  color: var(--text-secondary);
}

.suggestions-bar {
  display: flex;
  gap: $spacing-xs;
  padding: $spacing-xs $spacing-md;
  flex-shrink: 0;
  overflow-x: auto;
  white-space: nowrap;
  background: var(--bg-card);
  border-top: 1rpx solid var(--border-color);
}

.suggestion-chip {
  flex-shrink: 0;
  padding: 10rpx 24rpx;
  border-radius: 24rpx;
  background: var(--bg-input);
  font-size: $font-xs;
  color: var(--text-primary);
  border: 1rpx solid var(--border-color);
  transition: opacity 0.2s;

  &:active {
    opacity: 0.6;
  }
}
</style>
