<script setup>
/**
 * 执行结果卡片 — 从 MessageBubble 拆出
 *
 * 显示 AI 自动执行操作后的结果摘要（记录/账单/计划/查询/撤销）
 * 支持内联标签编辑（diary/plan）
 *
 * 已拆分模块：
 *   - useExecTags.js — 标签管理逻辑（增删改查、面板交互）
 *   - useExecCardHelpers.js — 卡片辅助函数（心情 emoji、优先级、进度计算等）
 *
 * props: message, isEditing
 * emits: confirm-action, start-edit, save-edit, cancel-edit, update-tags
 */
import { ref, watch, computed } from 'vue'
import SijiIcon from '@/components/common/SijiIcon.vue'
import { useExecTags } from '@/composables/useExecTags.js'
import {
  priorityClass, planProgressPercent, planDoneCount,
  topCategories, formatTs, execIcon, CATEGORIES
} from '@/composables/useExecCardHelpers.js'

const props = defineProps({
  message: { type: Object, required: true },
  isEditing: { type: Boolean, default: false }
})

const emit = defineEmits([
  'confirm-action', 'start-edit', 'save-edit', 'cancel-edit', 'update-tags'
])

const localForm = ref({})

/* 双击检测 */
let lastTapTime = 0
function onCardTap() {
  const now = Date.now()
  if (now - lastTapTime < 350) {
    lastTapTime = 0
    emit('start-edit')
  } else {
    lastTapTime = now
  }
}

function onEditConfirm() {
  emit('save-edit', localForm.value)
}

function initEditForm(detail) {
  if (!detail) { localForm.value = {}; return }
  if (detail.type === 'bill') {
    localForm.value = { amount: String(detail.amount || ''), category: detail.category || '其他', note: '' }
  } else if (detail.type === 'diary') {
    localForm.value = { title: detail.title || '' }
  } else if (detail.type === 'plan') {
    localForm.value = { title: detail.title || '' }
  } else {
    localForm.value = {}
  }
}

watch(() => props.isEditing, (editing) => {
  if (editing && props.message?.execResult?.detail) {
    initEditForm(props.message.execResult.detail)
  }
})

const categories = CATEGORIES

// 卡片头部类型图标 + 样式类
const execTypeIcon = computed(() => {
  const t = props.message?.execResult?.detail?.type || ''
  if (t === 'bill') return '¥'
  if (t === 'diary') return '📝'
  if (t === 'plan') return '✓'
  if (t.startsWith('query_')) return '🔍'
  if (t === 'undo') return '↩'
  return '✓'
})

const execTypeClass = computed(() => {
  const t = props.message?.execResult?.detail?.type || ''
  if (t === 'bill') return 'type-bill'
  if (t === 'diary') return 'type-diary'
  if (t === 'plan') return 'type-plan'
  if (t.startsWith('query_')) return 'type-query'
  return 'type-default'
})

// 标签管理 — 委托给 useExecTags composable
const {
  showTagPanel, tagPanelTags, newTagInput, canEditTags,
  currentTags, openTagPanel, closeTagPanel, toggleTag, isTagOn,
  createNewTag, removeTagFromCard, tagColor
} = useExecTags(props, emit)
</script>

<template>
  <!-- 复合意图结果 -->
  <template v-if="message.execResults && message.execResults.length > 1">
    <view class="exec-header">
      <text class="exec-status">{{ message.execResults.length }} 个操作已执行</text>
    </view>
    <view class="exec-multi-card" v-for="(r, idx) in message.execResults" :key="idx">
      <view class="exec-multi-row">
        <SijiIcon :name="execIcon(r.detail?.type)" size="sm" class="exec-multi-icon" />
        <view class="exec-multi-body">
          <text class="exec-multi-text">{{ r.message }}</text>
          <text v-if="r.detail?.type === 'bill'" class="exec-multi-sub">¥{{ r.detail.amount }} {{ r.detail.category }}</text>
          <text v-else-if="r.detail?.type === 'diary'" class="exec-multi-sub">{{ r.detail.title }}</text>
          <text v-else-if="r.detail?.type === 'plan'" class="exec-multi-sub">{{ r.detail.title }}</text>
        </view>
        <text class="exec-multi-arrow" @tap="$emit('confirm-action', { type: r.detail?.type ? ('create_' + r.detail.type) : '', payload: r.detail })">查看 →</text>
      </view>
    </view>
  </template>

  <!-- 单意图结果 -->
  <template v-else>
    <view class="exec-header">
      <view class="exec-header-left">
        <view class="exec-type-icon" :class="execTypeClass">
          <text class="eti-text">{{ execTypeIcon }}</text>
        </view>
      </view>
      <view class="exec-header-actions">
        <view class="exec-action-btn" @tap="$emit('start-edit')">
          <text class="exec-action-icon">✎</text>
        </view>
        <view class="exec-action-btn" @tap="$emit('confirm-action', message.actionCard)">
          <text class="exec-action-icon">→</text>
        </view>
      </view>
    </view>

    <view class="exec-body" @tap="onCardTap">
      <!-- ── 账单卡片 ── -->
      <template v-if="message.execResult.detail?.type === 'bill'">
        <view class="card-bill">
          <view class="bill-main-row">
            <text class="bill-amount" :class="{ income: message.execResult.detail.billType === 'income' }">
              {{ message.execResult.detail.billType === 'income' ? '+' : '-' }}{{ message.execResult.detail.amount }}
            </text>
            <view class="bill-cat-tag" :class="message.execResult.detail.billType === 'income' ? 'income' : 'expense'">
              <text class="bct-text">{{ message.execResult.detail.category }}</text>
            </view>
          </view>
          <view class="bill-meta-row" v-if="message.execResult.detail.bill_date || message.execResult.detail.note">
            <text class="bill-date" v-if="message.execResult.detail.bill_date">{{ message.execResult.detail.bill_date }}</text>
            <text class="bill-note" v-if="message.execResult.detail.note">· {{ message.execResult.detail.note }}</text>
          </view>
        </view>
      </template>

      <!-- ── 记录卡片 ── -->
      <template v-else-if="message.execResult.detail?.type === 'diary'">
        <view class="card-diary">
          <text class="diary-title">{{ message.execResult.detail.title }}</text>
          <text class="diary-preview" v-if="message.execResult.detail.content">{{ (message.execResult.detail.content || '').substring(0, 80) }}{{ (message.execResult.detail.content || '').length > 80 ? '...' : '' }}</text>
          <text class="diary-date" v-if="message.execResult.detail.created_at">{{ formatTs(message.execResult.detail.created_at) }}</text>
        </view>
      </template>

      <!-- ── 计划卡片 ── -->
      <template v-else-if="message.execResult.detail?.type === 'plan'">
        <view class="card-plan">
          <view class="plan-title-row">
            <view class="plan-priority-dot" :class="priorityClass(message.execResult.detail.priority)" />
            <text class="plan-title">{{ message.execResult.detail.title }}</text>
          </view>
          <text class="plan-desc" v-if="message.execResult.detail.description">{{ message.execResult.detail.description }}</text>
          <!-- 进度条 -->
          <view class="plan-progress" v-if="message.execResult.detail.subtasks?.length > 0">
            <view class="plan-progress-bar">
              <view class="plan-progress-fill" :style="{ width: planProgressPercent(message.execResult.detail) + '%' }" />
            </view>
            <text class="plan-progress-text">{{ planDoneCount(message.execResult.detail) }}/{{ message.execResult.detail.subtasks.length }}</text>
          </view>
          <text class="plan-subtask-count" v-else-if="message.execResult.detail.subtaskCount > 0">
            {{ message.execResult.detail.subtaskCount }} 个子任务
          </text>
          <view class="plan-date-row" v-if="message.execResult.detail.estimated_time || message.execResult.detail.due_date || message.execResult.detail.deadline">
            <text v-if="message.execResult.detail.estimated_time" class="plan-date-chip est">预计 {{ message.execResult.detail.estimated_time }}</text>
            <text v-if="message.execResult.detail.due_date || message.execResult.detail.deadline" class="plan-date-chip due">截止 {{ message.execResult.detail.due_date || message.execResult.detail.deadline }}</text>
          </view>
          <view class="plan-subtasks" v-if="message.execResult.detail.subtasks?.length > 0 && message.execResult.detail.subtasks.length <= 5">
            <view class="subtask-row" v-for="(st, idx) in message.execResult.detail.subtasks" :key="idx">
              <text class="subtask-dot" :class="{ done: st.done }">{{ st.done ? '✓' : '○' }}</text>
              <text class="subtask-title" :class="{ done: st.done }">{{ st.title }}</text>
            </view>
          </view>
        </view>
      </template>

      <!-- ── 查询账单 ── -->
      <template v-else-if="message.execResult.detail?.type === 'query_bill'">
        <view class="card-query-bill">
          <view class="query-summary" v-if="message.execResult.detail.totalExpense != null">
            <view class="qs-item">
              <text class="qs-label">支出</text>
              <text class="qs-value expense">¥{{ message.execResult.detail.totalExpense?.toFixed(2) }}</text>
            </view>
            <view class="qs-divider" />
            <view class="qs-item">
              <text class="qs-label">收入</text>
              <text class="qs-value income">¥{{ message.execResult.detail.totalIncome?.toFixed(2) }}</text>
            </view>
            <view class="qs-divider" />
            <view class="qs-item">
              <text class="qs-label">净值</text>
              <text class="qs-value" :class="(message.execResult.detail.totalIncome - message.execResult.detail.totalExpense) >= 0 ? 'income' : 'expense'">¥{{ (message.execResult.detail.totalIncome - message.execResult.detail.totalExpense).toFixed(2) }}</text>
            </view>
          </view>
          <view class="query-list" v-if="message.execResult.detail.items?.length > 0">
            <view class="query-item" v-for="(item, idx) in message.execResult.detail.items.slice(0, 5)" :key="idx">
              <text class="qi-amount" :class="item.type">{{ item.type === 'expense' ? '-' : '+' }}¥{{ item.amount }}</text>
              <text class="qi-cat">{{ item.category }}</text>
              <text class="qi-note" v-if="item.note">{{ item.note }}</text>
              <text class="qi-date">{{ item.bill_date }}</text>
            </view>
          </view>
          <view v-else class="query-empty">
            <text class="query-empty-text">暂无数据</text>
          </view>
        </view>
      </template>

      <!-- ── 查询统计 ── -->
      <template v-else-if="message.execResult.detail?.type === 'query_stat'">
        <view class="card-stat">
          <view class="stat-grid">
            <view class="stat-cell">
              <text class="stat-num">{{ message.execResult.detail.billCount }}</text>
              <text class="stat-label">账单</text>
            </view>
            <view class="stat-cell">
              <text class="stat-num">{{ message.execResult.detail.diaryCount }}</text>
              <text class="stat-label">记录</text>
            </view>
            <view class="stat-cell">
              <text class="stat-num">{{ message.execResult.detail.activePlanCount }}</text>
              <text class="stat-label">进行中</text>
            </view>
            <view class="stat-cell">
              <text class="stat-num">{{ message.execResult.detail.completedPlanCount }}</text>
              <text class="stat-label">已完成</text>
            </view>
          </view>
          <view class="stat-finance-row" v-if="message.execResult.detail.totalExpense != null">
            <view class="sfr-item">
              <text class="sfr-label">支出</text>
              <text class="sfr-value expense">¥{{ message.execResult.detail.totalExpense?.toFixed(2) }}</text>
            </view>
            <view class="sfr-item">
              <text class="sfr-label">收入</text>
              <text class="sfr-value income">¥{{ message.execResult.detail.totalIncome?.toFixed(2) }}</text>
            </view>
            <view class="sfr-item">
              <text class="sfr-label">净收支</text>
              <text class="sfr-value" :class="message.execResult.detail.netIncome >= 0 ? 'income' : 'expense'">¥{{ message.execResult.detail.netIncome?.toFixed(2) }}</text>
            </view>
          </view>
          <!-- 分类柱状图 -->
          <view class="stat-bars" v-if="message.execResult.detail.categoryBreakdown">
            <view class="bar-row" v-for="(cat, idx) in topCategories(message.execResult.detail.categoryBreakdown)" :key="idx">
              <text class="bar-label">{{ cat.name }}</text>
              <view class="bar-track">
                <view class="bar-fill" :style="{ width: cat.percent + '%', opacity: cat.opacity }" />
              </view>
              <text class="bar-amount">¥{{ cat.amount }}</text>
            </view>
          </view>
        </view>
      </template>

      <!-- ── 查询记录 ── -->
      <template v-else-if="message.execResult.detail?.type === 'query_diary'">
        <view class="card-query-diary">
          <text class="query-count" v-if="message.execResult.detail.count != null">共 {{ message.execResult.detail.count }} 篇</text>
          <view class="query-list" v-if="message.execResult.detail.items?.length > 0">
          <view class="query-item diary-q-item" v-for="(item, idx) in message.execResult.detail.items.slice(0, 5)" :key="idx">
            <view class="qi-diary-body">
              <text class="qi-title">{{ item.title }}</text>
              <text class="qi-preview" v-if="item.content">{{ item.content.substring(0, 40) }}...</text>
              <text class="qi-date">{{ formatTs(item.created_at) }}</text>
            </view>
          </view>
          </view>
          <view v-else class="query-empty">
            <text class="query-empty-text">暂无记录</text>
          </view>
        </view>
      </template>

      <!-- ── 查询计划 ── -->
      <template v-else-if="message.execResult.detail?.type === 'query_plan'">
        <view class="card-query-plan">
          <text class="query-count" v-if="message.execResult.detail.count != null">共 {{ message.execResult.detail.count }} 个计划</text>
          <view class="query-list" v-if="message.execResult.detail.items?.length > 0">
            <view class="query-item plan-q-item" v-for="(item, idx) in message.execResult.detail.items.slice(0, 5)" :key="idx">
              <view class="plan-priority-dot" :class="priorityClass(item.priority)" />
              <view class="qi-plan-body">
                <text class="qi-title">{{ item.title }}</text>
                <text class="qi-progress" v-if="item.subtasks?.length">{{ item.subtasks.filter(s => s.done).length }}/{{ item.subtasks.length }}</text>
              </view>
            </view>
          </view>
          <view v-else class="query-empty">
            <text class="query-empty-text">暂无计划</text>
          </view>
        </view>
      </template>

      <!-- ── 撤销结果 ── -->
      <template v-else-if="message.execResult.detail?.type === 'undo'">
        <text class="exec-title">{{ message.execResult.message }}</text>
      </template>
    </view>

    <!-- 标签栏 — 仅 diary / plan 类型显示 -->
    <view v-if="canEditTags" class="tag-section">
      <view class="tag-section-header">
        <text class="tag-section-label">标签</text>
        <text class="tag-section-count" v-if="currentTags().length > 0">{{ currentTags().length }}</text>
      </view>
      <view class="tag-section-chips">
        <view
          v-for="t in currentTags()" :key="t"
          class="tag-chip-item"
          :style="{ background: tagColor(t) + '1a', color: tagColor(t), borderColor: tagColor(t) + '40' }"
        >
          <text class="tci-label">#{{ t }}</text>
          <text class="tci-close" @tap.stop="removeTagFromCard(t)">✕</text>
        </view>
        <view class="tag-add-chip" @tap="openTagPanel">
          <text class="tag-add-text">+ 标签</text>
        </view>
      </view>
    </view>
  </template>

  <!-- 就地编辑表单 -->
  <view v-if="isEditing" class="edit-card">
    <view class="edit-header">
      <text class="edit-title">编辑</text>
    </view>
    <template v-if="message.execResult.detail?.type === 'bill'">
      <view class="edit-field">
        <text class="edit-label">金额</text>
        <input v-model="localForm.amount" type="digit" class="edit-input" placeholder="金额" @confirm="onEditConfirm" />
      </view>
      <view class="edit-field">
        <text class="edit-label">分类</text>
        <picker :range="categories" @change="localForm.category = categories[$event.detail.value]">
          <text class="edit-picker">{{ localForm.category }}</text>
        </picker>
      </view>
    </template>
    <template v-else-if="message.execResult.detail?.type === 'diary'">
      <view class="edit-field">
        <text class="edit-label">标题</text>
        <input v-model="localForm.title" class="edit-input" placeholder="标题" @confirm="onEditConfirm" />
      </view>
    </template>
    <template v-else-if="message.execResult.detail?.type === 'plan'">
      <view class="edit-field">
        <text class="edit-label">标题</text>
        <input v-model="localForm.title" class="edit-input" placeholder="计划标题" @confirm="onEditConfirm" />
      </view>
    </template>
    <view class="edit-actions">
      <view class="edit-btn cancel" @tap="$emit('cancel-edit')"><text>取消</text></view>
      <view class="edit-btn save" @tap="$emit('save-edit', localForm)"><text>保存</text></view>
    </view>
  </view>

  <!-- 标签选择面板 -->
  <view v-if="showTagPanel" class="tag-panel-overlay" @tap.self="closeTagPanel">
    <view class="tag-panel">
      <text class="tp-title">选择标签</text>
      <view class="tp-current" v-if="currentTags().length > 0">
        <view
          v-for="t in currentTags()" :key="t"
          class="tag-chip-item"
          :style="{ background: tagColor(t) + '1a', color: tagColor(t), borderColor: tagColor(t) + '40' }"
          @tap="toggleTag(t)"
        >
          <text class="tci-label">#{{ t }}</text>
          <text class="tci-close">✕</text>
        </view>
      </view>
      <view class="tp-list">
        <view
          v-for="t in tagPanelTags" :key="t.name"
          class="tp-item"
          :class="{ selected: isTagOn(t.name) }"
          @tap="toggleTag(t.name)"
        >
          <text class="tp-dot" :style="{ background: isTagOn(t.name) ? t.color : '#E4E4E7' }">{{ isTagOn(t.name) ? '✓' : '' }}</text>
          <text class="tp-name">{{ t.name }}</text>
          <text class="tp-count">{{ t.count }}</text>
        </view>
        <view class="tp-empty" v-if="tagPanelTags.length === 0">
          <text>暂无标签，输入下方可创建</text>
        </view>
      </view>
      <view class="tp-input-row">
        <input
          v-model="newTagInput"
          class="tp-input"
          placeholder="输入新标签名..."
          maxlength="20"
          @confirm="createNewTag"
        />
        <text class="tp-add" @tap="createNewTag">创建</text>
      </view>
      <view class="tp-done" @tap="closeTagPanel">完成</view>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import './ExecResultCard.scss';
</style>
