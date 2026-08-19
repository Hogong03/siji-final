<script setup>
/**
 * ConversationFilterPanel - filter chips + tag list (split from ConversationPanel)
 */
defineProps({
  activeFilter: { type: String, default: 'all' },
  activeTag: { type: String, default: null },
  allTags: { type: Array, default: () => [] }
})

defineEmits(['set-filter', 'select-tag'])
</script>

<template>
  <view class="conv-filter-panel">
    <view class="filter-chips-row">
      <view
        class="filter-chip"
        :class="{ active: activeFilter === 'all' }"
        @tap="$emit('set-filter', 'all')"
      >
        <text>全部</text>
      </view>
      <view
        class="filter-chip"
        :class="{ active: activeFilter === 'time' }"
        @tap="$emit('set-filter', 'time')"
      >
        <text>按时间</text>
      </view>
      <view
        class="filter-chip"
        :class="{ active: activeFilter === 'tag' }"
        @tap="$emit('set-filter', 'tag')"
      >
        <text>按标签</text>
      </view>
    </view>

    <!-- 标签列表（仅按标签模式展开后显示） -->
    <view v-if="activeFilter === 'tag'" class="tag-select-row">
      <view v-if="allTags.length === 0" class="tag-empty-hint">
        <text>暂无标签，点击对话右侧图标添加</text>
      </view>
      <scroll-view v-else scroll-x class="tag-scroll-view">
        <view class="tag-select-list">
          <view
            class="tag-select-chip"
            :class="{ active: !activeTag }"
            @tap="$emit('select-tag', null)"
          >
            <text>全部</text>
          </view>
          <view
            v-for="tag in allTags"
            :key="tag"
            class="tag-select-chip"
            :class="{ active: activeTag === tag }"
            @tap="$emit('select-tag', tag)"
          >
            <text>{{ tag }}</text>
          </view>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.conv-filter-panel {
  flex-shrink: 0;
  border-bottom: 1rpx solid #E4E4E7;
  overflow: hidden;
  animation: filterExpand 0.2s ease-out;
}

@keyframes filterExpand {
  from { max-height: 0; opacity: 0; }
  to { max-height: 400rpx; opacity: 1; }
}

.filter-chips-row {
  display: flex;
  gap: $spacing-xs;
  padding: $spacing-sm $spacing-md;
}

.filter-chip {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12rpx 0;
  border-radius: 12rpx;
  background: #F4F4F5;
  font-size: $font-sm;
  color: #71717A;
  transition: all 0.2s;

  &.active {
    background: #18181B;
    color: #FFFFFF;
    font-weight: 600;
  }
}

/* 标签选择行 */
.tag-select-row {
  padding: 0 $spacing-md $spacing-sm;
}

.tag-empty-hint {
  padding: $spacing-xs 0;
  text-align: center;
  font-size: $font-xs;
  color: #A1A1AA;
}

.tag-scroll-view {
  white-space: nowrap;
}

.tag-select-list {
  display: inline-flex;
  gap: $spacing-xs;
  padding: $spacing-xs 0;
}

.tag-select-chip {
  display: inline-flex;
  align-items: center;
  padding: 8rpx 24rpx;
  border-radius: 32rpx;
  background: #F4F4F5;
  font-size: $font-xs;
  color: #71717A;
  white-space: nowrap;
  transition: all 0.2s;

  &.active {
    background: #18181B;
    color: #FFFFFF;
  }
}


@media (prefers-color-scheme: dark) {
  .conv-filter-panel {
    border-bottom-color: #27272A;
  }
  .filter-chip {
    background: #27272A;
    color: #A1A1AA;
    &.active {
      background: #FAFAFA;
      color: #18181B;
    }
  }
  .tag-empty-hint {
    color: #52525B;
  }
  .tag-select-chip {
    background: #27272A;
    color: #A1A1AA;
    &.active {
      background: #FAFAFA;
      color: #18181B;
    }
  }
}
</style>
