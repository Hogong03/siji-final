<script setup>
/**
 * PlanSummarySheet — 计划汇总表（4.29.5）
 *
 * 每次打开应用 / 每天第一次进聊天页自动弹的「全部计划明细」底部面板。
 * 内容分三层：统计头（与计划 Tab 的「计划总览」同一口径）→ 优先级色条 →
 * 按状态分组的逐条明细（已过期 / 进行中 / 待开始 / 已完成）。
 *
 * 数据由 utils/plan-summary.js 的 buildPlanSummary 组装（纯函数，已单测）；
 * 本组件只负责渲染与 emit，不读存储、不算数。
 *
 * 点击某条计划 → emit('go-plan', clientId)，跳转由页面统一处理。
 * 样式注意：本组件是独立浮层，不依赖聊天页 scoped 样式（父页 scoped 作用不到这里），
 * 深色块按项目约定写在自己 scoped 里（H5/App 用 html.theme-dark 前缀，MP 用 @media）。
 */
import { ref, watch, computed } from 'vue'
import SijiIcon from '@/components/common/SijiIcon.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  summary: { type: Object, default: () => ({ stats: {}, priorityBar: [], groups: [], doneHidden: 0 }) }
})
const emit = defineEmits(['close', 'go-plan', 'go-plan-list'])

/** 入场动画开关：先挂载再置位，否则 translateY(100%) → 0 的过渡不会触发 */
const active = ref(false)
watch(() => props.show, (v) => {
  if (v) setTimeout(() => { active.value = true }, 20)
  else active.value = false
})

const stats = computed(() => props.summary.stats || {})
const groups = computed(() => props.summary.groups || [])
const priorityBar = computed(() => props.summary.priorityBar || [])
const isEmpty = computed(() => groups.value.length === 0)
</script>

<template>
  <view v-if="show" class="pss-mask" @tap="emit('close')">
    <view class="pss-sheet" :class="{ show: active }" @tap.stop>
      <!-- 头部：标题 + 概览副标题 + 关闭 -->
      <view class="pss-head">
        <view class="pss-head-left">
          <text class="pss-title">计划汇总</text>
          <text class="pss-sub">共 {{ stats.total || 0 }} 项 · 进行中 {{ stats.active || 0 }} · 过期 {{ stats.overdue || 0 }}</text>
        </view>
        <view class="pss-close" @tap="emit('close')">
          <SijiIcon name="close" size="sm" />
        </view>
      </view>

      <scroll-view class="pss-body" scroll-y>
        <!-- 统计格 -->
        <view class="pss-stats">
          <view class="pss-stat">
            <text class="pss-stat-num">{{ stats.total || 0 }}</text>
            <text class="pss-stat-label">总计</text>
          </view>
          <view class="pss-stat">
            <text class="pss-stat-num">{{ stats.completed || 0 }}</text>
            <text class="pss-stat-label">完成</text>
          </view>
          <view class="pss-stat">
            <text class="pss-stat-num">{{ stats.rate || 0 }}%</text>
            <text class="pss-stat-label">完成率</text>
          </view>
          <view class="pss-stat">
            <text class="pss-stat-num" :class="{ warn: (stats.overdue || 0) > 0 }">{{ stats.overdue || 0 }}</text>
            <text class="pss-stat-label">过期</text>
          </view>
        </view>

        <!-- 本周打卡 / 子计划 一行 -->
        <view v-if="(stats.weekCheckins || 0) > 0 || (stats.subTotal || 0) > 0" class="pss-subline">
          <text v-if="(stats.weekCheckins || 0) > 0" class="pss-subline-text">
            本周打卡 {{ stats.weekCheckins }} 次<text v-if="(stats.weekDays || 0) > 1">（{{ stats.weekDays }} 天）</text>
          </text>
          <text v-if="(stats.weekCheckins || 0) > 0 && (stats.subTotal || 0) > 0" class="pss-subline-sep">·</text>
          <text v-if="(stats.subTotal || 0) > 0" class="pss-subline-text">
            子计划 {{ stats.subDone || 0 }}/{{ stats.subTotal }}
          </text>
        </view>

        <!-- 优先级色条 -->
        <view v-if="priorityBar.length > 0" class="pss-pbar">
          <view v-for="p in priorityBar" :key="p.label" class="pss-pbar-seg"
            :style="{ width: p.pct + '%', background: p.color }" />
        </view>
        <view v-if="priorityBar.length > 0" class="pss-plabel">
          <text v-for="p in priorityBar" :key="p.label" class="pss-plabel-text">{{ p.label }}{{ p.count }}</text>
        </view>

        <!-- 空状态 -->
        <view v-if="isEmpty" class="pss-empty">
          <text class="pss-empty-title">还没有计划</text>
          <text class="pss-empty-desc">跟思迹说一句「帮我记个计划」，它就替你拆好步骤。</text>
        </view>

        <!-- 分组明细 -->
        <view v-for="g in groups" :key="g.key" class="pss-group">
          <view class="pss-group-head">
            <text class="pss-group-label">{{ g.label }}</text>
            <text class="pss-group-count">{{ g.items.length }}</text>
          </view>
          <view v-for="it in g.items" :key="it.clientId" class="pss-row" @tap="emit('go-plan', it.clientId)">
            <view class="pss-row-dot" :style="{ background: it.priorityColor }" />
            <view class="pss-row-main">
              <text class="pss-row-title">{{ it.title }}</text>
              <text v-if="it.metaText" class="pss-row-meta" :class="{ warn: it.overdue }">{{ it.metaText }}</text>
            </view>
            <text class="pss-row-status" :class="{ warn: it.overdue }">{{ it.overdue ? '逾期' + it.lateDays + '天' : it.statusText }}</text>
            <SijiIcon name="chevron-right" size="sm" />
          </view>
        </view>

        <view v-if="summary.doneHidden > 0" class="pss-more">
          <text class="pss-more-text">已完成另有 {{ summary.doneHidden }} 条较早记录未列出</text>
        </view>

        <view class="pss-pad" />
      </scroll-view>

      <view class="pss-foot">
        <view class="pss-btn" @tap="emit('go-plan-list')">
          <text class="pss-btn-text">去计划页</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.pss-mask {
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

.pss-sheet {
	width: 100%;
	background: #FFFFFF;
	border-radius: 24rpx 24rpx 0 0;
	display: flex;
	flex-direction: column;
	transform: translateY(100%);
	transition: transform 0.28s ease;
}
.pss-sheet.show {
	transform: translateY(0);
}

.pss-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	padding: 28rpx 28rpx 20rpx;
	border-bottom: 1rpx solid #F4F4F5;
}
.pss-head-left {
	display: flex;
	flex-direction: column;
	gap: 6rpx;
}
.pss-title {
	font-size: 34rpx;
	font-weight: 600;
	color: #18181B;
}
.pss-sub {
	font-size: 22rpx;
	color: #71717A;
}
.pss-close {
	width: 48rpx;
	height: 48rpx;
	border-radius: 999rpx;
	background: #F4F4F5;
	display: flex;
	align-items: center;
	justify-content: center;
}

.pss-body {
	max-height: 56vh;
	padding: 20rpx 28rpx 0;
}

/* 统计格 */
.pss-stats {
	display: flex;
}
.pss-stat {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 4rpx;
}
.pss-stat-num {
	font-size: 36rpx;
	font-weight: 600;
	color: #18181B;
}
.pss-stat-num.warn {
	color: #D35D5D;
}
.pss-stat-label {
	font-size: 20rpx;
	color: #A1A1AA;
}

.pss-subline {
	display: flex;
	align-items: center;
	gap: 10rpx;
	padding: 16rpx 0 4rpx;
}
.pss-subline-text {
	font-size: 22rpx;
	color: #52525B;
}
.pss-subline-sep {
	font-size: 22rpx;
	color: #D4D4D8;
}

/* 优先级色条 */
.pss-pbar {
	display: flex;
	height: 8rpx;
	border-radius: 999rpx;
	overflow: hidden;
	margin-top: 18rpx;
	background: #F4F4F5;
}
.pss-pbar-seg {
	height: 8rpx;
}
.pss-plabel {
	display: flex;
	gap: 20rpx;
	padding: 10rpx 0 0;
}
.pss-plabel-text {
	font-size: 20rpx;
	color: #A1A1AA;
}

/* 分组 */
.pss-group {
	margin-top: 24rpx;
}
.pss-group-head {
	display: flex;
	align-items: center;
	gap: 10rpx;
	padding-bottom: 8rpx;
}
.pss-group-label {
	font-size: 22rpx;
	color: #71717A;
	font-weight: 600;
}
.pss-group-count {
	font-size: 20rpx;
	color: #A1A1AA;
}

.pss-row {
	display: flex;
	align-items: center;
	gap: 16rpx;
	padding: 20rpx 0;
	border-bottom: 1rpx solid #F4F4F5;
}
.pss-row-dot {
	width: 12rpx;
	height: 12rpx;
	border-radius: 999rpx;
	flex-shrink: 0;
}
.pss-row-main {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 6rpx;
	min-width: 0;
}
.pss-row-title {
	font-size: 28rpx;
	color: #18181B;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.pss-row-meta {
	font-size: 20rpx;
	color: #A1A1AA;
}
.pss-row-meta.warn {
	color: #D35D5D;
}
.pss-row-status {
	font-size: 22rpx;
	color: #71717A;
	flex-shrink: 0;
}
.pss-row-status.warn {
	color: #D35D5D;
}

.pss-more {
	padding: 20rpx 0 0;
}
.pss-more-text {
	font-size: 20rpx;
	color: #A1A1AA;
}

/* 空状态 */
.pss-empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 10rpx;
	padding: 80rpx 20rpx;
}
.pss-empty-title {
	font-size: 28rpx;
	color: #52525B;
}
.pss-empty-desc {
	font-size: 22rpx;
	color: #A1A1AA;
	text-align: center;
}

.pss-pad {
	height: 24rpx;
}

.pss-foot {
	padding: 16rpx 28rpx;
	padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
	border-top: 1rpx solid #F4F4F5;
}
.pss-btn {
	height: 84rpx;
	border-radius: 999rpx;
	background: #000000;
	display: flex;
	align-items: center;
	justify-content: center;
}
.pss-btn-text {
	font-size: 28rpx;
	color: #FFFFFF;
}

/* 深色：H5 / App（带 html 前缀，禁止裸 .theme-dark 与 :global 包嵌套） */
/* #ifndef MP-WEIXIN */
html.theme-dark {
	.pss-sheet { background: #27272A; }
	.pss-head { border-bottom-color: #3F3F46; }
	.pss-title { color: #FAFAFA; }
	.pss-sub { color: #A1A1AA; }
	.pss-close { background: #3F3F46; }
	.pss-stat-num { color: #FAFAFA; }
	.pss-stat-num.warn { color: #F0A0A0; }
	.pss-stat-label { color: #A1A1AA; }
	.pss-subline-text { color: #A1A1AA; }
	.pss-subline-sep { color: #52525B; }
	.pss-pbar { background: #3F3F46; }
	.pss-plabel-text { color: #71717A; }
	.pss-group-label { color: #A1A1AA; }
	.pss-group-count { color: #71717A; }
	.pss-row { border-bottom-color: #3F3F46; }
	.pss-row-title { color: #FAFAFA; }
	.pss-row-meta { color: #71717A; }
	.pss-row-meta.warn { color: #F0A0A0; }
	.pss-row-status { color: #A1A1AA; }
	.pss-row-status.warn { color: #F0A0A0; }
	.pss-more-text { color: #71717A; }
	.pss-empty-title { color: #D4D4D8; }
	.pss-empty-desc { color: #71717A; }
	.pss-foot { border-top-color: #3F3F46; }
	.pss-btn { background: #FAFAFA; }
	.pss-btn-text { color: #18181B; }
}
/* #endif */

/* 深色：微信小程序（走系统跟随） */
/* #ifdef MP-WEIXIN */
@media (prefers-color-scheme: dark) {
	.pss-sheet { background: #27272A; }
	.pss-head { border-bottom-color: #3F3F46; }
	.pss-title { color: #FAFAFA; }
	.pss-sub { color: #A1A1AA; }
	.pss-close { background: #3F3F46; }
	.pss-stat-num { color: #FAFAFA; }
	.pss-stat-num.warn { color: #F0A0A0; }
	.pss-stat-label { color: #A1A1AA; }
	.pss-subline-text { color: #A1A1AA; }
	.pss-subline-sep { color: #52525B; }
	.pss-pbar { background: #3F3F46; }
	.pss-plabel-text { color: #71717A; }
	.pss-group-label { color: #A1A1AA; }
	.pss-group-count { color: #71717A; }
	.pss-row { border-bottom-color: #3F3F46; }
	.pss-row-title { color: #FAFAFA; }
	.pss-row-meta { color: #71717A; }
	.pss-row-meta.warn { color: #F0A0A0; }
	.pss-row-status { color: #A1A1AA; }
	.pss-row-status.warn { color: #F0A0A0; }
	.pss-more-text { color: #71717A; }
	.pss-empty-title { color: #D4D4D8; }
	.pss-empty-desc { color: #71717A; }
	.pss-foot { border-top-color: #3F3F46; }
	.pss-btn { background: #FAFAFA; }
	.pss-btn-text { color: #18181B; }
}
/* #endif */
</style>
