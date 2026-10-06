<script setup>
/**
 * AI 结果卡（4.15 统一组件）—— 全应用 AI 结果的统一展示态
 * 三态：生成中（骨架屏）/ 失败（原因 + 重试 + 去 API 设置）/ 内容（标题 + 时间 + 复制 + 重新生成）
 */
import { computed } from 'vue'

const props = defineProps({
	title: { type: String, default: '' },
	content: { type: String, default: '' },
	loading: { type: Boolean, default: false },
	/** 失败原因（非空即失败态） */
	error: { type: String, default: '' },
	/** 结果生成时间戳（展示 MM-DD HH:mm） */
	updatedAt: { type: Number, default: 0 },
	loadingText: { type: String, default: '生成中…' },
	/** 隐藏底部操作（如纯展示的 AI 建议） */
	staticCard: { type: Boolean, default: false }
})
const emit = defineEmits(['retry'])

const showBody = computed(() => !props.loading && !props.error && !!props.content)

function fmtTime(ts) {
	if (!ts) return ''
	const d = new Date(ts)
	const p = n => String(n).padStart(2, '0')
	return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function copyContent() {
	if (!props.content) return
	uni.setClipboardData({
		data: props.content,
		success: () => uni.showToast({ title: '已复制', icon: 'none' })
	})
}

function goSettings() {
	uni.navigateTo({ url: '/pages/settings/sub/ai' })
}
</script>

<template>
	<view class="ai-card">
		<!-- 生成中：骨架屏 -->
		<view v-if="loading" class="ai-card-loading">
			<text class="ai-card-loading-text">{{ loadingText }}</text>
			<view class="skel" />
			<view class="skel skel-70" />
			<view class="skel skel-40" />
		</view>

		<!-- 失败：原因 + 重试 + 去 API 设置 -->
		<template v-else-if="error">
			<view class="ai-card-error">
				<text class="ai-card-error-icon">⚠️</text>
				<text class="ai-card-error-text">{{ error }}</text>
			</view>
			<view class="ai-card-actions">
				<view class="ai-card-act primary" @tap="emit('retry')"><text>重试</text></view>
				<view class="ai-card-act" @tap="goSettings"><text>检查 API Key</text></view>
			</view>
		</template>

		<!-- 内容 -->
		<template v-else-if="showBody">
			<view class="ai-card-head">
				<text class="ai-card-title">{{ title }}</text>
				<view class="ai-card-head-right">
					<text v-if="updatedAt" class="ai-card-time">{{ fmtTime(updatedAt) }}</text>
					<template v-if="!staticCard">
						<text class="ai-card-op" @tap="copyContent">复制</text>
						<text class="ai-card-op" @tap="emit('retry')">重新生成</text>
					</template>
				</view>
			</view>
			<text class="ai-card-body">{{ content }}</text>
		</template>
	</view>
</template>

<style scoped lang="scss">
.ai-card {
	background: #FFFFFF;
	border-radius: 16rpx;
	padding: 20rpx 24rpx;
}

.ai-card-loading { display: flex; flex-direction: column; gap: 12rpx; }
.ai-card-loading-text { font-size: 24rpx; color: #71717A; }
.skel {
	height: 22rpx;
	border-radius: 8rpx;
	background: linear-gradient(90deg, #F4F4F5 25%, #EBEBED 45%, #F4F4F5 65%);
	background-size: 400% 100%;
	animation: aiSkel 1.2s ease infinite;
}
.skel-70 { width: 70%; }
.skel-40 { width: 40%; }
@keyframes aiSkel {
	0% { background-position: 100% 0; }
	100% { background-position: -100% 0; }
}

.ai-card-error { display: flex; align-items: flex-start; gap: 10rpx; }
.ai-card-error-icon { font-size: 26rpx; line-height: 1.5; }
.ai-card-error-text {
	flex: 1;
	font-size: 24rpx;
	color: #EF4444;
	line-height: 1.5;
}
.ai-card-actions {
	display: flex;
	gap: 12rpx;
	margin-top: 14rpx;
}
.ai-card-act {
	padding: 8rpx 22rpx;
	border-radius: 999rpx;
	background: #18181B;
	font-size: 22rpx;
	color: #FFFFFF;
	&.ghost { background: #F4F4F5; color: #71717A; }
	&:active { opacity: 0.8; }
}

.ai-card-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12rpx;
	margin-bottom: 8rpx;
}
.ai-card-title {
	font-size: 26rpx;
	font-weight: 600;
	color: #18181B;
	flex-shrink: 0;
}
.ai-card-head-right {
	display: flex;
	align-items: center;
	gap: 14rpx;
	min-width: 0;
}
.ai-card-time { font-size: 20rpx; color: #A1A1AA; }
.ai-card-op { font-size: 22rpx; color: #71717A; &:active { opacity: 0.7; } }
.ai-card-body {
	font-size: 26rpx;
	color: #18181B;
	line-height: 1.7;
	white-space: pre-wrap;
	word-break: break-all;
}

/* #ifndef MP-WEIXIN */
html.theme-dark {
	.ai-card { background: #27272A; }
	.ai-card-title { color: #FAFAFA; }
	.ai-card-body { color: #E4E4E7; }
	.ai-card-loading-text { color: #71717A; }
	.skel { background: linear-gradient(90deg, #3F3F46 25%, #52525B 45%, #3F3F46 65%); background-size: 400% 100%; }
	.ai-card-act.primary { background: #FAFAFA; color: #18181B; }
	.ai-card-act.ghost { background: #3F3F46; color: #A1A1AA; }
	.ai-card-op { color: #A1A1AA; }
	.ai-card-time { color: #71717A; }
}
/* #endif */
/* #ifdef MP-WEIXIN */
@media (prefers-color-scheme: dark) {
	.ai-card { background: #27272A; }
	.ai-card-title { color: #FAFAFA; }
	.ai-card-body { color: #E4E4E7; }
	.ai-card-loading-text { color: #71717A; }
	.skel { background: linear-gradient(90deg, #3F3F46 25%, #52525B 45%, #3F3F46 65%); background-size: 400% 100%; }
	.ai-card-act.primary { background: #FAFAFA; color: #18181B; }
	.ai-card-act.ghost { background: #3F3F46; color: #A1A1AA; }
	.ai-card-op { color: #A1A1AA; }
	.ai-card-time { color: #71717A; }
}
/* #endif */
</style>
