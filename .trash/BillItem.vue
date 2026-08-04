<script setup>
/**
 * 单个账单项 — 支持左滑露出操作按钮
 */
import { ref, computed } from 'vue'
import { getCategoryInfo } from '@/utils/categories.js'

const props = defineProps({
  item:        { type: Object, required: true },
  /** 该项是否处于展开状态（操作按钮已露出） */
  isOpen:      { type: Boolean, default: false },
  /** 当前滑动偏移量 */
  swipeOffset: { type: String, default: '0px' }
})

const emit = defineEmits(['tap', 'edit', 'delete', 'touchstart', 'touchmove', 'touchend'])

// 分类信息
const catInfo = computed(() => getCategoryInfo(props.item.category || ''))

function onTap() {
  emit('tap', props.item)
}

function onEdit() {
  emit('edit', props.item)
}

function onDelete() {
  emit('delete', props.item)
}

function onTouchStart(e) {
  emit('touchstart', e, props.item)
}

function onTouchMove(e) {
  emit('touchmove', e, props.item)
}

function onTouchEnd() {
  emit('touchend', props.item)
}

</script>

<template>
  <view class="swipe-container">
    <!-- 右侧操作按钮 -->
    <view class="swipe-actions" v-if="isOpen">
      <view class="swipe-btn edit-btn" @tap.stop="onEdit">
        <text class="sb-icon">✎</text>
        <text class="sb-text">编辑</text>
      </view>
      <view class="swipe-btn delete-btn" @tap.stop="onDelete">
        <text class="sb-icon">×</text>
        <text class="sb-text">删除</text>
      </view>
    </view>

    <!-- 账单项（可滑动） -->
    <view
      class="swipe-content"
      :style="{ transform: 'translateX(' + swipeOffset + ')' }"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
      @tap="onTap"
    >
      <view class="bill-item">
        <view class="bill-icon-wrap" :style="{ background: catInfo.color + '15' }">
          <text class="bill-icon">{{ catInfo.icon }}</text>
        </view>
        <view class="bill-body">
          <text class="bill-category">{{ item.category || '未分类' }}</text>
          <text class="bill-note" v-if="item.note || item.remark">{{ item.note || item.remark }}</text>
        </view>
        <view class="bill-amount-wrap">
          <text class="bill-amount" :class="(item.type === 'income' || item.type === 1) ? 'income' : 'expense'">
            {{ (item.type === 'income' || item.type === 1) ? '+' : '-' }}¥{{ (item.amount || 0).toFixed(2) }}
          </text>
          <text class="bill-time" v-if="item.created_at">{{ new Date(item.created_at).toTimeString().substring(0, 5) }}</text>
          <text class="bill-date" v-if="item.bill_date">{{ String(item.bill_date).substring(5).replace('-', '/') }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.swipe-container {
  position: relative;
  overflow: hidden;
  margin-bottom: 2rpx;
  border-radius: $radius-lg;
}

.swipe-actions {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  z-index: 1;
}

.swipe-btn {
  width: 140rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  &.edit-btn {
    background: var(--color-ai);
  }

  &.delete-btn {
    background: var(--color-red);
  }

  .sb-icon {
    color: var(--text-on-ai);
    font-size: 28rpx;
    margin-bottom: 2rpx;
  }

  .sb-text {
    color: var(--text-on-ai);
    font-size: $font-sm;
    font-weight: 600;
  }
}

.swipe-content {
  position: relative;
  z-index: 2;
  transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.15s ease,
              background-color 0.15s ease;
  background: $bg-card;
  border-radius: $radius-lg;

  &:active {
    transform: scale(0.98);
    opacity: 0.92;
    background: $bg-input;
  }
}

.bill-item {
  display: flex;
  align-items: center;
  padding: $spacing-sm;
}

.bill-icon-wrap {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: $spacing-sm;
  flex-shrink: 0;
}

.bill-icon {
  font-size: 32rpx;
}

.bill-body {
  flex: 1;
  min-width: 0;

  .bill-category {
    font-size: $font-md;
    color: $text-primary;
    display: block;
    font-weight: 600;
  }

  .bill-note {
    font-size: $font-xs;
    color: $text-hint;
    display: block;
    margin-top: 2rpx;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.bill-amount-wrap {
  text-align: right;
  flex-shrink: 0;

  .bill-amount {
    font-size: $font-lg;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    -webkit-font-feature-settings: 'tnum';

    &.expense { color: $danger; }
    &.income { color: $success; }
  }

  .bill-time {
    font-size: 18rpx;
    color: $text-hint;
    display: block;
    font-variant-numeric: tabular-nums;
    -webkit-font-feature-settings: 'tnum';
  }

  .bill-date {
    font-size: 18rpx;
    color: $text-hint;
    display: block;
    font-variant-numeric: tabular-nums;
    -webkit-font-feature-settings: 'tnum';
  }
}
</style>
