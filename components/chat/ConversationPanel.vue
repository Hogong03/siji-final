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
  background: var(--bg-card);
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
  border-bottom: 1rpx solid var(--border-color);
  flex-shrink: 0;
  box-sizing: border-box;
  position: relative;

  .conv-drawer-title {
    font-size: $font-lg;
    font-weight: 700;
    color: var(--text-primary);
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
  background: var(--text-hint);
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
    border-top: 2rpx dashed var(--border-color);
  }

  .conv-new-divider-text {
    font-size: $font-sm;
    color: var(--text-secondary);
    white-space: nowrap;
    padding: 0 $spacing-xs;
  }

  &:active .conv-new-divider-text {
    color: var(--text-primary);
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
  border-bottom: 1rpx solid var(--border-color);
  box-sizing: border-box;
  overflow: hidden;

  &:active { background: var(--bg-input); }
  &.active {
    background: var(--bg-input);
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
  color: var(--text-hint, #999);
  padding: 4rpx 8rpx;

  &:active { color: var(--text-primary); }
}

.conv-item-title {
  font-size: $font-md;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conv-item-time {
  font-size: $font-xs;
  color: var(--text-hint, #999);
}

.conv-item-msgs {
  font-size: $font-xs;
  color: var(--text-hint, #999);
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
    color: var(--text-hint, #999);
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
  background: var(--bg-card);
  border-radius: 16rpx;
  border: 1rpx solid var(--border-color);
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
  color: var(--text-secondary);
}
</style>
