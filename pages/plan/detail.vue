<script setup>
/**
 * 计划详情 / 新建页
 * 路由: /pages/plan/detail?id=new | ?clientId=xxx
 *
 * 这个文件只做「组合 + 生命周期」，具体职责都在外面：
 *   表单状态与落库 → composables/usePlanForm.js
 *   打卡与打卡日历 → composables/usePlanCheckin.js
 *   子计划动作 → composables/usePlanChildActions.js
 *   下一步单卡 → composables/usePlanNextStep.js
 *   标签管理 → composables/usePlanTags.js
 *   子计划落库 → utils/plan-child.js
 *   表单选项常量 → utils/plan-options.js
 *   视图分块 → components/plan/PlanActionSection.vue + PlanFieldsSection.vue + PlanAiTools.vue
 */
import { onBackPress, onLoad, onShow } from '@dcloudio/uni-app'
import { computed } from 'vue'
import PlanChildPlans from '@/components/plan/PlanChildPlans.vue'
import PlanTagPicker from '@/components/plan/PlanTagPicker.vue'
import PlanActionSection from '@/components/plan/PlanActionSection.vue'
import PlanFieldsSection from '@/components/plan/PlanFieldsSection.vue'
import PlanAiTools from '@/components/plan/PlanAiTools.vue'

import { getPlanList, getChildPlans } from '@/utils/storage.js'
import { useAppStore } from '@/store/index.js'
import { PRIORITY_COLORS, STATUS_MAP, REMINDER_ADVANCE_OPTIONS } from '@/utils/plan-options.js'
import { saveChildPlans } from '@/utils/plan-child.js'
import { usePlanTags } from '@/composables/usePlanTags.js'
import { safeNavigateBack } from '@/utils/nav-helper.js'
import { usePlanForm } from './composables/usePlanForm.js'
import { usePlanCheckin } from './composables/usePlanCheckin.js'
import { usePlanChildActions } from './composables/usePlanChildActions.js'
import { usePlanNextStep } from './composables/usePlanNextStep.js'
import { usePlanAI } from './composables/usePlanAI.js'
import { usePlanChildAI } from './composables/usePlanChildAI.js'

const store = useAppStore()

// ===== 表单 + 落库（usePlanForm） =====
const {
	isNew, planId, saved, initialSnapshot, showTimeEditor, form,
	selfRecurType, selfRecurCount, parentPlan, timeStrip, timeSummary,
	reminderEnabled, reminderAdvanceMin, reminderCustomDate, reminderCustomTimeValue, repeatType,
	snapshotForm, markSaved, markSnapshot, applyStoredItem, persistForm,
	toggleFrozen, handleSave, handleDelete, recurHintText
} = usePlanForm({ saveChildren: saveChildPlans })

const isFrozen = computed(() => !!form.value.frozen_at || form.value.status === 2)

// ===== 打卡 + 本月打卡日历（usePlanCheckin） =====
const {
	checkinStats, checkinRecords, selfCheckins,
	backfillDate, showCheckinInput, checkinNote,
	calYear, calMonth, calSelected, calWeeks, calTotals, calCanNext, calDayText, calBackfillMap, showCalendar,
	syncFromPlan, refreshCalendarMonth, shiftCalendar, planStreak, feedbackAfter,
	checkinSummaryText, toggleCheckinInput, submitCheckIn, submitBackfill, removeCheckin,
	toggleCalDay, onCalBackfill
} = usePlanCheckin({ isNew, planId, selfRecurType, selfRecurCount, isFrozen })

/** 日历选中日是否已有打卡（决定要不要给「撤销这天」） */
const calDayChecked = computed(() => !!selfCheckins.value.find(c => c && c.date === calSelected.value))

// ===== 子计划动作（usePlanChildActions） =====
const {
	childProgress, recurSummary, childSatisfiedToday,
	toggleChildSomeday, checkinChild, updateChildRecur
} = usePlanChildActions({
	form, isNew, planId, initialSnapshot, snapshotForm,
	planStreak, feedbackAfter, onSaved: markSaved
})

// ===== 下一步单卡（usePlanNextStep） =====
const {
	nextStepItem, weekCells,
	loadExecLogs, completeNextStep, nextStepButtonText, nextStepMetaText
} = usePlanNextStep({
	form, isNew, planId, selfRecurType, selfCheckins, childSatisfiedToday,
	persistForm, snapshotForm, initialSnapshot, planStreak, feedbackAfter
})

const nextStepMeta = computed(() => nextStepMetaText(nextStepItem.value))
const nextStepButton = computed(() => nextStepButtonText(nextStepItem.value))

// ===== 标签管理（usePlanTags） =====
const { showTagPicker, openTagPicker, toggleTag, handleAddTag, removeTagFromPlan, tagColor } = usePlanTags(form)

// ===== AI 增强（usePlanAI / usePlanChildAI） =====
const {
	aiScheduling, aiReview, aiNextStep,
	aiScheduleResult, aiReviewResult, aiNextStepResult,
	generateSchedule, generateReview, generateNextStep
} = usePlanAI(form, store, {
	getPlanId: () => planId.value,
	getChildren: () => form.value.childPlans
})

const { aiChildrenLoading, aiBreakdownChildren } = usePlanChildAI(form, store)

// ===== 读盘 =====
function loadPlan() {
	const plans = getPlanList()
	const item = plans.find(p => p.client_id === planId.value)
	if (!item) return
	applyStoredItem(item)
	loadExecLogs(item)
	syncFromPlan(item, plans)
	// 子计划补充孙计划数量（仅展示用，保存时剔除）
	form.value.childPlans.forEach(ch => { ch._subCount = getChildPlans(ch.client_id).length })
	markSnapshot()
}

onLoad((query) => {
	if (query && query.clientId) {
		isNew.value = false
		planId.value = query.clientId
		loadPlan()
	} else if (query && query.id === 'new' && query.parentId) {
		isNew.value = true
		form.value.parent_id = query.parentId
	}
	// 新建模式：记录空表单快照，未输入任何内容时退出不弹确认
	if (!query || !query.clientId) {
		markSnapshot()
	}
})

onShow(() => {
	refreshCalendarMonth()
	if (!isNew.value) loadPlan()
})

onBackPress(() => {
	// 已保存/无任何修改 → 直接退出，不弹确认
	if (saved.value) return false
	if (initialSnapshot.value && snapshotForm() === initialSnapshot.value) return false
	uni.showModal({
		title: '放弃编辑？', content: '当前内容未保存',
		confirmText: '放弃', cancelText: '继续编辑',
		success: (res) => {
			if (!res.confirm) return
			saved.value = true
			safeNavigateBack({ fallback: '/pages/functions/index' })
		}
	})
	return true
})

// ===== 跳转 =====
function goAddChildPlan() {
	uni.navigateTo({ url: `/pages/plan/detail?id=new&parentId=${planId.value}` })
}

function goChildPlan(clientId) {
	uni.navigateTo({ url: `/pages/plan/detail?clientId=${clientId}` })
}

function goParentPlan() {
	if (form.value.parent_id) {
		uni.navigateTo({ url: `/pages/plan/detail?clientId=${form.value.parent_id}` })
	}
}

</script>

<template>
	<view class="detail-page">
		<scroll-view class="detail-scroll" scroll-y>
			<!-- 行动区：下一步单卡 + 打卡 + 本月打卡日历 -->
			<PlanActionSection
				:next-step="nextStepItem"
				:plan-title="form.title"
				:meta-text="nextStepMeta"
				:button-text="nextStepButton"
				:is-new="isNew"
				:frozen="!!form.frozen_at"
				:status="form.status"
				:today-done="checkinStats.todayDone"
				:checkin-summary="checkinSummaryText()"
				:backfill-date="backfillDate"
				:self-recur-type="selfRecurType"
				:self-recur-count="selfRecurCount"
				:weekly-done="checkinStats.weeklyDone || 0"
				:show-checkin-input="showCheckinInput"
				v-model:checkin-note="checkinNote"
				:checkin-records="checkinRecords"
				:week-cells="weekCells"
				:show-calendar="showCalendar"
				:cal-year="calYear"
				:cal-month="calMonth"
				:cal-weeks="calWeeks"
				:cal-totals="calTotals"
				:cal-can-next="calCanNext"
				:cal-selected="calSelected"
				:cal-backfill-map="calBackfillMap"
				:cal-day-text="calDayText"
				:cal-day-checked="calDayChecked"
				@complete-next-step="completeNextStep"
				@toggle-checkin-input="toggleCheckinInput"
				@submit-backfill="submitBackfill"
				@submit-checkin="submitCheckIn"
				@remove-checkin="removeCheckin"
				@cal-prev="shiftCalendar(-1)"
				@cal-next="shiftCalendar(1)"
				@select-day="toggleCalDay"
				@backfill-day="onCalBackfill"
			/>

			<!-- 字段区：父计划 / 优先级 / 状态 / 标题 / 描述 / 标签 / 时间 / 循环 / 提醒 -->
			<PlanFieldsSection
				:parent-plan="parentPlan"
				v-model:priority="form.priority"
				v-model:status="form.status"
				v-model:title="form.title"
				v-model:description="form.description"
				:tags="form.tags"
				v-model:show-time-editor="showTimeEditor"
				:time-strip="timeStrip"
				:time-summary="timeSummary"
				v-model:estimated-date="form.estimated_time"
				v-model:estimated-time="form.estimated_time_value"
				v-model:due-date="form.due_date"
				v-model:due-time="form.due_time"
				v-model:recur-type="form.recur_type"
				v-model:recur-count="form.recur_count"
				:recur-hint="recurHintText()"
				v-model:reminder-enabled="reminderEnabled"
				v-model:reminder-advance-min="reminderAdvanceMin"
				v-model:reminder-custom-date="reminderCustomDate"
				v-model:reminder-custom-time-value="reminderCustomTimeValue"
				:reminder-advance-options="REMINDER_ADVANCE_OPTIONS"
				v-model:repeat-type="repeatType"
				:tag-color="tagColor"
				@remove-tag="removeTagFromPlan"
				@open-tag-picker="openTagPicker"
				@go-parent="goParentPlan"
			/>

			<!-- 子计划（新模型：计划直接包含子计划，点击子计划查看完整情况） -->
			<PlanChildPlans
				:child-plans="form.childPlans"
				:priority-colors="PRIORITY_COLORS"
				:status-map="STATUS_MAP"
				:progress="childProgress"
				:recur-summary="recurSummary"
				:ai-loading="aiChildrenLoading"
				:can-add="!isNew"
				@go-child-plan="goChildPlan"
				@add-child-plan="goAddChildPlan"
				@ai-breakdown="aiBreakdownChildren"
				@checkin-child="checkinChild"
				@update-child-recur="updateChildRecur"
				@postpone-child="(clientId) => toggleChildSomeday(clientId, true)"
				@activate-child="(clientId) => toggleChildSomeday(clientId, false)"
			/>

			<!-- AI 工具 + AI 建议 -->
			<PlanAiTools
				:status="form.status"
				:scheduling="aiScheduling"
				:review="aiReview"
				:next-step-loading="aiNextStep"
				:schedule-result="aiScheduleResult"
				:review-result="aiReviewResult"
				:next-step-result="aiNextStepResult"
				:ai-advice="form.ai_advice"
				@schedule="generateSchedule"
				@review="generateReview"
				@next-step="generateNextStep"
			/>
		</scroll-view>

		<!-- 标签选择弹窗 -->
		<PlanTagPicker
			v-model:visible="showTagPicker"
			:selected-tags="form.tags"
			@toggle-tag="toggleTag"
			@add-tag="handleAddTag"
			@remove-tag="removeTagFromPlan"
		/>

		<!-- 底部操作栏 -->
		<view class="bottom-bar safe-area-bottom">
			<view v-if="!isNew" class="btn-freeze" @tap="toggleFrozen">{{ form.frozen_at ? '恢复计划' : '先放一放' }}</view>
			<view v-if="!isNew" class="btn-delete" @tap="handleDelete">删除</view>
			<view class="btn-save" @tap="handleSave">保存计划</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
@import './detail.scss';
</style>
