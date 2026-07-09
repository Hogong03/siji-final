<script setup>
/**
 * 数据同步与导出 — 设置子页面
 */

import SijiIcon from '@/components/common/SijiIcon.vue'
import { ref, onMounted } from 'vue'
import { useAppStore } from '@/store/index.js'
import { trySync, getQueueLength } from '@/utils/sync.js'
import { post } from '@/utils/api.js'
import { exportJson, exportCsv, rebuildIndex } from '@/utils/storage.js'

const store = useAppStore()
const syncQueueLen = ref(0)

onMounted(() => {
  syncQueueLen.value = getQueueLength()
})

async function manualSync() {
  uni.showLoading({ title: '同步中...' })
  const result = await trySync(post)
  uni.hideLoading()
  syncQueueLen.value = getQueueLength()
  uni.showToast({ title: result.synced > 0 ? `已同步 ${result.synced} 条` : '没有待同步数据', icon: 'none' })
}

function doExport() {
  uni.showActionSheet({
    itemList: ['导出全部 (JSON)', '导出日记 (CSV)', '导出账单 (CSV)', '导出计划 (CSV)'],
    success(res) {
      if (res.tapIndex === 0) exportJsonFile()
      else exportCsvFile(['diary', 'bill', 'plan'][res.tapIndex - 1])
    }
  })
}

function exportJsonFile() {
  try {
    const json = exportJson()
    const d = JSON.parse(json)
    uni.setStorageSync('siji_export_json', json)
    uni.showToast({ title: `已导出: 日记${d.diaries.length} 账单${d.bills.length} 计划${d.plans.length}`, icon: 'success' })
  } catch (e) { uni.showToast({ title: e.message, icon: 'none' }) }
}

function exportCsvFile(type) {
  const csv = exportCsv(type)
  if (!csv) return uni.showToast({ title: '无数据', icon: 'none' })
  uni.setStorageSync(`siji_export_${type}_csv`, csv)
  uni.showToast({ title: `${({diary:'日记',bill:'账单',plan:'计划'})[type]} CSV 已导出`, icon: 'success' })
}

async function doRebuild() {
  uni.showLoading({ title: '构建中...' })
  try {
    const idx = rebuildIndex()
    let n = 0; Object.keys(idx).forEach(k => { if (k !== 'updatedAt' && typeof idx[k] === 'object') n += Object.keys(idx[k]).length })
    uni.hideLoading()
    uni.showToast({ title: `索引已重建（${n} 词条）`, icon: 'success' })
  } catch (e) { uni.hideLoading(); uni.showToast({ title: e.message, icon: 'none' }) }
}

function clearAll() {
  uni.showModal({
    title: '清除所有数据',
    content: '确定删除所有本地数据吗？不可撤销。',
    success(res) {
      if (res.confirm) {
        uni.clearStorageSync()
        store.restoreFromStorage()
        uni.showToast({ title: '已清除', icon: 'success' })
      }
    }
  })
}
</script>

<template>
  <view class="sub-page">
    <!-- 同步状态 -->
    <view class="card">
      <view class="card-title"><SijiIcon name="sync" size="sm" class="title-icon" /><text>同步状态</text></view>
      <view class="sync-row">
        <text class="sync-label">待同步队列</text>
        <text class="sync-value" :class="{ active: syncQueueLen > 0 }">{{ syncQueueLen }} 条</text>
      </view>
      <view class="btn-primary" @tap="manualSync">立即同步</view>
    </view>

    <!-- 数据导出 -->
    <view class="card">
      <view class="card-title"><SijiIcon name="export" size="sm" class="title-icon" /><text>数据导出</text></view>
      <text class="card-desc">将数据导出为 JSON 或 CSV 格式</text>
      <view class="btn-primary" @tap="doExport">选择导出格式</view>
    </view>

    <!-- 搜索索引 -->
    <view class="card">
      <view class="card-title"><SijiIcon name="search" size="sm" class="title-icon" /><text>搜索索引</text></view>
      <text class="card-desc">重建本地全文搜索索引，修复搜索异常</text>
      <view class="btn-outline" @tap="doRebuild">重建索引</view>
    </view>

    <!-- 危险操作 -->
    <view class="card danger-card">
      <text class="card-title danger-title">⚠️ 清除数据</text>
      <text class="card-desc">删除所有本地日记、账单、计划和配置</text>
      <view class="btn-danger" @tap="clearAll">清除所有本地数据</view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.sub-page {
  min-height: 100vh;
  background: var(--bg-page);
  padding: $spacing-md;
  box-sizing: border-box;
}

.card {
  background: var(--bg-card);
  border-radius: $radius-lg;
  padding: $spacing-md;
  margin-bottom: $spacing-md;
  box-shadow: $shadow-sm;
  box-sizing: border-box;
  overflow: hidden;

  .card-title { font-size: $font-md; font-weight: 700; color: var(--text-primary); display: block; margin-bottom: $spacing-sm; }
  .card-desc { font-size: $font-xs; color: var(--text-hint); display: block; margin-bottom: $spacing-md; }
}

.danger-card { border: 1rpx solid rgba(231, 76, 60, 0.2); }
.danger-title { color: $danger !important; }

.sync-row {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: $spacing-sm;
  .sync-label { font-size: $font-sm; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sync-value { font-size: $font-md; font-weight: 700; color: var(--text-hint); &.active { color: var(--color-plan); } flex-shrink: 0; margin-left: $spacing-sm; }
}

.btn-primary {
  width: 100%; padding: 20rpx 0; text-align: center; border-radius: $radius-md;
  background: var(--color-ai); color: var(--text-on-ai); font-size: $font-sm; font-weight: 600;
  box-sizing: border-box;
  &:active { opacity: 0.85; }
}
.btn-outline {
  width: 100%; padding: 20rpx 0; text-align: center; border-radius: $radius-md;
  border: 2rpx solid var(--color-ai); color: var(--color-ai); font-size: $font-sm; font-weight: 600;
  box-sizing: border-box;
  &:active { opacity: 0.85; }
}
.btn-danger {
  width: 100%; padding: 20rpx 0; text-align: center; border-radius: $radius-md;
  background: $danger; color: var(--text-on-ai); font-size: $font-sm; font-weight: 600;
  box-sizing: border-box;
  &:active { opacity: 0.85; }
}
</style>
