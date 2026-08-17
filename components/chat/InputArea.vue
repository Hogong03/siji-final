<script setup>
/**
 * 输入区组件 v9 — 极简版
 *
 * 一行输入：语音 → 图片 → 文本 → 发送/停止
 * AI 自动识别意图，去掉冗余的快捷标签按钮和 segment 系统
 */
import SijiIcon from '@/components/common/SijiIcon.vue'
import { ref, computed } from 'vue'
import { chooseAndCompress } from '@/utils/image.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  isSending: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'send', 'stop', 'image-selected', 'image-cleared'])

// ─── 快捷指令 ───
const showShortcuts = ref(false)
const shortcuts = [
  { icon: 'bill', label: '记账', text: '帮我记一笔' },
  { icon: 'diary', label: '记录', text: '写个记录' },
  { icon: 'plan', label: '计划', text: '建个计划' },
  { icon: 'search', label: '查询', text: '帮我查一下' }
]
function applyShortcut(s) {
  text.value = s.text
  emit('update:modelValue', s.text)
  showShortcuts.value = false
}

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
  onInputDraft()
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
  const msg = text.value.trim()
  if (msg.length > 2000) {
    uni.showToast({ title: '单条消息不能超过2000字', icon: 'none' })
    return
  }
  emit('send', msg || '请识别并分析这张截图')
}
function reset() { text.value = ''; selectedImage.value = null; emit('update:modelValue', ''); saveDraft('') }

// ─── 草稿自动保存 ───
const DRAFT_KEY = 'siji_chat_draft'
function saveDraft(v) { try { uni.setStorageSync(DRAFT_KEY, v) } catch (e) {} }
function loadDraft() {
  try {
    const d = uni.getStorageSync(DRAFT_KEY)
    if (d) { text.value = d; emit('update:modelValue', d) }
  } catch (e) {}
}
loadDraft()

// 输入时防保存草稿
let draftTimer = null
function onInputDraft() {
  if (draftTimer) clearTimeout(draftTimer)
  draftTimer = setTimeout(() => saveDraft(text.value), 1000)
}

defineExpose({ reset, setText, getImage: () => selectedImage.value, resetImage: () => { selectedImage.value = null } })
function setText(t) { if (t) { text.value = t; emit('update:modelValue', t) } }
</script>

<template>
  <view class="input-area safe-area-bottom">
    <!-- 快捷指令面板 -->
    <view v-if="showShortcuts" class="shortcut-panel">
      <view
        v-for="s in shortcuts" :key="s.label"
        class="shortcut-item"
        @tap="applyShortcut(s)"
      >
        <SijiIcon :name="s.icon" size="sm" color="#71717A" />
        <text class="shortcut-label">{{ s.label }}</text>
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
      <view class="side-btn" @tap="showShortcuts = !showShortcuts">
        <text class="shortcut-toggle">+</text>
      </view>

      <view class="side-btn" @tap="pickImage">
        <SijiIcon name="image" size="sm" color="#71717A" :style="{ opacity: imageLoading ? 0.4 : 1 }" />
      </view>

      <view class="input-wrap">
        <textarea
          class="text-input"
          :value="text"
          placeholder="说点什么..."
          :auto-height="true"
          :maxlength="2000"
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
  background: #FFFFFF;
  border-top: 1rpx solid #E4E4E7;
  padding: $spacing-sm $spacing-md;
  padding-bottom: calc($spacing-sm + env(safe-area-inset-bottom));
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.shortcut-panel {
  display: flex; gap: $spacing-sm; padding: 12rpx 16rpx;
  background: #F4F4F5; border-radius: 16rpx; margin-bottom: $spacing-sm;
  border: 1rpx solid #E4E4E7;
}
.shortcut-item {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6rpx;
  padding: 12rpx 8rpx; border-radius: 12rpx; background: #FFFFFF;
  border: 1rpx solid #E4E4E7;
  transition: transform 0.12s;
  &:active { transform: scale(0.92); background: #F4F4F5; }
}
.shortcut-label { font-size: 22rpx; color: #71717A; }
.shortcut-toggle { font-size: 36rpx; color: #71717A; font-weight: 300; line-height: 1; }

/* ─── 图片预览 ─── */
.img-preview {
  display: flex; align-items: center; gap: $spacing-sm; padding: 8rpx 16rpx;
  background: #F4F4F5; border-radius: 16rpx; margin-bottom: $spacing-sm;
  border: 1rpx solid #E4E4E7;
}
.img-preview-thumb { width: 80rpx; height: 80rpx; border-radius: 8rpx; flex-shrink: 0; }
.img-preview-label { flex: 1; font-size: 26rpx; color: #71717A; }
.img-preview-del {
  width: 36rpx; height: 36rpx; border-radius: 50%; background: rgba(0,0,0,.1);
  display: flex; align-items: center; justify-content: center; font-size: 24rpx; color: #71717A;
}

/* ─── 输入行 ─── */
.input-row { display: flex; align-items: flex-end; gap: $spacing-sm; }

.side-btn {
  width: 48rpx; height: 48rpx; border-radius: 50%; background: #F4F4F5; border: 1rpx solid #E4E4E7;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  margin-bottom: 12rpx;
  transition: transform 0.12s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s;
  &:active { transform: scale(0.9); background: #E4E4E7; }
}

.input-wrap {
  flex: 1; min-height: 72rpx; max-height: 350rpx; padding: 12rpx 24rpx;
  background: #F4F4F5; border-radius: 36rpx; border: 1rpx solid #E4E4E7;
  display: flex; align-items: center; overflow-y: auto;
  transition: border-color 0.2s ease, background-color 0.2s ease;
  &:focus-within {
    border-color: #000000;
    background: #E4E4E7;
  }
}
.text-input {
  width: 100%; font-size: $font-md; line-height: 1.5; color: #18181B;
  background: transparent; border: none; outline: none; padding: 0; min-height: 40rpx;
}

.send-btn, .stop-btn {
  width: 72rpx; height: 72rpx; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; transition: all .2s;
}
.send-btn {
  background: #A1A1AA; opacity: .5;
  &.active {
    background: #000000; opacity: 1;
    &:active { transform: scale(1.05); }
  }
}
.send-icon { color: #FFFFFF; font-size: 36rpx; font-weight: 700; }
.stop-btn { background: #18181B; &:active { transform: scale(.9); } }
.stop-icon { color: #FFFFFF; font-size: 28rpx; }

/* ─── 深色模式 ─── */
@media (prefers-color-scheme: dark) {
  .input-area { background: #18181B; border-top-color: #27272A; }
  .side-btn {
    background: #27272A; border-color: #3F3F46;
    &:active { background: #3F3F46; }
  }
  .input-wrap {
    background: #27272A; border-color: #3F3F46;
    &:focus-within {
      border-color: #FAFAFA;
      background: #18181B;
    }
  }
  .send-btn {
    background: #3F3F46; opacity: .6;
    &.active {
      background: #FAFAFA; opacity: 1;
    }
  }
  .send-icon { color: #000000; }
  .shortcut-panel {
    background: #27272A; border-color: #3F3F46;
  }
  .shortcut-item {
    background: #18181B; border-color: #27272A;
    &:active { background: #27272A; }
  }
  .shortcut-label { color: #A1A1AA; }
  .img-preview { background: #27272A; border-color: #3F3F46; }
  .img-preview-label { color: #A1A1AA; }
  .text-input { color: #F4F4F5; }
}
</style>
