<script setup>
/**
 * 数据管理 — 设置子页面
 * 同步功能已移除，仅保留导出/索引/清除
 */

import SijiIcon from '@/components/common/SijiIcon.vue'
import { ref } from 'vue'
import { useAppStore } from '@/store/index.js'
import { exportCsv, rebuildIndex, exportBackupJson, parseBackup, importBackup } from '@/utils/storage.js'
import { saveBackupToFile, buildBackupFileName } from '@/utils/backup-file.js'
import { getVersion } from '@/utils/version-check.js'

const store = useAppStore()

/* ---- 备份：保存文件（全量）/ 分份复制（防微信粘贴超长崩溃） ---- */
const SECTION_META = {
  life: { label: '生活数据与设置', scope: '记录/账单/计划/关系/决策/标签' },
  ai: { label: 'AI 记忆与画像', scope: '长期记忆/我的信息/Agent' },
  chat: { label: '聊天记录', scope: '全部对话内容（通常最大）' }
}

/* 单次复制体积上限（UTF-8 字节估算）：微信粘贴超长文本会崩溃，超限请改用文件 */
const SECTION_LIMIT_BYTES = {
  life: 800 * 1024,
  ai: 800 * 1024,
  chat: 300 * 1024
}

function doBackup() {
  uni.showActionSheet({
    itemList: ['保存为文件（推荐）', '分份复制到剪贴板'],
    success(res) {
      if (res.tapIndex === 0) backupToFile()
      else pickSectionToCopy()
    }
  })
}

function pickSectionToCopy() {
  const ids = Object.keys(SECTION_META)
  uni.showActionSheet({
    itemList: ids.map(id => SECTION_META[id].label + '（' + SECTION_META[id].scope + '）'),
    success(res) {
      copySection(ids[res.tapIndex])
    }
  })
}

function buildBackupText(section) {
  try {
    return exportBackupJson({ version: 'v' + getVersion(), section })
  } catch (e) {
    uni.showToast({ title: '备份失败: ' + (e.message || e), icon: 'none' })
    return null
  }
}

function utf8Bytes(str) {
  let bytes = 0
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    if (code < 0x80) bytes += 1
    else if (code < 0x800) bytes += 2
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      bytes += 4
      i += 1
    } else bytes += 3
  }
  return bytes
}

function formatKB(bytes) {
  return bytes >= 1024 ? (bytes / 1024).toFixed(1) + ' KB' : bytes + ' B'
}

function copySection(section) {
  const meta = SECTION_META[section]
  const json = buildBackupText(section)
  if (json == null) return
  const bytes = utf8Bytes(json)
  if (bytes > SECTION_LIMIT_BYTES[section]) {
    uni.showModal({
      title: meta.label + '备份过大（' + formatKB(bytes) + '）',
      content: '超出微信安全粘贴范围，请改用「保存为文件」备份；若必须经微信发送，建议先清理部分旧聊天记录。',
      showCancel: false,
      confirmText: '知道了'
    })
    return
  }
  uni.setClipboardData({
    data: json,
    success: () => {
      uni.showModal({
        title: meta.label + '备份已复制',
        content: '体积约 ' + formatKB(bytes) + '，请到微信「文件传输助手」粘贴保存。\n还需发送其他部分时，返回后再次点击「备份全部数据 → 分份复制到剪贴板」。',
        showCancel: false,
        confirmText: '知道了'
      })
    },
    fail: () => uni.showToast({ title: '复制失败，请重试', icon: 'none' })
  })
}

function backupToFile() {
  const json = buildBackupText()
  if (json == null) return
  uni.showLoading({ title: '生成备份中...' })
  saveBackupToFile(json, buildBackupFileName()).then((r) => {
    uni.hideLoading()
    if (r.ok) {
      const content = r.path
        ? '文件：' + r.path + '\nApp 端位于应用私有目录；要发到微信请选「分份复制到剪贴板」。'
        : '已开始下载：' + (r.path || '')
      uni.showModal({ title: '备份已保存', content, showCancel: false, confirmText: '知道了' })
    } else {
      uni.showToast({ title: r.message || '保存失败，请改用复制', icon: 'none' })
    }
  })
}

/* ---- 从备份恢复（分域备份自动合并写入） ---- */
const restoreText = ref('')
const restoring = ref(false)

function sectionLabel(section) {
  return (SECTION_META[section] || {}).label || section
}

function doRestore() {
  const text = restoreText.value
  if (!text.trim()) {
    uni.showToast({ title: '请先粘贴备份内容', icon: 'none' })
    return
  }
  // 先校验再弹确认，避免无效内容进入覆盖流程
  let parsed
  try {
    parsed = parseBackup(text)
  } catch (e) {
    uni.showToast({ title: e.message, icon: 'none' })
    return
  }
  const itemCount = Object.keys(parsed.storage).length
  const section = parsed.meta && parsed.meta.section ? parsed.meta.section : 'all'
  const merge = section !== 'all'
  uni.showModal({
    title: merge ? '恢复分域备份' : '恢复备份',
    content: merge
      ? '这是「' + sectionLabel(section) + '」分域备份（' + itemCount + ' 个数据项），将合并写入该部分、不清除其他数据；分域备份需逐份粘贴恢复。确定继续吗？'
      : '将清空当前全部数据并写入备份内容（' + itemCount + ' 个数据项），原数据不可恢复，确定继续吗？',
    confirmText: '恢复',
    confirmColor: '#000000',
    success(res) {
      if (!res.confirm) return
      restoreFromText(text, merge)
    }
  })
}

function restoreFromText(text, merge) {
  restoring.value = true
  uni.showLoading({ title: '恢复中...' })
  try {
    if (!merge) uni.clearStorageSync()
    const r = importBackup(text)
    uni.hideLoading()
    restoring.value = false
    restoreText.value = ''
    const tip = merge
      ? '已写入 ' + r.total + ' 个数据项（跳过 ' + r.skipped + ' 个无效项）。\n还有分域备份时请继续粘贴下一份；全部完成后重启 App 并重新配置 AI Key。'
      : '已写入 ' + r.total + ' 个数据项（跳过 ' + r.skipped + ' 个无效项）。\n请重启 App 使全部模块加载新数据，并重新配置 AI 厂商 Key。'
    uni.showModal({
      title: merge ? '合并完成' : '恢复完成',
      content: tip,
      showCancel: false,
      confirmText: '知道了'
    })
  } catch (e) {
    uni.hideLoading()
    restoring.value = false
    uni.showToast({ title: '恢复失败: ' + (e.message || e), icon: 'none' })
  }
}

function doExportCsv() {
  uni.showActionSheet({
    itemList: ['导出记录 (CSV)', '导出账单 (CSV)', '导出计划 (CSV)'],
    success(res) {
      const type = ['diary', 'bill', 'plan'][res.tapIndex]
      exportCsvFile(type)
    }
  })
}

function exportCsvFile(type) {
  const csv = exportCsv(type)
  if (!csv) return uni.showToast({ title: '无数据', icon: 'none' })
  uni.setClipboardData({
    data: csv,
    success: () => uni.showToast({ title: `${({diary:'记录',bill:'账单',plan:'计划'})[type]} CSV 已复制`, icon: 'success' }),
    fail: () => uni.showToast({ title: '复制失败', icon: 'none' })
  })
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
    <!-- 数据备份 -->
    <view class="card">
      <view class="card-title"><SijiIcon name="export" size="sm" class="title-icon" /><text>数据备份</text></view>
      <text class="card-desc">全量备份：记录、账单、计划、记忆、画像、对话、关系等全部本地数据（不含 API Key 与应用锁）。微信粘贴超长文本会崩溃：优先「保存为文件」，跨微信发送请选「分份复制到剪贴板」</text>
      <view class="btn-primary" @tap="doBackup">备份全部数据</view>
      <view class="btn-outline btn-csv" @tap="doExportCsv">导出 CSV 报表（记录/账单/计划）</view>
    </view>

    <!-- 从备份恢复 -->
    <view class="card">
      <view class="card-title"><SijiIcon name="download" size="sm" class="title-icon" /><text>恢复备份</text></view>
      <text class="card-desc">粘贴备份文本（跨设备时：微信传文件 → 复制 → 粘贴到此处）。全量备份覆盖当前数据；分域备份自动合并写入对应部分。</text>
      <textarea
        v-model="restoreText"
        class="restore-input"
        placeholder="在此粘贴 siji-backup JSON 备份内容..."
        :maxlength="-1"
        auto-height
      />
      <view class="btn-danger" @tap="doRestore">校验并恢复</view>
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
      <text class="card-desc">删除所有本地记录、账单、计划和配置</text>
      <view class="btn-danger" @tap="clearAll">清除所有本地数据</view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.sub-page {
  min-height: 100vh;
  background: #FAFAFA;
  padding: $spacing-md;
  box-sizing: border-box;
}

.card {
  background: #FFFFFF;
  border-radius: $radius-lg;
  padding: $spacing-md;
  margin-bottom: $spacing-md;
  box-shadow: none;
  box-sizing: border-box;
  overflow: hidden;

  .card-title { font-size: $font-md; font-weight: 700; color: #18181B; display: block; margin-bottom: $spacing-sm; }
  .card-desc { font-size: $font-xs; color: #A1A1AA; display: block; margin-bottom: $spacing-md; }
}

.danger-card { border: 1rpx solid rgba(231, 76, 60, 0.2); }
.danger-title { color: $danger !important; }

.btn-primary {
  width: 100%; padding: 20rpx 0; text-align: center; border-radius: $radius-md;
  background: #000000; color: #FFFFFF; font-size: $font-sm; font-weight: 600;
  box-sizing: border-box;
  &:active { opacity: 0.85; }
}

/* 备份卡 CSV 按钮间距 */
.btn-csv {
  margin-top: 16rpx;
}

/* 恢复备份粘贴区 */
.restore-input {
  width: 100%;
  min-height: 160rpx;
  background: #F4F4F5;
  border-radius: 12rpx;
  padding: 20rpx;
  font-size: 24rpx;
  color: #18181B;
  box-sizing: border-box;
  margin-bottom: 20rpx;
}
.btn-outline {
  width: 100%; padding: 20rpx 0; text-align: center; border-radius: $radius-md;
  border: 2rpx solid #000000; color: #000000; font-size: $font-sm; font-weight: 600;
  box-sizing: border-box;
  &:active { opacity: 0.85; }
}
.btn-danger {
  width: 100%; padding: 20rpx 0; text-align: center; border-radius: $radius-md;
  background: $danger; color: #FFFFFF; font-size: $font-sm; font-weight: 600;
  box-sizing: border-box;
  &:active { opacity: 0.85; }
}
</style>
