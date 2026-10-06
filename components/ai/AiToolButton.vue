<script setup>
/**
 * AI 工具按钮（4.15 统一组件）—— 全应用 AI 功能的统一按钮态
 * 加载中转圈文案、禁用态、点击事件，样式随主题深浅色
 */
defineProps({
	label: { type: String, default: '' },
	loadingLabel: { type: String, default: '' },
	loading: { type: Boolean, default: false },
	disabled: { type: Boolean, default: false }
})
const emit = defineEmits(['tap'])
</script>

<template>
	<view
		class="ai-btn"
		:class="{ loading, disabled }"
		@tap="() => { if (!loading && !disabled) emit('tap') }"
	>
		<text class="ai-btn-text">{{ loading ? (loadingLabel || label + '中…') : label }}</text>
	</view>
</template>

<style scoped lang="scss">
.ai-btn {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8rpx;
	padding: 16rpx 22rpx;
	border-radius: 14rpx;
	background: #F4F4F5;
	transition: all 0.15s ease;

	&:active { background: #E4E4E7; }
	&.loading { opacity: 0.65; }
	&.disabled { opacity: 0.4; }
}
.ai-btn-text {
	font-size: 26rpx;
	font-weight: 500;
	color: #18181B;
	white-space: nowrap;
}

/* #ifndef MP-WEIXIN */
html.theme-dark {
	.ai-btn { background: #3F3F46; }
	.ai-btn:active { background: #52525B; }
	.ai-btn-text { color: #FAFAFA; }
}
/* #endif */
/* #ifdef MP-WEIXIN */
@media (prefers-color-scheme: dark) {
	.ai-btn { background: #3F3F46; }
	.ai-btn:active { background: #52525B; }
	.ai-btn-text { color: #FAFAFA; }
}
/* #endif */
</style>
