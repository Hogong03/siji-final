<script setup>
/**
 * 输入区组件 v9 — 极简版
 *
 * 一行输入：语音 → 图片 → 文本 → 发送/停止
 * AI 自动识别意图，去掉冗余的快捷标签按钮和 segment 系统
 */
import SijiIcon from '@/components/common/SijiIcon.vue'
import { ref, nextTick } from 'vue'
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
    <!-- 图片预览 -->
    <view v-if="selectedImage" class="img-preview">
      <image :src="selectedImage.base64" mode="aspectFill" class="img-preview-thumb" />
      <text class="img-preview-label">图片待发送</text>
      <view class="img-preview-del" @tap="clearImage"><text>×</text></view>
    </view>

    <!-- 输入行 -->
    <view class="input-row">
      <view class="side-btn" @tap="pickImage">
        <text class="side-btn" @tap="pickImage" :style="{ opacity: imageLoading ? 0.4 : 1, fontSize: '36rpx', lineHeight: '36rpx' }">◉</text>
      </view>

      <view class="input-wrap">
        <textarea
          class="text-input"
          :value="text"
          placeholder="说点什么..."
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
