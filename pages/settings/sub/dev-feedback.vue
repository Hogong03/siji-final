<script setup>
/**
 * 开发者反馈 — 提取聊天记录，反馈给开发者（Codex）定位 Bug / 优化功能
 *
 * 功能：
 *  ① 选择导出范围（自动选择 / 自由选择 / 全部会话）
 *  ② 格式选择（Markdown / JSON）+ 是否包含 AI 执行动作
 *  ③ 实时统计与预览
 *  ④ 复制到剪贴板（全端）
 *  ⑤ 保存为文件（App 存 _doc/feedback/，H5 浏览器下载，小程序用剪贴板）
 */
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import SijiIcon from '@/components/common/SijiIcon.vue'
import { useAppStore } from '@/store/index.js'
import { getVersion } from '@/utils/version-check.js'
import {
  buildDevFeedbackMarkdown,
  buildDevFeedbackJson,
  summarizeConversation,
  selectIssueConversations,
  selectKeyMessages,
  getMessageIssue
} from '@/utils/dev-feedback.js'

const store = useAppStore()

const scope = ref('auto') // auto=自动选择 custom=自由选择 all=全部会话
const format = ref('markdown') // markdown / json
const includeActions = ref(true)

const previewLimit = 2000
const copied = ref(false)
const saving = ref(false)

/* ---- 自由选择状态 ---- */
const expandedConvId = ref(null) // 展开的会话 id（custom 模式）
const selectedMsgKeys = ref({}) // `convId:index` → true，消息勾选状态唯一来源
const msgKey = (convId, idx) => convId + ':' + idx
const convSelected = (conv) => (conv.messages || []).some((m, i) => !!selectedMsgKeys.value[msgKey(conv.id, i)])
const convMsgSelectedCount = (conv) => (conv.messages || []).filter((m, i) => !!selectedMsgKeys.value[msgKey(conv.id, i)]).length

/** 进入自由选择：无任何勾选时默认勾选当前会话，无当前会话则勾选第一个 */
function enterCustom() {
  scope.value = 'custom'
  if (Object.keys(selectedMsgKeys.value).length > 0) return
  const list = store.conversations || []
  const target = store.activeConversation || list[0]
  if (target) {
    (target.messages || []).forEach((m, i) => { selectedMsgKeys.value[msgKey(target.id, i)] = true })
  }
}

/** 勾选/取消会话（全选 / 全不选该会话消息） */
function toggleConv(conv) {
  const on = !convSelected(conv)
  ;(conv.messages || []).forEach((m, i) => {
    const k = msgKey(conv.id, i)
    if (on) selectedMsgKeys.value[k] = true
    else delete selectedMsgKeys.value[k]
  })
}

/** 勾选/取消单条消息 */
function toggleMsg(conv, idx) {
  const k = msgKey(conv.id, idx)
  if (selectedMsgKeys.value[k]) delete selectedMsgKeys.value[k]
  else selectedMsgKeys.value[k] = true
}

/** 全选 / 清空 */
function selectAllCustom() {
  ;(store.conversations || []).forEach(c => (c.messages || []).forEach((m, i) => { selectedMsgKeys.value[msgKey(c.id, i)] = true }))
}
function clearCustom() {
  selectedMsgKeys.value = {}
}

/** 消息列表预览文本：截断 + 图片标识 */
function msgPreview(m) {
  const img = m.image ? '（图片） ' : ''
  const raw = typeof m.content === 'string' ? m.content : (m.content ? JSON.stringify(m.content) : '')
  const t = raw.replace(/\s+/g, ' ').trim()
  return img + (t.length > 60 ? t.slice(0, 60) + '…' : t)
}

/** 导出会话：按 scope 生成待导出会话与消息 */
const exportConversations = computed(() => {
  const list = store.conversations || []
  if (scope.value === 'all') return list
  if (scope.value === 'custom') {
    return list
      .filter(c => convSelected(c))
      .map(c => ({ ...c, messages: (c.messages || []).filter((m, i) => !!selectedMsgKeys.value[msgKey(c.id, i)]) }))
  }
  // auto — 自动选择问题会话（异常消息多的优先），无异常时退回当前会话
  const picked = selectIssueConversations(list, { limit: 3 })
  const convs = picked.length > 0 ? picked.map(p => p.conv) : (store.activeConversation ? [store.activeConversation] : list.slice(0, 1))
  return convs.map(conv => ({ ...conv, messages: selectKeyMessages(conv, {}) }))
})

const summaries = computed(() => {
  if (scope.value === 'custom') return (store.conversations || []).map(summarizeConversation)
  return exportConversations.value.map(summarizeConversation)
})

const stats = computed(() => {
  const list = exportConversations.value
  const msgCount = list.reduce((s, c) => s + (Array.isArray(c.messages) ? c.messages.length : 0), 0)
  const issueCount = list.reduce((s, c) => s + (Array.isArray(c.messages) ? c.messages.filter(getMessageIssue).length : 0), 0)
  return { convCount: list.length, msgCount, issueCount }
})

const meta = computed(() => {
  const sys = (() => {
    try { return uni.getSystemInfoSync() } catch { return {} }
  })()
  return {
    exportedAt: new Date().toLocaleString(),
    appVersion: 'v' + getVersion(),
    platform: sys.platform || 'unknown',
    deviceModel: (sys.brand ? sys.brand + ' ' : '') + (sys.model || ''),
    model: store.modelName || store.modelLabel || ''
  }
})

const outputText = computed(() => {
  const opts = { includeActions: includeActions.value, meta: meta.value }
  const source = exportConversations.value
  return format.value === 'json'
    ? buildDevFeedbackJson(source, opts)
    : buildDevFeedbackMarkdown(source, opts)
})

const previewText = computed(() => {
  const t = outputText.value
  return t.length > previewLimit ? t.slice(0, previewLimit) + '\n\n…（预览截断，导出内容完整）' : t
})

const charCount = computed(() => outputText.value.length)

function copyOutput() {
  if (!outputText.value) {
    uni.showToast({ title: '没有可导出的内容', icon: 'none' })
    return
  }
  uni.setClipboardData({
    data: outputText.value,
    success: () => {
      copied.value = true
      uni.showToast({ title: '已复制，粘贴给开发者即可', icon: 'success' })
      setTimeout(() => { copied.value = false }, 2000)
    },
    fail: () => {
      uni.showToast({ title: '复制失败，请重试', icon: 'none' })
    }
  })
}

function buildFileName() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  const stamp = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds())
  return 'siji-feedback-' + stamp + (format.value === 'json' ? '.json' : '.md')
}

function saveToFile() {
  if (!outputText.value) {
    uni.showToast({ title: '没有可导出的内容', icon: 'none' })
    return
  }
  if (saving.value) return
  saving.value = true
  const fileName = buildFileName()
  // #ifdef APP-PLUS
  saveAppFile(outputText.value, fileName).then((path) => {
    uni.showModal({
      title: '已保存',
      content: '文件位置：' + path + '\n可通过文件管理发送给开发者',
      showCancel: false,
      confirmText: '知道了'
    })
  }).catch((err) => {
    uni.showToast({ title: '保存失败: ' + (err.message || err), icon: 'none' })
  }).finally(() => {
    saving.value = false
  })
  // #endif
  // #ifdef H5
  try {
    const blob = new Blob([outputText.value], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    uni.showToast({ title: '已开始下载', icon: 'success' })
  } catch (err) {
    uni.showToast({ title: '下载失败，请用复制', icon: 'none' })
  } finally {
    saving.value = false
  }
  // #endif
  // #ifndef APP-PLUS || H5
  saving.value = false
  uni.showToast({ title: '请使用复制按钮导出', icon: 'none' })
  // #endif
}

function saveAppFile(text, name) {
  return new Promise((resolve, reject) => {
    if (!plus || !plus.io) {
      reject(new Error('当前环境不支持文件写入'))
      return
    }
    plus.io.requestFileSystem(plus.io.PRIVATE_DOC, (fs) => {
      fs.root.getDirectory('feedback', { create: true }, (dir) => {
        dir.getFile(name, { create: true }, (fileEntry) => {
          fileEntry.createWriter((writer) => {
            writer.onwrite = () => resolve(fileEntry.fullPath)
            writer.onerror = (e) => reject(new Error('写入失败'))
            writer.write(text)
          }, (e) => reject(e))
        }, (e) => reject(e))
      }, (e) => reject(e))
    }, (e) => reject(e))
  })
}

onShow(() => { copied.value = false })
</script>

<template>
  <view class="dev-feedback-page">
    <view class="intro">
      <text class="intro-text">把聊天记录提取出来反馈给开发者，用于定位 Bug 或优化功能。导出内容不含图片本体与 API Key。</text>
    </view>

    <!-- 导出范围 -->
    <view class="section">
      <text class="section-title">导出范围</text>
      <view class="chip-row">
        <view class="chip" :class="{ active: scope === 'auto' }" @tap="scope = 'auto'">
          <text>自动选择（推荐）</text>
        </view>
        <view class="chip" :class="{ active: scope === 'custom' }" @tap="enterCustom">
          <text>自由选择</text>
        </view>
        <view class="chip" :class="{ active: scope === 'all' }" @tap="scope = 'all'">
          <text>全部会话</text>
        </view>
      </view>
      <view v-if="scope === 'auto'" class="auto-hint">
        <text class="auto-hint-text">已自动选中 {{ stats.convCount }} 个会话·{{ stats.issueCount }} 条异常消息，仅导出问题前后上下文</text>
      </view>
      <view v-if="scope === 'custom'" class="auto-hint">
        <text class="auto-hint-text">已选 {{ stats.convCount }} 个会话·{{ stats.msgCount }} 条消息，勾选会话或展开逐条选择</text>
      </view>
      <view v-if="scope === 'custom'" class="custom-panel">
        <view class="custom-toolbar">
          <view class="custom-btn" @tap="selectAllCustom">全选</view>
          <view class="custom-btn" @tap="clearCustom">清空</view>
        </view>
        <view v-if="(store.conversations || []).length > 0" class="conv-list">
          <view v-for="c in store.conversations || []" :key="c.id" class="conv-item conv-item-expandable">
            <view class="conv-row">
              <view class="conv-check" :class="{ on: convSelected(c) }" @tap="toggleConv(c)">
                <text class="conv-check-mark">{{ convSelected(c) ? '✓' : '' }}</text>
              </view>
              <view class="conv-main" @tap="expandedConvId = expandedConvId === c.id ? null : c.id">
                <text class="conv-title">{{ c.title || '未命名对话' }}</text>
                <text class="conv-meta">{{ convMsgSelectedCount(c) }}/{{ (c.messages || []).length }} 条消息</text>
              </view>
              <text class="conv-arrow">{{ expandedConvId === c.id ? '▴' : '▾' }}</text>
            </view>
            <view v-if="expandedConvId === c.id" class="msg-list">
              <view v-for="(m, mi) in c.messages || []" :key="mi" class="msg-item" @tap="toggleMsg(c, mi)">
                <view class="conv-check" :class="{ on: !!selectedMsgKeys[msgKey(c.id, mi)] }">
                  <text class="conv-check-mark">{{ selectedMsgKeys[msgKey(c.id, mi)] ? '✓' : '' }}</text>
                </view>
                <text class="msg-role" :class="m.role === 'user' ? 'msg-role-user' : 'msg-role-ai'">{{ m.role === 'user' ? '用户' : 'AI' }}</text>
                <text class="msg-text">{{ msgPreview(m) }}</text>
              </view>
            </view>
          </view>
        </view>
        <text v-else class="empty-tip">暂无可导出的会话</text>
      </view>
      <view v-if="scope !== 'custom' && summaries.length > 0" class="conv-list">
        <view v-for="(s, i) in summaries.slice(0, 5)" :key="i" class="conv-item">
          <text class="conv-title">{{ s.title }}</text>
          <text class="conv-meta">{{ s.messageCount }} 条消息</text>
        </view>
        <text v-if="summaries.length > 5" class="conv-more">…共 {{ summaries.length }} 个会话</text>
      </view>
      <text v-else-if="scope !== 'custom'" class="empty-tip">暂无可导出的会话</text>
    </view>

    <!-- 格式与选项 -->
    <view class="section">
      <text class="section-title">格式与选项</text>
      <view class="chip-row">
        <view class="chip" :class="{ active: format === 'markdown' }" @tap="format = 'markdown'">
          <text>Markdown（推荐）</text>
        </view>
        <view class="chip" :class="{ active: format === 'json' }" @tap="format = 'json'">
          <text>JSON</text>
        </view>
      </view>
      <view class="option-row" @tap="includeActions = !includeActions">
        <text class="option-label">包含 AI 执行动作（记账/建计划等）</text>
        <text class="option-switch" :class="{ on: includeActions }">{{ includeActions ? '开' : '关' }}</text>
      </view>
    </view>

    <!-- 统计 -->
    <view class="section">
      <text class="section-title">导出统计</text>
      <view class="stat-row">
        <view class="stat-item">
          <text class="stat-num">{{ stats.convCount }}</text>
          <text class="stat-label">会话</text>
        </view>
        <view class="stat-item">
          <text class="stat-num">{{ stats.msgCount }}</text>
          <text class="stat-label">消息</text>
        </view>
        <view class="stat-item">
          <text class="stat-num">{{ charCount }}</text>
          <text class="stat-label">字符</text>
        </view>
      </view>
    </view>

    <!-- 预览 -->
    <view class="section">
      <view class="preview-header">
        <text class="section-title">预览</text>
        <text class="preview-hint">最多显示前 {{ previewLimit }} 字符</text>
      </view>
      <scroll-view class="preview-box" scroll-y>
        <text class="preview-text">{{ previewText }}</text>
      </scroll-view>
    </view>

    <!-- 操作按钮 -->
    <view class="action-row">
      <button class="btn-primary" :disabled="saving" @tap="copyOutput">
        <SijiIcon name="copy" size="sm" color="#FFFFFF" />
        <text class="btn-text">{{ copied ? '已复制 ✓' : '复制到剪贴板' }}</text>
      </button>
      <button class="btn-secondary" :disabled="saving" @tap="saveToFile">
        <SijiIcon name="download" size="sm" />
        <text class="btn-text">保存为文件</text>
      </button>
    </view>

    <view style="height: 80rpx" />
  </view>
</template>

<style lang="scss" scoped>
@import './dev-feedback.scss';
</style>
