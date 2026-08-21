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
import { useChatTagSync } from '@/composables/useChatTagSync.js'
import { useMessageEdit } from '@/composables/useMessageEdit.js'
import { useChatNavigation } from '@/composables/useChatNavigation.js'
import { useVirtualMessages } from '@/composables/useVirtualMessages.js'

const store = useAppStore()
const inputText = ref('')
const inputAreaRef = ref(null)

// ===== 聊天核心逻辑 =====
const {
  isSending, pendingAction, pendingActions, pendingReply, currentSuggestions,
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

// ===== 会话管理 =====
const {
  showConvList, activeFilter, activeTag, allTags,
  sortedConversations, filteredConversations, groupedConversations, hasTags,
  toggleConvList, setFilter, selectTag, refreshTags,
  handleNewConversation: _handleNewConversation, handleSwitchConversation: _handleSwitchConversation, handleDeleteConversation: _handleDeleteConversation,
  handleRenameConversation, handleAddTag
} = useConversationManager(store, getWelcomeMessage, resetScrollState)

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
  _handleNewConversation()
}
function handleSwitchConversation(id) {
  if (isSending.value) handleStop()
  _handleSwitchConversation(id)
}
function handleDeleteConversation(conv) {
  if (isSending.value) handleStop()
  _handleDeleteConversation(conv)
}

// ===== 编辑/标签 =====
const {
  editingMessage, startEdit, cancelEdit, saveEdit, handleUpdateTags, syncAllMessageTags
} = useMessageEdit(store)

// ===== 跳转路由 =====
const { handleConfirmActionCard } = useChatNavigation()

// ===== 虚拟消息列表 =====
const allMessages = computed(() => store.messages)
const {
  visibleMessages, hasMore, isLoadingMore,
  checkLoadMore: _checkLoadMore, reset: resetVirtual, toVisibleIndex, toGlobalIndex
} = useVirtualMessages(allMessages)

// ===== 滚动事件 wrapper（叠加虚拟列表加载检查） =====
const _origHandleScroll = handleScroll
function wrappedHandleScroll(e) {
  _origHandleScroll(e)
  const { scrollTop, scrollHeight } = e.detail
  _checkLoadMore(scrollTop, scrollHeight)
}

// ===== 页面生命周期 =====
onLoad((options) => {
  if (options && options.simulation) {
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

onShow(() => {
  if (_pendingSimParams) {
    const params = _pendingSimParams
    _pendingSimParams = null
    initSimulation(params)
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
  stopStreamScroll()
})

// ===== 发送/停止/图片 =====
const pendingImage = ref(null)

function handleSend(text) {
  const message = text || inputText.value.trim()
  if (!message || isSending.value) return
  showRetryBar.value = false
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

function handleEditOwn(content) {
  if (!content) return
  inputAreaRef.value?.setText(content)
}

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
  return `/static/icons/provider-${PROVIDER_LOGO_MAP[pid] || 'oa'}.png`
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

// ===== onMounted =====
onMounted(() => {
  // 保护：如果 activeConversationId 指向的会话不存在（数据损坏/迁移），强制创建
  if (!store.activeConversation) {
    store.createConversation()
  }
  if (store.messages.length === 0 && !simulationMode.value && !_pendingSimParams) {
    store.addMessage({ role: 'assistant', content: getWelcomeMessage(), _isWelcome: true })
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

    <!-- 消息列表 -->
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
        <MessageBubble
          v-for="(msg, vi) in visibleMessages" :key="toGlobalIndex(vi)"
          :message="msg" :is-editing="editingMessage === toGlobalIndex(vi)"
          :prev-role="vi > 0 ? visibleMessages[vi - 1].role : (toGlobalIndex(vi) > 0 ? allMessages[toGlobalIndex(vi) - 1].role : '')"
          :is-last="vi === visibleMessages.length - 1"
          @confirm-action="handleConfirmActionCard"
          @confirm-pending="handleConfirmAction"
          @cancel-pending="handleCancelAction"
          @start-edit="startEdit(toGlobalIndex(vi))"
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
      <SijiIcon name="arrow-down" size="sm" color="#71717A" />
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
