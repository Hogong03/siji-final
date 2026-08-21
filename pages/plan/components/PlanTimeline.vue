<script setup>
/**
 * 计划时间轴预览 — 计划管理页顶部的时间索引条
 * - 直线长度按计划总体时间跨度自适应
 * - 单指左右滑动平移；双指捏合缩放，改变时间显示跨度
 * - 计划以节点（时间条）形式展示，点击进入计划详情
 */
import { ref, computed, watch, onMounted } from 'vue'
import { buildTimelineNodes, timelineRange, buildTicks, toPlanTs } from '@/utils/plan-timeline.js'

const props = defineProps({
	plans: { type: Array, default: () => [] }
})

const emit = defineEmits(['select'])

const DAY_MS = 86400000
const MIN_PX = 2
const MAX_PX = 240
const PAN_THRESHOLD = 6

const containerW = ref(0)
const pxPerDay = ref(0) // 0 = 未初始化，按总跨度自适应
const translateX = ref(0)

// 触摸状态（非响应式，避免频繁渲染）
let touchStartX = 0
let touchStartTranslate = 0
let pinchStartDist = 0
let pinchStartPx = 0
let pinchStartTranslate = 0
let pinchCenterX = 0
let pinchWorldX = 0
let moved = false

const nodes = computed(() => buildTimelineNodes(props.plans))
const range = computed(() => timelineRange(nodes.value))

const contentW = computed(() => {
	if (!range.value || pxPerDay.value <= 0) return 0
	return range.value.spanDays * pxPerDay.value
})

const minTranslate = computed(() => Math.min(0, containerW.value - contentW.value))

const ticks = computed(() => {
	if (!range.value || pxPerDay.value <= 0) return []
	return buildTicks(range.value.minTs, range.value.spanDays, pxPerDay.value)
})

const positioned = computed(() => {
	if (!range.value || pxPerDay.value <= 0) return []
	return nodes.value.map(n => ({
		id: n.id,
		title: n.title,
		status: n.status,
		parent_id: n.parent_id,
		left: (n.startTs - range.value.minTs) / DAY_MS * pxPerDay.value,
		width: Math.max(4, (n.endTs - n.startTs) / DAY_MS * pxPerDay.value),
		overdue: n.status !== 2 && n.endTs < Date.now()
	}))
})

const todayContentX = computed(() => {
	if (!range.value || pxPerDay.value <= 0) return null
	return (Date.now() - range.value.minTs) / DAY_MS * pxPerDay.value
})

const todayX = computed(() => {
	if (todayContentX.value === null) return null
	return todayContentX.value + translateX.value
})

const noTimeCount = computed(() => props.plans.length - nodes.value.length)

function clampTranslate(v) {
	if (minTranslate.value >= 0) return 0
	return Math.max(minTranslate.value, Math.min(0, v))
}

function fit() {
	if (!range.value || containerW.value <= 0) return
	pxPerDay.value = Math.min(MAX_PX, Math.max(MIN_PX, containerW.value / range.value.spanDays))
	translateX.value = 0
}

function jumpToday() {
	if (todayX.value === null) return
	translateX.value = clampTranslate(containerW.value / 2 - todayX.value)
}

function dist(a, b) {
	return Math.sqrt(Math.pow(a.clientX - b.clientX, 2) + Math.pow(a.clientY - b.clientY, 2))
}

function onTouchStart(e) {
	const touches = e.touches || []
	moved = false
	if (touches.length >= 2) {
		pinchStartDist = dist(touches[0], touches[1])
		pinchStartPx = pxPerDay.value
		pinchStartTranslate = translateX.value
		pinchCenterX = (touches[0].clientX + touches[1].clientX) / 2
		pinchWorldX = (pinchCenterX - pinchStartTranslate) / pinchStartPx
	} else if (touches.length === 1) {
		touchStartX = touches[0].clientX
		touchStartTranslate = translateX.value
	}
}

function onTouchMove(e) {
	const touches = e.touches || []
	if (touches.length >= 2 && pinchStartDist > 0) {
		const d = dist(touches[0], touches[1])
		if (d > 0) {
			const newPx = Math.min(MAX_PX, Math.max(MIN_PX, pinchStartPx * (d / pinchStartDist)))
			pxPerDay.value = newPx
			const centerX = (touches[0].clientX + touches[1].clientX) / 2
			translateX.value = clampTranslate(centerX - pinchWorldX * newPx)
		}
		moved = true
	} else if (touches.length === 1) {
		const dx = touches[0].clientX - touchStartX
		if (Math.abs(dx) > PAN_THRESHOLD) moved = true
		if (contentW.value > containerW.value) {
			translateX.value = clampTranslate(touchStartTranslate + dx)
		}
	}
}

function onTouchEnd() {
	pinchStartDist = 0
}

function onNodeTap(n) {
	if (moved) {
		moved = false
		return
	}
	emit('select', n.id)
}

// 数据变化：未初始化时自适应，否则仅收敛平移范围
watch(() => props.plans, () => {
	if (pxPerDay.value <= 0) {
		fit()
	} else {
		translateX.value = clampTranslate(translateX.value)
	}
})

onMounted(() => {
	const sys = uni.getSystemInfoSync()
	const winW = (sys && sys.windowWidth) || 375
	// 卡片外边距 20rpx*2 + 内边距 20rpx*2
	containerW.value = winW * (1 - 80 / 750)
	fit()
})
</script>

<template>
	<view v-if="nodes.length > 0 || noTimeCount > 0" class="timeline-card">
		<view class="tl-header">
			<view class="tl-title-row">
				<text class="tl-title">时间轴</text>
				<text v-if="contentW > containerW" class="tl-hint">滑动平移 · 双指缩放</text>
			</view>
			<view class="tl-tools">
				<view class="tl-btn" @tap="jumpToday">今天</view>
				<view class="tl-btn" @tap="fit">适应</view>
			</view>
		</view>

		<view
			class="timeline-body"
			@touchstart="onTouchStart"
			@touchmove="onTouchMove"
			@touchend="onTouchEnd"
			@touchcancel="onTouchEnd"
		>
			<view
				class="tl-content"
				:style="{ width: contentW + 'px', transform: 'translateX(' + translateX + 'px)' }"
			>
				<!-- 时间刻度 -->
				<view
					v-for="(t, i) in ticks" :key="i"
					class="tl-tick"
					:style="{ left: ((t.ts - range.minTs) / DAY_MS * pxPerDay) + 'px' }"
				>
					<text class="tl-tick-label">{{ t.label }}</text>
					<view class="tl-tick-line" />
				</view>

				<!-- 今天线 -->
				<view
					v-if="todayContentX !== null && todayContentX >= 0 && todayContentX <= contentW"
					class="tl-today"
					:style="{ left: todayContentX + 'px' }"
				>
					<text class="tl-today-label">今天</text>
					<view class="tl-today-line" />
				</view>

				<!-- 计划节点 -->
				<view
					v-for="n in positioned" :key="n.id"
					class="tl-node"
					:class="{ child: !!n.parent_id, done: n.status === 2, overdue: n.overdue }"
					:style="{ left: n.left + 'px', width: n.width + 'px' }"
					@tap="onNodeTap(n)"
				>
					<text v-if="!n.parent_id && n.width > 44" class="tl-node-title">{{ n.title }}</text>
				</view>
			</view>
		</view>

		<text v-if="noTimeCount > 0" class="tl-nohint">{{ noTimeCount }} 个计划未设置时间，未显示在时间轴上</text>
	</view>
</template>

<style scoped lang="scss">
.timeline-card {
	margin: 8rpx 20rpx 0;
	padding: 12rpx 20rpx 14rpx;
	background: #FFFFFF;
	border-radius: 12rpx;
}

.tl-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 6rpx;
}

.tl-title-row {
	display: flex;
	align-items: baseline;
	gap: 10rpx;
}

.tl-title {
	font-size: 26rpx;
	font-weight: 700;
	color: #18181B;
}

.tl-hint {
	font-size: 18rpx;
	color: #A1A1AA;
}

.tl-tools {
	display: flex;
	gap: 8rpx;
}

.tl-btn {
	padding: 4rpx 18rpx;
	border-radius: 16rpx;
	font-size: 20rpx;
	color: #18181B;
	background: #F4F4F5;

	&:active {
		background: #E4E4E7;
	}
}

.timeline-body {
	position: relative;
	width: 100%;
	height: 130rpx;
	overflow: hidden;
}

.tl-content {
	position: absolute;
	left: 0;
	top: 0;
	height: 100%;
	will-change: transform;
}

.tl-tick {
	position: absolute;
	top: 0;
	transform: translateX(-50%);
	display: flex;
	flex-direction: column;
	align-items: center;
}

.tl-tick-label {
	font-size: 18rpx;
	color: #A1A1AA;
	white-space: nowrap;
}

.tl-tick-line {
	width: 2rpx;
	height: 34rpx;
	background: #E4E4E7;
	margin-top: 2rpx;
}

.tl-today {
	position: absolute;
	top: 0;
	transform: translateX(-50%);
	display: flex;
	flex-direction: column;
	align-items: center;
	z-index: 3;
}

.tl-today-label {
	font-size: 18rpx;
	color: #EF4444;
	font-weight: 600;
}

.tl-today-line {
	width: 2rpx;
	height: 100rpx;
	background: #EF4444;
	margin-top: 2rpx;
	opacity: 0.55;
}

.tl-node {
	position: absolute;
	top: 56rpx;
	height: 28rpx;
	border-radius: 6rpx;
	background: #18181B;
	color: #FFFFFF;
	display: flex;
	align-items: center;
	overflow: hidden;
	z-index: 2;

	&.child {
		top: 88rpx;
		height: 20rpx;
		background: #71717A;
		opacity: 0.9;
	}

	&.done {
		background: #10B981;
	}

	&.overdue {
		background: #EF4444;
	}
}

.tl-node-title {
	font-size: 18rpx;
	padding: 0 6rpx;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.tl-nohint {
	display: block;
	font-size: 18rpx;
	color: #A1A1AA;
	margin-top: 6rpx;
}

@media (prefers-color-scheme: dark) {
	.timeline-card { background: #27272A; }
	.tl-title { color: #FAFAFA; }
	.tl-hint { color: #52525B; }
	.tl-btn { background: #3F3F46; color: #FAFAFA; &:active { background: #52525B; } }
	.tl-tick-label { color: #71717A; }
	.tl-tick-line { background: #3F3F46; }
	.tl-node { background: #FAFAFA; color: #18181B; &.child { background: #A1A1AA; } }
	.tl-nohint { color: #71717A; }
}
</style>
