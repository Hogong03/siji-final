<script setup>
/**
 * 计划字段区（3.5.7：从 pages/plan/detail.vue 抽出）
 *
 * 父计划 / 优先级 / 状态 / 标题 / 描述 / 标签 / 时间 / 循环 / 提醒 / 重复
 * 纯展示：所有字段走 v-model 语义（props + update 事件），不改父级对象
 */
import PlanTimeSection from '@/components/plan/PlanTimeSection.vue'
import PlanTimeStrip from '@/components/plan/PlanTimeStrip.vue'
import PlanReminderSection from '@/components/plan/PlanReminderSection.vue'
import {
	PRIORITY_OPTIONS, STATUS_OPTIONS, RECUR_TYPE_OPTIONS,
	RECUR_COUNT_OPTIONS, REPEAT_OPTIONS
} from '@/utils/plan-options.js'

defineProps({
	parentPlan: { type: Object, default: null },
	priority: { type: Number, default: 0 },
	status: { type: Number, default: 0 },
	title: { type: String, default: '' },
	description: { type: String, default: '' },
	tags: { type: Array, default: () => [] },
	showTimeEditor: { type: Boolean, default: false },
	timeStrip: { type: Object, default: null },
	timeSummary: { type: String, default: '' },
	estimatedDate: { type: String, default: '' },
	estimatedTime: { type: String, default: '' },
	dueDate: { type: String, default: '' },
	dueTime: { type: String, default: '' },
	recurType: { type: String, default: '' },
	recurCount: { type: Number, default: 1 },
	recurHint: { type: String, default: '' },
	reminderEnabled: { type: Boolean, default: false },
	reminderAdvanceMin: { type: Number, default: 30 },
	reminderCustomDate: { type: String, default: '' },
	reminderCustomTimeValue: { type: String, default: '' },
	reminderAdvanceOptions: { type: Array, default: () => [] },
	repeatType: { type: String, default: 'none' },
	tagColor: { type: Function, default: null }
})

const emit = defineEmits([
	'update:priority', 'update:status', 'update:title', 'update:description',
	'update:showTimeEditor',
	'update:estimatedDate', 'update:estimatedTime', 'update:dueDate', 'update:dueTime',
	'update:recurType', 'update:recurCount',
	'update:reminderEnabled', 'update:reminderAdvanceMin',
	'update:reminderCustomDate', 'update:reminderCustomTimeValue', 'update:repeatType',
	'remove-tag', 'open-tag-picker', 'go-parent'
])

function chipColor(t) {
	return typeof tagColor === 'function' ? tagColor(t) : '#71717A'
}
</script>

<template>
	<view>
		<!-- 父计划关联 -->
		<view v-if="parentPlan" class="section parent-section" @tap="emit('go-parent')">
			<view class="parent-link">
				<text class="parent-label">↳ 属于</text>
				<text class="parent-title">{{ parentPlan.title }}</text>
				<text class="parent-arrow">›</text>
			</view>
		</view>

		<!-- 优先级 -->
		<view class="section">
			<text class="section-label">优先级</text>
			<view class="priority-row">
				<view
					v-for="p in PRIORITY_OPTIONS" :key="p.value"
					class="priority-item"
					:class="{ active: priority === p.value }"
					:style="priority === p.value ? { background: p.color, color: '#fff' } : { borderColor: p.color, color: p.color }"
					@tap="emit('update:priority', p.value)"
				>
					{{ p.label }}
				</view>
			</view>
		</view>

		<!-- 状态 -->
		<view class="section">
			<text class="section-label">状态</text>
			<view class="status-row">
				<view
					v-for="s in STATUS_OPTIONS" :key="s.value"
					class="status-item"
					:class="{ active: status === s.value }"
					@tap="emit('update:status', s.value)"
				>
					{{ s.label }}
				</view>
			</view>
		</view>

		<!-- 标题 -->
		<view class="section">
			<text class="section-label">标题</text>
			<input
				class="input-field"
				:value="title"
				placeholder="计划名称..."
				maxlength="100"
				@input="(e) => emit('update:title', e.detail.value)"
			/>
		</view>

		<!-- 描述 -->
		<view class="section">
			<text class="section-label">描述</text>
			<textarea
				class="textarea-field"
				:value="description"
				placeholder="详细描述你的计划..."
				:maxlength="2000"
				:auto-height="true"
				@input="(e) => emit('update:description', e.detail.value)"
			/>
		</view>

		<!-- 标签 -->
		<view class="section">
			<text class="section-label">标签</text>
			<view class="tag-chips">
				<view
					v-for="t in tags" :key="t"
					class="tag-chip"
					:style="{ background: chipColor(t) + '1a', color: chipColor(t), borderColor: chipColor(t) }"
					@tap="emit('remove-tag', t)"
				>
					<text class="tc-label">{{ t }}</text>
					<text class="tc-close">✕</text>
				</view>
				<view class="tag-add-btn" @tap="emit('open-tag-picker')">
					<text>+ 添加标签</text>
				</view>
			</view>
		</view>

		<!-- 时间安排（3.2 M4：只读预览条 + 点击展开完整编辑器） -->
		<view class="section time-collapse-section">
			<view class="time-collapse-head">
				<PlanTimeStrip v-if="timeStrip" :strip="timeStrip" class="time-collapse-strip" />
				<text v-else class="time-collapse-empty">{{ timeSummary }}</text>
				<view class="time-collapse-btn" @tap="emit('update:showTimeEditor', !showTimeEditor)">
					<text>{{ showTimeEditor ? '收起' : '编辑时间' }}</text>
				</view>
			</view>
			<PlanTimeSection
				v-if="showTimeEditor"
				class="time-collapse-editor"
				:estimated-date="estimatedDate"
				:estimated-time="estimatedTime"
				:due-date="dueDate"
				:due-time="dueTime"
				@update:estimated-date="(v) => emit('update:estimatedDate', v)"
				@update:estimated-time="(v) => emit('update:estimatedTime', v)"
				@update:due-date="(v) => emit('update:dueDate', v)"
				@update:due-time="(v) => emit('update:dueTime', v)"
			/>
		</view>

		<!-- 循环任务（3.5.0：每天/每周固定动作，打卡计天不置完成） -->
		<view class="section">
			<text class="section-label">循环任务</text>
			<view class="repeat-row">
				<view
					v-for="opt in RECUR_TYPE_OPTIONS" :key="opt.value"
					class="repeat-item"
					:class="{ active: recurType === opt.value }"
					@tap="emit('update:recurType', opt.value)"
				>
					{{ opt.label }}
				</view>
			</view>
			<view v-if="recurType === 'weekly'" class="recur-count-row">
				<text class="recur-count-label">每周</text>
				<view
					v-for="n in RECUR_COUNT_OPTIONS" :key="n"
					class="repeat-item recur-count-item"
					:class="{ active: Number(recurCount) === n }"
					@tap="emit('update:recurCount', n)"
				>
					{{ n }}
				</view>
				<text class="recur-count-label">次</text>
			</view>
			<text class="recur-hint">{{ recurHint }}</text>
		</view>

		<!-- 提醒设置 -->
		<PlanReminderSection
			:enabled="reminderEnabled"
			:advance-min="reminderAdvanceMin"
			:custom-date="reminderCustomDate"
			:custom-time-value="reminderCustomTimeValue"
			:due-date="dueDate"
			:advance-options="reminderAdvanceOptions"
			@update:enabled="(v) => emit('update:reminderEnabled', v)"
			@update:advance-min="(v) => emit('update:reminderAdvanceMin', v)"
			@update:custom-date="(v) => emit('update:reminderCustomDate', v)"
			@update:custom-time-value="(v) => emit('update:reminderCustomTimeValue', v)"
		/>

		<!-- 重复提醒 -->
		<view v-if="reminderEnabled" class="section">
			<text class="section-label">重复</text>
			<view class="repeat-row">
				<view
					v-for="opt in REPEAT_OPTIONS" :key="opt.value"
					class="repeat-item"
					:class="{ active: repeatType === opt.value }"
					@tap="emit('update:repeatType', opt.value)"
				>
					{{ opt.label }}
				</view>
			</view>
			<text v-if="repeatType !== 'none' && reminderCustomDate === ''" class="recur-hint">重复提醒需设置下面的日期和时刻，才会按天/周循环触发</text>
		</view>
	</view>
</template>

<style lang="scss" scoped>
@import './plan-section.scss';
@import './PlanFieldsSection.scss';
</style>
