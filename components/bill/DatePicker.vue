<script setup>
/**
 * DatePicker - 日期选择组件
 * 包含：日期展示行、快捷日期选择面板
 */
import { ref, computed } from 'vue'
import SijiIcon from '@/components/common/SijiIcon.vue'

const props = defineProps({
  modelValue: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue'])

const showDatePicker = ref(false)

const today = computed(() => formatDateStr(new Date()))
const datePickerStart = computed(() => {
  const d = new Date()
  d.setMonth(d.getMonth() - 6)
  return formatDateStr(d)
})
const datePickerEnd = computed(() => formatDateStr(new Date()))

// 隐藏原生 picker 选中后关闭面板
function onDateChange(e) {
  emit('update:modelValue', e.detail.value)
}

// 自定义面板内 picker 选中后同步值但不关闭面板
function onPanelPickerChange(e) {
  emit('update:modelValue', e.detail.value)
}

function formatDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getYesterday() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return formatDateStr(d)
}

function getDayBefore(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return formatDateStr(d)
}

function quickSelect(dateStr) {
  emit('update:modelValue', dateStr)
  showDatePicker.value = false
}

function confirm() {
  showDatePicker.value = false
}
</script>

<template>
  <!-- 日期行 -->
  <view class="detail-row" @tap="showDatePicker = true">
    <view class="d-label"><SijiIcon name="calendar" size="xs" /><text>日期</text></view>
    <text class="d-value">{{ modelValue === today ? '今天' : modelValue }}</text>
    <text class="d-arrow">›</text>
  </view>

  <!-- 隐藏原生 picker（display:none，由外部触发时使用） -->
  <picker
    mode="date"
    :value="modelValue"
    :start="datePickerStart"
    :end="datePickerEnd"
    @change="onDateChange"
    style="display: none;"
  />

  <!-- 自定义日期面板 -->
  <view class="date-picker-mask" v-if="showDatePicker" @tap="showDatePicker = false">
    <view class="date-picker-content" @tap.stop>
      <text class="dp-title">选择日期</text>
      <view class="dp-quick-row">
        <view class="dp-quick" @tap="quickSelect(today)">今天</view>
        <view class="dp-quick" @tap="quickSelect(getYesterday())">昨天</view>
        <view class="dp-quick" @tap="quickSelect(getDayBefore(2))">前天</view>
      </view>
      <picker
        mode="date"
        :value="modelValue"
        :start="datePickerStart"
        :end="datePickerEnd"
        @change="onPanelPickerChange"
      >
        <view class="dp-pick-trigger">
          <text class="dp-pick-text">{{ modelValue }} ›</text>
        </view>
      </picker>
      <view class="dp-actions">
        <view class="dp-btn cancel" @tap="showDatePicker = false">取消</view>
        <view class="dp-btn confirm" @tap="confirm">确定</view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.detail-row {
  display: flex;
  align-items: center;
  padding: $spacing-sm $spacing-md;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.04);

  .d-label {
    font-size: $font-sm;
    color: $text-secondary;
    width: 120rpx;
    flex-shrink: 0;
  }

  .d-value {
    flex: 1;
    font-size: $font-sm;
    color: $text-primary;
    font-weight: 600;
    text-align: right;
  }

  .d-arrow {
    font-size: $font-md;
    color: $text-hint;
    margin-left: $spacing-xs;
  }
}

/* 日期选择器 */
.date-picker-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  display: flex;
  align-items: flex-end;
}

.date-picker-content {
  width: 100%;
  background: $bg-card;
  border-top-left-radius: $radius-lg;
  border-top-right-radius: $radius-lg;
  padding: $spacing-md;
  padding-bottom: calc(#{$spacing-md} + env(safe-area-inset-bottom));
}

.dp-title {
  font-size: $font-md;
  font-weight: 700;
  color: $text-primary;
  display: block;
  text-align: center;
  margin-bottom: $spacing-sm;
}

.dp-quick-row {
  display: flex;
  gap: $spacing-sm;
  margin-bottom: $spacing-md;
}

.dp-quick {
  flex: 1;
  text-align: center;
  padding: 14rpx 0;
  background: $bg-input;
  border-radius: $radius-md;
  font-size: $font-sm;
  color: $text-secondary;

  &:active { background: rgba(0, 0, 0, 0.06); }
}

.dp-pick-trigger {
  display: flex;
  justify-content: center;
  padding: $spacing-sm 0;
  margin-bottom: $spacing-sm;
}

.dp-pick-text {
  font-size: $font-md;
  font-weight: 600;
  color: var(--color-ai);
}

.dp-actions {
  display: flex;
  gap: $spacing-sm;

  .dp-btn {
    flex: 1;
    text-align: center;
    padding: 20rpx 0;
    border-radius: $radius-md;
    font-size: $font-md;
    font-weight: 600;

    &.cancel {
      background: $bg-input;
      color: $text-secondary;
    }

    &.confirm {
      background: var(--color-ai);
      color: var(--text-on-ai);
    }
  }
}
</style>
