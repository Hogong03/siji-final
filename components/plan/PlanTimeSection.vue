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

function quickSetEstNow() {
  const d = new Date()
  emit('update:estimatedDate', fmtDate(d))
  emit('update:estimatedTime', `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`)
}

function quickSetDue(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  emit('update:dueDate', fmtDate(d))
}

function quickSetDueEndOfDay() {
  const d = new Date()
  emit('update:dueDate', fmtDate(d))
  emit('update:dueTime', '23:59:59')
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
  <!-- 预计时间 -->
  <view class="section">
    <text class="section-label">预计开始时间</text>
    <view class="date-row">
      <picker mode="date" :value="estimatedDate" @change="onEstDateChange">
        <input
          :value="estimatedDate"
          class="input-field"
          type="text"
          placeholder="选择日期（可选）"
          disabled
        />
      </picker>
      <picker mode="time" :value="estimatedTime" :end="'23:59:59'" @change="onEstTimeChange">
        <input
          :value="estimatedTime"
          class="input-field time-picker"
          type="text"
          placeholder="选择时间（可选）"
          disabled
        />
      </picker>
    </view>
    <view class="quick-dates">
      <text class="qd-btn" @tap="quickSetEst(0)">今天</text>
      <text class="qd-btn" @tap="quickSetEst(1)">明天</text>
      <text class="qd-btn" @tap="quickSetEst(3)">3天后</text>
      <text class="qd-btn" @tap="quickSetEstNow">现在</text>
    </view>
  </view>

  <!-- 截止日期 -->
  <view class="section">
    <text class="section-label">截止时间</text>
    <view class="date-row">
      <picker mode="date" :value="dueDate" @change="onDueDateChange">
        <input
          :value="dueDate"
          class="input-field"
          type="text"
          placeholder="选择截止日期（可选）"
          disabled
        />
      </picker>
      <picker mode="time" :value="dueTime" :end="'23:59:59'" @change="onDueTimeChange">
        <input
          :value="dueTime"
          class="input-field time-picker"
          type="text"
          placeholder="选择时间（可选）"
          disabled
        />
      </picker>
    </view>
    <view class="quick-dates">
      <text class="qd-btn" @tap="quickSetDue(3)">3天后</text>
      <text class="qd-btn" @tap="quickSetDue(7)">一周后</text>
      <text class="qd-btn" @tap="quickSetDue(30)">一月后</text>
      <text class="qd-btn" @tap="quickSetDueEndOfDay">今天结束</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.date-row {
  display: flex;
  gap: $spacing-sm;
}

.quick-dates {
  display: flex;
  gap: $spacing-sm;
  margin-top: $spacing-sm;

  .qd-btn {
    font-size: $font-xs;
    color: $accent;
    padding: 6rpx 20rpx;
    background: rgba(0, 0, 0, 0.04);
    border-radius: 20rpx;
  }
}

.input-field {
  font-size: $font-md;
  padding: $spacing-sm 0;
  border-bottom: 1rpx solid rgba(0,0,0,0.06);
  width: 100%;
}

.time-picker {
  width: 200rpx !important;
  text-align: center;
  font-size: $font-sm !important;
}
</style>
