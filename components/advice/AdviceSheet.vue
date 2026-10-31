<script setup>
/**
 * AdviceSheet — 应用建议面板（4.35.0）
 *
 * 打开应用（进聊天页）时按「应用内容 + 当前时段 + 运行环境」给建议；
 * 三层任一变化（上下文签名变了）就值得重出 —— 数据源与门控在 utils/advice.js。
 *
 * 本组件只负责渲染与 emit，不读存储、不算数、不写存储（门控与记忆在页面侧调 advice.js）。
 * 样式注意：独立浮层，不依赖聊天页 scoped 样式；深色块按项目约定写在自己 scoped 里
 * （H5/App 用 html.theme-dark 嵌套前缀，MP 用 #ifdef 里的 @media），
 * 且**必须是 html.theme-dark 前缀 + 嵌套写法**（H5/App 一份、MP 的 @media 一份，一比一配对），
 * 扁平写法会被 tests/theme-mode.test.js 的守卫判为缺口。
 */
import { ref, computed, watch } from 'vue'
import SijiIcon from '@/components/common/SijiIcon.vue'

const props = defineProps({
	show: { type: Boolean, default: false },
	advice: {
		type: Object,
		default: () => ({ greeting: '', bucketLabel: '', focus: '', items: [], env: {} })
	}
})
const emit = defineEmits(['close', 'go', 'disable-auto', 'open-notify'])

/** 入场动画开关：先挂载再置位，否则 translateY(100%) → 0 的过渡不会触发 */
const active = ref(false)
/** 当前展开依据的方向 id（同一时刻只展开一条） */
const expanded = ref('')

/** M3：方向卡（五层过滤后的 2~3 条）；为空时回落旧版列表 */
const dirs = computed(() => (props.advice && Array.isArray(props.advice.directions) ? props.advice.directions : []))

function toggleEvidence(id) {
	expanded.value = expanded.value === id ? '' : id
}

watch(() => props.show, (v) => {
	if (v) setTimeout(() => { active.value = true }, 20)
	else active.value = false
})

function onGo(item) {
	emit('go', item)
}
</script>

<template>
	<view v-if="show" class="adv-mask" :class="{ show: active }" @tap="emit('close')">
		<view class="adv-sheet" :class="{ show: active }" @tap.stop>
			<!-- 头部：标题 + 时段 -->
			<view class="adv-head">
				<view class="adv-head-left">
					<text class="adv-title">给你的建议</text>
					<text class="adv-sub">{{ advice.bucketLabel }} · {{ advice.greeting }}</text>
				</view>
				<view class="adv-close" @tap="emit('close')">
					<SijiIcon name="close" size="sm" />
				</view>
			</view>

			<scroll-view scroll-y class="adv-body">
				<!-- 重点前置：现在最该做的一件事 -->
				<view v-if="advice.focus" class="adv-focus">
					<text class="adv-focus-label">先做这个</text>
					<text class="adv-focus-text">{{ advice.focus }}</text>
				</view>

				<!-- M3：方向卡（带依据与第一步） -->
				<view v-if="dirs.length" class="adv-list">
					<view v-for="d in dirs" :key="d.id" class="adv-card">
						<view class="adv-card-head" @tap="onGo(d)">
							<text class="adv-card-title">{{ d.title }}</text>
							<SijiIcon v-if="d.action" name="chevron-right" size="sm" />
						</view>
						<text class="adv-card-why">{{ d.why }}</text>
						<text v-if="d.firstStep" class="adv-card-step">先做：{{ d.firstStep }}</text>
						<view class="adv-card-foot">
							<text class="adv-card-evidence" @tap.stop="toggleEvidence(d.id)">{{ expanded === d.id ? '收起依据' : '看依据' }}</text>
						</view>
						<text v-if="expanded === d.id && d.evidence" class="adv-card-ref">{{ d.evidence.text }}（{{ d.evidence.ref }}）</text>
					</view>
				</view>

				<!-- 建议列表（旧版单条提醒，方向为空时回落） -->
				<view v-else-if="advice.items && advice.items.length" class="adv-list">
					<view
						v-for="it in advice.items"
						:key="it.key"
						class="adv-item"
						@tap="onGo(it)"
					>
						<view class="adv-dot" :class="'adv-dot--' + (it.tone || 'info')" />
						<view class="adv-item-main">
							<text class="adv-item-title">{{ it.title }}</text>
							<text v-if="it.desc" class="adv-item-desc">{{ it.desc }}</text>
						</view>
						<SijiIcon v-if="it.action" name="chevron-right" size="sm" />
					</view>
				</view>

				<!-- 空态：真的没什么要说的 -->
				<view v-else class="adv-empty">
					<text class="adv-empty-text">现在没什么要提醒的</text>
					<text class="adv-empty-sub">安静待着也是合法的</text>
				</view>
			</scroll-view>

			<!-- 底部：两个隐藏入口 -->
			<view class="adv-foot">
				<text class="adv-foot-link" @tap="emit('disable-auto')">不再自动弹出</text>
				<text class="adv-foot-dot">·</text>
				<text class="adv-foot-link" @tap="emit('open-notify')">提示设置</text>
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
.adv-mask {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	background: rgba(0, 0, 0, 0.45);
	z-index: 1000;
	display: flex;
	align-items: flex-end;
}

.adv-sheet {
	width: 100%;
	max-height: 78vh;
	background: #FFFFFF;
	border-radius: 24rpx 24rpx 0 0;
	display: flex;
	flex-direction: column;
	transform: translateY(100%);
	transition: transform 0.28s ease;
	padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
}

.adv-sheet.show {
	transform: translateY(0);
}

.adv-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	padding: 28rpx 28rpx 20rpx;
	border-bottom: 1rpx solid #F4F4F5;
}

.adv-head-left {
	display: flex;
	flex-direction: column;
}

.adv-title {
	font-size: 34rpx;
	font-weight: 700;
	color: #18181B;
}

.adv-sub {
	font-size: 24rpx;
	color: #71717A;
	margin-top: 6rpx;
}

.adv-close {
	padding: 8rpx;
}

.adv-body {
	max-height: 56vh;
	padding: 8rpx 28rpx 0;
}

.adv-focus {
	background: #F4F4F5;
	border-radius: 16rpx;
	padding: 20rpx 24rpx;
	margin-top: 16rpx;
	display: flex;
	flex-direction: column;
}

.adv-focus-label {
	font-size: 22rpx;
	color: #71717A;
}

.adv-focus-text {
	font-size: 30rpx;
	font-weight: 600;
	color: #18181B;
	margin-top: 6rpx;
}

.adv-list {
	margin-top: 8rpx;
}

.adv-item {
	display: flex;
	align-items: center;
	padding: 24rpx 0;
	border-bottom: 1rpx solid #F4F4F5;
}

.adv-item:last-child {
	border-bottom: none;
}

.adv-dot {
	width: 14rpx;
	height: 14rpx;
	border-radius: 50%;
	flex-shrink: 0;
	margin-right: 18rpx;
}

.adv-dot--urgent {
	background: #DC2626;
}

.adv-dot--nudge {
	background: #18181B;
}

.adv-dot--info {
	background: #A1A1AA;
}

.adv-item-main {
	flex: 1;
	display: flex;
	flex-direction: column;
	min-width: 0;
}

.adv-item-title {
	font-size: 30rpx;
	font-weight: 600;
	color: #18181B;
}

.adv-item-desc {
	font-size: 24rpx;
	color: #71717A;
	margin-top: 6rpx;
	line-height: 1.5;
}

.adv-card {
	padding: 24rpx 0;
	border-bottom: 1rpx solid #F4F4F5;
}

.adv-card:last-child {
	border-bottom: none;
}

.adv-card-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.adv-card-title {
	flex: 1;
	font-size: 30rpx;
	font-weight: 600;
	color: #18181B;
}

.adv-card-why {
	display: block;
	font-size: 24rpx;
	color: #71717A;
	margin-top: 8rpx;
	line-height: 1.5;
}

.adv-card-step {
	display: block;
	font-size: 24rpx;
	color: #18181B;
	margin-top: 6rpx;
}

.adv-card-foot {
	display: flex;
	justify-content: flex-end;
	margin-top: 8rpx;
}

.adv-card-evidence {
	font-size: 22rpx;
	color: #A1A1AA;
}

.adv-card-ref {
	display: block;
	margin-top: 8rpx;
	padding: 12rpx 16rpx;
	font-size: 22rpx;
	color: #71717A;
	background: #FAFAFA;
	border-radius: 10rpx;
}

.adv-empty {
	padding: 60rpx 0;
	display: flex;
	flex-direction: column;
	align-items: center;
}

.adv-empty-text {
	font-size: 30rpx;
	color: #71717A;
}

.adv-empty-sub {
	font-size: 24rpx;
	color: #A1A1AA;
	margin-top: 8rpx;
}

.adv-foot {
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 20rpx 28rpx 8rpx;
	border-top: 1rpx solid #F4F4F5;
	margin-top: 8rpx;
}

.adv-foot-link {
	font-size: 24rpx;
	color: #71717A;
	padding: 8rpx 12rpx;
}

.adv-foot-dot {
	font-size: 24rpx;
	color: #D4D4D8;
}

/* #ifndef MP-WEIXIN */
html.theme-dark {
	.adv-sheet {
		background: #18181B;
	}

	.adv-head {
		border-bottom-color: #27272A;
	}

	.adv-title {
		color: #FAFAFA;
	}

	.adv-sub {
		color: #A1A1AA;
	}

	.adv-focus {
		background: #27272A;
	}

	.adv-focus-label {
		color: #A1A1AA;
	}

	.adv-focus-text {
		color: #FAFAFA;
	}

	.adv-item {
		border-bottom-color: #27272A;
	}

	.adv-dot--nudge {
		background: #FAFAFA;
	}

	.adv-dot--info {
		background: #71717A;
	}

	.adv-item-title {
		color: #FAFAFA;
	}

	.adv-item-desc {
		color: #A1A1AA;
	}

	.adv-card {
		border-bottom-color: #27272A;
	}

	.adv-card-title {
		color: #FAFAFA;
	}

	.adv-card-why {
		color: #A1A1AA;
	}

	.adv-card-step {
		color: #FAFAFA;
	}

	.adv-card-evidence {
		color: #71717A;
	}

	.adv-card-ref {
		color: #A1A1AA;
		background: #27272A;
	}

	.adv-empty-text {
		color: #A1A1AA;
	}

	.adv-empty-sub {
		color: #71717A;
	}

	.adv-foot {
		border-top-color: #27272A;
	}

	.adv-foot-link {
		color: #A1A1AA;
	}

	.adv-foot-dot {
		color: #3F3F46;
	}
}
/* #endif */

/* #ifdef MP-WEIXIN */
@media (prefers-color-scheme: dark) {
	.adv-sheet {
		background: #18181B;
	}

	.adv-head {
		border-bottom-color: #27272A;
	}

	.adv-title {
		color: #FAFAFA;
	}

	.adv-sub {
		color: #A1A1AA;
	}

	.adv-focus {
		background: #27272A;
	}

	.adv-focus-label {
		color: #A1A1AA;
	}

	.adv-focus-text {
		color: #FAFAFA;
	}

	.adv-item {
		border-bottom-color: #27272A;
	}

	.adv-dot--nudge {
		background: #FAFAFA;
	}

	.adv-dot--info {
		background: #71717A;
	}

	.adv-item-title {
		color: #FAFAFA;
	}

	.adv-item-desc {
		color: #A1A1AA;
	}

	.adv-card {
		border-bottom-color: #27272A;
	}

	.adv-card-title {
		color: #FAFAFA;
	}

	.adv-card-why {
		color: #A1A1AA;
	}

	.adv-card-step {
		color: #FAFAFA;
	}

	.adv-card-evidence {
		color: #71717A;
	}

	.adv-card-ref {
		color: #A1A1AA;
		background: #27272A;
	}

	.adv-empty-text {
		color: #A1A1AA;
	}

	.adv-empty-sub {
		color: #71717A;
	}

	.adv-foot {
		border-top-color: #27272A;
	}

	.adv-foot-link {
		color: #A1A1AA;
	}

	.adv-foot-dot {
		color: #3F3F46;
	}
}
/* #endif */
</style>
