<script setup>
/**
 * ConversationPanel - 会话列表底部抽屉组件
 *
 * 职责: 纯展示 + 事件上报，不直接访问 store
 * 入口: 聊天页底部 Sheet 抽屉
 */
import SijiIcon from '@/components/common/SijiIcon.vue'

defineProps({
  show: { type: Boolean, default: false },
  conversations: { type: Array, default: () => [] },
  activeId: { type: String, default: '' }
})

defineEmits(['close', 'switch', 'delete', 'rename', 'new'])

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
</script>

<template>
  <view v-if="show" class="conv-mask" @tap="$emit('close')">
    <view class="conv-drawer" @tap.stop>
      <view class="conv-drawer-header">
        <text class="conv-drawer-title">对话列表</text>
      </view>
      <scroll-view class="conv-list-scroll" scroll-y>
        <view
          v-for="conv in conversations" :key="conv.id"
          class="conv-item"
          :class="{ active: conv.id === activeId }"
          @tap="$emit('switch', conv.id)"
          @longpress="$emit('delete', conv)"
        >
          <view class="conv-item-info">
            <view class="conv-item-title-row">
              <text class="conv-item-title">{{ conv.title }}</text>
            </view>
            <text class="conv-item-time">{{ formatConvTime(conv.updatedAt) }}</text>
          </view>
          <view class="conv-item-actions">
            <view class="conv-item-rename" @tap.stop="$emit('rename', conv)"><SijiIcon name="edit" size="sm" /></view>
            <text class="conv-item-msgs">{{ conv.messages.length }} 条</text>
          </view>
        </view>
        <view v-if="conversations.length === 0" class="conv-empty">
          <text class="conv-empty-text">暂无对话</text>
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
  height: 70vh;
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

/* 底部 Sheet 拖拽指示器 */
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

.conv-list-scroll {
  flex: 1;
  overflow: hidden;
}

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
}

.conv-item-actions {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  flex-shrink: 0;
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
  .conv-drawer-header {
    border-bottom-color: #27272A;
    .conv-drawer-title {
      color: #FAFAFA;
    }
  }
  .conv-drawer-header::before {
    background: #52525B;
  }
  .conv-new-divider .conv-divider-line {
    border-top-color: #27272A;
  }
  .conv-new-divider-text {
    color: #71717A;
    &:active { color: #FAFAFA; }
  }
  .conv-item {
    border-bottom-color: #27272A;
    &:active { background: #27272A; }
    &.active {
      background: #27272A;
      border-left-color: #FAFAFA;
    }
  }
  .conv-item-rename {
    color: #52525B;
    &:active { color: #FAFAFA; }
  }
  .conv-item-title {
    color: #FAFAFA;
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
