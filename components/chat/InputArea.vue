<script setup>
import SijiIcon from '@/components/common/SijiIcon.vue'
/**
 * 输入区组件 — v8
 *
 * 核心设计：
 *  - 每个标签段 = chip + 内联文本，所有段在同一个输入框容器内流式排列
 *  - chip 显示图标+功能名+× 删除
 *  - 非编辑段：chip 后面显示文本摘要（灰色只读）
 *  - 编辑段（当前激活）：chip 后面接一个 inline input 可编辑
 *  - 无标签时：末尾有一个 inline input 可自由输入
 *  - 点击 chip → 切换到该段编辑
 *  - 点击 × → 删除整段
 *  - 语音按钮：长按录音，实时转写填入输入框
 */
import { ref, watch, computed, nextTick } from 'vue'
import { isVoiceSupport, startRecord, stopRecord, cancelRecord } from '@/utils/voice.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  isSending: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'send', 'stop'])

const quickActions = [
  { key: 'bill',  text: '记账', icon: '¥', tag: '记账',  placeholder: '如：午饭花了35' },
  { key: 'diary', text: '日记', icon: '✎', tag: '日记',  placeholder: '如：今天心情不错' },
  { key: 'plan',  text: '计划', icon: '✓', tag: '计划',  placeholder: '如：下周完成报告' },
  { key: 'query', text: '查询', icon: '?', tag: '查询',  placeholder: '如：这个月花了多少' }
]

let segSeq = 0
const segments = ref([])
const activeUid = ref(null)
const freeText = ref('')
const inputRefs = ref({})

// ==================== 语音状态 ====================
const voiceSupported = isVoiceSupport()
const isRecording = ref(false)
const voiceText = ref('') // 语音转写的累积文本
const voiceStatus = ref('') // connecting / recording / stopped
const voiceDuration = ref(0) // 录音时长（毫秒）
const voiceError = ref('') // 语音错误信息

// ==================== 快捷按钮 ====================
function addSegment(action) {
  const seg = { uid: ++segSeq, key: action.key, icon: action.icon, tag: action.tag, text: '' }
  segments.value.push(seg)
  activeUid.value = seg.uid
  nextTick(() => focusInput(seg.uid))
}

// ==================== 输入同步 ====================
function onSegInput(uid, e) {
  const seg = segments.value.find(s => s.uid === uid)
  if (!seg) return
  // #ifdef H5
  seg.text = e.target?.value ?? e.detail?.value ?? ''
  // #endif
  // #ifndef H5
  seg.text = e.detail?.value ?? ''
  // #endif
}

function onFreeInput(e) {
  // #ifdef H5
  freeText.value = e.target?.value ?? e.detail?.value ?? ''
  // #endif
  // #ifndef H5
  freeText.value = e.detail?.value ?? ''
  // #endif
  emit('update:modelValue', freeText.value)
}

// ==================== 切换编辑段 ====================
function editSegment(uid) { activeUid.value = uid; nextTick(() => focusInput(uid)) }
function editFree() { activeUid.value = null; nextTick(() => focusInput('free')) }

// ==================== 删除段 ====================
function removeSegment(uid) {
  const idx = segments.value.findIndex(s => s.uid === uid)
  if (idx < 0) return
  segments.value.splice(idx, 1)
  if (activeUid.value === uid) { activeUid.value = null; nextTick(() => focusInput('free')) }
}

// ==================== 焦点管理 ====================
function focusInput(key) {
  // #ifdef H5
  const el = inputRefs.value[key]
  if (el) {
    const dom = el.$el || el
    if (dom && dom.focus) dom.focus()
  }
  // #endif
}

// ==================== placeholder ====================
const currentPlaceholder = computed(() => {
  if (activeUid.value !== null) {
    const seg = segments.value.find(s => s.uid === activeUid.value)
    if (seg) {
      const action = quickActions.find(a => a.key === seg.key)
      return action ? action.placeholder : '输入内容...'
    }
  }
  return '跟思迹说点什么...'
})

// ==================== 是否可发送 ====================
const canSend = computed(() => {
  if (props.disabled) return false
  if (segments.value.some(s => s.text.trim())) return true
  if (activeUid.value === null && freeText.value.trim()) return true
  return false
})

// ==================== 多行状态检测 ====================
const isMultiLine = computed(() => {
  // 仅当包含换行符时才视为多行（textarea auto-height 自动撑高单行）
  const activeText = activeUid.value !== null
    ? segments.value.find(s => s.uid === activeUid.value)?.text || ''
    : freeText.value
  return activeText.includes('\n')
})

// ==================== Enter 键提交（H5 端）====================
function onKeyDown(e) {
  // #ifdef H5
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    handleSend()
  }
  // #endif
}

// ==================== 发送 ====================
function handleSend() {
  if (!canSend.value) return
  const taggedParts = segments.value.filter(s => s.text.trim()).map(s => `[${s.tag}:${s.text.trim()}]`)
  if (taggedParts.length > 0) {
    if (freeText.value.trim()) taggedParts.push(freeText.value.trim())
    emit('send', taggedParts.join(' '))
  } else {
    if (freeText.value.trim()) emit('send', freeText.value.trim())
  }
  // 不在此处清空，由父组件确认发送成功后调用 reset()
}

// ==================== 重置输入（供父组件调用）====================
function reset() {
  segments.value = []
  activeUid.value = null
  freeText.value = ''
  emit('update:modelValue', '')
}

defineExpose({ reset, setText })

/** 供父组件调用：将文本填入自由输入区并切换到该区域 */
function setText(text) {
  if (!text) return
  segments.value = []
  activeUid.value = null
  freeText.value = text
  emit('update:modelValue', text)
  nextTick(() => focusInput('free'))
}

// ==================== 按钮状态 ====================
function hasSeg(key) { return segments.value.some(s => s.key === key) }
function truncate(text, max = 20) { return !text ? '' : (text.length > max ? text.slice(0, max) + '...' : text) }

// ==================== 语音录音 ====================
async function toggleVoice() {
  if (!voiceSupported) {
    uni.showToast({ title: '当前环境不支持语音', icon: 'none' })
    return
  }
  if (isRecording.value) {
    // 停止录音 → 转写文本填入输入框
    await stopRecord()
    isRecording.value = false
    voiceStatus.value = ''
    voiceError.value = ''
    // 将转写文本填入自由输入
    if (voiceText.value.trim()) {
      if (freeText.value.trim()) {
        freeText.value = freeText.value + voiceText.value
      } else {
        freeText.value = voiceText.value
      }
      emit('update:modelValue', freeText.value)
      // 切到自由输入模式
      activeUid.value = null
      nextTick(() => focusInput('free'))
    }
    voiceText.value = ''
  } else {
    // 开始录音
    voiceText.value = ''
    voiceError.value = ''
    // H5 端先做快速权限检测，不支持的環境直接 Toast，不进入浮层
    // #ifdef H5
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        uni.showToast({ title: '当前环境不支持语音输入，请使用真机调试', icon: 'none', duration: 2500 })
        return
      }
      // 检测是否有麦克风设备（不触发权限弹窗）
      const devices = await navigator.mediaDevices.enumerateDevices()
      const hasMic = devices.some(d => d.kind === 'audioinput')
      if (!hasMic) {
        uni.showToast({ title: '未检测到麦克风设备', icon: 'none' })
        return
      }
    } catch (e) {
      // enumerateDevices 可能被拒绝，继续尝试（getUserMedia 会给出更具体的错误）
    }
    // #endif
    isRecording.value = true
    voiceStatus.value = 'connecting'
    voiceDuration.value = 0
    try {
      await startRecord({
        onTextChange(text) {
          voiceText.value = text
        },
        onStatusChange(status) {
          voiceStatus.value = status
        },
        onDuration(ms) {
          voiceDuration.value = ms
        },
        onError(err) {
          console.error('[思迹] 语音错误:', err)
          const errMsg = err && err.message ? err.message : '语音识别失败'
          voiceError.value = errMsg
          voiceStatus.value = ''
        }
      })
    } catch (err) {
      console.error('[思迹] 启动录音失败:', err)
      const errMsg = err && err.message ? err.message : '启动录音失败'
      voiceError.value = errMsg
      voiceStatus.value = ''
    }
  }
}

// ==================== 录音时长格式化 ====================
function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

// ==================== 录音状态文案 ====================
const voiceStatusText = computed(() => {
  if (!isRecording.value) return ''
  if (voiceError.value) return '出错了'
  if (voiceStatus.value === 'connecting') return '连接中...'
  if (voiceStatus.value === 'reconnecting') return '重连中...'
  if (voiceStatus.value === 'recording') {
    return formatDuration(voiceDuration.value)
  }
  if (voiceStatus.value === 'closed') return '连接已断开'
  return '处理中...'
})
</script>

<template>
  <view class="input-area safe-area-bottom">
    <!-- 录音中浮层提示 -->
    <view v-if="isRecording" class="voice-overlay" @tap="toggleVoice">
      <view class="voice-overlay-inner">
        <!-- 错误状态 -->
        <template v-if="voiceError">
          <text class="voice-overlay-error">{{ voiceError }}</text>
          <text class="voice-overlay-hint">点击关闭</text>
        </template>
        <!-- 正常录音状态 -->
        <template v-else>
          <view class="voice-wave-container">
            <view class="voice-wave-bar" v-for="i in 5" :key="i" :style="{ animationDelay: (i * 0.12) + 's' }" />
          </view>
          <text class="voice-overlay-text">{{ voiceStatusText }}</text>
          <text v-if="voiceText" class="voice-overlay-result">{{ voiceText }}</text>
          <text class="voice-overlay-hint">点击结束录音</text>
        </template>
      </view>
    </view>

    <!-- 快捷功能入口 -->
    <view class="quick-actions">
      <view
        v-for="(a, i) in quickActions"
        :key="i"
        class="action-chip"
        :class="{ active: hasSeg(a.key) }"
        @tap="addSegment(a)"
      >
        <view class="chip-icon-box">
          <text class="chip-icon">{{ a.icon }}</text>
        </view>
        <text class="chip-text">{{ a.text }}</text>
      </view>
    </view>

    <!-- 输入行 -->
    <view class="input-row">
      <!-- 语音按钮 -->
      <view
        class="voice-btn"
        :class="{ recording: isRecording }"
        @tap="toggleVoice"
      >
        <SijiIcon v-if="!isRecording" name="mic" size="lg" color="var(--text-primary)" class="voice-icon" />
        <text v-else class="voice-icon recording">■</text>
      </view>

      <view class="input-field-wrapper" :class="{ 'multi-line': isMultiLine }">
        <template v-for="seg in segments" :key="seg.uid">
          <view
            class="seg-chip"
            :class="{ editing: activeUid === seg.uid }"
            @tap.stop="editSegment(seg.uid)"
          >
            <text class="seg-chip-icon">{{ seg.icon }}</text>
            <text class="seg-chip-label">{{ seg.tag }}:</text>
            <view class="seg-chip-close" @tap.stop="removeSegment(seg.uid)">
              <text class="seg-chip-close-icon">×</text>
            </view>
          </view>

          <view v-if="activeUid === seg.uid" class="seg-text-edit">
            <textarea
              :ref="el => { if (el) inputRefs[seg.uid] = el }"
              class="seg-text-input active"
              :value="seg.text"
              :placeholder="currentPlaceholder"
              :auto-height="true"
              :maxlength="-1"
              :show-confirm-bar="false"
              :adjust-position="true"
              :cursor-spacing="20"
              confirm-type="send"
              disable-default-padding
              @input="onSegInput(seg.uid, $event)"
              @confirm="handleSend"
              @keydown="onKeyDown"
            />
          </view>
          <view v-else class="seg-text-readonly" @tap.stop="editSegment(seg.uid)">
            <text v-if="seg.text.trim()" class="seg-text-display">{{ seg.text }}</text>
            <text v-else class="seg-text-empty">点击输入...</text>
          </view>
        </template>

        <!-- 自由输入 -->
        <view v-if="activeUid === null" class="seg-text-edit free">
          <textarea
            ref="el => { if (el) inputRefs['free'] = el }"
            class="seg-text-input free"
            :value="freeText"
            placeholder="跟思迹说点什么..."
            :auto-height="true"
            :maxlength="-1"
            :show-confirm-bar="false"
            :adjust-position="true"
            :cursor-spacing="20"
            confirm-type="send"
            disable-default-padding
            @input="onFreeInput($event)"
            @confirm="handleSend"
            @keydown="onKeyDown"
          />
        </view>
        <view v-else class="seg-text-readonly free" @tap.stop="editFree()">
          <text v-if="freeText.trim()" class="seg-text-display">{{ freeText }}</text>
        </view>
      </view>

      <!-- 发送 / 停止按钮 -->
      <view
        v-if="!isSending"
        class="send-btn"
        :class="{ disabled: !canSend, active: canSend }"
        @tap="handleSend"
      >
        <text class="send-icon">↑</text>
      </view>
      <view
        v-else
        class="stop-btn"
        @tap="$emit('stop')"
      >
        <text class="stop-icon">■</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.input-area {
  background: var(--bg-card);
  border-top: 1rpx solid var(--border-color);
  padding: $spacing-sm $spacing-md;
  padding-bottom: calc($spacing-sm + env(safe-area-inset-bottom));
  position: relative;
}

/* ─── 录音浮层 ─── */
.voice-overlay {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  top: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.voice-overlay-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24rpx;
  padding: 60rpx;
}

/* 声波动画 */
.voice-wave-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  height: 120rpx;
}

.voice-wave-bar {
  width: 8rpx;
  height: 60rpx;
  background: var(--bg-card);
  border-radius: 4rpx;
  animation: voiceWave 0.8s ease-in-out infinite alternate;
}

.voice-wave-bar:nth-child(1) { animation-duration: 0.6s; }
.voice-wave-bar:nth-child(2) { animation-duration: 0.8s; }
.voice-wave-bar:nth-child(3) { animation-duration: 1.0s; }
.voice-wave-bar:nth-child(4) { animation-duration: 0.7s; }
.voice-wave-bar:nth-child(5) { animation-duration: 0.9s; }

@keyframes voiceWave {
  0% { height: 20rpx; opacity: 0.4; }
  100% { height: 100rpx; opacity: 1; }
}

.voice-overlay-text {
  font-size: $font-md;
  color: var(--text-on-ai);
  font-weight: 600;
}

.voice-overlay-result {
  font-size: $font-sm;
  color: rgba(255, 255, 255, 0.8);
  max-width: 600rpx;
  text-align: center;
  line-height: 1.6;
}

.voice-overlay-hint {
  font-size: $font-xs;
  color: rgba(255, 255, 255, 0.5);
}

.voice-overlay-error {
  font-size: $font-md;
  color: var(--color-danger);
  text-align: center;
  line-height: 1.5;
  margin-bottom: $spacing-sm;
}

/* ─── 快捷功能入口 ─── */
.quick-actions {
  display: flex;
  gap: $spacing-sm;
  margin-bottom: $spacing-sm;
  overflow-x: auto;
  white-space: nowrap;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar { display: none; }
}

.action-chip {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 10rpx 22rpx;
  border-radius: 10rpx;
  background: var(--bg-input);
  border: 2rpx solid transparent;
  transition: all 0.15s ease;

  &:active { transform: scale(0.93); }
  &.active { background: var(--color-ai); border-color: var(--color-ai); }

  .chip-icon-box { width: 32rpx; height: 32rpx; display: flex; align-items: center; justify-content: center; }
  .chip-icon { font-size: 28rpx; font-weight: 700; color: var(--color-ai); transition: color 0.15s ease; }
  &.active .chip-icon { color: var(--bg-card); }
  .chip-text { font-size: $font-xs; color: var(--text-strong); font-weight: 600; transition: color 0.15s ease; }
  &.active .chip-text { color: var(--bg-card); }
}

/* ─── 输入行 ─── */
.input-row {
  display: flex;
  align-items: flex-end;
  gap: $spacing-sm;
}

/* 语音按钮 */
.voice-btn {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: var(--bg-input);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s ease;

  &:active { transform: scale(0.92); }

  &.recording {
    background: var(--color-ai);
    animation: voiceBtnPulse 1s ease-in-out infinite;
  }

  .voice-icon {
    font-size: 32rpx;
    color: var(--text-primary);
    line-height: 1;
  }

  &.recording .voice-icon {
    color: var(--text-on-ai);
    font-size: 24rpx;
  }
}

@keyframes voiceBtnPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(0, 0, 0, 0.3); }
  50% { box-shadow: 0 0 0 12rpx rgba(0, 0, 0, 0); }
}

/* 输入框容器 */
.input-field-wrapper {
  flex: 1;
  min-height: 72rpx;
  max-height: 350rpx;
  padding: 16rpx 24rpx;
  background: var(--bg-input);
  border-radius: 36rpx;
  border: 1rpx solid var(--border-color);
  transition: border-color 0.15s ease;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6rpx 8rpx;
  overflow-y: auto;

  &:focus-within { border-color: var(--color-ai); }

  /* 多行时圆角微调 */
  &.multi-line {
    border-radius: 24rpx;
    align-items: flex-start;
    padding-top: 20rpx;
    padding-bottom: 20rpx;
  }
}

/* ─── 标签 chip ─── */
.seg-chip {
  display: inline-flex;
  align-items: center;
  gap: 4rpx;
  padding: 4rpx 4rpx 4rpx 10rpx;
  background: var(--color-ai);
  border-radius: 6rpx;
  flex-shrink: 0;
  animation: chipIn 0.2s ease both;

  &.editing { background: var(--text-primary); box-shadow: 0 0 0 2rpx var(--bg-card) inset; }
}

@keyframes chipIn {
  from { opacity: 0; transform: scale(0.7); }
  to { opacity: 1; transform: scale(1); }
}

.seg-chip-icon { font-size: 22rpx; color: var(--bg-card); font-weight: 700; }
.seg-chip-label { font-size: 22rpx; color: rgba(255, 255, 255, 0.7); font-weight: 600; }

.seg-chip-close {
  width: 28rpx; height: 28rpx;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4rpx;
  margin-left: 2rpx;
  transition: background 0.15s ease;
  &:active { background: rgba(255, 255, 255, 0.4); }
}

.seg-chip-close-icon { font-size: 24rpx; color: var(--bg-card); font-weight: 700; line-height: 1; }

/* ─── 段文本：编辑态 ─── */
.seg-text-edit {
  display: inline-flex;
  align-items: center;
  flex: 1;
  min-width: 120rpx;
  &.free { flex: 1; }
}

.seg-text-input {
  width: 100%;
  min-width: 120rpx;
  min-height: 40rpx;
  font-size: $font-md;
  line-height: 1.5;
  color: var(--text-primary);
  background: transparent;
  border: none;
  outline: none;
  padding: 0;
  box-sizing: border-box;

  /* textarea 默认样式重置 */
  /* #ifdef H5 */
  resize: none;
  overflow: hidden;
  /* #endif */

  &.active { border-bottom: 2rpx solid var(--color-ai); }
  &.free { border-bottom: none; }
}

/* ─── 段文本：只读态 ─── */
.seg-text-readonly {
  display: inline-flex;
  align-items: center;
  min-width: 60rpx;
  &.free { min-width: 40rpx; }
}

.seg-text-display { font-size: $font-md; color: var(--text-mid); padding: 0 4rpx; }
.seg-text-empty { font-size: $font-xs; color: var(--text-hint); font-style: italic; padding: 0 4rpx; }

/* ─── 停止按钮 ─── */
.stop-btn {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
  animation: stopBtnPulse 1.5s ease-in-out infinite;

  &:active { transform: scale(0.9); background: var(--text-strong); }

  .stop-icon {
    font-size: 28rpx;
    color: var(--bg-card);
    line-height: 1;
  }
}

@keyframes stopBtnPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(0, 0, 0, 0.15); }
  50% { box-shadow: 0 0 0 8rpx rgba(0, 0, 0, 0); }
}

/* ─── 发送按钮 ─── */
.send-btn {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: var(--color-ai);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s ease;

  &.disabled { background: var(--border-strong); transform: scale(0.9); }
  &.active { &:active { transform: scale(0.92); background: var(--text-strong); } }

  .send-icon { color: var(--bg-card); font-size: 36rpx; font-weight: 700; }
}
</style>
