<script setup>
/**
 * 版本详情页 — 按功能分类展示完整变更，可折叠/展开
 * 路由: /pages/settings/sub/version-detail?version=1.3.0
 */
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getVersionRecord } from '@/utils/storage/version-history.js'

const version = ref('')
const record = ref(null)
const expandedCategories = ref({})

onLoad((query) => {
  if (query && query.version) {
    version.value = query.version
    record.value = getVersionRecord(query.version)
    // 默认展开第一个分类
    if (record.value?.categories?.length) {
      expandedCategories.value[0] = true
    }
  }
})

function toggleCategory(idx) {
  expandedCategories.value[idx] = !expandedCategories.value[idx]
  // 触发响应式更新
  expandedCategories.value = { ...expandedCategories.value }
}

const totalChanges = computed(() => {
  if (!record.value?.categories) return 0
  return record.value.categories.reduce((n, c) => n + c.items.length, 0)
})
</script>

<template>
  <view class="detail-page" v-if="record">
    <!-- 版本头部 -->
    <view class="version-header">
      <view class="vh-top">
        <text class="vh-version">v{{ record.version }}</text>
        <text class="vh-date">{{ record.date }}</text>
      </view>
      <text class="vh-title">{{ record.title }}</text>
      <text class="vh-count">共 {{ totalChanges }} 项更新</text>
    </view>

    <!-- 功能分类列表 -->
    <view class="cat-list">
      <view
        v-for="(cat, idx) in record.categories"
        :key="idx"
        class="cat-card"
      >
        <!-- 分类头部（可折叠） -->
        <view class="cat-header" @tap="toggleCategory(idx)">
          <view class="cat-left">
            <text class="cat-arrow" :class="{ expanded: expandedCategories[idx] }">›</text>
            <text class="cat-title">{{ cat.title }}</text>
          </view>
          <text class="cat-count">{{ cat.items.length }} 项</text>
        </view>

        <!-- 分类内容（折叠/展开） -->
        <view class="cat-body" v-if="expandedCategories[idx]">
          <view v-for="(item, ii) in cat.items" :key="ii" class="ci-row">
            <text class="ci-dot">·</text>
            <text class="ci-text">{{ item }}</text>
          </view>
        </view>
        <view class="cat-collapsed-hint" v-else @tap="toggleCategory(idx)">
          <text class="hint-text">{{ cat.items.length }} 项更新 · 点击展开</text>
        </view>
      </view>
    </view>

    <view class="bottom-spacer" />
  </view>

  <!-- 未找到 -->
  <view class="empty-page" v-else>
    <text class="empty-text">未找到版本记录</text>
  </view>
</template>

<style scoped lang="scss">
.detail-page {
  min-height: 100vh;
  background: #F4F4F5;
  padding: 20rpx;
  padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

/* 版本头部 */
.version-header {
  background: #18181B;
  border-radius: 16rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
}

.vh-top {
  display: flex;
  align-items: baseline;
  gap: 16rpx;
  margin-bottom: 8rpx;
}

.vh-version {
  font-size: 36rpx;
  font-weight: 800;
  color: #FAFAFA;
  font-variant-numeric: tabular-nums;
}

.vh-date {
  font-size: 24rpx;
  color: #71717A;
}

.vh-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #D4D4D8;
  display: block;
  margin-bottom: 8rpx;
}

.vh-count {
  font-size: 22rpx;
  color: #71717A;
}

/* 分类列表 */
.cat-list {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.cat-card {
  background: #FFFFFF;
  border-radius: 14rpx;
  overflow: hidden;
  border: 1rpx solid #E4E4E7;
}

.cat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 24rpx;
}

.cat-left {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.cat-arrow {
  font-size: 32rpx;
  color: #A1A1AA;
  font-weight: 300;
  transition: transform 0.2s;
  transform: rotate(0deg);

  &.expanded {
    transform: rotate(90deg);
  }
}

.cat-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #18181B;
}

.cat-count {
  font-size: 22rpx;
  color: #A1A1AA;
  background: #F4F4F5;
  padding: 4rpx 14rpx;
  border-radius: 16rpx;
}

/* 分类内容 */
.cat-body {
  padding: 0 24rpx 20rpx;
  border-top: 1rpx solid #F4F4F5;
}

.ci-row {
  display: flex;
  gap: 10rpx;
  align-items: flex-start;
  padding: 10rpx 0;
}

.ci-dot {
  font-size: 30rpx;
  color: #A1A1AA;
  line-height: 1.4;
  flex-shrink: 0;
}

.ci-text {
  font-size: 25rpx;
  color: #52525B;
  line-height: 1.6;
  flex: 1;
}

/* 折叠提示 */
.cat-collapsed-hint {
  padding: 8rpx 24rpx 16rpx;
}

.hint-text {
  font-size: 22rpx;
  color: #A1A1AA;
}

.bottom-spacer { height: 40rpx; }

/* 空态 */
.empty-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #F4F4F5;
}

.empty-text {
  font-size: 28rpx;
  color: #A1A1AA;
}

/* 深色模式 */
@media (prefers-color-scheme: dark) {
  .detail-page { background: #09090B; }
  .version-header { background: #FAFAFA; }
  .vh-version { color: #18181B; }
  .vh-date { color: #71717A; }
  .vh-title { color: #52525B; }
  .vh-count { color: #71717A; }
  .cat-card { background: #18181B; border-color: #27272A; }
  .cat-arrow { color: #71717A; }
  .cat-title { color: #FAFAFA; }
  .cat-count { background: #27272A; color: #71717A; }
  .cat-body { border-top-color: #27272A; }
  .ci-dot { color: #71717A; }
  .ci-text { color: #A1A1AA; }
  .hint-text { color: #71717A; }
  .empty-page { background: #09090B; }
  .empty-text { color: #71717A; }
}
</style>
