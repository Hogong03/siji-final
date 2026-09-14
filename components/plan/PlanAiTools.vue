<script setup>
/**
 * 计划 AI 工具区（3.5.7：从 pages/plan/detail.vue 抽出）
 *
 * AI 工具栏（智能排期 / 进度复盘 / 下一步建议）+ 结果展示 + 原有 AI 建议
 */
import SijiIcon from '@/components/common/SijiIcon.vue'

defineProps({
	status: { type: Number, default: 0 },
	scheduling: { type: Boolean, default: false },
	review: { type: Boolean, default: false },
	nextStepLoading: { type: Boolean, default: false },
	scheduleResult: { type: String, default: '' },
	reviewResult: { type: String, default: '' },
	nextStepResult: { type: String, default: '' },
	aiAdvice: { type: String, default: '' }
})

const emit = defineEmits(['schedule', 'review', 'next-step'])
</script>

<template>
	<view>
		<!-- AI 增强工具栏 -->
		<view class="section ai-tools-section">
			<text class="section-label">AI 工具</text>
			<view class="ai-tools-row">
				<view class="ai-tool-btn" :class="{ loading: scheduling }" @tap="emit('schedule')">
					<SijiIcon name="calendar" size="sm" />
					<text>{{ scheduling ? '排期中...' : '智能排期' }}</text>
				</view>
				<view v-if="status === 2" class="ai-tool-btn" :class="{ loading: review }" @tap="emit('review')">
					<SijiIcon name="stats" size="sm" />
					<text>{{ review ? '复盘中...' : '进度复盘' }}</text>
				</view>
				<view v-if="status === 1" class="ai-tool-btn" :class="{ loading: nextStepLoading }" @tap="emit('next-step')">
					<SijiIcon name="tip" size="sm" />
					<text>{{ nextStepLoading ? '思考中...' : '下一步建议' }}</text>
				</view>
			</view>
			<!-- AI 结果展示 -->
			<view v-if="scheduleResult" class="ai-result">
				<text class="ai-result-title">排期建议</text>
				<text class="ai-result-text">{{ scheduleResult }}</text>
			</view>
			<view v-if="reviewResult" class="ai-result">
				<text class="ai-result-title">复盘报告</text>
				<text class="ai-result-text">{{ reviewResult }}</text>
			</view>
			<view v-if="nextStepResult" class="ai-result">
				<text class="ai-result-title">下一步建议</text>
				<text class="ai-result-text">{{ nextStepResult }}</text>
			</view>
		</view>

		<!-- 原有 AI 建议 -->
		<view v-if="aiAdvice" class="section ai-section">
			<view class="section-label"><SijiIcon name="tip" size="sm" class="section-icon" /><text>AI 建议</text></view>
			<text class="ai-text">{{ aiAdvice }}</text>
		</view>
	</view>
</template>

<style lang="scss" scoped>
@import './plan-section.scss';
@import './PlanAiTools.scss';
</style>
