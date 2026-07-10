<script setup>
/**
 * 提醒设置组件
 * 支持基于截止时间的提前提醒 + 自定义提醒时间
 */
defineProps({
  enabled: { type: Boolean, default: false },
  advanceMin: { type: Number, default: 30 },
  customDate: { type: String, default: '' },
  customTimeValue: { type: String, default: '' },
  dueDate: { type: String, default: '' },
  advanceOptions: {
    type: Array,
    default: () => [
      { label: '5 分钟', value: 5 },
      { label: '15 分钟', value: 15 },
      { label: '30 分钟', value: 30 },
      { label: '1 小时', value: 60 },
      { label: '3 小时', value: 180 },
      { label: '1 天', value: 1440 },
      { label: '3 天', value: 4320 }
    ]
  }
})

const emit = defineEmits([
  'update:enabled',
  'update:advanceMin',
  'update:customDate',
  'update:customTimeValue'
])

function onSwitchChange(e) {
  emit('update:enabled', e.detail.value)
}

function selectAdvance(min) {
  emit('update:advanceMin', min)
  emit('update:customDate', '')
  emit('update:customTimeValue', '')
}

function onCustomDateChange(e) {
  emit('update:customDate', e.detail.value)
}

function onCustomTimeChange(e) {
  emit('update:customTimeValue', e.detail.value)
}

function cancelCustom() {
  emit('update:customDate', '')
  emit('update:customTimeValue', '')
}
</script>

<template>
  <view class="section">
    <view class="reminder-header">
      <text class="section-label">提醒</text>
      <switch :checked="enabled" @change="onSwitchChange" color="#000000" />
    </view>
    <template v-if="enabled">
      <view class="reminder-options">
        <text class="reminder-desc">基于截止时间提前提醒</text>
        <view class="reminder-chips">
          <view
            v-for="opt in advanceOptions" :key="opt.value"
            class="reminder-chip"
            :class="{ active: advanceMin === opt.value && !customDate }"
            @tap="selectAdvance(opt.value)"
          >
            {{ opt.label }}
          </view>
        </view>
        <view class="reminder-custom">
          <text class="reminder-custom-label">或指定提醒时间</text>
          <view class="date-row">
            <picker mode="date" :value="customDate" @change="onCustomDateChange">
              <input
                :value="customDate"
                class="input-field"
                type="text"
                placeholder="选择日期"
                disabled
              />
            </picker>
            <picker mode="time" :value="customTimeValue" @change="onCustomTimeChange">
              <input
                :value="customTimeValue"
                class="input-field time-picker"
                type="text"
                placeholder="选择时间"
                disabled
              />
            </picker>
          </view>
          <view v-if="customDate" class="quick-dates">
            <text class="qd-btn" @tap="cancelCustom">取消自定义</text>
          </view>
        </view>
        <text v-if="!dueDate && !customDate" class="reminder-hint">请先设置截止时间或自定义提醒时间</text>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.reminder-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.reminder-options {
  margin-top: $spacing-sm;
}

.reminder-desc {
  font-size: $font-sm;
  color: var(--text-secondary);
  margin-bottom: $spacing-xs;
  display: block;
}

.reminder-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.reminder-chip {
  padding: 12rpx 28rpx;
  border-radius: $radius-sm;
  border: 1rpx solid var(--border-color);
  font-size: $font-sm;
  color: var(--text-secondary);
  background: var(--bg-card);
  transition: all 0.2s;
}

.reminder-chip.active {
  background: var(--color-ai);
  color: var(--text-on-ai);
  border-color: var(--color-ai);
}

.reminder-custom {
  margin-top: $spacing-md;
  padding-top: $spacing-md;
  border-top: 1rpx solid var(--border-color);
}

.reminder-custom-label {
  font-size: $font-sm;
  color: var(--text-secondary);
  display: block;
  margin-bottom: $spacing-xs;
}

.reminder-hint {
  font-size: $font-xs;
  color: var(--text-hint);
  margin-top: $spacing-xs;
  display: block;
}

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
