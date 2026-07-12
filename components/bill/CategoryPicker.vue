<script setup>
/**
 * CategoryPicker - 分类选择组件
 * 包含：分类网格、快捷备注标签
 */
defineProps({
  modelValue: { type: String, default: '' },
  categories: { type: Array, default: () => [] },
  quickNotes: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:modelValue', 'select-quick-note'])

function selectCategory(cat) {
  emit('update:modelValue', cat)
}

function tapQuickNote(qn) {
  emit('select-quick-note', qn)
}
</script>

<template>
  <!-- 分类选择网格 -->
  <view class="category-grid">
    <view
      v-for="cat in categories" :key="cat.key"
      class="cat-cell" :class="{ selected: modelValue === cat.key }"
      @tap="selectCategory(cat.key)"
    >
      <view class="cat-icon-wrap" :style="{ background: modelValue === cat.key ? cat.color : cat.color + '12' }">
        <text class="cat-icon">{{ cat.icon }}</text>
      </view>
      <text
        class="cat-name"
        :class="{ selected: modelValue === cat.key }"
        :style="{ color: modelValue === cat.key ? cat.color : '' }"
      >{{ cat.key }}</text>
    </view>
  </view>

  <!-- 快捷备注 -->
  <view class="quick-notes" v-if="quickNotes.length > 0">
    <view
      v-for="qn in quickNotes" :key="qn"
      class="qn-tag"
      @tap="tapQuickNote(qn)"
    >{{ qn }}</view>
  </view>
</template>

<style lang="scss" scoped>
/* 分类网格 */
.category-grid {
  display: flex;
  flex-wrap: wrap;
  padding: 0 $spacing-md;
  margin-bottom: $spacing-sm;
}

.cat-cell {
  width: 20%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $spacing-xs 0;
  transition: transform $transition-fast;

  &:active { transform: scale(0.92); }

  .cat-icon-wrap {
    width: 72rpx;
    height: 72rpx;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all $transition-fast;
  }

  .cat-icon {
    font-size: 36rpx;
  }

  .cat-name {
    font-size: 18rpx;
    margin-top: 6rpx;
    text-align: center;
    white-space: nowrap;
    color: $text-secondary;

    &.selected {
      font-weight: 600;
    }
  }

  &.selected {
    .cat-icon-wrap {
      transform: scale(1.1);
    }
  }
}

/* 快捷备注 */
.quick-notes {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-xs;
  padding: 0 $spacing-md;
  margin-bottom: $spacing-sm;

  .qn-tag {
    padding: 8rpx 20rpx;
    background: $bg-card;
    border-radius: $radius-round;
    font-size: $font-xs;
    color: $text-secondary;

    &:active { background: $bg-input; }
  }
}
</style>
