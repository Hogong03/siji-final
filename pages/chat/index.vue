<script setup>
/**
 * 思迹首页 - AI 对话核心 Tab
 *
 * UI: 极简未来 - 纯黑白 + AI 单色聚焦
 * 架构: 核心逻辑抽至 composables/useChatEngine.js，本文件只处理 UI 渲染 + 交互状态
 */
import { ref, nextTick, onMounted, watch, computed } from 'vue'
import { onShow, onLoad, onHide } from '@dcloudio/uni-app'
import { useAppStore } from '@/store/index.js'
import { getPlanList, getDiaryList } from '@/utils/storage.js'
import MessageBubble from '@/components/chat/MessageBubble.vue'
import SijiIcon from '@/components/common/SijiIcon.vue'
import AgentAvatar from '@/components/common/AgentAvatar.vue'
import InputArea from '@/components/chat/InputArea.vue'
import ConversationPanel from '@/components/chat/ConversationPanel.vue'
import GuideModal from '@/components/chat/GuideModal.vue'
import ModelSwitcher from '@/components/chat/ModelSwitcher.vue'
import AgentSwitcher from '@/components/chat/AgentSwitcher.vue'
import { useChatEngine } from '@/composables/useChatEngine.js'

const store = useAppStore()
const inputText = ref('')
const inputAreaRef = ref(null)

// ===== 聊天核心逻辑（从 composable 引入） =====
const {
  isSending, stopSignal, pendingAction, pendingActions, pendingReply, currentSuggestions,
  simulationMode,
  getWelcomeMessage, handleSend: engineSend, handleStop: engineStop, handleRetry: engineRetry, autoExecuteAndDisplay,
  handleConfirmAction, handleCancelAction, initSimulation
} = useChatEngine()

// ==================== 重试栏 ====================
const showRetryBar = ref(false)
const retryMessage = ref('')
const retryImage = ref(null)
const pendingRetryData = ref(null)

// 发送完成后检测失败消息
watch(isSending, (v, prev) => {
  if (!v && prev && !showRetryBar.value) {
    const lastMsg = store.messages[store.messages.length - 1]
    if (lastMsg && lastMsg.role === 'assistant' && lastMsg.failed) {
      for (let i = store.messages.length - 2; i >= 0; i--) {
        if (store.messages[i].role === 'user') {
          retryMessage.value = store.messages[i].content
          retryImage.value = store.messages[i].image || null
          break
        }
      }
      showRetryBar.value = true
    }
  }
})

function handleRetrySend() {
  showRetryBar.value = false
  engineRetry({}, inputAreaRef, scrollToBottom, { startStreamScroll, stopStreamScroll })
}

function handleRetryWithModel() {
  showRetryBar.value = false
  pendingRetryData.value = { message: retryMessage.value, image: retryImage.value }
  showModelSwitch.value = true
}

function handleRetryEdit() {
  showRetryBar.value = false
  // 移除失败的 assistant 消息
  const conv = store.activeConversation
  if (conv && conv.messages.length > 0 && conv.messages[conv.messages.length - 1].role === 'assistant' && conv.messages[conv.messages.length - 1].failed) {
    conv.messages.pop()
  }
  inputAreaRef.value?.setText(retryMessage.value)
}

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
  // 页面隐藏时清除待处理参数 + 停止流式滚动
  _pendingSimParams = null
  stopStreamScroll()
})

// ==================== 滚动控制（方案 C：双模式） ====================
// 模式 1：锚点定位（普通场景 — 启动/切换会话/发送/结束）
// 模式 2：增量 scroll-top（流式输出期间 — 零 DOM 查询）
const scrollTopValue = ref(0)       // scroll-top 绑定值（流式增量模式用）
const scrollIntoView = ref('')      // scroll-into-view 绑定值（锚点模式用）
const scrollWithAnim = ref(true)    // 是否带动画
const isAtBottom = ref(true)
const showBackToBottom = ref(false)
let shouldAutoScroll = false        // 用户是否在底部（发送时拍快照）
let isProgrammaticScroll = false    // 程序化滚动锁（忽略 handleScroll）
let lastScrollHeight = 0            // 上次已知的内容高度（增量估算用）
let scrollTick = 0                  // scroll-top 强制变化用递增标记

// --- 锚点滚动（精确，用于非流式场景） ---
function scrollToBottomAnchor(animate = true) {
  scrollWithAnim.value = animate
  scrollIntoView.value = ''
  nextTick(() => {
    scrollIntoView.value = 'chat-bottom'
  })
}

// --- scroll-top 滚动（流式增量模式，不查 DOM） ---
function scrollToBottomTop(estimatedHeight) {
  scrollWithAnim.value = false
  scrollTick++
  scrollTopValue.value = (estimatedHeight || lastScrollHeight || 99999) + scrollTick
}

// --- 统一入口 ---
function scrollToBottom(force = false) {
  if (force) {
    shouldAutoScroll = true
    scrollToBottomAnchor(true)
    return
  }
  if (!shouldAutoScroll) return
  scrollToBottomAnchor(true)
}

// --- 流式滚动：interval 驱动，零 DOM 查询 ---
let streamScrollTimer = null

function startStreamScroll() {
  if (streamScrollTimer) return
  // 先查一次实际高度作为基线
  const query = uni.createSelectorQuery()
  query.select('#chat-scroll').scrollOffset()
  query.exec(res => {
    if (res && res[0]) lastScrollHeight = res[0].scrollHeight
  })
  // 每 150ms 增量追加 scroll-top（不查 DOM）
  streamScrollTimer = setInterval(() => {
    if (!shouldAutoScroll) return
    // 增量估算：每次 +400rpx（约 2 行文字）
    lastScrollHeight += 400
    scrollToBottomTop(lastScrollHeight)
  }, 150)
}

function stopStreamScroll() {
  if (!streamScrollTimer) return
  clearInterval(streamScrollTimer)
  streamScrollTimer = null
  // 结束时精确对齐一次（查 DOM 修正误差）
  nextTick(() => {
    const query = uni.createSelectorQuery()
    query.select('#chat-scroll').scrollOffset()
    query.exec(res => {
      if (res && res[0]) {
        lastScrollHeight = res[0].scrollHeight
        scrollTick++
        isProgrammaticScroll = true
        scrollTopValue.value = res[0].scrollHeight + scrollTick
        setTimeout(() => { isProgrammaticScroll = false }, 300)
      }
    })
  })
}

function handleScroll(e) {
  if (isProgrammaticScroll) return
  const { scrollTop, scrollHeight } = e.detail
  const sh = scrollHeight || (e.target && e.target.scrollHeight) || 0
  lastScrollHeight = sh
  const clientH = e.target && e.target.clientHeight
    ? e.target.clientHeight
    : (typeof window !== 'undefined' ? window.innerHeight : (uni.getSystemInfoSync().windowHeight || 600))
  const distanceFromBottom = sh - scrollTop - clientH
  isAtBottom.value = distanceFromBottom <= 80
  const hasScrolledEnough = sh > clientH * 1.5 && distanceFromBottom > 300
  showBackToBottom.value = !isAtBottom.value && hasScrolledEnough
  // 用户主动上滑 → 取消追底 + 停止流式滚动
  if (shouldAutoScroll && distanceFromBottom > 150) {
    shouldAutoScroll = false
  }
}

function backToBottom() {
  shouldAutoScroll = true
  isAtBottom.value = true
  showBackToBottom.value = false
  scrollToBottomAnchor(true)
}

onMounted(() => {
  if (store.conversations.length === 0) store.createConversation()
  // 模拟模式下不显示欢迎语（initSimulation 已在 onLoad 中添加了开场白）
  // 同时检查 _pendingSimParams（switchTab 跳转时 onShow 可能在 onMounted 之后才处理）
  if (store.messages.length === 0 && !simulationMode.value && !_pendingSimParams) {
    store.addMessage({ role: 'assistant', content: getWelcomeMessage(), _isWelcome: true })
  }
  const sysInfo = uni.getSystemInfoSync()
  statusBarHeight.value = sysInfo.statusBarHeight || 0
  // 启动时滚到底部
  nextTick(() => {
    setTimeout(() => scrollToBottomAnchor(false), 50)
  })
})

/** 发送消息 — 包装 engine 的 handleSend，注入 inputAreaRef 和 scrollToBottom */
const pendingImage = ref(null)

function handleSend(text) {
  const message = text || inputText.value.trim()
  if (!message || isSending.value) return
  showRetryBar.value = false
  shouldAutoScroll = true  // 用户发送 → 强制追底
  const img = pendingImage.value
  engineSend(message, inputAreaRef, scrollToBottom, img, {
    startStreamScroll,
    stopStreamScroll
  })
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

/** 停止 AI 输出 — 先停流式滚动，再调 engine stop */
function handleStop() {
  stopStreamScroll()
  engineStop()
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
  shouldAutoScroll = true
  isAtBottom.value = true
  showBackToBottom.value = false
  nextTick(() => {
    setTimeout(() => scrollToBottomAnchor(false), 50)
  })
}

function handleDeleteConversation(conv) {
  uni.showModal({
    title: '删除对话', content: `确定删除「${conv.title || '未命名对话'}」吗?`,
    success(res) {
      if (res.confirm) {
        store.deleteConversation(conv.id)
        if (store.conversations.length === 0) {
          store.createConversation()
          store.addMessage({ role: 'assistant', content: getWelcomeMessage(), _isWelcome: true })
        }
        if (store.messages.length === 0) {
          store.addMessage({ role: 'assistant', content: getWelcomeMessage(), _isWelcome: true })
        }
        uni.showToast({ title: '已删除', icon: 'none' })
        isAtBottom.value = true
        showBackToBottom.value = false
        nextTick(() => {
          setTimeout(() => scrollToBottomAnchor(false), 50)
        })
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

function toggleAgentSwitch() { showAgentSwitch.value = !showAgentSwitch.value }
function toggleModelSwitch() { showModelSwitch.value = !showModelSwitch.value }

// 换模型重试：ModelSwitcher 关闭后触发 retry
watch(showModelSwitch, (v, prev) => {
  if (!v && prev && pendingRetryData.value) {
    pendingRetryData.value = null
    engineRetry({}, inputAreaRef, scrollToBottom, { startStreamScroll, stopStreamScroll })
  }
})

// ==================== onShow: 同步标签 + 滚到底部 ====================
let savedScrollTop = 0

onShow(() => {
  syncAllMessageTags()
  // 返回页面时滚到底部（不恢复旧位置 — 内容可能已变化）
  if (!isSending.value) {
    nextTick(() => {
      setTimeout(() => scrollToBottomAnchor(false), 100)
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
    <scroll-view 
      id="chat-scroll" 
      class="chat-scroll" 
      scroll-y 
      :scroll-with-animation="scrollWithAnim" 
      :scroll-top="scrollTopValue" 
      :scroll-into-view="scrollIntoView"
      @scroll="handleScroll"
    >
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

    <!-- 重试栏 -->
    <view v-if="showRetryBar && !isSending" class="retry-bar">
      <text class="retry-bar-title">AI 走神了，要不要再试一次？</text>
      <view class="retry-bar-actions">
        <view class="retry-btn retry-btn-primary" @tap="handleRetrySend">
          <SijiIcon name="refresh" size="sm" />
          <text>重新发送</text>
        </view>
        <view class="retry-btn retry-btn-secondary" @tap="handleRetryWithModel">
          <SijiIcon name="settings" size="sm" />
          <text>换模型</text>
        </view>
        <view class="retry-btn retry-btn-secondary" @tap="handleRetryEdit">
          <SijiIcon name="edit" size="sm" />
          <text>编辑</text>
        </view>
      </view>
    </view>

    <!-- 输入区 -->
    <InputArea ref="inputAreaRef" v-model="inputText" :disabled="isSending" :is-sending="isSending" @send="handleSend" @stop="handleStop" @image-selected="onImageSelected" @image-cleared="onImageCleared" />

    <!-- AI 使用说明 Modal -->
    <GuideModal :show="showGuide" @close="showGuide = false" />

    <!-- 模型快速切换 Modal -->
    <ModelSwitcher :show="showModelSwitch" @close="showModelSwitch = false" />

    <!-- Agent 快速切换 Modal -->
    <AgentSwitcher :show="showAgentSwitch" @close="showAgentSwitch = false" />

    <!-- 会话列表抽屉 -->
    <ConversationPanel
      :show="showConvList"
      :conversations="sortedConversations"
      :active-id="store.activeConversationId"
      @close="toggleConvList"
      @switch="handleSwitchConversation"
      @delete="handleDeleteConversation"
      @rename="handleRenameConversation"
      @new="handleNewConversation"
    />
  </view>
</template>

<style lang="scss" scoped>
@import './chat.scss';
</style>