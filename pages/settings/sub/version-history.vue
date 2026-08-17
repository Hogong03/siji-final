<script setup>
/**
 * 版本历史列表页 — 只显示核心摘要
 * 点击进入 version-detail 子页面看完整变更
 */
import { ref, onMounted } from 'vue'
import { getVersionHistory } from '@/utils/storage/version-history.js'

const history = ref([])
const latestVersion = ref('')

onMounted(() => {
  history.value = getVersionHistory()
  latestVersion.value = history.value[0]?.version || ''
})

function goDetail(version) {
  uni.navigateTo({ url: `/pages/settings/sub/version-detail?version=${version}` })
}
</script>

<template>
  <view class="version-page">
    <!-- 当前版本标识 -->
    <view class="current-banner">
      <view class="current-left">
        <text class="current-label">当前版本</text>
        <text class="current-version">v{{ latestVersion }}</text>
      </view>
      <text class="current-badge">最新</text>
    </view>

    <!-- 版本列表 -->
    <view class="version-list">
      <view
        v-for="(item, idx) in history"
        :key="idx"
        class="v-card"
        :class="{ latest: idx === 0 }"
        @tap="goDetail(item.version)"
      >
        <view class="v-top">
          <text class="v-version">v{{ item.version }}</text>
          <text class="v-date">{{ item.date }}</text>
        </view>
        <text class="v-title">{{ item.title }}</text>
        <view class="v-summary">
          <view v-for="(s, si) in (item.summary || []).slice(0, 3)" :key="si" class="s-item">
            <text class="s-dot">·</text>
            <text class="s-text">{{ s }}</text>
          </view>
        </view>
        <view class="v-footer">
          <text class="v-count">{{ (item.categories || []).reduce((n, c) => n + c.items.length, 0) }} 项更新</text>
          <text class="v-arrow">›</text>
        </view>
      </view>
    </view>

    <view class="bottom-spacer" />
  </view>
</template>

<style scoped lang="scss">
.version-page {
  min-height: 100vh;
  background: #F4F4F5;
  padding: 20rpx;
  padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

/* 当前版本 */
.current-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 28rpx;
  background: #18181B;
  border-radius: 16rpx;
  margin-bottom: 20rpx;
}

.current-left {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
}

.current-label {
  font-size: 24rpx;
  color: #A1A1AA;
}

.current-version {
  font-size: 34rpx;
  color: #FAFAFA;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.current-badge {
  font-size: 22rpx;
  color: #18181B;
  background: #FAFAFA;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  font-weight: 600;
}

/* 版本卡片 */
.version-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.v-card {
  background: #FFFFFF;
  border-radius: 14rpx;
  padding: 20rpx 24rpx;
  border: 1rpx solid #E4E4E7;
}

.v-card.latest {
  border-color: #18181B;
  border-width: 2rpx;
}

.v-top {
  display: flex;
  align-items: baseline;
  gap: 16rpx;
  margin-bottom: 4rpx;
}

.v-version {
  font-size: 30rpx;
  font-weight: 700;
  color: #18181B;
  font-variant-numeric: tabular-nums;
}

.v-date {
  font-size: 22rpx;
  color: #A1A1AA;
}

.v-title {
  font-size: 26rpx;
  font-weight: 600;
  color: #3F3F46;
  display: block;
  margin-bottom: 12rpx;
}

/* 摘要 */
.v-summary {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.s-item {
  display: flex;
  gap: 8rpx;
  align-items: flex-start;
}

.s-dot {
  font-size: 28rpx;
  color: #A1A1AA;
  line-height: 1.4;
  flex-shrink: 0;
}

.s-text {
  font-size: 24rpx;
  color: #52525B;
  line-height: 1.5;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 底部 */
.v-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid #F4F4F5;
}

.v-count {
  font-size: 22rpx;
  color: #A1A1AA;
}

.v-arrow {
  font-size: 28rpx;
  color: #A1A1AA;
  font-weight: 300;
}

.bottom-spacer { height: 40rpx; }

/* 深色模式 */
@media (prefers-color-scheme: dark) {
  .version-page { background: #09090B; }
  .current-banner { background: #FAFAFA; }
  .current-label { color: #71717A; }
  .current-version { color: #18181B; }
  .current-badge { background: #18181B; color: #FAFAFA; }
  .v-card { background: #18181B; border-color: #27272A; }
  .v-card.latest { border-color: #FAFAFA; }
  .v-version { color: #FAFAFA; }
  .v-date { color: #71717A; }
  .v-title { color: #F4F4F5; }
  .s-dot { color: #71717A; }
  .s-text { color: #A1A1AA; }
  .v-footer { border-top-color: #27272A; }
  .v-count { color: #71717A; }
  .v-arrow { color: #71717A; }
}
</style>
