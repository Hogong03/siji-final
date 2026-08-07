<script setup>
/**
 * ConversationPanel - 会话列表底部抽屉组件 v2
 *
 * 新增分类功能：
 * - 三个筛选维度：全部 / 时间分组 / 标签筛选
 * - 时间分组：今天 / 昨天 / 本周 / 更早
 * - 标签筛选：点击标签 chip 筛选，长按删除标签
 * - 对话项支持打标签（点击 tag 图标）
 *
 * 职责: 纯展示 + 事件上报，不直接访问 store
 */
import SijiIcon from '@/components/common/SijiIcon.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  conversations: { type: Array, default: () => [] },        // 已筛选+排序后的列表
  groupedConversations: { type: Array, default: () => [] }, // 时间分组结果
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
  <view v-if="show" class="conv-mask" @tap="$emit('close')">
    <view class="conv-drawer" @tap.stop>
      <view class="conv-drawer-header">
        <text class="conv-drawer-title">对话列表</text>
      </view>

      <!-- 筛选切换栏 -->
      <view class="conv-filter-bar">
        <view
          class="filter-tab"
          :class="{ active: activeFilter === 'all' }"
          @tap="$emit('set-filter', 'all')"
        >
          <text>全部</text>
        </view>
        <view
          class="filter-tab"
          :class="{ active: activeFilter === 'time' }"
          @tap="$emit('set-filter', 'time')"
        >
          <text>按时间</text>
        </view>
        <view
          class="filter-tab"
          :class="{ active: activeFilter === 'tag' }"
          @tap="$emit('set-filter', 'tag')"
        >
          <text>按标签</text>
        </view>
      </view>

      <!-- 标签筛选区（仅在 tag 模式下显示） -->
      <view v-if="activeFilter === 'tag'" class="tag-chips-bar">
        <view v-if="allTags.length === 0" class="tag-empty-hint">
          <text>暂无标签，点击对话右侧标签图标添加</text>
        </view>
        <view v-else class="tag-chips-scroll" scroll-x>
          <scroll-view scroll-x class="tag-scroll-view">
            <view class="tag-chips-list">
              <view
                class="tag-chip"
                :class="{ active: !activeTag }"
                @tap="$emit('select-tag', null)"
              >
                <text>全部</text>
              </view>
              <view
                v-for="tag in allTags"
                :key="tag"
                class="tag-chip"
                :class="{ active: activeTag === tag }"
                @tap="$emit('select-tag', tag)"
              >
                <text>{{ tag }}</text>
              </view>
            </view>
          </scroll-view>
        </view>
      </view>

      <scroll-view class="conv-list-scroll" scroll-y>
        <!-- 时间分组模式 -->
        <template v-if="activeFilter === 'time'">
          <view v-for="group in groupedConversations" :key="group.label" class="conv-group">
            <view class="conv-group-header">
              <text class="conv-group-label">{{ group.label }}</text>
              <text class="conv-group-count">{{ group.items.length }}</text>
            </view>
            <view
              v-for="conv in group.items"
              :key="conv.id"
              class="conv-item"
              :class="{ active: conv.id === activeId }"
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
          </view>
        </template>

        <!-- 全部 / 标签模式（平铺列表） -->
        <template v-else>
          <view
            v-for="conv in conversations"
            :key="conv.id"
            class="conv-item"
            :class="{ active: conv.id === activeId }"
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

/* 筛选切换栏 */
.conv-filter-bar {
  display: flex;
  padding: 0 $spacing-md;
  border-bottom: 1rpx solid #E4E4E7;
  flex-shrink: 0;
  box-sizing: border-box;
}

.filter-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $spacing-sm 0;
  font-size: $font-sm;
  color: #71717A;
  position: relative;
  transition: color 0.2s;

  &.active {
    color: #18181B;
    font-weight: 600;

    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 48rpx;
      height: 4rpx;
      background: #18181B;
      border-radius: 2rpx;
    }
  }
}

/* 标签 chips 区 */
.tag-chips-bar {
  flex-shrink: 0;
  padding: $spacing-xs $spacing-md;
  border-bottom: 1rpx solid #E4E4E7;
  box-sizing: border-box;
}

.tag-empty-hint {
  padding: $spacing-sm 0;
  text-align: center;
  font-size: $font-xs;
  color: #A1A1AA;
}

.tag-scroll-view {
  white-space: nowrap;
}

.tag-chips-list {
  display: inline-flex;
  gap: $spacing-xs;
  padding: $spacing-xs 0;
}

.tag-chip {
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

/* 时间分组 */
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
  .conv-drawer-header {
    border-bottom-color: #27272A;
    .conv-drawer-title {
      color: #FAFAFA;
    }
  }
  .conv-drawer-header::before {
    background: #52525B;
  }
  .conv-filter-bar {
    border-bottom-color: #27272A;
  }
  .filter-tab {
    color: #71717A;
    &.active {
      color: #FAFAFA;
      &::after {
        background: #FAFAFA;
      }
    }
  }
  .tag-chips-bar {
    border-bottom-color: #27272A;
  }
  .tag-chip {
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
  .conv-shortcut-item {
    background: #18181B;
    border-color: #27272A;
  }
  .conv-shortcut-text {
    color: #A1A1AA;
  }
}
</style>
