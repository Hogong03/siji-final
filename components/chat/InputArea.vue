<script setup>
/**
 * 输入区组件 v9 — 极简版
 *
 * 一行输入：语音 → 图片 → 文本 → 发送/停止
 * AI 自动识别意图，去掉冗余的快捷标签按钮和 segment 系统
 */
import SijiIcon from '@/components/common/SijiIcon.vue'
import { ref, computed, nextTick } from 'vue'
import { isVoiceSupport, startRecord, stopRecord } from '@/utils/voice.js'
import { chooseAndCompress } from '@/utils/image.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  isSending: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'send', 'stop', 'image-selected', 'image-cleared'])

// ─── 文本输入 ───
const text = ref('')

function onInput(e) {
  // #ifdef H5
  text.value = e.target?.value ?? e.detail?.value ?? ''
  // #endif
  // #ifndef H5
  text.value = e.detail?.value ?? ''
  // #endif
  emit('update:modelValue', text.value)
}

// ─── 语音 ───
const voiceSupported = isVoiceSupport()
const isRecording = ref(false)
const voiceText = ref('')
const voiceStatus = ref('')
const voiceDuration = ref(0)
const longPressTimer = ref(null)

function onLongPressStart() {
  if (!voiceSupported || isRecording.value) return
  longPressTimer.value = setTimeout(() => {
    startVoiceRecord()
  }, 500)
}

function onLongPressEnd() {
  if (longPressTimer.value) { clearTimeout(longPressTimer.value); longPressTimer.value = null }
  if (isRecording.value) { stopVoiceRecord() }
}

async function startVoiceRecord() {
  // #ifdef H5
  try { if (!navigator?.mediaDevices?.getUserMedia) { uni.showToast({ title: '需真机测试语音功能', icon: 'none', duration: 2000 }); return } } catch {}
  // #endif
  isRecording.value = true; voiceStatus.value = 'connecting'; voiceDuration.value = 0; voiceText.value = ''
  try {
    await startRecord({
      onTextChange(t) { voiceText.value = t },
      onStatusChange(s) { voiceStatus.value = s },
      onDuration(ms) { voiceDuration.value = ms },
      onError() { voiceStatus.value = '' }
    })
  } catch { isRecording.value = false; voiceStatus.value = '' }
}

async function stopVoiceRecord() {
  try { await stopRecord() } catch {}
  isRecording.value = false; voiceStatus.value = ''
  if (voiceText.value.trim()) {
    text.value = (text.value + voiceText.value).trim()
    emit('update:modelValue', text.value)
  }
  voiceText.value = ''
}

// ─── 图片 ───
const selectedImage = ref(null)
const imageLoading = ref(false)

async function pickImage() {
  if (imageLoading.value) return; imageLoading.value = true
  try { const r = await chooseAndCompress(); if (r) { selectedImage.value = r; emit('image-selected', r) } } finally { imageLoading.value = false }
}
function clearImage() { selectedImage.value = null; emit('image-cleared') }

// ─── 发送 ───
const canSend = computed(() => !props.disabled && (text.value.trim() || selectedImage.value))

function handleSend() {
  if (!canSend.value) return
  emit('send', text.value.trim() || '请识别并分析这张截图')
}
function reset() { text.value = ''; selectedImage.value = null; emit('update:modelValue', '') }

defineExpose({ reset, setText, getImage: () => selectedImage.value, resetImage: () => { selectedImage.value = null } })
function setText(t) { if (t) { text.value = t; emit('update:modelValue', t) } }
</script>

<template>
  <view class="input-area safe-area-bottom">
    <!-- 录音浮层（长按输入框触发，点击浮层结束） -->
    <view v-if="isRecording" class="voice-overlay" @tap="stopVoiceRecord">
      <view class="voice-overlay-inner">
        <view class="voice-wave">
          <view v-for="i in 5" :key="i" class="voice-wave-bar" :style="{ animationDelay: (i * 0.12) + 's' }" />
        </view>
        <text class="voice-overlay-time">{{ String(Math.floor(voiceDuration / 60000)).padStart(2, '0') }}:{{ String(Math.floor(voiceDuration / 1000) % 60).padStart(2, '0') }}</text>
        <text v-if="voiceText" class="voice-overlay-result">{{ voiceText }}</text>
        <text class="voice-overlay-hint">点击结束</text>
      </view>
    </view>

    <!-- 图片预览 -->
    <view v-if="selectedImage" class="img-preview">
      <image :src="selectedImage.base64" mode="aspectFill" class="img-preview-thumb" />
      <text class="img-preview-label">图片待发送</text>
      <view class="img-preview-del" @tap="clearImage"><text>×</text></view>
    </view>

    <!-- 输入行 -->
    <view class="input-row">
      <view class="side-btn" @tap="pickImage">
        <SijiIcon name="camera" size="lg" />
      </view>

      <view class="input-wrap" @touchstart="onLongPressStart" @touchend="onLongPressEnd" @touchcancel="onLongPressEnd">
        <textarea
          class="text-input"
          :value="text"
          placeholder="说点什么...（长按语音）"
          :auto-height="true"
          :maxlength="-1"
          :show-confirm-bar="false"
          :adjust-position="true"
          :cursor-spacing="20"
          confirm-type="send"
          disable-default-padding
          @input="onInput"
          @confirm="handleSend"
        />
      </view>

      <view v-if="!isSending" class="send-btn" :class="{ active: canSend }" @tap="handleSend">
        <text class="send-icon">↑</text>
      </view>
      <view v-else class="stop-btn" @tap="$emit('stop')">
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
}

/* ─── 录音浮层 ─── */
.voice-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center; z-index: 9999;
}
.voice-overlay-inner {
  display: flex; flex-direction: column; align-items: center; gap: 24rpx; padding: 60rpx;
}
.voice-wave { display: flex; gap: 12rpx; height: 120rpx; align-items: center; }
.voice-wave-bar {
  width: 8rpx; height: 60rpx; background: #fff; border-radius: 4rpx;
  animation: vw 0.8s ease-in-out infinite alternate;
}
.voice-wave-bar:nth-child(1) { animation-duration: 0.6s; }
.voice-wave-bar:nth-child(2) { animation-duration: 0.8s; }
.voice-wave-bar:nth-child(3) { animation-duration: 1.0s; }
.voice-wave-bar:nth-child(4) { animation-duration: 0.7s; }
.voice-wave-bar:nth-child(5) { animation-duration: 0.9s; }
@keyframes vw { 0% { height: 20rpx; opacity: .4; } 100% { height: 100rpx; opacity: 1; } }
.voice-overlay-time { font-size: $font-md; color: #fff; font-weight: 600; }
.voice-overlay-result { font-size: $font-sm; color: rgba(255,255,255,.8); max-width: 600rpx; text-align: center; }
.voice-overlay-hint { font-size: $font-xs; color: rgba(255,255,255,.4); }

/* ─── 图片预览 ─── */
.img-preview {
  display: flex; align-items: center; gap: $spacing-sm; padding: 8rpx 16rpx;
  background: var(--bg-input); border-radius: 16rpx; margin-bottom: $spacing-sm;
}
.img-preview-thumb { width: 80rpx; height: 80rpx; border-radius: 8rpx; flex-shrink: 0; }
.img-preview-label { flex: 1; font-size: 26rpx; color: var(--text-secondary); }
.img-preview-del {
  width: 36rpx; height: 36rpx; border-radius: 50%; background: rgba(0,0,0,.1);
  display: flex; align-items: center; justify-content: center; font-size: 24rpx; color: var(--text-secondary);
}

/* ─── 输入行 ─── */
.input-row { display: flex; align-items: flex-end; gap: $spacing-sm; }

.side-btn {
  width: 72rpx; height: 72rpx; border-radius: 50%; background: var(--bg-input);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  &:active { transform: scale(.92); }
}

.input-wrap {
  flex: 1; min-height: 72rpx; max-height: 350rpx; padding: 12rpx 24rpx;
  background: var(--bg-input); border-radius: 36rpx; border: 1rpx solid var(--border-color);
  display: flex; align-items: center; overflow-y: auto;
  &:focus-within { border-color: var(--text-primary); }
}
.text-input {
  width: 100%; font-size: $font-md; line-height: 1.5; color: var(--text-primary);
  background: transparent; border: none; outline: none; padding: 0; min-height: 40rpx;
}

.send-btn, .stop-btn {
  width: 72rpx; height: 72rpx; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; transition: all .2s;
}
.send-btn {
  background: var(--border-strong); opacity: .5;
  &.active { background: var(--color-ai); opacity: 1; &:active { transform: scale(.92); } }
}
.send-icon { color: var(--bg-card); font-size: 36rpx; font-weight: 700; }
.stop-btn { background: var(--text-primary); &:active { transform: scale(.9); } }
.stop-icon { color: var(--bg-card); font-size: 28rpx; }
</style>
