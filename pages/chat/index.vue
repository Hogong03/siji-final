<script setup>
/**
 * 思迹首页 - AI 对话核心 Tab
 *
 * UI: 极简未来 - 纯黑白 + AI 单色聚焦
 * 架构: 逻辑分散在 composables/ 下，本文件只处理 UI 渲染 + 事件胶水
 */
import { ref, nextTick, onMounted, onUnmounted, watch, computed } from 'vue'
import { onShow, onLoad, onHide } from '@dcloudio/uni-app'
import { useAppStore } from '@/store/index.js'
import MessageBubble from '@/components/chat/MessageBubble.vue'
import SijiIcon from '@/components/common/SijiIcon.vue'
import InputArea from '@/components/chat/InputArea.vue'
import ConversationPanel from '@/components/chat/ConversationPanel.vue'
import GuideModal from '@/components/chat/GuideModal.vue'
import ModelSwitcher from '@/components/chat/ModelSwitcher.vue'
import UnifiedSwitcher from '@/components/chat/UnifiedSwitcher.vue'
import OnboardingGuide from '@/components/chat/OnboardingGuide.vue'
import { useChatEngine } from '@/composables/useChatEngine.js'
import { useScrollControl } from '@/composables/useScrollControl.js'
import { useConversationManager } from '@/composables/useConversationManager.js'
import { useRetryBar } from '@/composables/useRetryBar.js'
import { useChatSession } from '@/composables/useChatSession.js'
import { useMessageEdit } from '@/composables/useMessageEdit.js'
import { useChatNavigation } from '@/composables/useChatNavigation.js'
import { useEnterSummary } from '@/composables/useEnterSummary.js'
import { hasEnterSummaryMessage, isEmptyConversation } from '@/utils/chat-session.js'
import { enterSummarySignature, shouldAppendEnterSummary } from '@/utils/enter-dialogue.js'
import { useVirtualMessages } from '@/composables/useVirtualMessages.js'
import { useChatRuler } from '@/composables/useChatRuler.js'

const store = useAppStore()
const inputText = ref('')
const inputAreaRef = ref(null)

// ===== 聊天核心逻辑 =====
const {
  isSending, sendStage, sendElapsedMs, pendingAction, pendingActions, pendingReply, currentSuggestions,
  nextStep, clearNextStep,
  simulationMode,
  getWelcomeMessage, handleSend: engineSend, handleStop: engineStop, handleRetry: engineRetry,
  handleConfirmAction, handleCancelAction, initSimulation
} = useChatEngine()

// ===== 滚动控制 =====
const {
  scrollTopValue, scrollIntoView, scrollWithAnim,
  isAtBottom, showBackToBottom, navScrolled,
  scrollToBottom, scrollToBottomAnchor,
  startStreamScroll, stopStreamScroll,
  handleScroll, backToBottom, resetScrollState, forceShouldAutoScroll
} = useScrollControl()

// ===== 发送状态行（P1）+ AI 气泡重新生成/换说法（P4）=====
const REPHRASE_HINT = '请把这条回复换个说法重新回答：意思保持一致，但换一种更自然、更简洁的表达，不要重复刚才的原句，也不要执行任何操作或输出动作。'
const sendStageText = computed(() => {
  const map = { idle: '正在连接…', thinking: '正在思考…', streaming: '正在回复…' }
  return map[sendStage.value] || '正在思考…'
})
const sendElapsedLabel = computed(() => {
  const s = Math.floor(sendElapsedMs.value / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
})
const chatScrollHelpers = { startStreamScroll, stopStreamScroll, scrollToBottomAnchor }

function handleRegenerateReply() {
  showRetryBar.value = false
  engineRetry({}, inputAreaRef, scrollToBottom, chatScrollHelpers)
}

function handleRephraseReply() {
  let hasText = false
  const msgs = store.messages
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === 'user') { hasText = !!msgs[i].content; break }
  }
  if (!hasText) {
    uni.showToast({ title: '上一条消息没有文字，无法换一种说法', icon: 'none' })
    return
  }
  showRetryBar.value = false
  engineRetry({ appendInstruction: REPHRASE_HINT }, inputAreaRef, scrollToBottom, chatScrollHelpers)
}

// ===== 进入总结（3.5.19：改成对话里的伪对话消息，不再是顶部卡片）=====
const { pending: enterSummary, dismiss: dismissEnterSummary } = useEnterSummary()
// 已落进对话的总结签名：同一条只写一次，回前台算出新的一批才再写
let _lastEnterSignature = ''
// 正在输出回复时先攒着，等这一轮结束再落（避免打断流式写最后一条消息）
let _queuedEnterSummary = null

/** 把新总结落成一条 AI 消息；重复或空内容返回 false（判定见 utils/enter-dialogue.js） */
function injectEnterSummary(summary) {
  if (!shouldAppendEnterSummary(summary, _lastEnterSignature)) return false
  if (!appendEnterSummary(summary)) return false
  _lastEnterSignature = enterSummarySignature(summary)
  return true
}

/** 流式输出结束后，把攒下的总结落进对话 */
function flushEnterSummary() {
  const queued = _queuedEnterSummary
  if (!queued) return
  _queuedEnterSummary = null
  if (injectEnterSummary(queued)) resetScrollState()
}

/**
 * 总结消息上的「返回旧对话」是否显示
 * 只在「这次刚进来、还没说过话」时给：已经在聊的会话里插一条总结，不该再劝你跳走
 */
const summaryReturnVisible = computed(
  () => !!resumeTarget.value && isEmptyConversation(store.activeConversation)
)

/**
 * 总结消息里预置按钮的分发（3.5.21）
 * navigate：先推进确认基线（看过就不再报）再跳页；prefill：把预置话术填进输入框，用户自己改
 * @param {Object} btn { key, label, action, value }，由 utils/enter-dialogue.js 的 buildEnterButtons 生成
 */
function handleEnterButton(btn) {
  if (!btn) return
  dismissEnterSummary()
  if (btn.action === 'prefill') {
    handleWelcomeChip(btn.value || '')
    return
  }
  uni.navigateTo({ url: btn.value || '/pages/diary/list' })
}

// ===== 会话管理 =====
const {
  showConvList, activeFilter, activeTag, allTags,
  sortedConversations, filteredConversations, groupedConversations, hasTags,
  toggleConvList, setFilter, selectTag, refreshTags,
  handleNewConversation: _handleNewConversation, handleSwitchConversation: _handleSwitchConversation, handleDeleteConversation: _handleDeleteConversation,
  handleRenameConversation, handleAddTag
} = useConversationManager(store, getWelcomeMessage, resetScrollState)

// ===== 冷启动新对话 + 新对话空态入口（3.5.16）=====
const { resumeTarget, resumeVisible, resumeAge, resumeCount, dismissResume, resumeBack, appendEnterSummary, maybeStartFreshSession } =
  useChatSession(store, getWelcomeMessage)

function handleResumeBack() {
  if (resumeBack()) resetScrollState()
}
function handleResumePick() {
  toggleConvList()
}

// ===== 重试栏 + 网络横幅 =====
const {
  showRetryBar, retryMessage, retryImage, pendingRetryData, retryTitle,
  showOfflineBanner, showReconnectedBanner,
  handleRetrySend: _handleRetrySend, handleRetryWithModel: _handleRetryWithModel, handleRetryEdit: _handleRetryEdit
} = useRetryBar(store, isSending, engineRetry, inputAreaRef, { startStreamScroll, stopStreamScroll, scrollToBottom, scrollToBottomAnchor })

function handleRetrySend() { _handleRetrySend() }
function handleRetryWithModel() { _handleRetryWithModel(showModelSwitch) }
function handleRetryEdit() { _handleRetryEdit(inputAreaRef) }

// 发送中切换/新建/删除会话 — 先停止当前请求，防止流式内容串写会话
function handleNewConversation() {
  if (isSending.value) handleStop()
  resetRuler()
  _handleNewConversation()
}
function handleSwitchConversation(id) {
  if (isSending.value) handleStop()
  resetRuler()
  _handleSwitchConversation(id)
}
function handleDeleteConversation(conv) {
  if (isSending.value) handleStop()
  _handleDeleteConversation(conv)
}

// ===== 编辑/标签 =====
const {
  handleUpdateTags, syncAllMessageTags
} = useMessageEdit(store)

// ===== 跳转路由 =====
const { handleConfirmActionCard } = useChatNavigation()

// ===== 虚拟消息列表 =====
const allMessages = computed(() => store.messages)
const {
  visibleMessages, hasMore, isLoadingMore, visibleCount,
  checkLoadMore: _checkLoadMore, reset: resetVirtual, toVisibleIndex, toGlobalIndex
} = useVirtualMessages(allMessages)
// ===== 对话尺（3.5.17）：消息够长时左侧出现刻度尺，点/拖快速跳转 =====
const {
  rulerVisible, rulerTicks, rulerActiveKey,
  rulerViewportStyle, rulerPreview, rulerPreviewStyle,
  syncRulerScroll, resetRuler,
  handleRulerTouchStart, handleRulerTouchMove, handleRulerTouchEnd, handleRulerTap
} = useChatRuler({
  allMessages,
  visibleCount,
  scrollIntoView,
  scrollWithAnim
})

// ===== 滚动事件 wrapper（叠加虚拟列表加载检查） =====
const _origHandleScroll = handleScroll
function wrappedHandleScroll(e) {
  _origHandleScroll(e)
  const { scrollTop, scrollHeight } = e.detail
  _checkLoadMore(scrollTop, scrollHeight)
  syncRulerScroll(e)
}

// ===== 页面生命周期 =====
let _deepLinkSim = false

onLoad((options) => {
  if (options && options.simulation) {
    _deepLinkSim = true
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

let _pendingSimParams = null
const _simHandler = (params) => { _pendingSimParams = params }
uni.$on('init-simulation', _simHandler)

// 外部页面投递一段待发送文本（关系页起草回复等）：先进缓冲区，onShow 时落到输入框
let _pendingPrefill = ''
const _prefillHandler = (text) => { if (text) _pendingPrefill = String(text) }
uni.$on('prefill-input', _prefillHandler)

onShow(() => {
  if (_pendingSimParams) {
    const params = _pendingSimParams
    _pendingSimParams = null
    initSimulation(params)
  }
  if (_pendingPrefill) {
    const text = _pendingPrefill
    _pendingPrefill = ''
    nextTick(() => { if (inputAreaRef.value) inputAreaRef.value.setText(text) })
  }
  syncAllMessageTags()
  resetVirtual()
  if (!isSending.value && store.messages.length > 0) {
    // 消息列表非空时才滚动，避免首次进入空列表滚动竞争
    nextTick(() => {
      setTimeout(() => scrollToBottomAnchor(false), 150)
    })
  }
})

onHide(() => {
  _pendingSimParams = null
  _pendingPrefill = ''
  stopStreamScroll()
})

// ===== 发送/停止/图片 =====
const pendingImage = ref(null)

function handleSend(text) {
  const message = text || inputText.value.trim()
  if (!message || isSending.value) return
  showRetryBar.value = false
  agentHintDismissed.value = true
  forceShouldAutoScroll()
  const img = pendingImage.value
  engineSend(message, inputAreaRef, scrollToBottom, img, { startStreamScroll, stopStreamScroll, scrollToBottomAnchor })
  pendingImage.value = null
}

function onImageSelected(data) { pendingImage.value = data }
function onImageCleared() { pendingImage.value = null }

function handleStop() {
  stopStreamScroll()
  engineStop()
}

function handleSuggestion(text) {
  currentSuggestions.value = []
  handleSend(text)
}

// 3.5.13：最小行动单卡 —— 点进计划详情，或直接关掉
function handleNextStep() {
  const item = nextStep.value
  clearNextStep()
  if (!item) return
  uni.navigateTo({ url: '/pages/plan/detail?clientId=' + item.client_id })
}

function handleEditOwn(content) {
  if (!content) return
  inputAreaRef.value?.setText(content)
}

// ===== 开场引导 Starter（3.1 M2）=====
// 当前 Agent 有 starts 且会话还没有用户消息时，在输入区上方展示可一键发送的示例
const starterChips = computed(() => {
  const starts = store.activeAgent && store.activeAgent.starts
  return Array.isArray(starts) ? starts.slice(0, 3) : []
})
const starterChipsVisible = computed(() => {
  if (simulationMode.value || isSending.value || starterChips.value.length === 0) return false
  const conv = store.activeConversation
  if (!conv) return true
  return !conv.messages.some(m => m.role === 'user')
})

// ===== 会话 Agent 绑定提示（3.1 M3）=====
// 打开历史会话时若绑定 Agent 与当前活跃 Agent 不一致，提示一次，不自动切换
const agentHintDismissed = ref(false)
const boundConvAgent = computed(() => {
  if (simulationMode.value) return null
  const conv = store.activeConversation
  if (!conv || !conv.agentId || conv.agentId === store.activeAgentId) return null
  return conv
})
const showConvAgentHint = computed(() => !!boundConvAgent.value && !agentHintDismissed.value)
const convAgentHintName = computed(() => {
  const conv = boundConvAgent.value
  if (!conv) return ''
  const agent = store.agents.find(a => a.id === conv.agentId)
  return (agent && agent.name) || conv.agentName || '该 Agent'
})
function switchToConversationAgent() {
  const conv = boundConvAgent.value
  if (conv && conv.agentId) store.setActiveAgent(conv.agentId)
  agentHintDismissed.value = true
}
watch(() => store.activeConversationId, () => {
  agentHintDismissed.value = false
})

// ===== UI Modal 状态 =====
const showGuide = ref(false)
const statusBarHeight = ref(0)
const showUnifiedSwitch = ref(false)
const showModelSwitch = ref(false)

// ===== 首次使用引导 =====
const showOnboarding = ref(false)
function checkOnboarding() {
  try {
    const done = uni.getStorageSync('siji_onboarding_done') === '1'
    if (!done) showOnboarding.value = true
  } catch { showOnboarding.value = true }
}

function showGuideModal() { showGuide.value = true }
function toggleUnifiedSwitch() { showUnifiedSwitch.value = !showUnifiedSwitch.value }
function toggleModelSwitch() { showModelSwitch.value = !showModelSwitch.value }

// 顶部厂商 logo 映射
const PROVIDER_LOGO_MAP = {
  deepseek: 'ds', zhipu: 'zg', qwen: 'qw', moonshot: 'ms', openai: 'oa'
}
function getProviderLogo(pid) {
  return `/static/icons/provider-${PROVIDER_LOGO_MAP[pid] || 'oa'}-v2.png`
}
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

watch(showModelSwitch, (v, prev) => {
  if (!v && prev && pendingRetryData.value) {
    pendingRetryData.value = null
    engineRetry({}, inputAreaRef, scrollToBottom, { startStreamScroll, stopStreamScroll, scrollToBottomAnchor })
  }
})

// ===== 进入总结落成对话消息（3.5.19）=====
// 回前台算出增量后写进当前对话；正在输出回复时排队，等这一轮结束再写
watch(enterSummary, (val) => {
  if (!val || simulationMode.value) return
  if (isSending.value) {
    _queuedEnterSummary = val
    return
  }
  if (injectEnterSummary(val)) resetScrollState()
})
watch(isSending, (val) => {
  if (!val) flushEnterSummary()
})

// ===== onMounted =====
onMounted(() => {
  // 冷启动：清空壳 → 停在一条新对话上（回前台不触发，避免打断打字）
  maybeStartFreshSession({
    pendingSimulation: !!_pendingSimParams || _deepLinkSim,
    enterSummary: enterSummary.value
  })
  // 会话初始化已写过总结时记下签名，同一批进展不再写第二遍
  if (hasEnterSummaryMessage(store.activeConversation)) _lastEnterSignature = enterSummarySignature(enterSummary.value)
  // 保护：如果 activeConversationId 指向的会话不存在（数据损坏/迁移），强制创建
  if (!store.activeConversation) {
    store.createConversation()
  }
  if (store.messages.length === 0 && !simulationMode.value && !_pendingSimParams) {
    // 有进入总结就发总结（伪对话开场），没有才发欢迎语
    if (!injectEnterSummary(enterSummary.value)) {
      store.addMessage({ role: 'assistant', content: getWelcomeMessage(), _isWelcome: true })
    }
  }
  const sysInfo = uni.getSystemInfoSync()
  statusBarHeight.value = sysInfo.statusBarHeight || 0
  // 延迟滚动到底部 — App 端 DOM 渲染较慢，需多轮重试确保 #chat-bottom 存在
  const tryScroll = (retries = 3) => {
    nextTick(() => {
      setTimeout(() => {
        scrollToBottomAnchor(false)
        if (retries > 0) {
          setTimeout(() => tryScroll(retries - 1), 100)
        }
      }, 100)
    })
  }
  tryScroll()
  uni.$on('welcome-chip-tap', handleWelcomeChip)
  // 首次使用引导
  checkOnboarding()
})

onUnmounted(() => {
  uni.$off('welcome-chip-tap', handleWelcomeChip)
  uni.$off('init-simulation', _simHandler)
  uni.$off('prefill-input', _prefillHandler)
})

function handleWelcomeChip(text) {
  if (inputAreaRef.value) {
    inputAreaRef.value.setText(text)
  }
}
</script>

<template>
  <view class="chat-page">
    <!-- 极简导航栏 -->
    <view class="custom-nav" :class="{ 'nav-scrolled': navScrolled }" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <view class="nav-menu-btn" @tap="toggleConvList">
          <SijiIcon name="menu" size="md" />
        </view>
        <view class="nav-brand" @tap="toggleUnifiedSwitch">
          <text class="nav-title">{{ store.activeAgent?.name || '思迹' }}</text>
          <view class="nav-badge-unified">
            <image
              :src="getProviderLogo(store.aiProvider)"
              mode="aspectFit"
              class="nav-badge-logo"
            />
            <text class="nav-badge-text">{{ store.currentProviderName }} ▾</text>
          </view>
        </view>
        <view class="nav-guide-btn" @tap="showGuideModal">
          <text class="guide-icon">?</text>
        </view>
      </view>
    </view>


    <!-- 会话 Agent 绑定提示（该会话由 X 进行 · 切换） -->
    <view v-if="showConvAgentHint" class="conv-agent-hint">
      <text class="conv-agent-hint-text">该会话由 {{ convAgentHintName }} 进行</text>
      <view class="conv-agent-hint-btn" @tap="switchToConversationAgent">
        <text class="conv-agent-hint-btn-text">切换</text>
      </view>
    </view>

    <!-- 离线提示条 -->
    <view v-if="showOfflineBanner" class="banner-slide-in offline-banner">
      <text class="offline-text">网络已断开 · 数据保存在本地</text>
    </view>

    <!-- 恢复连接反馈条 -->
    <view v-if="showReconnectedBanner" class="banner-slide-in reconnected-banner">
      <text class="reconnected-text">已恢复连接</text>
    </view>

    <!-- 模拟模式标识条 -->
    <view v-if="simulationMode" class="sim-banner">
      <view class="sim-banner-left" @tap="exitSimulation">
        <SijiIcon name="arrow-left" size="sm" />
        <text class="sim-banner-text">{{ simBannerTitle }} · 模拟中</text>
      </view>
      <text class="sim-banner-hint">说「复盘」结束</text>
    </view>

    <!-- 消息区：滚动列表 + 对话尺（3.5.17） -->
    <view class="messages-wrap" :class="{ 'has-ruler': rulerVisible }">
      <scroll-view 
        id="chat-scroll" 
        class="chat-scroll" 
        scroll-y 
        :scroll-with-animation="scrollWithAnim" 
        :scroll-top="scrollTopValue" 
        :scroll-into-view="scrollIntoView"
        @scroll="wrappedHandleScroll"
      >
        <!-- 加载更多提示 -->
        <view v-if="hasMore" class="load-more-hint">
          <text v-if="isLoadingMore">加载中...</text>
          <text v-else>上拉加载更多</text>
        </view>
        <view class="messages-list">
          <view
            v-for="(msg, vi) in visibleMessages" :key="toGlobalIndex(vi)"
            :id="'msg-' + toGlobalIndex(vi)"
            class="msg-anchor"
          >
            <MessageBubble
            :message="msg"
            :prev-role="vi > 0 ? visibleMessages[vi - 1].role : (toGlobalIndex(vi) > 0 ? allMessages[toGlobalIndex(vi) - 1].role : '')"
            :is-last="vi === visibleMessages.length - 1"
            :operable="msg.role === 'assistant' && !msg.loading && !!msg.content && !msg.failed && !msg._isWelcome && !msg._isEnterSummary && !msg.pendingAction && !msg.execResult && toGlobalIndex(vi) === allMessages.length - 1"
            @confirm-action="handleConfirmActionCard"
            @confirm-pending="handleConfirmAction"
            @cancel-pending="handleCancelAction"
            @update-tags="handleUpdateTags"
            @edit-own="handleEditOwn"
            @regenerate="handleRegenerateReply"
            @rephrase="handleRephraseReply"
          />
            <!-- 进入总结消息的操作行：预置按钮（3.5.21，按钮由 utils/enter-dialogue.js 按摘要内容生成）+ 返回旧对话 -->
            <view v-if="msg._isEnterSummary && !simulationMode" class="enter-actions">
              <view
                v-for="btn in (msg._enterButtons || [])"
                :key="btn.key"
                class="enter-btn"
                @tap="handleEnterButton(btn)"
              >
                <text class="enter-btn-text">{{ btn.label }}</text>
              </view>
              <view
                v-if="summaryReturnVisible"
                class="enter-btn enter-btn-primary"
                @tap="handleResumeBack"
              >
                <text class="enter-btn-text">返回旧对话 · {{ resumeTarget.title || '上次的对话' }}</text>
              </view>
            </view>
          </view>
          <!-- 新对话空态：回去接着聊 / 选择历史对话（3.5.16，可关） -->
          <view v-if="resumeVisible && !simulationMode" class="resume-card">
            <view class="resume-head">
              <text class="resume-label">这是新对话</text>
              <view class="resume-close" @tap="dismissResume">
                <text class="resume-close-icon">×</text>
              </view>
            </view>
            <view class="resume-main" @tap="handleResumeBack">
              <text class="resume-title">{{ resumeTarget.title || '上次的对话' }}</text>
              <text class="resume-meta">{{ resumeAge }}<text v-if="resumeCount > 0"> · {{ resumeCount }} 条消息</text></text>
            </view>
            <view class="resume-actions">
              <view class="resume-btn resume-btn-primary" @tap="handleResumeBack">回去接着聊</view>
              <view class="resume-btn" @tap="handleResumePick">选择历史对话</view>
            </view>
          </view>

          <view id="chat-bottom" style="height: 16rpx" />
        </view>
      </scroll-view>

      <!-- 对话尺：消息够长时出现在聊天区左侧，轻点/拖动刻度即可跳转 -->
      <view
        v-if="rulerVisible"
        id="chat-ruler"
        class="chat-ruler"
        @touchstart="handleRulerTouchStart"
        @touchmove="handleRulerTouchMove"
        @touchend="handleRulerTouchEnd"
        @touchcancel="handleRulerTouchEnd"
        @tap="handleRulerTap"
      >
        <view id="chat-ruler-track" class="ruler-track">
          <view class="ruler-viewport" :style="rulerViewportStyle" />
          <view
            v-for="t in rulerTicks" :key="t.key"
            class="ruler-tick"
            :class="{ 'tick-user': t.role === 'user', 'tick-active': t.key === rulerActiveKey }"
            :style="{ top: t.percent + '%' }"
          >
            <view class="ruler-bar" />
          </view>
          <view v-if="rulerPreview" class="ruler-preview" :style="rulerPreviewStyle">
            <text class="ruler-preview-text">{{ rulerPreview.label }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 回到底部按钮 -->
    <view v-if="showBackToBottom" class="back-to-bottom" @tap="backToBottom">
      <SijiIcon name="arrow-down" size="sm" color="#71717A" />
    </view>

    <!-- 对话后的最小行动单卡（3.5.13：每天最多一次，可关，不追问） -->
    <view v-if="nextStep && !isSending" class="next-step-card">
      <view class="next-step-main" @tap="handleNextStep">
        <text class="next-step-label">今天可以从这件开始</text>
        <text class="next-step-title">{{ nextStep.title }}</text>
        <text v-if="nextStep.minutes > 0" class="next-step-meta">约 {{ nextStep.minutes }} 分钟</text>
      </view>
      <view class="next-step-close" @tap="clearNextStep">
        <text class="next-step-close-icon">×</text>
      </view>
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
      <text class="retry-bar-title">{{ retryTitle }}</text>
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

    <!-- 开场引导 Starter：切换/创建 Agent 后可一键发送的示例 -->
    <view v-if="starterChipsVisible" class="agent-starter-bar">
      <view
        v-for="(s, i) in starterChips" :key="i"
        class="agent-starter-chip"
        @tap="handleSend(s)"
      >
        <text class="agent-starter-chip-text">{{ s }}</text>
      </view>
    </view>

    <!-- 发送中状态行：正在思考/回复 + 计时 -->
    <view v-if="isSending" class="sending-strip">
      <view class="sending-dot" />
      <text class="sending-text">{{ sendStageText }}</text>
      <text class="sending-elapsed">{{ sendElapsedLabel }}</text>
    </view>

    <!-- 输入区 -->
    <InputArea ref="inputAreaRef" v-model="inputText" :disabled="isSending" :is-sending="isSending" @send="handleSend" @stop="handleStop" @image-selected="onImageSelected" @image-cleared="onImageCleared" />

    <!-- AI 使用说明 Modal -->
    <GuideModal :show="showGuide" @close="showGuide = false" />
  <OnboardingGuide :show="showOnboarding" @finish="showOnboarding = false" />

    <!-- 模型快速切换 Modal -->
    <ModelSwitcher :show="showModelSwitch" @close="showModelSwitch = false" />

    <!-- 统一切换 Modal（厂商 + Agent） -->
    <UnifiedSwitcher :show="showUnifiedSwitch" @close="showUnifiedSwitch = false" />

    <!-- 会话列表抽屉 -->
    <ConversationPanel
      :show="showConvList"
      :conversations="filteredConversations"
      :grouped-conversations="groupedConversations"
      :active-id="store.activeConversationId"
      :active-filter="activeFilter"
      :active-tag="activeTag"
      :all-tags="allTags"
      :has-tags="hasTags"
      @close="toggleConvList"
      @switch="handleSwitchConversation"
      @delete="handleDeleteConversation"
      @rename="handleRenameConversation"
      @new="handleNewConversation"
      @set-filter="setFilter"
      @select-tag="selectTag"
      @add-tag="handleAddTag"
      @navigate="(url) => { toggleConvList(); uni.navigateTo({ url }) }"
    />
  </view>
</template>

<style lang="scss" scoped>
@import './chat.scss';
</style>
