<script setup>
/**
 * 按日期分组的账单列表
 * 组合 BillItem 渲染，将触摸事件上抛给父组件
 */
import BillItem from './BillItem.vue'

defineProps({
  groupedBills:    { type: Array, default: () => [] },
  swipeItem:       { type: String, default: '' },
  getSwipeOffset:  { type: Function, required: true },
  formatDateLabel: { type: Function, required: true },
  isToday:         { type: Function, default: () => () => false }
})

const emit = defineEmits(['billTap', 'edit', 'delete', 'touchStart', 'touchMove', 'touchEnd'])
</script>

<template>
  <scroll-view class="bill-scroll" scroll-y>
    <view v-if="groupedBills.length === 0" class="empty-state">
      <text class="empty-text">暂无账单</text>
    </view>

    <view v-else class="bill-list">
      <view v-for="group in groupedBills" :key="group.date" class="bill-group">
        <!-- 日期头 -->
        <view class="date-header" :class="{ today: isToday(group.date) }">
          <text class="date-label">{{ formatDateLabel(group.date) }}</text>
          <view class="date-summary">
            <text v-if="group.dayExpense > 0" class="ds-expense">支出 ¥{{ group.dayExpense.toFixed(0) }}</text>
            <text v-if="group.dayIncome > 0" class="ds-income">收入 ¥{{ group.dayIncome.toFixed(0) }}</text>
          </view>
        </view>

        <!-- 当日账单 -->
        <BillItem
          v-for="item in group.items" :key="item.client_id"
          :item="item"
          :is-open="swipeItem === item.client_id"
          :swipe-offset="getSwipeOffset(item)"
          @tap="(bill) => emit('billTap', bill)"
          @edit="(bill) => emit('edit', bill)"
          @delete="(bill) => emit('delete', bill)"
          @touchstart="(e, bill) => emit('touchStart', e, bill)"
          @touchmove="(e, bill) => emit('touchMove', e, bill)"
          @touchend="(bill) => emit('touchEnd', bill)"
        />
      </view>
    </view>

    <view style="height: 120rpx" />
  </scroll-view>
</template>

<style lang="scss" scoped>
.bill-scroll {
  flex: 1;
  padding: 0 $spacing-md;
  background: var(--bg-page);
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200rpx;

  .empty-text {
    font-size: $font-sm;
    color: $text-hint;
  }
}

.bill-list {
  /* 列表容器 */
}

.bill-group {
  margin-bottom: $spacing-sm;
}

.date-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-xs 0;

  .date-label {
    font-size: $font-xs;
    font-weight: 700;
    color: $text-secondary;
  }

  .date-summary {
    display: flex;
    gap: $spacing-sm;

    .ds-expense {
      font-size: 18rpx;
      color: $danger;
    }

    .ds-income {
      font-size: 18rpx;
      color: $success;
    }
  }
}
</style>
