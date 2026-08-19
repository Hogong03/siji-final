<script setup>
/**
 * ConversationListItem - single conversation row (split from ConversationPanel)
 */
import SijiIcon from '@/components/common/SijiIcon.vue'

defineProps({
  conv: { type: Object, default: () => ({}) },
  active: { type: Boolean, default: false }
})

defineEmits(['switch', 'delete', 'add-tag', 'rename'])

function formatConvTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const that = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (today === that) return time
  return that.substring(5)
}

function getConvTags(conv) {
  return (conv && conv.tags) ? conv.tags : []
}
</script>

<template>
      <view
        :key="conv.id"
        class="conv-item"
        :class="{ active: active }"
        @tap="$emit('switch', conv.id)"
        @longpress="$emit('delete', conv)"
      >
        <view class="conv-item-info">
          <view class="conv-item-title-row">
            <text class="conv-item-title">{{ conv.title }}</text>
            <view v-if="getConvTags(conv).length > 0" class="conv-item-tags">
              <text
                v-for="t in getConvTags(conv)"
                :key="t"
                class="conv-item-tag"
              >{{ t }}</text>
            </view>
          </view>
          <text class="conv-item-time">{{ formatConvTime(conv.updatedAt) }}</text>
        </view>
        <view class="conv-item-actions">
          <view class="conv-item-tag-btn" @tap.stop="$emit('add-tag', conv)">
            <SijiIcon name="more" size="sm" />
          </view>
          <view class="conv-item-rename" @tap.stop="$emit('rename', conv)">
            <SijiIcon name="edit" size="sm" />
          </view>
          <text class="conv-item-msgs">{{ conv.messages.length }} 条</text>
        </view>
      </view>
</template>

<style lang="scss" scoped>
.conv-item {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-md;
  border-bottom: 1rpx solid #E4E4E7;
  box-sizing: border-box;
  overflow: hidden;

  &:active { background: #E4E4E7; }
  &.active {
    background: #E4E4E7;
    border-left: 6rpx solid #000000;
  }
}

.conv-item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  min-width: 0;
  overflow: hidden;
}

.conv-item-title-row {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  min-width: 0;
  overflow: hidden;
  flex-wrap: wrap;
}

.conv-item-actions {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  flex-shrink: 0;
}

.conv-item-tag-btn {
  font-size: 32rpx;
  color: #A1A1AA;
  padding: 4rpx 8rpx;

  &:active { color: #18181B; }
}

.conv-item-rename {
  font-size: 32rpx;
  color: #A1A1AA;
  padding: 4rpx 8rpx;

  &:active { color: #18181B; }
}

.conv-item-title {
  font-size: $font-md;
  font-weight: 600;
  color: #18181B;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conv-item-tags {
  display: inline-flex;
  gap: 4rpx;
  flex-wrap: nowrap;
  overflow: hidden;
}

.conv-item-tag {
  font-size: 20rpx;
  color: #71717A;
  background: #F4F4F5;
  padding: 2rpx 10rpx;
  border-radius: 8rpx;
  white-space: nowrap;
  flex-shrink: 0;
}

.conv-item-time {
  font-size: $font-xs;
  color: #A1A1AA;
}

.conv-item-msgs {
  font-size: $font-xs;
  color: #A1A1AA;
  flex-shrink: 0;
  white-space: nowrap;
}


@media (prefers-color-scheme: dark) {
  .conv-item {
    border-bottom-color: #27272A;
    &:active { background: #27272A; }
    &.active {
      background: #27272A;
      border-left-color: #FAFAFA;
    }
  }
  .conv-item-tag-btn {
    color: #52525B;
    &:active { color: #FAFAFA; }
  }
  .conv-item-rename {
    color: #52525B;
    &:active { color: #FAFAFA; }
  }
  .conv-item-title {
    color: #FAFAFA;
  }
  .conv-item-tag {
    color: #A1A1AA;
    background: #27272A;
  }
}
</style>
