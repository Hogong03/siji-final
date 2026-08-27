<script setup>
/**
 * 时间设置组件（预计开始时间 + 截止时间）
 * 通过 v-model 双向绑定日期/时间字段
 */
const props = defineProps({
  estimatedDate: { type: String, default: '' },
  estimatedTime: { type: String, default: '' },
  dueDate: { type: String, default: '' },
  dueTime: { type: String, default: '' }
})

const emit = defineEmits([
  'update:estimatedDate',
  'update:estimatedTime',
  'update:dueDate',
  'update:dueTime'
])

/** 格式化日期字符串 */
function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function quickSetEst(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  emit('update:estimatedDate', fmtDate(d))
}

function quickSetDue(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  emit('update:dueDate', fmtDate(d))
}

function quickSetDueEndOfWeek() {
  const d = new Date()
  const dayOfWeek = d.getDay() // 0=Sun, 6=Sat
  const daysToSat = dayOfWeek === 6 ? 0 : (6 - dayOfWeek)
  d.setDate(d.getDate() + daysToSat)
  emit('update:dueDate', fmtDate(d))
}

function quickSetDueNextMonday() {
  const d = new Date()
  const dayOfWeek = d.getDay()
  const daysToMon = dayOfWeek === 1 ? 7 : ((8 - dayOfWeek) % 7)
  d.setDate(d.getDate() + daysToMon)
  emit('update:dueDate', fmtDate(d))
}

function onDueDateChange(e) {
  emit('update:dueDate', e.detail.value)
}

function onDueTimeChange(e) {
  emit('update:dueTime', e.detail.value ? e.detail.value + ':00' : '')
}

function onEstDateChange(e) {
  emit('update:estimatedDate', e.detail.value)
}

function onEstTimeChange(e) {
  emit('update:estimatedTime', e.detail.value ? e.detail.value + ':00' : '')
}
</script>

<template>
  <view class="section">
    <text class="section-label">时间安排</text>
    <view class="time-row">
      <text class="time-label">开始</text>
      <picker mode="date" :value="estimatedDate" @change="onEstDateChange">
        <input :value="estimatedDate" class="input-field" placeholder="日期" disabled />
      </picker>
      <picker mode="time" :value="estimatedTime" :end="'23:59:59'" @change="onEstTimeChange">
        <input :value="estimatedTime" class="input-field time-picker" placeholder="时间" disabled />
      </picker>
    </view>
    <view class="quick-dates">
      <text class="qd-btn" @tap="quickSetEst(0)">今天</text>
      <text class="qd-btn" @tap="quickSetEst(1)">明天</text>
      <text class="qd-btn" @tap="quickSetEst(3)">3天后</text>
    </view>
    <view class="time-row due-row">
      <text class="time-label">截止</text>
      <picker mode="date" :value="dueDate" @change="onDueDateChange">
        <input :value="dueDate" class="input-field" placeholder="日期" disabled />
      </picker>
      <picker mode="time" :value="dueTime" :end="'23:59:59'" @change="onDueTimeChange">
        <input :value="dueTime" class="input-field time-picker" placeholder="时间" disabled />
      </picker>
    </view>
    <view class="quick-dates">
      <text class="qd-btn" @tap="quickSetDue(0)">今天</text>
      <text class="qd-btn" @tap="quickSetDueEndOfWeek">本周末</text>
      <text class="qd-btn" @tap="quickSetDueNextMonday">下周一</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.time-row {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
}

.due-row {
  margin-top: $spacing-sm;
}

.time-label {
  font-size: $font-xs;
  color: #A1A1AA;
  width: 56rpx;
  flex-shrink: 0;
}

.quick-dates {
  display: flex;
  gap: $spacing-xs;
  margin-top: $spacing-xs;

  .qd-btn {
    font-size: $font-xs;
    color: $accent;
    padding: 4rpx 16rpx;
    background: rgba(0, 0, 0, 0.04);
    border-radius: 20rpx;
  }
}

.input-field {
  font-size: $font-md;
  padding: 6rpx 0;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.06);
  width: 100%;
  min-width: 0;
}

.time-picker {
  width: 160rpx !important;
  text-align: center;
  font-size: $font-sm !important;
  flex-shrink: 0;
}
</style>
