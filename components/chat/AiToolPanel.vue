<script setup>
/**
 * AiToolPanel —— AI 功能面板（4.29.0）
 *
 * 输入行「+」触发，底部弹出，网格收纳图片识别 / 文件读取 / 语音转文字 / 更多能力。
 * 面板只负责展示与 emit('pick', action)，具体选图/读文件/录音逻辑仍在 InputArea。
 * vision / voice 受能力开关控制，关闭时对应项不显示（不做灰显死项）。
 * 底部弹出复用项目既有规范（固定底部、圆角、safe-area、遮罩点击关闭）。
 */
import SijiIcon from '@/components/common/SijiIcon.vue'

const props = defineProps({
	show: { type: Boolean, default: false },
	visionOn: { type: Boolean, default: false },
	voiceOn: { type: Boolean, default: false }
})
const emit = defineEmits(['close', 'pick'])

function pick(action) {
	emit('pick', action)
}
</script>

<template>
	<view v-if="show">
		<view class="ai-tool-mask mask-in" @tap="emit('close')" />
		<view class="ai-tool-sheet">
			<view class="ai-tool-head">
				<text class="ai-tool-title">AI 工具</text>
				<text class="ai-tool-sub">选择一项能力</text>
			</view>

			<view class="ai-tool-grid">
				<view v-if="visionOn" class="ai-tool-item btn-tactile" @tap="pick('image')">
					<view class="ai-tool-icon">
						<SijiIcon name="image" size="lg" />
					</view>
					<text class="ai-tool-label">图片识别</text>
				</view>

				<view class="ai-tool-item btn-tactile" @tap="pick('file')">
					<view class="ai-tool-icon">
						<SijiIcon name="file" size="lg" />
					</view>
					<text class="ai-tool-label">文件读取</text>
				</view>

				<view v-if="voiceOn" class="ai-tool-item btn-tactile" @tap="pick('voice')">
					<view class="ai-tool-icon">
						<view class="mic-glyph">
							<view class="mic-body" />
							<view class="mic-arc" />
						</view>
					</view>
					<text class="ai-tool-label">语音转文字</text>
				</view>

				<view class="ai-tool-item btn-tactile" @tap="pick('more')">
					<view class="ai-tool-icon">
						<SijiIcon name="settings" size="lg" />
					</view>
					<text class="ai-tool-label">更多能力</text>
				</view>
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
.ai-tool-mask {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background: rgba(0, 0, 0, 0.45);
	z-index: 999;
}

.ai-tool-sheet {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: 1000;
	background: #FFFFFF;
	border-radius: 24rpx 24rpx 0 0;
	padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
	animation: chatRiseIn 0.25s cubic-bezier(0.4, 0, 0.2, 1) both;
}

.ai-tool-head {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	padding: 28rpx 32rpx 4rpx;
}
.ai-tool-title {
	font-size: 32rpx;
	font-weight: 700;
	color: #18181B;
}
.ai-tool-sub {
	font-size: 22rpx;
	color: #71717A;
}

.ai-tool-grid {
	display: flex;
	flex-wrap: wrap;
	padding: 16rpx 8rpx 16rpx;
}

.ai-tool-item {
	width: 25%;
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 20rpx 0;

	&:active {
		opacity: 0.6;
	}
}

.ai-tool-icon {
	width: 96rpx;
	height: 96rpx;
	border-radius: 24rpx;
	background: #F4F4F5;
	border: 1rpx solid #E4E4E7;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-bottom: 12rpx;
}

.ai-tool-label {
	font-size: 22rpx;
	color: #71717A;
}

/* 麦克风（static/icons 无 mic 图标）：与 InputArea 同一套 CSS 线框麦克风 */
.mic-glyph {
	display: flex;
	flex-direction: column;
	align-items: center;
}
.mic-body {
	width: 14rpx;
	height: 26rpx;
	border-radius: 7rpx;
	background: #18181B;
}
.mic-arc {
	width: 28rpx;
	height: 12rpx;
	border: 3rpx solid #18181B;
	border-top: none;
	border-radius: 0 0 14rpx 14rpx;
	margin-top: 4rpx;
	box-sizing: border-box;
}

/* ──── 深色模式（H5 / App） ──── */
/* #ifndef MP-WEIXIN */
html.theme-dark {
	.ai-tool-sheet { background: #27272A; }
	.ai-tool-title { color: #FAFAFA; }
	.ai-tool-sub { color: #A1A1AA; }
	.ai-tool-icon {
		background: #3F3F46;
		border-color: #3F3F46;
	}
	.ai-tool-label { color: #A1A1AA; }
	.mic-body { background: #F4F4F5; }
	.mic-arc { border-color: #F4F4F5; }
}
/* #endif */
/* #ifdef MP-WEIXIN */
@media (prefers-color-scheme: dark) {
	.ai-tool-sheet { background: #27272A; }
	.ai-tool-title { color: #FAFAFA; }
	.ai-tool-sub { color: #A1A1AA; }
	.ai-tool-icon {
		background: #3F3F46;
		border-color: #3F3F46;
	}
	.ai-tool-label { color: #A1A1AA; }
	.mic-body { background: #F4F4F5; }
	.mic-arc { border-color: #F4F4F5; }
}
/* #endif */
</style>
