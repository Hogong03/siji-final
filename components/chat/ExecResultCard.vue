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
 * props: message
 * emits: confirm-action, update-tags
 */
import { computed } from 'vue'
import SijiIcon from '@/components/common/SijiIcon.vue'
import { useExecTags } from '@/composables/useExecTags.js'
import {
  priorityClass, planProgressPercent, planDoneCount, planListCount,
  topCategories, formatTs, execIcon
} from '@/composables/useExecCardHelpers.js'
import { canOpenType } from '@/composables/useChatNavigation.js'
import { execCardText } from '@/utils/ai/exec-payload.js'

const props = defineProps({
  message: { type: Object, required: true }
})

const emit = defineEmits([
  'confirm-action', 'update-tags'
])

// 可编辑类型（标题行内嵌跳转按钮）— 其余类型保留头部图标 + 跳转按钮
const isInlineType = computed(() => {
  const t = props.message?.execResult?.detail?.type || ''
  return t === 'bill' || t === 'diary' || t === 'plan' || t === 'glimmer'
})

// 联网搜索 / 读网页：没有可跳转的页面，卡片只给一行摘要（3.6.2）
// 命中时既不显头部图标，也不显「查看 →」—— 那个按钮以前点了没反应
const toolCardText = computed(() => execCardText(props.message?.execResult?.detail))
const showExecHeader = computed(() => !isInlineType.value && !toolCardText.value)

/** multi 行里的「查看 →」指向 create_<type>，没有对应路由就不显示 */
function canOpenRow(r) {
  const t = r && r.detail && r.detail.type
  return canOpenType(t ? 'create_' + t : '')
}

// 记录预览：压平换行 + 截断，避免长文/多换行在 App 端撑爆卡片（反馈 2026-09-01）
const diaryPreviewText = computed(() => {
  const c = props.message?.execResult?.detail?.content || ''
  const flat = c.replace(/\s+/g, ' ').trim()
  return flat.length > 50 ? flat.substring(0, 50) + '...' : flat
})

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

// 3.3 A：计划卡片「下一步」入口（第一条未完成且带 client_id 的子计划）
const nextChild = computed(() => {
  const kids = props.message?.execResult?.detail?.children || []
  return kids.find(st => st.status !== 2 && st.client_id) || null
})
function openChild(st) {
  if (!st || !st.client_id) return
  emit('confirm-action', { type: 'open_plan_child', payload: { id: st.client_id } })
}

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
        <text v-if="canOpenRow(r)" class="exec-multi-arrow" @tap="$emit('confirm-action', { type: r.detail?.type ? ('create_' + r.detail.type) : '', payload: r.detail })">查看 →</text>
      </view>
    </view>
  </template>

  <!-- 单意图结果 -->
  <template v-else>
    <!-- 非 bill/diary/plan：保留类型图标 + 跳转按钮 -->
    <view v-if="showExecHeader" class="exec-header">
      <view class="exec-header-left">
        <view class="exec-type-icon" :class="execTypeClass">
          <text class="eti-text">{{ execTypeIcon }}</text>
        </view>
      </view>
      <text class="exec-jump-btn" @tap="$emit('confirm-action', message.actionCard)">查看 →</text>
    </view>

    <view class="exec-body">
      <!-- ── 联网搜索 / 读网页：一行摘要（没有跳转可点） ── -->
      <text v-if="toolCardText" class="exec-title">{{ toolCardText }}</text>

      <!-- ── 账单卡片 ── -->
      <template v-else-if="message.execResult.detail?.type === 'bill'">
        <view class="card-bill">
          <view class="bill-main-row">
            <text class="bill-amount" :class="{ income: message.execResult.detail.billType === 'income' }">
              {{ message.execResult.detail.billType === 'income' ? '+' : '-' }}{{ message.execResult.detail.amount }}
            </text>
            <view class="bill-cat-tag" :class="message.execResult.detail.billType === 'income' ? 'income' : 'expense'">
              <text class="bct-text">{{ message.execResult.detail.category }}</text>
            </view>
            <text class="exec-jump-btn" @tap="$emit('confirm-action', message.actionCard)">查看 →</text>
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
          <view class="diary-title-row">
            <text class="diary-title">{{ message.execResult.detail.title }}</text>
            <text class="exec-jump-btn" @tap="$emit('confirm-action', message.actionCard)">查看 →</text>
          </view>
          <text class="diary-preview" v-if="diaryPreviewText">{{ diaryPreviewText }}</text>
          <text class="diary-date" v-if="message.execResult.detail.created_at">{{ formatTs(message.execResult.detail.created_at) }}</text>
        </view>
      </template>

      <!-- ── 计划卡片 ── -->
      <template v-else-if="message.execResult.detail?.type === 'plan'">
        <view class="card-plan">
          <view class="plan-title-row">
            <view class="plan-priority-dot" :class="priorityClass(message.execResult.detail.priority)" />
            <text class="plan-title">{{ message.execResult.detail.title }}</text>
            <text class="exec-jump-btn" @tap="$emit('confirm-action', message.actionCard)">查看 →</text>
          </view>
          <text class="plan-desc" v-if="message.execResult.detail.description">{{ message.execResult.detail.description }}</text>
          <!-- 进度条（子计划优先，历史子任务兜底） -->
          <view class="plan-progress" v-if="planListCount(message.execResult.detail) > 0">
            <view class="plan-progress-bar">
              <view class="plan-progress-fill" :style="{ width: planProgressPercent(message.execResult.detail) + '%' }" />
            </view>
            <text class="plan-progress-text">{{ planDoneCount(message.execResult.detail) }}/{{ planListCount(message.execResult.detail) }}</text>
          </view>
          <text class="plan-subtask-count" v-else-if="message.execResult.detail.childCount > 0">
            {{ message.execResult.detail.childCount }} 个子计划
          </text>
          <text class="plan-subtask-count" v-else-if="message.execResult.detail.subtaskCount > 0">
            {{ message.execResult.detail.subtaskCount }} 个子任务
          </text>
          <view class="plan-date-row" v-if="message.execResult.detail.estimated_time || message.execResult.detail.due_date || message.execResult.detail.deadline">
            <text v-if="message.execResult.detail.estimated_time" class="plan-date-chip est">预计 {{ message.execResult.detail.estimated_time }}</text>
            <text v-if="message.execResult.detail.due_date || message.execResult.detail.deadline" class="plan-date-chip due">截止 {{ message.execResult.detail.due_date || message.execResult.detail.deadline }}</text>
          </view>
          <view class="plan-subtasks" v-if="message.execResult.detail.children?.length > 0 && message.execResult.detail.children.length <= 5">
            <view class="subtask-row" v-for="(st, idx) in message.execResult.detail.children" :key="idx" @tap="openChild(st)">
              <text class="subtask-dot" :class="{ done: st.status === 2 }">{{ st.status === 2 ? '✓' : '○' }}</text>
              <text class="subtask-title" :class="{ done: st.status === 2 }">{{ st.title }}</text>
            </view>
          </view>
            <!-- 3.3 A：最小行动「下一步」入口 → 直达该子计划详情页标记完成 -->
            <view class="plan-next-row" v-if="nextChild" @tap="openChild(nextChild)">
              <text class="pn-label">下一步</text>
              <text class="pn-title">{{ nextChild.title }}</text>
              <text class="pn-arrow">去做 →</text>
            </view>
          <view class="plan-subtasks" v-else-if="message.execResult.detail.subtasks?.length > 0 && message.execResult.detail.subtasks.length <= 5">
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
              <text class="qi-preview" v-if="item.content">{{ item.content.replace(/\s+/g, ' ').substring(0, 40) }}...</text>
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

      <!-- ── 微光本（3.4 M2）── -->
      <template v-else-if="message.execResult.detail?.type === 'glimmer'">
        <view class="card-glimmer">
          <text class="gl-date">{{ message.execResult.detail.date }} · 微光</text>
          <text class="gl-content">{{ message.execResult.detail.content }}</text>
        </view>
      </template>
      <template v-else-if="message.execResult.detail?.type === 'query_glimmers'">
        <view class="card-query-glimmer">
          <text class="glq-count">微光本 · 近 {{ message.execResult.detail.days || 30 }} 天 {{ message.execResult.detail.count || 0 }} 条</text>
          <view class="glq-list" v-if="(message.execResult.detail.items || []).length > 0">
            <view class="glq-item" v-for="(g, idx) in message.execResult.detail.items.slice(0, 10)" :key="idx">
              <text class="glq-date">{{ g.date }}</text>
              <text class="glq-content">{{ g.content }}</text>
            </view>
          </view>
          <text class="glq-empty" v-else>微光本是空的，允许空着</text>
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
