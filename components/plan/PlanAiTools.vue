<script setup>
/**
 * 计划 AI 工具区（3.5.7：从 pages/plan/detail.vue 抽出）
 *
 * 4.15：换统一 AI 组件（AiToolButton / AiResultCard）——
 * 统一加载骨架屏、错误卡（重试 + 去 API 设置）、结果持久化时间戳
 */
import AiToolButton from '@/components/ai/AiToolButton.vue'
import AiResultCard from '@/components/ai/AiResultCard.vue'

defineProps({
	status: { type: Number, default: 0 },
	scheduling: { type: Boolean, default: false },
	review: { type: Boolean, default: false },
	nextStepLoading: { type: Boolean, default: false },
	scheduleResult: { type: String, default: '' },
	reviewResult: { type: String, default: '' },
	nextStepResult: { type: String, default: '' },
	scheduleError: { type: String, default: '' },
	reviewError: { type: String, default: '' },
	nextStepError: { type: String, default: '' },
	scheduleAt: { type: Number, default: 0 },
	reviewAt: { type: Number, default: 0 },
	nextStepAt: { type: Number, default: 0 },
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
				<AiToolButton
					label="智能排期" loading-label="排期中…"
					:loading="scheduling" @tap="emit('schedule')"
				/>
				<AiToolButton
					v-if="status === 2"
					label="进度复盘" loading-label="复盘中…"
					:loading="review" @tap="emit('review')"
				/>
				<AiToolButton
					v-if="status === 1"
					label="下一步建议" loading-label="思考中…"
					:loading="nextStepLoading" @tap="emit('next-step')"
				/>
			</view>
		</view>

		<!-- AI 结果（统一卡片：内容/骨架/错误三态） -->
		<view v-if="scheduling || scheduleError || scheduleResult" class="ai-result">
			<AiResultCard
				title="排期建议"
				:content="scheduleResult"
				:loading="scheduling"
				:error="scheduleError"
				:updated-at="scheduleAt"
				@retry="emit('schedule')"
			/>
		</view>
		<view v-if="review || reviewError || reviewResult" class="ai-result">
			<AiResultCard
				title="复盘报告"
				:content="reviewResult"
				:loading="review"
				:error="reviewError"
				:updated-at="reviewAt"
				@retry="emit('review')"
			/>
		</view>
		<view v-if="nextStepLoading || nextStepError || nextStepResult" class="ai-result">
			<AiResultCard
				title="下一步建议"
				:content="nextStepResult"
				:loading="nextStepLoading"
				:error="nextStepError"
				:updated-at="nextStepAt"
				@retry="emit('next-step')"
			/>
		</view>

		<!-- 原有 AI 建议（静态展示，无操作） -->
		<AiResultCard
			v-if="aiAdvice"
			class="ai-result"
			title="AI 建议"
			:content="aiAdvice"
			static-card
		/>
	</view>
</template>

<style lang="scss" scoped>
@import './plan-section.scss';
@import './PlanAiTools.scss';
</style>
