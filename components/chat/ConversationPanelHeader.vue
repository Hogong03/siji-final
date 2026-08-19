<script setup>
/**
 * ConversationPanelHeader - drawer header + filter toggle (split from ConversationPanel)
 */
const props = defineProps({
  activeFilter: { type: String, default: 'all' },
  activeTag: { type: String, default: null },
  filterExpanded: { type: Boolean, default: false }
})

defineEmits(['toggle-filter'])

function getFilterLabel() {
  if (props.activeFilter === 'time') return '按时间'
  if (props.activeFilter === 'tag') {
    return props.activeTag ? props.activeTag : '按标签'
  }
  return '筛选'
}
</script>

<template>
  <view class="conv-drawer-header">
    <text class="conv-drawer-title">对话列表</text>
    <view
      class="conv-filter-btn"
      :class="{ active: activeFilter !== 'all', expanded: filterExpanded }"
      @tap="$emit('toggle-filter')"
    >
      <text class="conv-filter-label">{{ getFilterLabel() }}</text>
      <text class="conv-filter-arrow">{{ filterExpanded ? '▴' : '▾' }}</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.conv-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-md;
  border-bottom: 1rpx solid #E4E4E7;
  flex-shrink: 0;
  box-sizing: border-box;
  position: relative;

  .conv-drawer-title {
    font-size: $font-lg;
    font-weight: 700;
    color: #18181B;
  }
}

.conv-drawer-header::before {
  content: '';
  position: absolute;
  top: -16rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 64rpx;
  height: 8rpx;
  border-radius: 4rpx;
  background: #A1A1AA;
  opacity: 0.3;
}

/* 筛选按钮 */
.conv-filter-btn {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 8rpx 20rpx;
  border-radius: 32rpx;
  background: #F4F4F5;
  transition: all 0.2s;

  &.active {
    background: #18181B;
    .conv-filter-label { color: #FFFFFF; }
    .conv-filter-arrow { color: #FFFFFF; }
  }

  &.expanded {
    border-radius: 32rpx 32rpx 0 0;
  }

  &:active { opacity: 0.7; }
}

.conv-filter-label {
  font-size: $font-sm;
  color: #71717A;
  font-weight: 500;
}

.conv-filter-arrow {
  font-size: 20rpx;
  color: #71717A;
  line-height: 1;
}


@media (prefers-color-scheme: dark) {
  .conv-drawer-header {
    border-bottom-color: #27272A;
    .conv-drawer-title {
      color: #FAFAFA;
    }
  }
  .conv-drawer-header::before {
    background: #52525B;
  }
  .conv-filter-btn {
    background: #27272A;
    &.active {
      background: #FAFAFA;
      .conv-filter-label { color: #18181B; }
      .conv-filter-arrow { color: #18181B; }
    }
  }
  .conv-filter-label {
    color: #A1A1AA;
  }
  .conv-filter-arrow {
    color: #A1A1AA;
  }
}
</style>
