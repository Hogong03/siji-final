<script setup>
/**
 * 聊天气泡组件 — 极简未来版
 *
 * 设计语言：纯黑白 + AI 单色聚焦
 * AI 气泡：浅灰底，左侧功能色条指示操作类型
 * 用户气泡：纯黑实心白字
 * 执行结果卡：白底黑边，只有数据有功能色
 *
 * props: message, isEditing
 * emits: confirm-action, confirm-pending, cancel-pending, start-edit, save-edit, cancel-edit, update-tags
 */
import { computed } from 'vue'
import SijiIcon from '@/components/common/SijiIcon.vue'
import ExecResultCard from './ExecResultCard.vue'
import MarkdownRenderer from './MarkdownRenderer.vue'

const props = defineProps({
  message: { type: Object, required: true },
  isEditing: { type: Boolean, default: false }
})

const emit = defineEmits([
  'confirm-action', 'confirm-pending', 'cancel-pending',
  'start-edit', 'save-edit', 'cancel-edit', 'update-tags', 'edit-own'
])

/** 根据执行结果类型决定颜色侧边条 */
const edgeColor = computed(() => {
  if (props.message.role !== 'assistant') return ''
  const er = props.message.execResult
  if (!er || !er.success) return ''
  const t = er.detail?.type || ''
  if (t.startsWith('bill') || t === 'create_bill' || t === 'update_bill' || t === 'query_bill') return 'var(--color-bill)'
  if (t.startsWith('diary') || t === 'create_diary' || t === 'update_diary' || t === 'query_diary') return 'var(--color-diary)'
  if (t.startsWith('plan') || t === 'create_plan' || t === 'update_plan' || t === 'query_plan') return 'var(--color-plan)'
  return ''
})

function copyContent() {
  const text = props.message?.content || ''
  if (!text) return
  uni.setClipboardData({
    data: text,
    success() {
      uni.showToast({ title: '已复制', icon: 'success' })
    }
  })
}

/** 待确认卡片图标 */
function execIcon(type) {
  const map = {
    diary: 'diary', bill: 'bill', plan: 'plan',
    query_diary: 'search', query_bill: 'stats', query_plan: 'search',
    update_bill: 'edit', update_diary: 'edit', update_plan: 'edit',
    delete_bill: 'trash', delete_diary: 'trash', delete_plan: 'trash'
  }
  return map[type] || 'check'
}

function actionTitle(action) {
  const map = {
    create_diary: '写日记', create_bill: '记账', create_plan: '创建计划',
    query_diary: '查询日记', query_bill: '查询账单', query_plan: '查询计划',
    update_bill: '修改账单', update_diary: '修改日记', update_plan: '修改计划',
    delete_bill: '删除账单', delete_diary: '删除日记', delete_plan: '删除计划'
  }
  return map[action.type] || '确认操作'
}

function actionDetail(action) {
  const p = action.payload || {}
  if (action.type === 'create_bill') return `¥${p.amount || 0} ${p.category || ''} ${p.note || ''}`.trim()
  if (action.type === 'create_diary') return p.title || (p.content || '').substring(0, 30) || ''
  if (action.type === 'create_plan') return p.title || ''
  if (action.type.startsWith('update_')) return Object.entries(p).map(([k,v]) => `${k}: ${v}`).join(' ')
  if (action.type.startsWith('delete_')) return p.title || p.client_id || ''
  return JSON.stringify(p).substring(0, 60)
}

/** 从执行结果卡片内触发的编辑操作，透传 emit */
function onStartEdit() { emit('start-edit') }
function onSaveEdit(form) { emit('save-edit', form) }
function onCancelEdit() { emit('cancel-edit') }
function onUpdateTags(payload) { emit('update-tags', payload) }
</script>

<template>
  <view class="bubble-wrapper" :class="message.role">
    <!-- 加载动画 — 横线伸缩 -->
    <view v-if="message.loading" class="loading-bar">
      <view class="bar-segment" />
      <view class="bar-segment" />
      <view class="bar-segment" />
    </view>

    <!-- 消息内容 -->
    <template v-else>
      <!-- 消息行：按钮 + 气泡 水平排列 -->
      <view class="msg-row" :class="message.role">
        <!-- 操作按钮组（用户消息在左侧，AI消息在右侧） -->
        <view class="bubble-actions" :class="message.role">
          <view class="bubble-action-btn btn-tactile" @tap.stop="copyContent">
            <SijiIcon name="copy" size="xs" color="var(--text-secondary)" />
          </view>
          <view v-if="message.role === 'user'" class="bubble-action-btn btn-tactile" @tap.stop="$emit('edit-own', message.content)">
            <SijiIcon name="edit" size="xs" color="var(--text-secondary)" />
          </view>
        </view>

        <view class="bubble" :class="[message.role, { 'has-edge': edgeColor }]" :style="edgeColor ? { borderLeftColor: edgeColor } : {}">
          <text v-if="message.role === 'assistant'" class="ai-label">AI</text>
          <image v-if="message.image" :src="message.image.base64" class="bubble-image" mode="widthFix" />
          <!-- AI 消息使用 MarkdownRenderer 渲染富文本 -->
          <MarkdownRenderer v-if="message.role === 'assistant'" :content="message.content" />
          <!-- 用户消息保持纯文本 -->
          <text v-else class="bubble-text" selectable="true" user-select="true">{{ message.content }}</text>
          <text class="bubble-time">{{ message.time }}</text>
        </view>
      </view>

      <!-- 待确认卡片 -->
      <view v-if="message.pendingAction" class="confirm-card">
        <view class="confirm-header">
          <SijiIcon :name="execIcon(message.pendingAction.type.replace('create_', ''))" size="sm" class="confirm-icon" />
          <text class="confirm-title">{{ actionTitle(message.pendingAction) }}</text>
        </view>
        <view class="confirm-body">
          <text class="confirm-detail">{{ actionDetail(message.pendingAction) }}</text>
        </view>
        <view class="confirm-actions">
          <view class="confirm-btn cancel" @tap="$emit('cancel-pending')">
            <text>取消</text>
          </view>
          <view class="confirm-btn ok" @tap="$emit('confirm-pending')">
            <text>确认执行</text>
          </view>
        </view>
      </view>

      <!-- 执行结果卡片（独立组件） -->
      <ExecResultCard
        v-else-if="message.execResult && message.execResult.success && !isEditing"
        :message="message"
        :is-editing="false"
        @confirm-action="$emit('confirm-action', $event)"
        @start-edit="onStartEdit"
        @save-edit="onSaveEdit"
        @cancel-edit="onCancelEdit"
        @update-tags="onUpdateTags"
      />

      <!-- 就地编辑表单（独立组件内） -->
      <ExecResultCard
        v-else-if="message.execResult && message.execResult.success && isEditing"
        :message="message"
        :is-editing="true"
        @confirm-action="$emit('confirm-action', $event)"
        @start-edit="onStartEdit"
        @save-edit="onSaveEdit"
        @cancel-edit="onCancelEdit"
        @update-tags="onUpdateTags"
      />

      <!-- 失败提示 -->
      <view
        v-else-if="message.execResult && !message.execResult.success && message.execResult.message !== '无需执行'"
        class="exec-card failed"
      >
        <text class="exec-error">{{ message.execResult.message }}</text>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.bubble-wrapper {
  display: flex;
  flex-direction: column;
  margin-bottom: $spacing-lg;
  padding: 0 $spacing-md;
  animation: bubbleIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) both;

  &.user { align-items: flex-end; }
  &.assistant { align-items: flex-start; }
}

/* 消息行：按钮 + 气泡水平排列 */
.msg-row {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  max-width: 100%;

  &.user {
    flex-direction: row;
    justify-content: flex-end;
  }
  &.assistant {
    flex-direction: row-reverse;
    justify-content: flex-end;
  }
}

@keyframes bubbleIn {
  from {
    opacity: 0;
    transform: translateY(16rpx) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* ─── 气泡 ─── */
.bubble {
  max-width: 80%;
  padding: $spacing-sm $spacing-md;
  position: relative;

  &.user {
    background: var(--color-ai);
    color: var(--bg-card);
    border-radius: 24rpx 24rpx 8rpx 24rpx;
  }

  &.assistant {
    background: var(--bg-card-alt);
    color: var(--text-primary);
    border-radius: 24rpx 24rpx 24rpx 8rpx;
    border-left: 3rpx solid var(--border-color);
    transition: border-color 0.25s ease;

    &.has-edge {
      border-left-color: var(--text-secondary);
    }
  }

  &-text {
    font-size: $font-md;
    line-height: 1.65;
    white-space: pre-wrap;
    word-break: break-word;
  }

  &-time {
    display: block;
    font-size: $font-xs;
    margin-top: 6rpx;
    opacity: 0.4;
    text-align: right;
  }

  &-image {
    width: 100%;
    max-width: 300rpx;
    border-radius: 12rpx;
    margin-bottom: $spacing-sm;
    display: block;
  }
}

/* 消息操作按钮组 — 气泡外部 */
.bubble-actions {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  flex-shrink: 0;
  padding-bottom: 4rpx;

  /* 用户消息：按钮在气泡左侧 */
  &.user {
    margin-right: 8rpx;
  }
  /* AI 消息：按钮在气泡右侧（row-reverse 下自然落在右边） */
  &.assistant {
    margin-right: 8rpx;
  }
}

.bubble-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40rpx;
  height: 40rpx;
  border-radius: 8rpx;
  background: var(--bg-card-alt);
  border: 1rpx solid var(--border-color);
  transition: background 0.15s, opacity 0.15s;
  opacity: 0.55;

  &:active {
    background: var(--border-color);
    opacity: 1;
  }
}

/* AI 标签 */
.ai-label {
  display: inline-block;
  font-size: 18rpx;
  font-weight: 700;
  color: var(--text-secondary);
  background: var(--border-color);
  padding: 2rpx 10rpx;
  border-radius: 4rpx;
  margin-bottom: 8rpx;
  letter-spacing: 1rpx;
}

/* ─── 加载动画 — 横线伸缩 ─── */
.loading-bar {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: $spacing-sm $spacing-md;
  background: var(--bg-card-alt);
  border-radius: 24rpx 24rpx 24rpx 8rpx;
  border-left: 3rpx solid var(--border-color);

  .bar-segment {
    width: 24rpx;
    height: 4rpx;
    background: var(--text-secondary);
    border-radius: 2rpx;
    animation: barSlide 1.2s infinite ease-in-out both;

    &:nth-child(1) { animation-delay: 0s; }
    &:nth-child(2) { animation-delay: 0.15s; }
    &:nth-child(3) { animation-delay: 0.3s; }
  }
}

@keyframes barSlide {
  0%, 100% { transform: scaleX(0.4); opacity: 0.3; }
  50% { transform: scaleX(1); opacity: 1; }
}

/* ─── 待确认卡片 ─── */
.confirm-card {
  margin-top: $spacing-sm;
  padding: $spacing-md;
  background: var(--bg-card);
  border-radius: 12rpx;
  border: 2rpx solid var(--color-ai);
  width: 85%;
}

.confirm-header {
  display: flex;
  align-items: center;
  margin-bottom: $spacing-xs;

  .confirm-icon { font-size: 32rpx; margin-right: $spacing-xs; }
  .confirm-title { font-size: $font-sm; font-weight: 700; color: var(--color-ai); }
}

.confirm-body {
  margin-bottom: $spacing-sm;
  .confirm-detail { font-size: $font-sm; color: var(--text-strong); }
}

.confirm-actions {
  display: flex;
  gap: $spacing-sm;
}

.confirm-btn {
  flex: 1;
  text-align: center;
  padding: 14rpx 0;
  border-radius: 8rpx;
  font-size: $font-sm;
  transition: transform 0.12s cubic-bezier(0.4, 0, 0.2, 1);

  &:active { transform: scale(0.94); }

  &.cancel {
    background: var(--bg-input);
    color: var(--text-secondary);
  }

  &.ok {
    background: var(--color-ai);
    color: var(--bg-card);
  }
}

/* ─── 失败提示（保留在 MessageBubble 中） ─── */
.exec-card {
  margin-top: $spacing-sm;
  padding: $spacing-sm $spacing-md;
  background: var(--bg-card);
  border-radius: 12rpx;
  border: 1rpx solid var(--border-color);
  width: 85%;

  &.failed {
    border-color: var(--color-danger, #ef4444);
  }
}

.exec-error {
  font-size: $font-sm;
  color: var(--color-danger, #ef4444);
}
</style>
