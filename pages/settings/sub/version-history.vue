<script setup>
/**
 * 版本历史列表页 — 按主版本分组折叠显示
 * 点击卡片进入 version-detail 子页面看完整变更
 */
import { ref, computed, onMounted } from 'vue'
import { getVersionHistory } from '@/utils/storage/version-history.js'
import { getVersion, isRunningOlderThan } from '@/utils/version-check.js'

const PREVIEW_COUNT = 5

const history = ref([])
const latestVersion = ref('')
// 4.0.1：这一行原来叫「当前版本」却显示日志最新条 —— 反馈里用户据此以为自己的版本低
const runningVersion = ref(getVersion())
const runningOutdated = computed(() => isRunningOlderThan(latestVersion.value))
// 展开状态：记录已展开的主版本号，最新组默认展开
const openMajors = ref([])
// 组内全量展开状态：记录已展开全部的主版本号
const allExpandedMajors = ref([])

// 按主版本号分组（version 第一个点前的数字），组按主版本降序
const groups = computed(() => {
  const majorMap = {}
  for (const item of history.value) {
    const major = String(item.version).split('.')[0]
    if (!majorMap[major]) majorMap[major] = []
    majorMap[major].push(item)
  }
  return Object.keys(majorMap).map((major) => {
    const items = majorMap[major]
    const newest = items[0].version
    const oldest = items[items.length - 1].version
    return {
      major,
      items,
      rangeText: newest === oldest ? `v${newest}` : `v${oldest} ~ v${newest}`,
    }
  }).sort((a, b) => Number(b.major) - Number(a.major))
})

onMounted(() => {
  history.value = getVersionHistory()
  latestVersion.value = history.value[0]?.version || ''
  const firstMajor = groups.value[0]?.major
  if (firstMajor) openMajors.value.push(firstMajor)
})

function isOpen(major) {
  return openMajors.value.includes(major)
}

function toggleGroup(major) {
  const idx = openMajors.value.indexOf(major)
  if (idx >= 0) {
    openMajors.value.splice(idx, 1)
  } else {
    openMajors.value.push(major)
  }
}

function isAllExpanded(major) {
  return allExpandedMajors.value.includes(major)
}

function toggleAll(major) {
  const idx = allExpandedMajors.value.indexOf(major)
  if (idx >= 0) {
    allExpandedMajors.value.splice(idx, 1)
  } else {
    allExpandedMajors.value.push(major)
  }
}

// 超过 5 条默认只显示最新 5 条，展开全部后显示组内全部
function visibleItems(group) {
  if (group.items.length <= PREVIEW_COUNT) return group.items
  if (isAllExpanded(group.major)) return group.items
  return group.items.slice(0, PREVIEW_COUNT)
}

function goDetail(version) {
  uni.navigateTo({ url: `/pages/settings/sub/version-detail?version=${version}` })
}
</script>

<template>
  <view class="version-page">
    <!-- 当前运行版本 -->
    <view class="current-banner">
      <view class="current-left">
        <text class="current-label">当前运行</text>
        <text class="current-version">v{{ runningVersion }}</text>
      </view>
      <text v-if="!runningOutdated" class="current-badge">最新</text>
      <text v-else class="current-badge current-badge-old">日志已到 v{{ latestVersion }}</text>
    </view>

    <!-- 跑的是旧构建时直说，并给出下一步 -->
    <view v-if="runningOutdated" class="outdated-hint">
      <text class="outdated-hint-text">你正在运行旧构建（v{{ runningVersion }}）。在 HBuilder X 里删掉 unpackage/dist 重新编译，并覆盖安装到手机后再看这里 → 显示 v{{ latestVersion }} 才算更新成功。</text>
    </view>

    <!-- 版本分组列表 -->
    <view class="version-list">
      <view v-for="group in groups" :key="group.major" class="version-group">
        <!-- 分组折叠头 -->
        <view class="group-head" @tap="toggleGroup(group.major)">
          <view class="g-caret" :class="{ open: isOpen(group.major) }">
            <text>›</text>
          </view>
          <view class="g-info">
            <text class="g-name">v{{ group.major }} 系列</text>
            <text class="g-range">{{ group.rangeText }}</text>
          </view>
          <text class="g-count">{{ group.items.length }} 条</text>
        </view>

        <!-- 组内版本卡片 -->
        <view v-if="isOpen(group.major)" class="group-body">
          <view
            v-for="item in visibleItems(group)"
            :key="item.version"
            class="v-card"
            :class="{ latest: item.version === latestVersion }"
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

          <!-- 组内展开全部 -->
          <view v-if="group.items.length > PREVIEW_COUNT" class="group-more" @tap="toggleAll(group.major)">
            <text>{{ isAllExpanded(group.major) ? '收起' : '展开全部' }}</text>
          </view>
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

/* 4.0.1：运行版本落后于日志时的徽标与提示条 */
.current-badge-old {
  background: #E4E4E7;
  color: #18181B;
}

.outdated-hint {
  margin: 16rpx 0 4rpx;
  padding: 20rpx 24rpx;
  background: #F4F4F5;
  border-radius: 12rpx;
}

.outdated-hint-text {
  font-size: 24rpx;
  line-height: 1.6;
  color: #3F3F46;
}

/* 版本分组 */
.version-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.version-group {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.group-head {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 24rpx;
  background: #FFFFFF;
  border: 1rpx solid #E4E4E7;
  border-radius: 14rpx;
}

.g-caret {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32rpx;
  height: 32rpx;
  font-size: 30rpx;
  font-weight: 300;
  color: #A1A1AA;
  transform: rotate(0deg);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.g-caret.open {
  transform: rotate(90deg);
}

.g-info {
  display: flex;
  flex-direction: column;
  gap: 2rpx;
  flex: 1;
  min-width: 0;
}

.g-name {
  font-size: 28rpx;
  font-weight: 700;
  color: #18181B;
}

.g-range {
  font-size: 20rpx;
  color: #A1A1AA;
}

.g-count {
  font-size: 22rpx;
  color: #71717A;
  font-variant-numeric: tabular-nums;
}

.group-body {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

/* 版本卡片 */
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

/* 展开全部 */
.group-more {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20rpx;
  background: #FFFFFF;
  border: 1rpx solid #E4E4E7;
  border-radius: 14rpx;
}

.group-more text {
  font-size: 24rpx;
  color: #52525B;
}

.bottom-spacer { height: 40rpx; }

/* 深色模式 */
@media (prefers-color-scheme: dark) {
  .version-page { background: #09090B; }
  .current-banner { background: #FAFAFA; }
  .current-label { color: #71717A; }
  .current-version { color: #18181B; }
  .current-badge { background: #18181B; color: #FAFAFA; }
  .current-badge-old { background: #27272A; color: #FAFAFA; }
  .outdated-hint { background: #18181B; }
  .outdated-hint-text { color: #A1A1AA; }
  .group-head { background: #18181B; border-color: #27272A; }
  .g-caret { color: #71717A; }
  .g-name { color: #FAFAFA; }
  .g-range { color: #71717A; }
  .g-count { color: #71717A; }
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
  .group-more { background: #18181B; border-color: #27272A; }
  .group-more text { color: #A1A1AA; }
}
</style>
