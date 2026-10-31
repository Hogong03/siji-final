<template>
	<view class="loop-card">
		<view class="loop-head">
			<text class="loop-label">{{ label }}</text>
			<text v-if="candidate.quote" class="loop-quote">{{ candidate.quote }}</text>
		</view>

		<view v-if="!editing" class="loop-body">
			<text class="loop-title">{{ candidate.title }}</text>
			<text v-if="candidate.hint" class="loop-hint">进度：{{ candidate.hint }}</text>
		</view>
		<view v-else class="loop-body">
			<input
				class="loop-input"
				v-model="draft"
				:maxlength="30"
				placeholder="改个名字"
				placeholder-class="loop-placeholder"
			/>
			<text class="loop-counter">{{ draft.length }}/30</text>
		</view>

		<view class="loop-actions">
			<view class="loop-btn loop-btn-primary" :class="{ 'is-busy': submitting }" @tap="onConfirm">
				<text class="loop-btn-text">{{ primaryLabel }}</text>
			</view>
			<view v-if="!editing" class="loop-btn" @tap="startEdit">
				<text class="loop-btn-text">改一下</text>
			</view>
			<view v-else class="loop-btn" @tap="cancelEdit">
				<text class="loop-btn-text">取消</text>
			</view>
			<view class="loop-btn loop-btn-ghost" @tap="onDismiss">
				<text class="loop-btn-text">不用了</text>
			</view>
		</view>
	</view>
</template>

<script setup>
/**
 * OpenLoopCard — 开放事项确认卡（M2.2，对话内联）
 *
 * 它是写入的唯一闸门：卡片不确认，open-loops 不会落库。
 * 状态提示（暂停/继续）来自候选的 mode，不在这里改数据。
 */
import { ref, computed } from 'vue'

const props = defineProps({
  candidate: { type: Object, required: true }
})
const emit = defineEmits(['confirm', 'dismiss'])

const editing = ref(false)
const draft = ref(props.candidate.title || '')
// 防连点：第一次点击后置位，直到父组件卸载本卡片
const submitting = ref(false)

const label = computed(() => {
  if (props.candidate.mode === 'pause') return '把这件事先放一放？'
  if (props.candidate.mode === 'resume') return '重新捡起来？'
  return '记成一件悬着的事？'
})
const primaryLabel = computed(() => {
  if (props.candidate.mode === 'pause') return '暂停它'
  if (props.candidate.mode === 'resume') return '继续做'
  return '记下来'
})

function startEdit() {
  if (submitting.value) return
  draft.value = props.candidate.title || ''
  editing.value = true
}

function cancelEdit() {
  if (submitting.value) return
  editing.value = false
}

function onConfirm() {
  if (submitting.value) return
  submitting.value = true
  const title = String(draft.value || props.candidate.title || '').trim().slice(0, 30)
  if (!title) {
    submitting.value = false
    editing.value = true
    return
  }
  emit('confirm', { title })
}

function onDismiss() {
  if (submitting.value) return
  submitting.value = true
  emit('dismiss', {})
}
</script>

<style lang="scss" scoped>
.loop-card {
	margin: 16rpx 24rpx 8rpx;
	padding: 24rpx 24rpx 20rpx;
	background: #FFFFFF;
	border: 2rpx solid #E4E4E7;
	border-radius: 20rpx;
}

.loop-head {
	display: flex;
	flex-direction: column;
}

.loop-label {
	font-size: 24rpx;
	color: #71717A;
	letter-spacing: 1rpx;
}

.loop-quote {
	margin-top: 8rpx;
	font-size: 24rpx;
	color: #A1A1AA;
	line-height: 1.5;
}

.loop-body {
	margin-top: 12rpx;
	display: flex;
	flex-direction: column;
}

.loop-title {
	font-size: 30rpx;
	color: #18181B;
	font-weight: 500;
	line-height: 1.4;
}

.loop-hint {
	margin-top: 6rpx;
	font-size: 24rpx;
	color: #52525B;
}

.loop-input {
	height: 72rpx;
	padding: 0 20rpx;
	font-size: 30rpx;
	color: #18181B;
	background: #FAFAFA;
	border: 2rpx solid #E4E4E7;
	border-radius: 12rpx;
}

.loop-placeholder {
	color: #A1A1AA;
}

.loop-counter {
	margin-top: 6rpx;
	font-size: 22rpx;
	color: #A1A1AA;
	text-align: right;
}

.loop-actions {
	margin-top: 20rpx;
	display: flex;
	align-items: center;
}

.loop-btn {
	margin-right: 16rpx;
	padding: 12rpx 28rpx;
	border-radius: 999rpx;
	border: 2rpx solid #E4E4E7;
	background: #FFFFFF;
}

.loop-btn-primary {
	background: #000000;
	border-color: #000000;
}

.loop-btn-primary .loop-btn-text {
	color: #FFFFFF;
}

.loop-btn-ghost {
	border-color: transparent;
	background: transparent;
	margin-right: 0;
	margin-left: auto;
}

.loop-btn-ghost .loop-btn-text {
	color: #A1A1AA;
}

.loop-btn-text {
	font-size: 26rpx;
	color: #18181B;
}

.is-busy {
	opacity: 0.5;
}

html.theme-dark .loop-card {
	background: #18181B;
	border-color: #3F3F46;
}

html.theme-dark .loop-title,
html.theme-dark .loop-btn-text {
	color: #FAFAFA;
}

html.theme-dark .loop-label {
	color: #A1A1AA;
}

html.theme-dark .loop-quote {
	color: #71717A;
}

html.theme-dark .loop-hint {
	color: #D4D4D8;
}

html.theme-dark .loop-input {
	background: #27272A;
	border-color: #3F3F46;
	color: #FAFAFA;
}

html.theme-dark .loop-btn {
	background: #27272A;
	border-color: #3F3F46;
}

html.theme-dark .loop-btn-primary {
	background: #FAFAFA;
	border-color: #FAFAFA;
}

html.theme-dark .loop-btn-primary .loop-btn-text {
	color: #18181B;
}
</style>
