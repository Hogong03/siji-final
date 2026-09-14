<script setup>
/**
 * 子计划列表组件（3.4.3：今日 / 任意时间 两组）
 * 新模型：计划直接包含子计划；点击子计划查看其完整情况
 * 任意时间组（someday_at）：今天不做，温和顺延，展示弱化，可随时安排回今天
 */
import { computed, ref } from 'vue'
import { recurTypeOf, recurCountOf, weeklyDoneOf, isCheckedToday, quotaSatisfied, weekDayCells } from '@/utils/plan-recur.js'
import PlanWeekStrip from '@/components/plan/PlanWeekStrip.vue'

const props = defineProps({
  childPlans: { type: Array, default: () => [] },
  priorityColors: { type: Array, default: () => ['#999', '#E8A838', '#D35D5D'] },
  statusMap: { type: Array, default: () => ['待开始', '进行中', '已完成'] },
  progress: { type: Object, default: () => ({ total: 0, done: 0, pct: 0 }) },
  recurSummary: { type: Object, default: () => ({ total: 0, doneToday: 0 }) },
  aiLoading: { type: Boolean, default: false },
  canAdd: { type: Boolean, default: true }
})

const emit = defineEmits(['go-child-plan', 'add-child-plan', 'ai-breakdown', 'postpone-child', 'activate-child', 'checkin-child', 'update-child-recur'])

// 3.5.2：内联循环设置（把一条子计划改成每天/每周循环，或取消循环）
const recurOptions = [
  { label: '不循环', value: '' },
  { label: '每天', value: 'daily' },
  { label: '每周', value: 'weekly' }
]
const recurCountOptions = [1, 2, 3, 4, 5, 6, 7]
const editingRecur = ref('')
const draftType = ref('')
const draftCount = ref(1)

function openRecurEditor(child) {
  editingRecur.value = child.client_id
  draftType.value = recurTypeOf(child)
  draftCount.value = recurCountOf(child)
}

function closeRecurEditor() {
  editingRecur.value = ''
}

function applyRecur(child) {
  emit('update-child-recur', {
    clientId: child.client_id,
    recur_type: draftType.value,
    recur_count: draftType.value === 'weekly' ? draftCount.value : 1
  })
  closeRecurEditor()
}

const todayList = computed(() => (props.childPlans || []).filter(c => !c.someday_at))
const somedayList = computed(() => (props.childPlans || []).filter(c => c.someday_at))

function goChildPlan(clientId) {
  emit('go-child-plan', clientId)
}

function goAddChildPlan() {
  emit('add-child-plan')
}

function goAiBreakdown() {
  emit('ai-breakdown')
}

function postponeChild(child) {
  emit('postpone-child', child.client_id)
}

function activateChild(child) {
  emit('activate-child', child.client_id)
}

function childExtra(child) {
  // 3.5.0：循环任务展示循环语义与本周进度
  const rt = recurTypeOf(child)
  if (rt === 'daily') return '每天循环 · 打卡记当天，到阶段截止自动结束'
  if (rt === 'weekly') {
    return '每周 ' + recurCountOf(child) + ' 次 · 本周已做 ' + weeklyDoneOf(child) + ' 次'
  }
  // 孙计划数量（loadPlan 时注入 _subCount）
  const sub = child._subCount || 0
  if (sub > 0) return sub + ' 个子计划'
  // 历史数据兜底：子任务计数
  if (Array.isArray(child.subtasks) && child.subtasks.length > 0) {
    return child.subtasks.filter(s => s.done).length + '/' + child.subtasks.length + ' 子任务'
  }
  return ''
}

function childStatusLabel(child) {
  const rt = recurTypeOf(child)
  if (rt && child.status !== 2) return '循环'
  return props.statusMap[child.status] || '未知'
}

// 3.5.1：循环子计划的今日状态与打卡入口（不必进入子计划详情）
function childCheckedToday(child) {
  return isCheckedToday(child)
}

function childQuotaDone(child) {
  return quotaSatisfied(child)
}

function childCheckinText(child) {
  if (recurTypeOf(child) === 'weekly') {
    return childQuotaDone(child) ? '本周已达标' : '本周 ' + weeklyDoneOf(child) + '/' + recurCountOf(child)
  }
  return childCheckedToday(child) ? '已打卡' : '打卡'
}

function checkinChild(child) {
  emit('checkin-child', child.client_id)
}

/** 3.5.3：周任务在子计划卡内直接展示本周七天（不用进入子计划详情） */
function childWeekCells(child) {
  return weekDayCells(child)
}
</script>

<template>
  <view class="section">
    <view class="subplan-header">
      <view class="subplan-title-row">
        <text class="section-label">子计划</text>
        <text v-if="progress.total > 0" class="subplan-progress">{{ progress.done }}/{{ progress.total }}</text>
        <text v-if="recurSummary.total > 0" class="subplan-progress subplan-recur">循环 {{ recurSummary.total }} 项 · 今日 {{ recurSummary.doneToday }}/{{ recurSummary.total }}</text>
      </view>
      <view class="subplan-actions">
        <view class="subplan-btn ai-btn" :class="{ loading: aiLoading }" @tap="goAiBreakdown">
          <text>{{ aiLoading ? '拆解中...' : 'AI 拆解' }}</text>
        </view>
        <view v-if="canAdd" class="subplan-btn" @tap="goAddChildPlan">
          <text>+ 添加子计划</text>
        </view>
      </view>
    </view>

    <!-- 进度条 -->
    <view v-if="progress.total > 0" class="subplan-bar-row">
      <view class="subplan-bar">
        <view class="subplan-bar-fill" :style="{ width: progress.pct + '%' }" />
      </view>
      <text class="subplan-bar-text">{{ progress.pct }}%</text>
    </view>

    <view v-if="todayList.length === 0 && somedayList.length === 0" class="empty-subplan">
      <text class="empty-subplan-text">暂无子计划。添加子计划后，点击即可查看该子计划的完整情况。</text>
    </view>

    <!-- 今日组：待做与已完成 -->
    <view v-if="todayList.length" class="child-plan-list">
      <view
        v-for="child in todayList" :key="child.client_id"
        class="child-plan-card"
        @tap="goChildPlan(child.client_id)"
      >
        <view class="cp-top">
          <view class="cp-dot" :style="{ background: priorityColors[child.priority] || '#999' }" />
          <text class="cp-title">{{ child.title }}</text>
          <text v-if="!(recurTypeOf(child) && child.status !== 2)" class="cp-status" :class="'cp-status-' + child.status">{{ childStatusLabel(child) }}</text>
          <view
            v-if="recurTypeOf(child) && child.status !== 2"
            class="cp-act cp-act-check"
            :class="{ done: childCheckedToday(child) || childQuotaDone(child) }"
            @tap.stop="checkinChild(child)"
          >
            <text>{{ childCheckinText(child) }}</text>
          </view>
          <view v-if="child.status !== 2" class="cp-act" @tap.stop="postponeChild(child)">
            <text>今天不做</text>
          </view>
        </view>
        <text v-if="child.description" class="cp-desc">{{ child.description }}</text>
        <text v-else-if="!child._subCount" class="cp-desc cp-desc-empty">还没有细节，点开补充</text>
        <view v-if="child.est_minutes || child.start_time" class="cp-meta">
          <text class="cp-meta-text">{{ child.start_time ? child.start_time + ' · ' : '' }}约 {{ child.est_minutes }} 分钟</text>
        </view>
        <view v-if="child.due_date" class="cp-due">
          <text class="cp-due-text">截止: {{ child.due_date }}</text>
        </view>
        <view class="cp-foot">
          <text v-if="childExtra(child)" class="cp-sub-text">{{ childExtra(child) }}</text>
          <text class="cp-recur-edit" @tap.stop="openRecurEditor(child)">循环设置</text>
        </view>
        <PlanWeekStrip
          v-if="recurTypeOf(child) === 'weekly' && child.status !== 2"
          compact
          class="cp-week"
          :cells="childWeekCells(child)"
          :target="recurCountOf(child)"
          :done="weeklyDoneOf(child)"
        />
        <view v-if="editingRecur === child.client_id" class="cp-recur-panel" @tap.stop>
          <view class="cr-row">
            <view
              v-for="opt in recurOptions" :key="opt.value"
              class="cr-item" :class="{ active: draftType === opt.value }"
              @tap.stop="draftType = opt.value"
            >
              <text>{{ opt.label }}</text>
            </view>
          </view>
          <view v-if="draftType === 'weekly'" class="cr-row cr-row-count">
            <text class="cr-hint">每周</text>
            <view
              v-for="n in recurCountOptions" :key="n"
              class="cr-item cr-count" :class="{ active: Number(draftCount) === n }"
              @tap.stop="draftCount = n"
            >
              <text>{{ n }}</text>
            </view>
            <text class="cr-hint">次</text>
          </view>
          <view class="cr-actions">
            <view class="cr-btn" @tap.stop="closeRecurEditor"><text>取消</text></view>
            <view class="cr-btn primary" @tap.stop="applyRecur(child)"><text>保存</text></view>
          </view>
        </view>
      </view>
    </view>

    <!-- 任意时间组：今天不做，想做了再安排回来 -->
    <view v-if="somedayList.length" class="someday-block">
      <view class="sd-head">
        <text class="sd-title">任意时间 · {{ somedayList.length }}</text>
        <text class="sd-sub">今天不做，想做了再安排回来</text>
      </view>
      <view class="child-plan-list">
        <view
          v-for="child in somedayList" :key="child.client_id"
          class="child-plan-card som-card"
          @tap="goChildPlan(child.client_id)"
        >
          <view class="cp-top">
            <view class="cp-dot cp-dot-som" />
            <text class="cp-title som-title">{{ child.title }}</text>
            <text class="cp-status" :class="'cp-status-' + child.status">{{ childStatusLabel(child) }}</text>
            <view v-if="child.status !== 2" class="cp-act cp-act-on" @tap.stop="activateChild(child)">
              <text>安排到今天</text>
            </view>
          </view>
          <text v-if="child.description" class="cp-desc">{{ child.description }}</text>
          <view v-if="child.est_minutes || child.start_time" class="cp-meta">
            <text class="cp-meta-text">{{ child.start_time ? child.start_time + ' · ' : '' }}约 {{ child.est_minutes }} 分钟</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.subplan-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4rpx;
}

.subplan-title-row {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
}

.subplan-progress {
  font-size: 22rpx;
  color: $text-secondary;
  font-weight: 600;
}

.subplan-recur {
  color: $text-hint;
  font-weight: 500;
  font-size: 20rpx;
}

.subplan-actions {
  display: flex;
  gap: 8rpx;
  align-items: center;
}

.subplan-btn {
  padding: 6rpx 20rpx;
  border-radius: 20rpx;
  font-size: $font-xs;
  color: $accent;

  &.ai-btn {
    background: rgba(0, 0, 0, 0.04);
  }

  &:active { transform: scale(0.95); }
}

.subplan-bar-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin: 4rpx 0 12rpx;
}

.subplan-bar {
  flex: 1;
  height: 8rpx;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 4rpx;
  overflow: hidden;
}

.subplan-bar-fill {
  height: 100%;
  background: $accent;
  border-radius: 4rpx;
  transition: width 0.3s;
}

.subplan-bar-text {
  font-size: 20rpx;
  color: $text-hint;
  min-width: 56rpx;
  text-align: right;
}

.empty-subplan {
  padding: $spacing-md 0;
  text-align: center;
}

.empty-subplan-text {
  font-size: $font-xs;
  color: $text-hint;
  line-height: 1.6;
}

.child-plan-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.child-plan-card {
  padding: $spacing-sm $spacing-md;
  background: rgba(0, 0, 0, 0.02);
  border-radius: $radius-sm;
  border-left: 4rpx solid $accent;
  transition: all $transition-fast;

  &:active { transform: scale(0.98); }
}

.som-card {
  border-left-color: #D4D4D8;
  background: rgba(0, 0, 0, 0.015);
}

.cp-top {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.cp-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  flex-shrink: 0;
}

.cp-dot-som {
  background: #D4D4D8;
}

.cp-title {
  flex: 1;
  font-size: $font-sm;
  font-weight: 600;
  color: $text-primary;
}

.som-title {
  color: $text-hint;
  font-weight: 500;
}

.cp-act {
  flex-shrink: 0;
  padding: 2rpx 14rpx;
  border-radius: 16rpx;
  font-size: 20rpx;
  font-weight: 600;
  background: rgba(0, 0, 0, 0.06);
  color: $text-secondary;

  &:active { background: rgba(0, 0, 0, 0.12); }
}

.cp-act-on {
  background: $accent;
  color: #FFFFFF;
}

.cp-act-check {
  background: #FFFFFF;
  border: 1rpx solid $border-color;
  color: $text-primary;

  &.done {
    background: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.3);
    color: #059669;
  }
}

.cp-status {
  font-size: 20rpx;
  padding: 2rpx 12rpx;
  border-radius: 16rpx;
  font-weight: 600;
  flex-shrink: 0;

  &.cp-status-0 { background: rgba(0,0,0,0.05); color: $text-secondary; }
  &.cp-status-1 { background: rgba(0,0,0,0.06); color: $text-primary; }
  &.cp-status-2 { background: rgba(16, 185, 129, 0.1); color: #059669; }
}

.cp-due {
  margin-top: 4rpx;
  padding-left: 20rpx;
}

.cp-foot {
  margin-top: 6rpx;
  padding-left: 20rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.cp-recur-edit {
  flex-shrink: 0;
  font-size: 20rpx;
  font-weight: 600;
  color: $accent;
  padding: 2rpx 12rpx;
  border-radius: 16rpx;
  background: rgba(0, 0, 0, 0.04);

  &:active { background: rgba(0, 0, 0, 0.1); }
}

.cp-week {
  margin-top: 10rpx;
  padding-left: 20rpx;
  padding-right: 12rpx;
}

.cp-recur-panel {
  margin-top: 8rpx;
  padding: 12rpx;
  background: #FFFFFF;
  border: 1rpx solid $border-color;
  border-radius: $radius-sm;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.cr-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
  flex-wrap: wrap;
}

.cr-hint {
  font-size: 20rpx;
  color: $text-hint;
}

.cr-item {
  padding: 4rpx 16rpx;
  border-radius: 16rpx;
  font-size: 20rpx;
  font-weight: 600;
  background: rgba(0, 0, 0, 0.05);
  color: $text-secondary;

  &.active {
    background: $accent;
    color: #FFFFFF;
  }
}

.cr-count {
  min-width: 44rpx;
  text-align: center;
}

.cr-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10rpx;
}

.cr-btn {
  padding: 6rpx 22rpx;
  border-radius: 16rpx;
  font-size: 20rpx;
  font-weight: 600;
  background: rgba(0, 0, 0, 0.06);
  color: $text-secondary;

  &.primary {
    background: $accent;
    color: #FFFFFF;
  }
}

.cp-desc {
  margin-top: 6rpx;
  padding-left: 20rpx;
  font-size: 22rpx;
  color: $text-secondary;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.cp-due-text, .cp-sub-text {
  font-size: 20rpx;
  color: $text-hint;
}
.cp-meta {
  margin-top: 4rpx;
  padding-left: 20rpx;
  display: flex;
  align-items: center;
}
.cp-meta-text {
  font-size: 20rpx;
  color: $text-hint;
}
.cp-desc-empty {
  color: $text-hint;
}

.someday-block {
  margin-top: $spacing-md;
}

.sd-head {
  display: flex;
  align-items: baseline;
  gap: 10rpx;
  margin-bottom: $spacing-sm;
}

.sd-title {
  font-size: 22rpx;
  font-weight: 700;
  color: $text-hint;
}

.sd-sub {
  font-size: 20rpx;
  color: $text-hint;
}

@media (prefers-color-scheme: dark) {
  .child-plan-card { background: rgba(255, 255, 255, 0.04); }
  .child-plan-card.som-card { background: rgba(255, 255, 255, 0.02); }
  .cp-title { color: #FAFAFA; }
  .cp-recur-edit { color: #FAFAFA; background: rgba(255, 255, 255, 0.08); }
  .cp-recur-panel { background: #27272A; border-color: #3F3F46; }
  .cr-item { background: rgba(255, 255, 255, 0.08); color: #A1A1AA; &.active { background: #FAFAFA; color: #18181B; } }
  .cr-btn { background: rgba(255, 255, 255, 0.1); color: #A1A1AA; &.primary { background: #FAFAFA; color: #18181B; } }
  .cp-act-check { background: #27272A; border-color: #3F3F46; color: #E4E4E7; }
  .cp-act { background: rgba(255, 255, 255, 0.08); color: #A1A1AA; }
}
</style>
