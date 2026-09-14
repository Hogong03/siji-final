<script setup>
/**
 * 计划行动区（3.5.7：从 pages/plan/detail.vue 抽出）
 *
 * 下一步单卡 + 打卡轻记录 + 本月打卡日历，纯展示：状态与动作全部由页面注入
 */
import PlanWeekStrip from '@/components/plan/PlanWeekStrip.vue'
import PlanHeatmap from '@/components/plan/PlanHeatmap.vue'

defineProps({
	nextStep: { type: Object, default: null },
	planTitle: { type: String, default: '' },
	metaText: { type: String, default: '' },
	buttonText: { type: String, default: '' },
	isNew: { type: Boolean, default: false },
	frozen: { type: Boolean, default: false },
	status: { type: Number, default: 0 },
	todayDone: { type: Boolean, default: false },
	checkinSummary: { type: String, default: '' },
	backfillDate: { type: String, default: '' },
	selfRecurType: { type: String, default: '' },
	selfRecurCount: { type: Number, default: 1 },
	weeklyDone: { type: Number, default: 0 },
	showCheckinInput: { type: Boolean, default: false },
	checkinNote: { type: String, default: '' },
	checkinRecords: { type: Array, default: () => [] },
	weekCells: { type: Array, default: () => [] },
	showCalendar: { type: Boolean, default: false },
	calYear: { type: Number, default: 0 },
	calMonth: { type: Number, default: 0 },
	calWeeks: { type: Array, default: () => [] },
	calTotals: { type: Object, default: () => ({}) },
	calCanNext: { type: Boolean, default: false },
	calSelected: { type: String, default: '' },
	calBackfillMap: { type: Object, default: () => ({}) },
	calDayText: { type: String, default: '' },
	calDayChecked: { type: Boolean, default: false }
})

const emit = defineEmits([
	'complete-next-step',
	'toggle-checkin-input',
	'submit-backfill',
	'submit-checkin',
	'remove-checkin',
	'update:checkinNote',
	'cal-prev',
	'cal-next',
	'select-day',
	'backfill-day'
])

function onNoteInput(e) {
	emit('update:checkinNote', e.detail.value)
}
</script>

<template>
	<view>
		<!-- 3.3 A：下一步单卡（最小行动闭环：一次对话后有一个可点的下一步） -->
		<view v-if="nextStep && !frozen" class="next-step-card">
			<view class="ns-body">
				<text class="ns-label">{{ nextStep._self ? '就剩这一步' : '下一步' }}</text>
				<text class="ns-title">{{ nextStep._self ? planTitle : nextStep.title }}</text>
				<text class="ns-meta">{{ metaText }}</text>
			</view>
			<view class="ns-btn" @tap="emit('complete-next-step')">
				<text>{{ buttonText }}</text>
			</view>
		</view>

		<!-- 3.4.1 B2：打卡（带描述与时刻，轻记录） -->
		<view v-if="!isNew && !frozen && status !== 2" class="checkin-card">
			<view class="ci-head">
				<view class="ci-body">
					<text class="ci-label">{{ todayDone ? '今日已打卡' : '打卡' }}</text>
					<text class="ci-sub">{{ checkinSummary }}</text>
				</view>
				<view class="ci-btn" :class="{ done: todayDone }" @tap.stop="emit('toggle-checkin-input')">
					<text>{{ todayDone ? '补写描述' : '今天做了' }}</text>
				</view>
			</view>
			<!-- 3.5.4：漏了昨天才给「补记」，点一次即可，不追问 -->
			<view v-if="selfRecurType && backfillDate" class="ci-backfill" @tap.stop="emit('submit-backfill')">
				<text>补记 {{ backfillDate.slice(5) }}（昨天漏了）</text>
			</view>
			<!-- 3.5.2：周任务周历（本周七天，一眼看出哪几天做了） -->
			<PlanWeekStrip
				v-if="selfRecurType === 'weekly'"
				:cells="weekCells"
				:target="selfRecurCount"
				:done="weeklyDone"
			/>
			<view v-if="showCheckinInput" class="ci-editor">
				<textarea
					class="ci-note"
					:value="checkinNote"
					placeholder="今天做了什么？（如：散步 20 分钟，可空）"
					:maxlength="200"
					:auto-height="true"
					@input="onNoteInput"
				/>
				<view class="ci-save" @tap.stop="emit('submit-checkin')"><text>{{ todayDone ? '更新' : '记录' }}</text></view>
			</view>
			<view v-if="checkinRecords.length" class="ci-list">
				<view
					v-for="r in checkinRecords" :key="r.date"
					class="ci-item"
					@longpress.stop="emit('remove-checkin', r.date)"
				>
					<text class="ci-item-time">{{ r.date.slice(5) }} {{ r.timeText }}</text>
					<text class="ci-item-note">{{ r.note || '没写描述' }}</text>
				</view>
				<text class="ci-tip">长按某条可撤销那天的打卡</text>
			</view>
		</view>

		<!-- 3.5.5：本月打卡日历（点某天看当天，长按某天补记） -->
		<view v-if="showCalendar" class="section cal-section">
			<text class="section-label">打卡日历</text>
			<PlanHeatmap
				flat
				:year="calYear"
				:month="calMonth"
				:weeks="calWeeks"
				:totals="calTotals"
				:can-next="calCanNext"
				:selected-date="calSelected"
				:backfill-map="calBackfillMap"
				@prev="emit('cal-prev')"
				@next="emit('cal-next')"
				@select-day="(d) => emit('select-day', d)"
				@backfill-day="(d) => emit('backfill-day', d)"
			/>
			<view v-if="calDayText" class="cal-day-row">
				<text class="cal-day-text">{{ calDayText }}</text>
				<view v-if="calDayChecked" class="cal-undo" @tap.stop="emit('remove-checkin', calSelected)">
					<text>撤销这天</text>
				</view>
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
@import './plan-section.scss';
@import './PlanActionSection.scss';
</style>
