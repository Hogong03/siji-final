<script setup>
/**
 * AmountInput - 金额输入组件
 * 包含：类型切换、金额显示、数字键盘
 */
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  type: { type: String, default: 'expense' } // expense | income
})

const emit = defineEmits(['update:modelValue', 'update:type'])

const displayAmount = computed(() => {
  return props.modelValue || '0'
})

const numPad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del']

function switchType(type) {
  if (props.type === type) return
  emit('update:type', type)
}

function tapNumber(num) {
  const val = props.modelValue
  if (num === '.' && val.includes('.')) return
  if (val.includes('.') && (val.split('.')[1] || '').length >= 2) return
  if (val === '0' && num !== '.') {
    emit('update:modelValue', num)
    return
  }
  emit('update:modelValue', val + num)
}

function tapDelete() {
  emit('update:modelValue', props.modelValue.slice(0, -1))
}
</script>

<template>
  <!-- 类型切换 -->
  <view class="type-switch">
    <view
      class="ts-btn" :class="{ active: type === 'expense', expense: type === 'expense' }"
      @tap="switchType('expense')"
    >支出</view>
    <view
      class="ts-btn" :class="{ active: type === 'income', income: type === 'income' }"
      @tap="switchType('income')"
    >收入</view>
  </view>

  <!-- 金额显示 -->
  <view class="amount-display" :class="type">
    <text class="currency">¥</text>
    <text class="amount-num">{{ displayAmount }}</text>
  </view>

  <!-- 数字键盘 -->
  <view class="num-pad">
    <view
      v-for="key in numPad" :key="key"
      class="np-key" :class="{ 'np-del': key === 'del' }"
      @tap="key === 'del' ? tapDelete() : tapNumber(key)"
    >
      <text v-if="key !== 'del'" class="np-text">{{ key }}</text>
      <text v-else class="np-icon">⌫</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
/* 类型切换 */
.type-switch {
  display: flex;
  margin: $spacing-md;
  background: $bg-card;
  border-radius: $radius-round;
  padding: 4rpx;

  .ts-btn {
    flex: 1;
    text-align: center;
    padding: 16rpx 0;
    border-radius: $radius-round;
    font-size: $font-md;
    font-weight: 600;
    color: $text-secondary;
    transition: all $transition-fast;

    &.active {
      color: var(--text-on-ai);

      &.expense { background: var(--color-ai); box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.12); }
      &.income { background: var(--text-strong); box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.08); }
    }
  }
}

/* 金额显示 */
.amount-display {
  text-align: center;
  padding: $spacing-md 0;

  .currency {
    font-size: $font-xl;
    font-weight: 600;
    vertical-align: top;
  }

  .amount-num {
    font-size: 80rpx;
    font-weight: 800;
    letter-spacing: 2rpx;
  }

  &.expense .currency, &.expense .amount-num { color: var(--color-bill); }
  &.income .currency, &.income .amount-num { color: var(--color-plan); }
}

/* 数字键盘 */
.num-pad {
  display: flex;
  flex-wrap: wrap;
  padding: $spacing-xs $spacing-md;
  margin-top: auto;
}

.np-key {
  width: calc(33.33% - 6rpx);
  margin: 3rpx;
  padding: 24rpx 0;
  background: $bg-card;
  border-radius: $radius-md;
  text-align: center;
  transition: background $transition-fast;

  &:active { background: $bg-input; }

  &.np-del {
    background: rgba(0, 0, 0, 0.04);
  }

  .np-text {
    font-size: $font-xl;
    font-weight: 600;
    color: $text-primary;
  }

  .np-icon {
    font-size: $font-xl;
    color: $text-secondary;
  }
}
</style>
