<script setup>
/**
 * 月度收支概览卡片
 * 展示：支出/收入/结余/预算进度
 */
defineProps({
  income:  { type: Number, default: 0 },
  expense: { type: Number, default: 0 },
  balance: { type: Number, default: 0 },
  budgetUsed: { type: Number, default: 0 },
  budget:   { type: Number, default: 0 }
})

const emit = defineEmits(['openBudgetSet'])
</script>

<template>
  <view class="summary-card">
    <!-- 两栏：支出 / 收入 -->
    <view class="summary-row">
      <view class="summary-item">
        <text class="sum-label">支出</text>
        <text class="sum-value expense">¥{{ expense.toFixed(0) }}</text>
      </view>
      <view class="summary-item">
        <text class="sum-label">收入</text>
        <text class="sum-value income">+¥{{ income.toFixed(0) }}</text>
      </view>
    </view>

    <!-- 结余 — 独立行带分隔线 -->
    <view class="balance-row">
      <view class="balance-divider" />
      <view class="balance-text" :class="balance >= 0 ? 'positive' : 'negative'">
        <text class="balance-label">{{ balance >= 0 ? '结余' : '超支' }}</text>
        <text class="balance-num">{{ balance >= 0 ? '+' : '' }}{{ balance.toFixed(0) }}</text>
      </view>
      <view class="balance-divider" />
    </view>

    <!-- 预算进度条 -->
    <view class="budget-section" v-if="budget > 0" @tap="$emit('openBudgetSet')">
      <view class="budget-info">
        <text class="budget-label">预算 ¥{{ budget.toFixed(0) }}</text>
        <text class="budget-pct" :class="{ over: budgetUsed >= 100 }">{{ Math.round(budgetUsed) }}%</text>
      </view>
      <view class="budget-bar-wrap">
        <view
          class="budget-bar"
          :class="{ pulse: budgetUsed >= 100 }"
          :style="{
            width: Math.min(100, budgetUsed) + '%',
            background: budgetUsed >= 100 ? 'var(--color-red)' : budgetUsed >= 80 ? 'var(--color-amber)' : 'var(--color-plan)'
          }"
        />
      </view>
    </view>

    <!-- 未设置预算 -->
    <view class="budget-set-hint" v-else @tap="$emit('openBudgetSet')">
      <view class="budget-hint">
        <text class="budget-hint-text">点击设置月度预算，掌控消费</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.summary-card {
  margin: $spacing-sm $spacing-md;
  padding: $spacing-lg $spacing-md $spacing-md;
  background: var(--bg-card);
  border-radius: $radius-lg;
  box-shadow: $shadow-sm;
}

.summary-row {
  display: flex;
  align-items: baseline;
  gap: $spacing-md;
}

.summary-item {
  flex: 1;
  text-align: center;

  .sum-label {
    font-size: $font-xs;
    color: var(--text-hint);
  }

  .sum-value {
    font-size: 56rpx;
    font-weight: 800;
    display: block;
    margin-top: 4rpx;
    font-variant-numeric: tabular-nums;
    letter-spacing: -1rpx;

    &.expense { color: var(--color-danger); }
    &.income { color: var(--color-plan); }
  }
}

.balance-row {
  display: flex;
  align-items: center;
  margin-top: $spacing-sm;
  padding: $spacing-sm 0;
}

.balance-divider {
  flex: 1;
  height: 1rpx;
  background: var(--border-color);
}

.balance-text {
  padding: 0 $spacing-md;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rpx;

  .balance-label {
    font-size: $font-xs;
    color: var(--text-hint);
  }

  .balance-num {
    font-size: 36rpx;
    font-weight: 700;
    color: var(--text-primary);
  }

  &.positive .balance-num { color: var(--color-plan); }
  &.negative .balance-num { color: var(--color-danger); }
}

.budget-section {
  margin-top: $spacing-md;
  padding-top: $spacing-md;
  border-top: 1rpx solid var(--border-color);

  .budget-info {
    display: flex;
    justify-content: space-between;
    margin-bottom: 6rpx;

    .budget-label {
      font-size: $font-xs;
      color: var(--text-hint);
    }

    .budget-pct {
      font-size: $font-xs;
      font-weight: 700;
      color: var(--text-secondary);

      &.over {
        color: var(--color-red);
        animation: budgetPulse 1.5s ease-in-out infinite;
      }
    }
  }

  .budget-bar-wrap {
    height: 10rpx;
    background: var(--bg-input);
    border-radius: 5rpx;
    overflow: hidden;
  }

  .budget-bar {
    height: 100%;
    border-radius: 5rpx;
    transition: width 0.5s $transition-normal;
  }

  .budget-bar.pulse {
    animation: budgetPulse 1.5s ease-in-out infinite;
  }
}

@keyframes budgetPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.budget-set-hint {
  margin-top: $spacing-sm;
  padding-top: $spacing-sm;
  border-top: 1rpx solid var(--border-color);
  text-align: center;

  .budget-hint-text {
    font-size: $font-xs;
    color: rgba(255, 255, 255, 0.6);
  }
}
</style>
