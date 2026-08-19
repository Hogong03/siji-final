<script setup>
/**
 * ConversationPanel - conversation list drawer shell (split from v4)
 * responsibility: pure display + event reporting, no direct store access
 * split: ConversationPanelHeader / ConversationFilterPanel / ConversationListItem
 */
import SijiIcon from '@/components/common/SijiIcon.vue'
import ConversationPanelHeader from './ConversationPanelHeader.vue'
import ConversationFilterPanel from './ConversationFilterPanel.vue'
import ConversationListItem from './ConversationListItem.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  conversations: { type: Array, default: () => [] },
  groupedConversations: { type: Array, default: () => [] },
  activeId: { type: String, default: '' },
  activeFilter: { type: String, default: 'all' },
  activeTag: { type: String, default: null },
  allTags: { type: Array, default: () => [] },
  hasTags: { type: Boolean, default: false }
})

const emit = defineEmits([
  'close', 'switch', 'delete', 'rename', 'new',
  'set-filter', 'select-tag', 'add-tag'
])

import { ref } from 'vue'
const filterExpanded = ref(false)

function toggleFilter() {
  filterExpanded.value = !filterExpanded.value
}

function handleSelectFilter(mode) {
  emit('set-filter', mode)
  if (mode !== 'tag') {
    filterExpanded.value = false
  }
}

function handleSelectTag(tag) {
  emit('select-tag', tag)
  filterExpanded.value = false
}
</script>

<template>
  <view v-if="show" class="conv-mask" @tap="$emit('close')">
    <view class="conv-drawer" @tap.stop>
      <ConversationPanelHeader
        :active-filter="activeFilter"
        :active-tag="activeTag"
        :filter-expanded="filterExpanded"
        @toggle-filter="toggleFilter"
      />
      <ConversationFilterPanel
        v-if="filterExpanded"
        :active-filter="activeFilter"
        :active-tag="activeTag"
        :all-tags="allTags"
        @set-filter="handleSelectFilter"
        @select-tag="handleSelectTag"
      />
      <scroll-view class="conv-list-scroll" scroll-y>
        <template v-if="activeFilter === 'time'">
          <view v-for="group in groupedConversations" :key="group.label" class="conv-group">
            <view class="conv-group-header">
              <text class="conv-group-label">{{ group.label }}</text>
              <text class="conv-group-count">{{ group.items.length }}</text>
            </view>
            <ConversationListItem
              v-for="conv in group.items"
              :key="conv.id"
              :conv="conv"
              :active="conv.id === activeId"
              @switch="$emit('switch', $event)"
              @delete="$emit('delete', $event)"
              @add-tag="$emit('add-tag', $event)"
              @rename="$emit('rename', $event)"
            />
          </view>
        </template>
        <template v-else>
          <ConversationListItem
            v-for="conv in conversations"
            :key="conv.id"
            :conv="conv"
            :active="conv.id === activeId"
            @switch="$emit('switch', $event)"
            @delete="$emit('delete', $event)"
            @add-tag="$emit('add-tag', $event)"
            @rename="$emit('rename', $event)"
          />
        </template>
        <view v-if="conversations.length === 0" class="conv-empty">
          <text class="conv-empty-text">{{ activeFilter === 'tag' && activeTag ? '该标签下暂无对话' : '暂无对话' }}</text>
        </view>
        <view class="conv-new-divider" @tap="$emit('new')">
          <view class="conv-divider-line" />
          <text class="conv-new-divider-text">新对话</text>
          <view class="conv-divider-line" />
        </view>
        <view class="conv-shortcuts">
          <view class="conv-shortcut-item" @tap="uni.navigateTo({ url: '/pages/settings/sub/profile' })">
            <SijiIcon name="user" size="md" class="conv-shortcut-icon" />
            <text class="conv-shortcut-text">我的信息</text>
          </view>
          <view class="conv-shortcut-item" @tap="uni.navigateTo({ url: '/pages/settings/sub/ai' })">
            <SijiIcon name="settings" size="md" class="conv-shortcut-icon" />
            <text class="conv-shortcut-text">AI 配置</text>
          </view>
        </view>
        <view class="conv-bottom-spacer" />
      </scroll-view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.conv-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 999;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.conv-drawer {
  width: 100%;
  height: 75vh;
  background: #FFFFFF;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
  border-radius: $radius-xl $radius-xl 0 0;
  animation: sheetSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes sheetSlideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.conv-group {
  margin-bottom: $spacing-xs;
}

.conv-group-header {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  padding: $spacing-sm $spacing-md;
  padding-top: $spacing-md;
  box-sizing: border-box;

  .conv-group-label {
    font-size: $font-xs;
    font-weight: 600;
    color: #A1A1AA;
    text-transform: uppercase;
    letter-spacing: 1rpx;
  }

  .conv-group-count {
    font-size: 20rpx;
    color: #A1A1AA;
    background: #F4F4F5;
    padding: 2rpx 12rpx;
    border-radius: 16rpx;
  }
}

.conv-list-scroll {
  flex: 1;
  overflow: hidden;
}

.conv-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $spacing-lg 0;

  .conv-empty-text {
    font-size: $font-sm;
    color: #A1A1AA;
  }
}

.conv-new-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-sm;
  padding: $spacing-md $spacing-lg;
  margin-top: $spacing-sm;
  box-sizing: border-box;

  .conv-divider-line {
    flex: 1;
    height: 1rpx;
    border-top: 2rpx dashed #E4E4E7;
  }

  .conv-new-divider-text {
    font-size: $font-sm;
    color: #71717A;
    white-space: nowrap;
    padding: 0 $spacing-xs;
  }

  &:active .conv-new-divider-text {
    color: #18181B;
    font-weight: 600;
  }
}

.conv-bottom-spacer {
  height: 60rpx;
  flex-shrink: 0;
}

.conv-shortcuts {
  display: flex;
  gap: 24rpx;
  padding: 16rpx 24rpx;
  margin-top: 8rpx;
}
.conv-shortcut-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 20rpx 0;
  background: #FFFFFF;
  border-radius: 16rpx;
  border: 1rpx solid #E4E4E7;
  box-sizing: border-box;
}
.conv-shortcut-item:active {
  opacity: 0.6;
}
.conv-shortcut-icon {
  font-size: 28rpx;
}
.conv-shortcut-text {
  font-size: 24rpx;
  color: #71717A;
}


@media (prefers-color-scheme: dark) {
  .conv-drawer {
    background: #18181B;
  }
  .conv-group-header {
    .conv-group-label { color: #52525B; }
    .conv-group-count {
      color: #52525B;
      background: #27272A;
    }
  }
  .conv-new-divider .conv-divider-line {
    border-top-color: #27272A;
  }
  .conv-new-divider-text {
    color: #71717A;
    &:active { color: #FAFAFA; }
  }
  .conv-shortcut-item {
    background: #18181B;
    border-color: #27272A;
  }
  .conv-shortcut-text {
    color: #A1A1AA;
  }
}
</style>
