<script setup>
/**
 * 聊天气泡组件 — 极简未来版
 *
 * 设计语言：纯黑白 + AI 单色聚焦
 * AI 气泡：浅灰底，左侧功能色条指示操作类型
 * 用户气泡：纯黑实心白字
 * 执行结果卡：白底黑边，只有数据有功能色
 *
 * props: message
 * emits: confirm-action, confirm-pending, cancel-pending, update-tags
 */
import { computed, ref, watch } from 'vue'
import SijiIcon from '@/components/common/SijiIcon.vue'
import ExecResultCard from './ExecResultCard.vue'
import MarkdownRenderer from './MarkdownRenderer.vue'
import { previewImage } from '@/utils/image.js'

const props = defineProps({
  message: { type: Object, required: true },
  prevRole: { type: String, default: '' },
  operable: { type: Boolean, default: false },
  isLast: { type: Boolean, default: false }
})

/** 图片 src：优先 localPath（已存本地），fallback base64 */
const imageSrc = computed(() => {
  const img = props.message?.image
  if (!img) return ''
  return img.localPath || img.base64 || ''
})

/** 图片加载失败兜底（localPath 失效时） */
const imageFailed = ref(false)
function onImageError() { imageFailed.value = true }
watch(imageSrc, () => { imageFailed.value = false })

const emit = defineEmits([
  'confirm-action', 'confirm-pending', 'cancel-pending',
  'update-tags', 'edit-own', 'delete-message', 'regenerate', 'rephrase', 'read-long'
])

/** 文件卡文案：名称 · 大小 · 行数（3.6.0 读文件） */
const fileLabel = computed(() => {
  const f = props.message?.file
  if (!f) return ''
  const parts = [f.name || '文件']
  if (f.sizeText) parts.push(f.sizeText)
  if (f.lines) parts.push(f.lines + ' 行')
  if (f.truncated) parts.push('已截断')
  return parts.join(' · ')
})

/** 点击图片预览 */
function onImageTap() {
  if (imageSrc.value) previewImage([imageSrc.value], 0)
}

/** 根据执行结果类型决定颜色侧边条 */
const edgeColor = computed(() => {
  if (props.message.role !== 'assistant') return ''
  const er = props.message.execResult
  if (!er || !er.success) return ''
  const t = er.detail?.type || ''
  if (t.startsWith('bill') || t === 'create_bill' || t === 'update_bill' || t === 'query_bill') return '#F59E0B'
  if (t.startsWith('diary') || t === 'create_diary' || t === 'update_diary' || t === 'query_diary') return '#0EA5E9'
  if (t.startsWith('plan') || t === 'create_plan' || t === 'update_plan' || t === 'query_plan') return '#059669'
  if (t === 'glimmer' || t === 'query_glimmers') return '#B45309'
  return ''
})

/** AI 消息内容类型检测 — 用于气泡样式变化 */
const contentStyle = computed(() => {
  if (props.message.role !== 'assistant' || !props.message.content) return 'plain'
  const c = props.message.content
  const hasCodeBlock = c.includes('```')
  const hasList = /^[\-\*]\s/m.test(c) || /^\d+\.\s/m.test(c)
  const hasHeading = /^#{1,4}\s/m.test(c)
  const hasQuote = /^>/m.test(c)
  const hasTable = c.includes('|') && c.includes('---')
  const length = c.length

  if (hasCodeBlock) return 'code'
  if (hasTable) return 'table'
  if (hasQuote) return 'quote'
  if (hasHeading && hasList && length > 200) return 'rich'
  if (hasList && length > 100) return 'list'
  if (length > 500) return 'long'
  if (length < 30) return 'short'
  return 'plain'
})

/** 是否为欢迎消息 */
/**
 * 欢迎语快捷按钮 → 填进输入框
 * 3.10.0 修死按钮：原来用 $root.$emit（Vue 组件事件），而聊天页用 uni.$on（uni 事件总线）听，
 * 两者不在一条通道上，点了没有任何反应。统一走 uni.$emit。
 */
function emitWelcomeChip(text) {
  if (!text) return
  uni.$emit('welcome-chip-tap', text)
}

const isWelcome = computed(() => !!props.message._isWelcome)

/** 是否为连续 AI 消息（上一条也是 AI）—— 去重标签 */
const isContinuation = computed(() => {
  return props.message.role === 'assistant' && props.prevRole === 'assistant'
})

/** 短文本检测 — 收窄气泡 */
const isShort = computed(() => {
  if (!props.message.content) return false
  return props.message.content.length < 30 && !props.message.content.includes('\n')
})

/* 复制功能 — 所有消息可用，显式按钮替代长按 */
function copyContent() {
  const text = props.message.content || ''
  if (!text) return
  uni.setClipboardData({
    data: text,
    success: () => uni.showToast({ title: '已复制', icon: 'success' })
  })
}

/* 编辑自己的消息 — 填回输入框重新编辑发送 */
function editOwn() {
  if (!props.message.content) return
  emit('edit-own', props.message.content)
}

/** AI 气泡操作：重新生成 / 换一种说法（P4，事件交由页面触发重发） */
/** 长文阈值（4.3.0）：超过这个字数就给「按章节阅读」入口 */
const LONG_TEXT_MIN = 800

/** 这条 AI 回复算不算长文（正文长度） */
const isLongText = computed(() => {
  if (props.message.role !== 'assistant') return false
  const text = props.message.aiReply || props.message.content || ''
  return typeof text === 'string' && text.replace(/\s+/g, '').length >= LONG_TEXT_MIN
})

function onReadLong() { emit('read-long', props.message) }

function onRegenerate() { emit('regenerate') }
function onRephrase() { emit('rephrase') }

/** 待确认卡片图标 */
function execIcon(type) {
  const map = {
    diary: 'diary', bill: 'bill', plan: 'plan', plan_phases: 'plan',
    query_diary: 'search', query_bill: 'stats', query_plan: 'search',
    update_bill: 'edit', update_diary: 'edit', update_plan: 'edit',
    delete_bill: 'trash', delete_diary: 'trash', delete_plan: 'trash'
  }
  return map[type] || 'check'
}

function actionTitle(action) {
  const map = {
    create_diary: '写记录', create_bill: '记账', create_plan: '创建计划',
    create_plan_phases: '创建分阶段计划',
    query_diary: '查询记录', query_bill: '查询账单', query_plan: '查询计划',
    update_bill: '修改账单', update_diary: '修改记录', update_plan: '修改计划',
    update_plan_phase: '更新计划阶段', update_plan_subtask: '更新计划子项',
    delete_bill: '删除账单', delete_diary: '删除记录', delete_plan: '删除计划',
    smart_update_profile: '更新个人信息', update_profile: '更新个人信息',
    create_relation: '创建人物档案', update_relation: '修改人物档案', log_interaction: '记录互动',
    create_decision: '创建决策', update_decision: '更新决策', review_decision: '复盘决策',
    create_feedback: '提交反馈', update_feedback: '修改反馈',
    add_tag: '添加标签', update_tag_category: '修改标签分类', remove_tag: '删除标签',
    create_agent: '创建 Agent', create_plan_template: '保存计划模板', undo_last: '撤销上一步',
    create_glimmer: '收微光', query_glimmers: '查看微光本'
  }
  return map[action.type] || '确认操作'
}

function actionDetail(action) {
  const p = action.payload || {}
  if (action.type === 'create_bill') return `¥${p.amount || 0} ${p.category || ''} ${p.note || ''}`.trim()
  if (action.type === 'create_diary') return p.title || (p.content || '').substring(0, 30) || ''
  if (action.type === 'create_plan') return p.title || ''
  if (action.type === 'create_plan_phases') return (p.title || '') + (p.phase_count ? `（${p.phase_count} 个阶段）` : '')
  if (action.type === 'create_glimmer') return (p.content || '').substring(0, 30)
  if (action.type === 'create_agent') {
    const parts = [`名称：${p.name || ''}`]
    if (p.description) parts.push(p.description)
    return parts.join('｜')
  }
  if (action.type === 'smart_update_profile' || action.type === 'update_profile') {
    const updates = Array.isArray(p.updates) ? p.updates : []
    const labels = []
    updates.slice(0, 4).forEach(u => labels.push(`${u.card || u.field || '?'}: ${u.value != null ? u.value : (u.field || '')}`))
    if (p.custom && p.custom.length) labels.push(p.custom.map(c => `${c.label}: ${c.value}`).join('、'))
    return labels.length ? labels.join('；') : (JSON.stringify(p).substring(0, 60))
  }
  if (action.type === 'log_interaction') return `${p.relation_name || p.relation_id || ''} ${p.scene || ''} ${p.content || ''}`.trim()
  if (action.type === 'create_relation') return `${p.name || ''}（${p.relation || '未填关系'}）`
  if (action.type.startsWith('update_')) return Object.entries(p).map(([k,v]) => `${k}: ${v}`).join(' ')
  if (action.type.startsWith('delete_')) return p.title || p.client_id || ''
  return JSON.stringify(p).substring(0, 60)
}

/** 待确认卡标题：多操作时显示总数 */
function confirmCardTitle(message) {
  const list = message?.pendingActions
  if (Array.isArray(list) && list.length > 1) return `${list.length} 个操作待确认`
  return actionTitle(message?.pendingAction || {})
}

/** 从执行结果卡片内触发的标签操作，透传 emit */
function onUpdateTags(payload) { emit('update-tags', payload) }

/** 长按消息 — 已禁用（削弱 AI 幻觉 + 简化交互） */
</script>

<template>
  <view class="bubble-wrapper" :class="[message.role, { streaming: message.loading && message.content, 'is-continuation': isContinuation, 'is-short': isShort }]">
    <!-- 加载动画 — 仅在无内容时显示（等待 AI 响应） -->
    <view v-if="message.loading && !message.content" class="bubble assistant loading-bubble">
      <view class="loading-bar">
        <view class="bar-segment" />
        <view class="bar-segment" />
        <view class="bar-segment" />
      </view>
    </view>

    <!-- 消息内容 -->
    <template v-else>
      <!-- 消息行：单气泡，长按触发操作 -->
      <view class="msg-row" :class="message.role">
        <view class="bubble" :class="[message.role, contentStyle, { 'has-edge': edgeColor, 'is-welcome': isWelcome, 'is-continuation': isContinuation, 'is-short': isShort, 'streaming': message.role === 'assistant' && message.loading && message.content }]" :style="edgeColor ? { borderLeftColor: edgeColor } : {}">
          <image v-if="message.image && !imageFailed" :src="imageSrc" class="bubble-image" mode="widthFix" @tap="onImageTap" @error="onImageError" />
          <view v-else-if="message.image && imageFailed" class="bubble-image-fallback" @tap="onImageTap">
            <text class="bubble-image-fallback-text">图片已失效</text>
          </view>
          <!-- 3.6.0 读文件：只挂一张文件卡，正文不进气泡（太长） -->
          <view v-if="message.file" class="bubble-file">
            <text class="bubble-file-badge">文件</text>
            <text class="bubble-file-name">{{ fileLabel }}</text>
          </view>
          <!-- AI 消息：流式期间用纯文本（避免每帧全量解析 Markdown），结束后切富文本 -->
          <MarkdownRenderer v-if="message.role === 'assistant' && !(message.loading && message.content)" :content="message.content" />
          <text v-else-if="message.role === 'assistant'" class="bubble-text">{{ message.content }}</text>
          <!-- 用户消息保持纯文本（禁用复制/选择，削弱幻觉传播） -->
          <text v-else class="bubble-text">{{ message.content }}</text>

          <!-- 欢迎消息快捷示例 -->
          <view v-if="isWelcome" class="welcome-chips">
            <view class="welcome-chip" @tap.stop="emitWelcomeChip('记一笔午餐 ¥25')">
              <text>记一笔午餐 ¥25</text>
            </view>
            <view class="welcome-chip" @tap.stop="emitWelcomeChip('写个记录：今天很开心')">
              <text>写个记录：今天很开心</text>
            </view>
            <view class="welcome-chip" @tap.stop="emitWelcomeChip('帮我规划下周工作')">
              <text>帮我规划下周工作</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 时间戳 + 操作按钮（AI: 复制；用户: 复制+编辑） -->
      <view class="bubble-meta" :class="message.role">
        <text class="bubble-time-outer">{{ message.time }}</text>
        <text v-if="message.role === 'user' && message.content" class="bubble-action-btn" @tap.stop="copyContent">复制</text>
        <text v-if="message.role === 'user' && message.content" class="bubble-action-btn" @tap.stop="editOwn">编辑</text>
        <text v-if="message.role === 'assistant' && message.content && operable" class="bubble-action-btn" @tap.stop="onRegenerate">重新生成</text>
        <text v-if="message.role === 'assistant' && message.content && operable" class="bubble-action-btn" @tap.stop="onRephrase">换一种说法</text>
        <text v-if="message.role === 'assistant' && message.content" class="bubble-action-btn" @tap.stop="copyContent">复制</text>
        <!-- 长文：给一个按章节读的入口（会先存成记录，再进阅读页的目录尺版式） -->
        <text v-if="isLongText" class="bubble-action-btn bubble-action-strong" @tap.stop="onReadLong">按章节阅读</text>
      </view>

      <!-- 待确认卡片 -->
      <view v-if="message.pendingAction" class="confirm-card">
        <view class="confirm-header">
          <SijiIcon :name="execIcon(message.pendingAction.type.replace('create_', ''))" size="sm" class="confirm-icon" />
          <text class="confirm-title">{{ confirmCardTitle(message) }}</text>
        </view>
        <view class="confirm-body">
          <template v-if="Array.isArray(message.pendingActions) && message.pendingActions.length > 1">
            <text v-for="(pa, pi) in message.pendingActions" :key="pi" class="confirm-detail">{{ actionTitle(pa) }}：{{ actionDetail(pa) }}</text>
          </template>
          <text v-else class="confirm-detail">{{ actionDetail(message.pendingAction) }}</text>
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
        v-else-if="message.execResult && message.execResult.success"
        :message="message"
        @confirm-action="$emit('confirm-action', $event)"
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

<style scoped lang="scss">
@import './MessageBubble.scss';

.bubble-image-fallback {
  width: 320rpx;
  height: 160rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #F4F4F5;
  border-radius: 12rpx;
}
.bubble-image-fallback-text {
  font-size: 24rpx;
  color: #A1A1AA;
}
</style>
