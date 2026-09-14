<script setup>
/**
 * 计划执行记录页（3.4.3：进度可回看）
 * 聚合全部计划的「打卡」与「完成」事件，按周/月切换回看，只陈述成果不评价
 */
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getPlanList, logPlanCheckIn } from '@/utils/storage.js'
import { collectPlanExecEvents } from '@/utils/plan-daily.js'
import { collectDayCounts, monthGrid, monthTotals, shiftMonth, canGoNext } from '@/utils/plan-heatmap.js'
import { backfillCandidates, buildPlanIndex, isBackfillable, recurTypeOf } from '@/utils/plan-recur.js'
import PlanHeatmap from '@/components/plan/PlanHeatmap.vue'

const mode = ref('week') // week / month
const events = ref([])
const dayCounts = ref({})
const planList = ref([])

const MODE_OPTIONS = [
	{ label: '本周', value: 'week' },
	{ label: '本月', value: 'month' }
]
const WEEK_CN = ['日', '一', '二', '三', '四', '五', '六']

function pad(n) { return String(n).padStart(2, '0') }
function dateKeyOf(ts) {
	const d = new Date(ts)
	if (isNaN(d.getTime())) return ''
	return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}
function dayLabel(key) {
	const parts = String(key).split('-')
	const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
	if (isNaN(d.getTime())) return key
	return pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' 周' + WEEK_CN[d.getDay()]
}

function loadEvents() {
	planList.value = getPlanList()
	// 上限放宽到 2000：热力图计数是全量的，明细被截断会出现「有颜色点开却是空的」
	events.value = collectPlanExecEvents(planList.value, { max: 2000 })
	dayCounts.value = collectDayCounts(planList.value)
}

onShow(() => { loadEvents() })

// 3.5.3：打卡热力月视图（翻月不改变列表口径，仅切换热力图月份）
const heatYear = ref(new Date().getFullYear())
const heatMonth = ref(new Date().getMonth())
const heatWeeks = computed(() => monthGrid(heatYear.value, heatMonth.value, dayCounts.value))
const heatTotals = computed(() => monthTotals(heatYear.value, heatMonth.value, dayCounts.value))
const heatCanNext = computed(() => canGoNext(heatYear.value, heatMonth.value))

function prevMonth() {
	const s = shiftMonth(heatYear.value, heatMonth.value, -1)
	heatYear.value = s.year
	heatMonth.value = s.month
	selectedDate.value = ''
}

function nextMonth() {
	if (!heatCanNext.value) return
	const s = shiftMonth(heatYear.value, heatMonth.value, 1)
	heatYear.value = s.year
	heatMonth.value = s.month
	selectedDate.value = ''
}

/** 周从周一开始，月从 1 号开始（区间起点毫秒） */
const rangeStart = computed(() => {
	const now = new Date()
	if (mode.value === 'month') {
		return new Date(now.getFullYear(), now.getMonth(), 1).getTime()
	}
	const day = now.getDay()
	const mondayOffset = day === 0 ? -6 : 1 - day
	return new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset).getTime()
})

const rangeEnd = computed(() => {
	const now = new Date()
	if (mode.value === 'week') {
		const day = now.getDay()
		const sundayOffset = day === 0 ? 0 : 7 - day
		return new Date(now.getFullYear(), now.getMonth(), now.getDate() + sundayOffset, 23, 59, 59).getTime()
	}
	return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime()
})

/** 区间键（与归组同口径：都按事件归属日，跨周补记不会跑到本周列表里） */
const rangeStartKey = computed(() => dateKeyOf(rangeStart.value))
const rangeEndKey = computed(() => dateKeyOf(rangeEnd.value))

const visibleEvents = computed(() => events.value.filter(e => {
	const key = eventDayKey(e)
	if (!key) return false
	return key >= rangeStartKey.value && key <= rangeEndKey.value
}))

/** 按日期倒序分组 */
const groups = computed(() => {
	const map = new Map()
	visibleEvents.value.forEach(e => {
		const key = eventDayKey(e)
		if (!key) return
		const list = map.get(key) || []
		const d = new Date(e.at)
		const pad2 = n => String(n).padStart(2, '0')
		list.push({
			...e,
			dateKey: key,
			timeText: pad2(d.getHours()) + ':' + pad2(d.getMinutes())
		})
		map.set(key, list)
	})
	return [...map.entries()].map(([key, items]) => ({
		dateKey: key,
		label: dayLabel(key),
		items: items.sort((a, b) => b.at - a.at)
	}))
})

/** 事件归属日：补记的打卡按补记的那天归位，其余按发生时刻 */
function eventDayKey(e) {
	if (!e) return ''
	const d = e.date
	if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d
	return dateKeyOf(e.at)
}

/** 3.5.4：选中日期的明细（点热力格展开，再点一次收起） */
const selectedDate = ref('')
const dayEvents = computed(() => {
	if (!selectedDate.value) return []
	return events.value
		.filter(e => eventDayKey(e) === selectedDate.value)
		.map(e => {
			const d = new Date(e.at)
			const pad2 = n => String(n).padStart(2, '0')
			return { ...e, timeText: pad2(d.getHours()) + ':' + pad2(d.getMinutes()) }
		})
})
const selectedLabel = computed(() => (selectedDate.value ? dayLabel(selectedDate.value) : ''))
function toggleDay(date) {
	if (!date) return
	selectedDate.value = selectedDate.value === date ? '' : date
}

/** 当前热力月里「至少有一个循环任务可补记」的日子（热力格右下角带点） */
const backfillMap = computed(() => {
	const map = {}
	const rec = planList.value.filter(p => p && p.is_deleted !== 1 && recurTypeOf(p))
	if (rec.length === 0) return map
	const byId = buildPlanIndex(planList.value)
	const now = Date.now()
	const days = new Date(heatYear.value, heatMonth.value + 1, 0).getDate()
	for (let day = 1; day <= days; day++) {
		const date = heatYear.value + '-' + pad(heatMonth.value + 1) + '-' + pad(day)
		if (rec.some(p => isBackfillable(p, byId, date, now))) map[date] = true
	}
	return map
})

/** 3.5.5：长按热力格补记某天（挑一个窗口内的循环任务，选完即落库） */
function onBackfillDay(date) {
	if (!date) return
	const candidates = backfillCandidates(planList.value, date)
	if (candidates.length === 0) {
		uni.showToast({ title: '这天没有可补记的循环任务', icon: 'none' })
		return
	}
	uni.showActionSheet({
		title: '补记 ' + date.slice(5) + ' 到哪个任务',
		itemList: candidates.map(c => c.label),
		success: (res) => {
			const picked = candidates[res.tapIndex]
			if (!picked) return
			applyBackfill(picked, date)
		}
	})
}

function applyBackfill(item, date) {
	const rec = logPlanCheckIn(item.client_id, '', date)
	if (!rec) {
		uni.showToast({ title: '当前状态暂不能打卡', icon: 'none' })
		return
	}
	loadEvents()
	selectedDate.value = date
	uni.showToast({ title: '已补记 ' + date.slice(5), icon: 'none' })
}

function totalCount() {
	return visibleEvents.value.length
}

function goDetail(planId) {
	if (planId) uni.navigateTo({ url: `/pages/plan/detail?clientId=${planId}` })
}
</script>

<template>
	<view class="records-page">
		<view class="rp-head">
			<view class="rp-mode">
				<view
					v-for="opt in MODE_OPTIONS" :key="opt.value"
					class="rp-chip" :class="{ active: mode === opt.value }"
					@tap="mode = opt.value"
				>{{ opt.label }}</view>
			</view>
			<text class="rp-count">{{ totalCount() }} 次</text>
		</view>

		<scroll-view class="rp-scroll" scroll-y>
			<!-- 3.5.3：打卡热力月视图（本月/历史月强度回看） -->
			<PlanHeatmap
				:year="heatYear"
				:month="heatMonth"
				:weeks="heatWeeks"
				:totals="heatTotals"
				:can-next="heatCanNext"
				:backfill-map="backfillMap"
				:selected-date="selectedDate"
				@prev="prevMonth"
				@next="nextMonth"
				@select-day="toggleDay"
				@backfill-day="onBackfillDay"
			/>
			<!-- 3.5.4：选中某天的明细（再点一次热力格收起） -->
			<view v-if="selectedDate" class="rp-day">
				<view class="rp-date">
					<text class="rp-date-text">{{ selectedLabel }}</text>
					<text class="rp-date-count">{{ dayEvents.length }} 件</text>
				</view>
				<view v-if="dayEvents.length === 0" class="rp-day-empty">
					<text class="rp-day-empty-text">这天没有记录。空着也是可以的。</text>
				</view>
				<view
					v-for="item in dayEvents" :key="'d-' + item.at + '-' + item.planId + '-' + item.kind"
					class="rp-item" @tap="goDetail(item.planId)"
				>
					<view class="rp-item-time">
						<text class="rp-time-text">{{ item.timeText }}</text>
					</view>
					<view class="rp-item-body">
						<view class="rp-item-title">
							<text class="rp-kind" :class="'rk-' + item.kind">{{ item.kind === 'done' ? '完成' : '打卡' }}</text>
							<text class="rp-plan-title">{{ item.title }}</text>
						</view>
						<text v-if="item.kind === 'checkin' && item.note" class="rp-note">{{ item.note }}</text>
					</view>
					<text class="rp-arrow">›</text>
				</view>
			</view>
			<view v-if="groups.length === 0" class="rp-empty">
				<text class="rp-empty-text">这段时间还没有打卡或完成记录。允许空着，做了再记。</text>
			</view>

			<view v-for="group in groups" :key="group.dateKey" class="rp-group">
				<view class="rp-date">
					<text class="rp-date-text">{{ group.label }}</text>
					<text class="rp-date-count">{{ group.items.length }} 件</text>
				</view>
				<view
					v-for="item in group.items" :key="item.at + '-' + item.planId + '-' + item.kind"
					class="rp-item" @tap="goDetail(item.planId)"
				>
					<view class="rp-item-time">
						<text class="rp-time-text">{{ item.timeText }}</text>
					</view>
					<view class="rp-item-body">
						<view class="rp-item-title">
							<text class="rp-kind" :class="'rk-' + item.kind">{{ item.kind === 'done' ? '完成' : '打卡' }}</text>
							<text class="rp-plan-title">{{ item.title }}</text>
						</view>
						<text v-if="item.kind === 'checkin' && item.note" class="rp-note">{{ item.note }}</text>
					</view>
					<text class="rp-arrow">›</text>
				</view>
			</view>
			<view style="height: 40rpx" />
		</scroll-view>
	</view>
</template>

<style lang="scss" scoped>
.records-page {
	display: flex;
	flex-direction: column;
	height: 100vh;
	background: #F4F4F5;
}

.rp-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 16rpx 20rpx;
	background: #FFFFFF;
	border-bottom: 1rpx solid #E4E4E7;
}

.rp-mode {
	display: flex;
	gap: 4rpx;
}

.rp-chip {
	padding: 6rpx 28rpx;
	border-radius: 8rpx;
	font-size: 24rpx;
	color: #71717A;
	background: #F4F4F5;

	&.active {
		background: #18181B;
		color: #FFFFFF;
		font-weight: 600;
	}
}

.rp-count {
	font-size: 22rpx;
	color: #71717A;
	font-variant-numeric: tabular-nums;
}

.rp-scroll {
	flex: 1;
}

.rp-group {
	margin: 16rpx 20rpx 0;
}

.rp-date {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	padding: 4rpx 4rpx 8rpx;
}

.rp-date-text {
	font-size: 24rpx;
	font-weight: 700;
	color: #18181B;
}

.rp-date-count {
	font-size: 20rpx;
	color: #A1A1AA;
}

.rp-item {
	display: flex;
	align-items: center;
	gap: 14rpx;
	background: #FFFFFF;
	border-radius: 12rpx;
	padding: 16rpx;
	margin-bottom: 8rpx;

	&:active {
		background: #E4E4E7;
		transform: scale(0.98);
	}
}

.rp-item-time {
	min-width: 76rpx;
}

.rp-time-text {
	font-size: 22rpx;
	color: #A1A1AA;
	font-variant-numeric: tabular-nums;
}

.rp-item-body {
	flex: 1;
	min-width: 0;
}

.rp-item-title {
	display: flex;
	align-items: center;
	gap: 10rpx;
}

.rp-kind {
	font-size: 20rpx;
	font-weight: 700;
	padding: 2rpx 12rpx;
	border-radius: 14rpx;
	flex-shrink: 0;

	&.rk-checkin {
		background: #F4F4F5;
		color: #71717A;
	}

	&.rk-done {
		background: rgba(16, 185, 129, 0.12);
		color: #059669;
	}
}

.rp-plan-title {
	font-size: 26rpx;
	font-weight: 600;
	color: #18181B;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.rp-note {
	display: block;
	margin-top: 2rpx;
	font-size: 22rpx;
	color: #71717A;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.rp-arrow {
	font-size: 30rpx;
	color: #A1A1AA;
	flex-shrink: 0;
}

.rp-empty {
  padding: 80rpx 40rpx;
  text-align: center;
}

.rp-day {
  margin: 12rpx 20rpx 0;
}

.rp-day-empty {
  padding: 20rpx 4rpx;
}

.rp-day-empty-text {
  font-size: 22rpx;
  color: #A1A1AA;
}

.rp-empty-text {
	font-size: 24rpx;
	color: #A1A1AA;
	line-height: 1.6;
}

@media (prefers-color-scheme: dark) {
	.records-page { background: #18181B; }
	.rp-head { background: #27272A; border-bottom-color: #3F3F46; }
	.rp-chip { background: #3F3F46; color: #A1A1AA; &.active { background: #FAFAFA; color: #18181B; } }
	.rp-count { color: #71717A; }
	.rp-date-text { color: #FAFAFA; }
	.rp-date-count { color: #52525B; }
	.rp-item { background: #27272A; &:active { background: #3F3F46; } }
	.rp-time-text { color: #52525B; }
	.rp-kind.rk-checkin { background: #3F3F46; color: #A1A1AA; }
	.rp-plan-title { color: #FAFAFA; }
	.rp-note { color: #A1A1AA; }
	.rp-arrow { color: #52525B; }
	.rp-empty-text { color: #52525B; }
	.rp-day-empty-text { color: #52525B; }
}
</style>
