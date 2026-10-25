<script setup>
/**
 * PlanSummarySheet — 计划汇总表（4.29.5 / 4.30.0 改版）
 *
 * 每天第一次进聊天页自动弹的「全部计划明细」底部面板。
 * 4.30.0 改版目标：内容丰富但显示简洁、重点前置、可隐藏。
 *   ① 顶部「今日焦点」：逾期最久 1 条 + 今天/明天/3 天内到期，最多 FOCUS_LIMIT 条
 *   ② 统计头收成 2 个大数字（已过期 / 今天明天），其余压成一行小字
 *   ③ 分组默认只展开「已过期」「今天/明天」，其余折叠成计数行（点了才展开）
 *   ④ 删掉优先级色条（与行内高优圆点信息重复）
 *   ⑤ 底部给「不再自动弹出」与「提示设置」两个隐藏入口
 *
 * 数据由 utils/plan-summary.js 的 buildPlanSummary 组装（纯函数，已单测）；
 * 本组件只负责渲染与 emit，不读存储、不算数、不做写操作（打卡在计划详情页）。
 * 样式注意：本组件是独立浮层，不依赖聊天页 scoped 样式（父页 scoped 作用不到这里），
 * 深色块按项目约定写在自己 scoped 里（H5/App 用 html.theme-dark 前缀，MP 用 @media）。
 */
import { ref, watch, computed } from 'vue'
import SijiIcon from '@/components/common/SijiIcon.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  summary: { type: Object, default: () => ({ stats: {}, focus: [], weekBar: null, groups: [], doneHidden: 0, expiredHidden: 0 }) }
})
const emit = defineEmits(['close', 'go-plan', 'go-plan-list', 'disable-auto', 'open-notify'])

/** 入场动画开关：先挂载再置位，否则 translateY(100%) → 0 的过渡不会触发 */
const active = ref(false)
/** 分组展开态：默认只展开这两组，其余折叠 */
const DEFAULT_OPEN = ['overdue', 'today']
const expanded = ref({})

watch(() => props.show, (v) => {
  if (v) {
    const init = {}
    ;(props.summary.groups || []).forEach(g => { init[g.key] = DEFAULT_OPEN.indexOf(g.key) >= 0 })
    expanded.value = init
    setTimeout(() => { active.value = true }, 20)
  } else {
    active.value = false
  }
})

const stats = computed(() => props.summary.stats || {})
const groups = computed(() => props.summary.groups || [])
const focus = computed(() => props.summary.focus || [])
const week = computed(() => props.summary.weekBar || null)
const isEmpty = computed(() => groups.value.length === 0)

function isOpen(key) { return !!expanded.value[key] }
function toggleGroup(key) {
  expanded.value = Object.assign({}, expanded.value, { [key]: !expanded.value[key] })
}

/** 周一 ~ 周日 */
const WEEK_LABEL = ['一', '二', '三', '四', '五', '六', '日']

/** 头部副标题：只说最要紧的一句 */
const headSub = computed(() => {
  const s = stats.value
  if ((s.overdue || 0) > 0) return `有 ${s.overdue} 项已过期`
  if ((s.todayTodo || 0) > 0) return `今天/明天 ${s.todayTodo} 项`
  return '今天没有到期项'
})

/** 次要信息压成一行 */
const smallLine = computed(() => {
  const s = stats.value
  const parts = [`共 ${s.total || 0} 项`]
  if ((s.total || 0) > 0) parts.push(`完成 ${s.completed || 0} · ${s.rate || 0}%`)
  if ((s.expired || 0) > 0) parts.push(`到期 ${s.expired}`)
  if ((s.subTotal || 0) > 0) parts.push(`子计划 ${s.subDone || 0}/${s.subTotal}`)
  return parts.join(' · ')
})
</script>

<template>
  <view v-if="show" class="pss-mask mask-in" @tap="emit('close')">
    <view class="pss-sheet" :class="{ show: active }" @tap.stop>
      <!-- 头部：标题 + 最要紧的一句 + 关闭 -->
      <view class="pss-head">
        <view class="pss-head-left">
          <text class="pss-title">计划汇总</text>
          <text class="pss-sub">{{ headSub }}</text>
        </view>
        <view class="pss-close" @tap="emit('close')">
          <SijiIcon name="close" size="sm" />
        </view>
      </view>

      <scroll-view class="pss-body" scroll-y>
        <!-- 今日焦点：先看该干什么，动作在详情页 -->
        <view v-if="focus.length > 0" class="pss-focus">
          <text class="pss-focus-title">今日焦点</text>
          <view
            v-for="f in focus" :key="f.clientId"
            class="pss-focus-row list-item-tactile" @tap="emit('go-plan', f.clientId)"
          >
            <view class="pss-focus-dot" :class="f.tone" />
            <text class="pss-focus-name">{{ f.title }}</text>
            <text class="pss-focus-tag" :class="f.tone">{{ f.tag }}</text>
            <SijiIcon name="chevron-right" size="sm" />
          </view>
        </view>

        <!-- 两个大数字：只留真会看的两个 -->
        <view class="pss-stats">
          <view class="pss-stat">
            <text class="pss-stat-num" :class="{ warn: (stats.overdue || 0) > 0 }">{{ stats.overdue || 0 }}</text>
            <text class="pss-stat-label">已过期</text>
          </view>
          <view class="pss-stat">
            <text class="pss-stat-num">{{ stats.todayTodo || 0 }}</text>
            <text class="pss-stat-label">今天/明天</text>
          </view>
        </view>
        <text class="pss-small">{{ smallLine }}</text>

        <!-- 本周打卡迷你条 -->
        <view v-if="week" class="pss-week">
          <text class="pss-week-title">本周打卡 {{ week.done }}/{{ week.total }} 天</text>
          <view class="pss-week-bar">
            <view v-for="(on, wi) in week.flags" :key="wi" class="pss-week-col">
              <view class="pss-week-cell" :class="{ on: on, today: wi === week.todayIndex }" />
              <text class="pss-week-day" :class="{ today: wi === week.todayIndex }">{{ WEEK_LABEL[wi] }}</text>
            </view>
          </view>
        </view>

        <!-- 空状态 -->
        <view v-if="isEmpty" class="pss-empty">
          <text class="pss-empty-title">还没有计划</text>
          <text class="pss-empty-desc">跟思迹说一句「帮我记个计划」，它就替你拆好步骤。</text>
        </view>

        <!-- 分组明细：默认只展开已过期 / 今天明天 -->
        <view v-for="g in groups" :key="g.key" class="pss-group">
          <view class="pss-group-head" @tap="toggleGroup(g.key)">
            <text class="pss-group-arrow">{{ isOpen(g.key) ? '▾' : '▸' }}</text>
            <text class="pss-group-label">{{ g.label }}</text>
            <text class="pss-group-count">{{ g.items.length }}</text>
          </view>
          <view v-if="isOpen(g.key)">
            <view
              v-for="it in g.items" :key="it.clientId"
              class="pss-row list-item-tactile" @tap="emit('go-plan', it.clientId)"
            >
              <view class="pss-row-dot" :style="{ background: it.priorityColor }" />
              <view class="pss-row-main">
                <text class="pss-row-title">{{ it.title }}</text>
                <text v-if="it.metaText" class="pss-row-meta" :class="{ warn: it.overdue }">{{ it.metaText }}</text>
              </view>
              <text class="pss-row-status" :class="{ warn: it.overdue }">{{ it.overdue ? '逾期' + it.lateDays + '天' : it.statusText }}</text>
              <SijiIcon name="chevron-right" size="sm" />
            </view>
          </view>
        </view>

        <view v-if="summary.doneHidden > 0" class="pss-more">
          <text class="pss-more-text">已完成另有 {{ summary.doneHidden }} 条较早记录未列出</text>
        </view>
        <view v-if="summary.expiredHidden > 0" class="pss-more">
          <text class="pss-more-text">已到期另有 {{ summary.expiredHidden }} 条较早记录未列出</text>
        </view>

        <view class="pss-pad" />
      </scroll-view>

      <view class="pss-foot">
        <view class="pss-btn btn-tactile" @tap="emit('go-plan-list')">
          <text class="pss-btn-text">去计划页</text>
        </view>
        <view class="pss-foot-links">
          <text class="pss-foot-link" @tap="emit('disable-auto')">不再自动弹出</text>
          <text class="pss-foot-sep">·</text>
          <text class="pss-foot-link" @tap="emit('open-notify')">提示设置</text>
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

/* 今日焦点 */
.pss-focus {
	border: 1rpx solid #E4E4E7;
	border-radius: 16rpx;
	padding: 20rpx 20rpx 8rpx;
	margin-bottom: 24rpx;
}
.pss-focus-title {
	font-size: 22rpx;
	font-weight: 600;
	color: #71717A;
}
.pss-focus-row {
	display: flex;
	align-items: center;
	gap: 14rpx;
	padding: 16rpx 0;
}
.pss-focus-dot {
	width: 12rpx;
	height: 12rpx;
	border-radius: 999rpx;
	flex-shrink: 0;
	background: #A1A1AA;
}
.pss-focus-dot.danger { background: #D35D5D; }
.pss-focus-dot.warn { background: #E8A838; }
.pss-focus-name {
	flex: 1;
	min-width: 0;
	font-size: 28rpx;
	color: #18181B;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.pss-focus-tag {
	font-size: 20rpx;
	flex-shrink: 0;
	color: #A1A1AA;
}
.pss-focus-tag.danger { color: #D35D5D; }
.pss-focus-tag.warn { color: #E8A838; }

/* 两个大数字 + 一行小字 */
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
	font-size: 52rpx;
	font-weight: 600;
	line-height: 1.1;
	color: #18181B;
}
.pss-stat-num.warn {
	color: #D35D5D;
}
.pss-stat-label {
	font-size: 20rpx;
	color: #A1A1AA;
}
.pss-small {
	display: block;
	font-size: 20rpx;
	color: #A1A1AA;
	text-align: center;
	margin-top: 12rpx;
}

/* 本周打卡迷你条 */
.pss-week {
	margin-top: 24rpx;
}
.pss-week-title {
	font-size: 22rpx;
	color: #71717A;
}
.pss-week-bar {
	display: flex;
	gap: 12rpx;
	margin-top: 14rpx;
}
.pss-week-col {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8rpx;
}
.pss-week-cell {
	width: 100%;
	height: 12rpx;
	border-radius: 999rpx;
	background: #E4E4E7;
}
.pss-week-cell.on {
	background: #18181B;
}
.pss-week-cell.today {
	border: 1rpx solid #18181B;
}
.pss-week-day {
	font-size: 18rpx;
	color: #A1A1AA;
}
.pss-week-day.today {
	color: #18181B;
	font-weight: 600;
}

/* 分组 */
.pss-group {
	margin-top: 24rpx;
}
.pss-group-head {
	display: flex;
	align-items: center;
	gap: 8rpx;
	padding: 8rpx 0;
}
.pss-group-arrow {
	font-size: 20rpx;
	color: #A1A1AA;
	width: 20rpx;
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
.pss-foot-links {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 12rpx;
	margin-top: 16rpx;
}
.pss-foot-link {
	font-size: 22rpx;
	color: #A1A1AA;
}
.pss-foot-sep {
	font-size: 22rpx;
	color: #D4D4D8;
}

/* 深色：H5 / App（带 html 前缀，禁止裸 .theme-dark 与 :global 包嵌套） */
/* #ifndef MP-WEIXIN */
html.theme-dark {
	.pss-sheet { background: #27272A; }
	.pss-head { border-bottom-color: #3F3F46; }
	.pss-title { color: #FAFAFA; }
	.pss-sub { color: #A1A1AA; }
	.pss-close { background: #3F3F46; }
	.pss-focus { border-color: #3F3F46; }
	.pss-focus-title { color: #A1A1AA; }
	.pss-focus-name { color: #FAFAFA; }
	.pss-focus-dot { background: #71717A; }
	.pss-focus-dot.danger { background: #F0A0A0; }
	.pss-focus-dot.warn { background: #E8C070; }
	.pss-focus-tag { color: #71717A; }
	.pss-focus-tag.danger { color: #F0A0A0; }
	.pss-focus-tag.warn { color: #E8C070; }
	.pss-stat-num { color: #FAFAFA; }
	.pss-stat-num.warn { color: #F0A0A0; }
	.pss-stat-label { color: #A1A1AA; }
	.pss-small { color: #71717A; }
	.pss-week-title { color: #A1A1AA; }
	.pss-week-cell { background: #3F3F46; }
	.pss-week-cell.on { background: #FAFAFA; }
	.pss-week-cell.today { border-color: #FAFAFA; }
	.pss-week-day { color: #71717A; }
	.pss-week-day.today { color: #FAFAFA; }
	.pss-group-arrow { color: #71717A; }
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
	.pss-foot-link { color: #71717A; }
	.pss-foot-sep { color: #52525B; }
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
	.pss-focus { border-color: #3F3F46; }
	.pss-focus-title { color: #A1A1AA; }
	.pss-focus-name { color: #FAFAFA; }
	.pss-focus-dot { background: #71717A; }
	.pss-focus-dot.danger { background: #F0A0A0; }
	.pss-focus-dot.warn { background: #E8C070; }
	.pss-focus-tag { color: #71717A; }
	.pss-focus-tag.danger { color: #F0A0A0; }
	.pss-focus-tag.warn { color: #E8C070; }
	.pss-stat-num { color: #FAFAFA; }
	.pss-stat-num.warn { color: #F0A0A0; }
	.pss-stat-label { color: #A1A1AA; }
	.pss-small { color: #71717A; }
	.pss-week-title { color: #A1A1AA; }
	.pss-week-cell { background: #3F3F46; }
	.pss-week-cell.on { background: #FAFAFA; }
	.pss-week-cell.today { border-color: #FAFAFA; }
	.pss-week-day { color: #71717A; }
	.pss-week-day.today { color: #FAFAFA; }
	.pss-group-arrow { color: #71717A; }
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
	.pss-foot-link { color: #71717A; }
	.pss-foot-sep { color: #52525B; }
}
/* #endif */
</style>
