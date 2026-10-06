<template>
	<view class="briefing">
		<!-- 问候行：时段池轮换 + 离开回来的语境 -->
		<view class="briefing-greet">
			<text class="briefing-greet-text" :style="{ fontSize: fontRpx(28) }">{{ greetLine }}</text>
			<text class="briefing-greet-date" :style="{ fontSize: fontRpx(20) }">{{ dateLine }}</text>
		</view>

		<!-- 指标格：最多 3 格，无数据的格子不渲染 -->
		<view v-if="briefing.metrics && briefing.metrics.length > 0" class="briefing-metrics">
			<view v-for="m in briefing.metrics" :key="m.key" class="briefing-metric">
				<text class="briefing-metric-value" :style="{ fontSize: fontRpx(30) }">{{ m.value }}</text>
				<text class="briefing-metric-label" :style="{ fontSize: fontRpx(20) }">{{ m.label }}</text>
			</view>
		</view>

		<!-- 今日打卡进度：有可打卡的循环计划才渲染（4.13.0） -->
		<view v-if="briefing.checkin" class="briefing-checkin">
			<text class="briefing-checkin-text" :style="{ fontSize: fontRpx(22) }">今日打卡 {{ briefing.checkin.done }}/{{ briefing.checkin.total }}</text>
			<view class="briefing-checkin-bar">
				<view class="briefing-checkin-fill" :style="{ width: checkinPercent }" />
			</view>
		</view>

		<!-- 状态区：唯一主按钮 + 次要状态行 -->
		<view v-if="briefing.primary" class="briefing-primary-wrap">
			<view class="briefing-primary" @tap.stop="tap(briefing.primary)">
				<text class="briefing-primary-text" :style="{ fontSize: fontRpx(26) }">{{ briefing.primary.label }}</text>
					<text class="briefing-primary-arrow">→</text>
			</view>
		</view>
		<view v-if="briefing.statusLines && briefing.statusLines.length > 0" class="briefing-status">
			<view v-for="(line, i) in briefing.statusLines" :key="i" class="briefing-status-line">
				<view class="briefing-status-dot" />
				<text class="briefing-status-text" :style="{ fontSize: fontRpx(22) }">{{ line }}</text>
			</view>
		</view>

		<!-- 下一步：主按钮被占时只剩说明行 -->
		<view v-if="briefing.nextLine" class="briefing-next">
			<text class="briefing-next-text" :style="{ fontSize: fontRpx(22) }">{{ briefing.nextLine }}</text>
		</view>
		<!-- 低落提示（moodDip）：软行 -->
		<view v-if="briefing.moodDip" class="briefing-next">
			<text class="briefing-next-text" :style="{ fontSize: fontRpx(22) }">这两天记录里写着低落，今天慢一点也算数。</text>
		</view>

		<!-- 次级 chips：最多 3 个 -->
		<view v-if="briefing.chips && briefing.chips.length > 0" class="briefing-chips">
			<view
				v-for="btn in briefing.chips"
				:key="btn.key"
				class="briefing-chip"
				@tap.stop="tap(btn)"
			>
				<text class="briefing-chip-text" :style="{ fontSize: fontRpx(22) }">{{ btn.label }}</text>
			</view>
		</view>
	</view>
</template>

<script>
/**
 * EnterBriefing — 进入消息的结构化简报卡（4.12.0）
 *
 * 渲染 _briefing payload（utils/enter-dialogue.js 的 buildBriefing 产出）：
 * 问候行 → 指标格（昨日支出/连续打卡/新记录，最多 3 格）→ 主按钮（一屏只推一件事：
 * 上班卡 > 过时计划 > 下一步）→ 次要状态行 → 下一步说明 → 次级 chips（最多 3 个）。
 *
 * 按钮点击只 emit 'action'（btn 与 _enterButtons 同构），跳转/预填/打卡仍由页面
 * handleEnterButton 统一处理 —— 通道与旧版页级按钮行一致。
 * 文本 content 仍随消息生成（老版本回落渲染 + AI 历史窗口都吃它）。
 *
 * 样式注意：本组件是 MessageBubble 的子组件，父页 scoped 样式作用不到这里，
 * 深色块必须写在组件自己的 scoped 样式里（html.theme-dark 嵌套写法）。
 */
import { fontRpx } from '@/utils/font-scale.js'

export default {
	name: 'EnterBriefing',
	props: {
		message: { type: Object, required: true }
	},
	emits: ['action'],
	computed: {
		briefing() {
			return (this.message && this.message._briefing) || {}
		},
		greetLine() {
			const b = this.briefing
			if (this.message && this.message._enterSummaryKind === 'away') {
				return `${b.greeting || ''}，回来了。`
			}
			return `${b.greeting || ''}。`
		},
		/* 今日打卡进度条填充宽度（done/total，异常收敛到 0-100%） */
		checkinPercent() {
			const c = this.briefing.checkin
			const total = Number(c && c.total) || 0
			if (total <= 0) return '0%'
			const pct = Math.round(((Number(c.done) || 0) / total) * 100)
			return Math.min(100, Math.max(0, pct)) + '%'
		}
	},
	methods: {
		tap(btn) {
			if (btn) this.$emit('action', btn)
		},
		// options API 的模板解析不到模块级 import —— fontRpx 必须经 methods 暴露给模板
		// （4.13.1 排坑：直接在模板里调导入函数 → _ctx.fontRpx undefined → 渲染抛错整卡消失）
		fontRpx
	}
}
</script>

<style lang="scss" scoped>
.briefing {
	display: flex;
	flex-direction: column;
	gap: 16rpx;
}

.briefing-greet-text {
	font-size: 28rpx;
	font-weight: 600;
	color: #18181B;
	line-height: 1.5;
}
.briefing-greet-date {
	font-size: 20rpx;
	color: #A1A1AA;
	margin-top: 2rpx;
}

/* 指标格 */
.briefing-metrics {
	display: flex;
	gap: 12rpx;
}

.briefing-metric {
	display: inline-flex;
	align-items: baseline;
	gap: 8rpx;
	padding: 12rpx 22rpx;
	background: #F4F4F5;
	border-radius: 999rpx;
}

.briefing-metric-value {
	font-size: 30rpx;
	font-weight: 600;
	color: #18181B;
	max-width: 100%;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.briefing-metric-label {
	font-size: 20rpx;
	color: #71717A;
}

/* 今日打卡进度 */
.briefing-checkin {
	display: flex;
	align-items: center;
	gap: 16rpx;
}

.briefing-checkin-text {
	font-size: 22rpx;
	color: #52525B;
	flex-shrink: 0;
}

.briefing-checkin-bar {
	flex: 1;
	height: 8rpx;
	border-radius: 4rpx;
	background: #E4E4E7;
	overflow: hidden;
}

.briefing-checkin-fill {
	height: 8rpx;
	border-radius: 4rpx;
	background: #000000;
}

/* 主按钮：一屏唯一 */
.briefing-primary-wrap {
	display: flex;
}

.briefing-primary {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 10rpx;
	width: 100%;
	padding: 20rpx 32rpx;
	background: #000000;
	border-radius: 14rpx;
}
.briefing-primary-arrow {
	font-size: 26rpx;
	color: #FFFFFF;
	font-weight: 700;
}

.briefing-primary:active {
	opacity: 0.8;
}

.briefing-primary-text {
	font-size: 26rpx;
	font-weight: 600;
	color: #FFFFFF;
}

/* 状态行 */
.briefing-status {
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}

.briefing-status-line {
	display: flex;
	align-items: flex-start;
	gap: 10rpx;
}

.briefing-status-dot {
	width: 8rpx;
	height: 8rpx;
	border-radius: 50%;
	background: #A1A1AA;
	margin-top: 12rpx;
	flex-shrink: 0;
}

.briefing-status-text {
	font-size: 22rpx;
	color: #52525B;
	line-height: 1.6;
}

/* 下一步 / 低落：软行 */
.briefing-next-text {
	font-size: 22rpx;
	color: #71717A;
	line-height: 1.6;
}

/* 次级 chips */
.briefing-chips {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
}

.briefing-chip {
	padding: 10rpx 22rpx;
	border-radius: 10rpx;
	background: #F4F4F5;
	border: 1rpx solid #E4E4E7;
}

.briefing-chip:active {
	opacity: 0.7;
}

.briefing-chip-text {
	font-size: 22rpx;
	color: #18181B;
}

/* 深色（H5/App）：html.theme-dark 嵌套写法，与浅色一比一配对 */
/* #ifndef MP-WEIXIN */
html.theme-dark {
	.briefing-greet-text {
		color: #FAFAFA;
	}
	.briefing-greet-date {
		color: #71717A;
	}
	.briefing-metric {
		background: #1E1E20;
	}
	.briefing-primary-arrow {
		color: #18181B;
	}

	.briefing-metric {
		background: #1E1E20;
	}

	.briefing-metric-value {
		color: #FAFAFA;
	}

	.briefing-metric-label {
		color: #A1A1AA;
	}

	.briefing-checkin-text {
		color: #A1A1AA;
	}

	.briefing-checkin-bar {
		background: #3F3F46;
	}

	.briefing-checkin-fill {
		background: #FAFAFA;
	}

	.briefing-status-text {
		color: #D4D4D8;
	}

	.briefing-status-dot {
		background: #52525B;
	}

	.briefing-next-text {
		color: #A1A1AA;
	}

	.briefing-chip {
		background: #27272A;
		border-color: #3F3F46;
	}

	.briefing-chip-text {
		color: #E4E4E7;
	}

	.briefing-primary {
		background: #FAFAFA;
	}

	.briefing-primary-text {
		color: #18181B;
	}
}
/* #endif */

/* 深色（MP）：媒体查询包在条件编译内 */
/* #ifdef MP-WEIXIN */
@media (prefers-color-scheme: dark) {
	.briefing-greet-text {
		color: #FAFAFA;
	}
	.briefing-greet-date {
		color: #71717A;
	}
	.briefing-metric {
		background: #1E1E20;
	}
	.briefing-primary-arrow {
		color: #18181B;
	}

	.briefing-metric {
		background: #1E1E20;
	}

	.briefing-metric-value {
		color: #FAFAFA;
	}

	.briefing-metric-label {
		color: #A1A1AA;
	}

	.briefing-checkin-text {
		color: #A1A1AA;
	}

	.briefing-checkin-bar {
		background: #3F3F46;
	}

	.briefing-checkin-fill {
		background: #FAFAFA;
	}

	.briefing-status-text {
		color: #D4D4D8;
	}

	.briefing-status-dot {
		background: #52525B;
	}

	.briefing-next-text {
		color: #A1A1AA;
	}

	.briefing-chip {
		background: #27272A;
		border-color: #3F3F46;
	}

	.briefing-chip-text {
		color: #E4E4E7;
	}

	.briefing-primary {
		background: #FAFAFA;
	}

	.briefing-primary-text {
		color: #18181B;
	}
}
/* #endif */
</style>
