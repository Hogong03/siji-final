<script setup>
/**
 * ConversationPanel - 会话列表底部抽屉组件 v4
 *
 * 筛选改为展开折叠区：header 右侧「筛选 ▾」按钮，点击展开/收起
 * - 展开后显示：全部 / 按时间 / 按标签 三个 chip + 标签列表（仅按标签模式）
 * - 选中后自动收起
 * - 时间分组：今天 / 昨天 / 本周 / 更早
 * - 对话项支持打标签（点击 more 图标）
 *
 * 职责: 纯展示 + 事件上报，不直接访问 store
 */
import SijiIcon from '@/components/common/SijiIcon.vue'

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

function getFilterLabel() {
  if (props.activeFilter === 'time') return '按时间'
  if (props.activeFilter === 'tag') {
    return props.activeTag ? props.activeTag : '按标签'
  }
  return '筛选'
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
        <view
          class="conv-filter-btn"
          :class="{ active: activeFilter !== 'all', expanded: filterExpanded }"
          @tap="toggleFilter"
        >
          <text class="conv-filter-label">{{ getFilterLabel() }}</text>
          <text class="conv-filter-arrow">{{ filterExpanded ? '▴' : '▾' }}</text>
        </view>
      </view>

      <!-- 筛选展开折叠区 -->
      <view v-if="filterExpanded" class="conv-filter-panel">
        <view class="filter-chips-row">
          <view
            class="filter-chip"
            :class="{ active: activeFilter === 'all' }"
            @tap="handleSelectFilter('all')"
          >
            <text>全部</text>
          </view>
          <view
            class="filter-chip"
            :class="{ active: activeFilter === 'time' }"
            @tap="handleSelectFilter('time')"
          >
            <text>按时间</text>
          </view>
          <view
            class="filter-chip"
            :class="{ active: activeFilter === 'tag' }"
            @tap="handleSelectFilter('tag')"
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
                @tap="handleSelectTag(null)"
              >
                <text>全部</text>
              </view>
              <view
                v-for="tag in allTags"
                :key="tag"
                class="tag-select-chip"
                :class="{ active: activeTag === tag }"
                @tap="handleSelectTag(tag)"
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

/* 筛选展开面板 */
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
