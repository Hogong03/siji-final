<script setup>
/**
 * 今日行动条（3.4.3：把长期计划收敛成「今天只做 1-3 件小事」）
 * 数据由父页 usePlanList → collectDailySuggestions 计算，本组件只负责展示与跳转
 * 3.5.2：长按循环任务 → 行内补写描述后打卡（不必进入子计划详情）
 */
import { ref } from 'vue'

defineProps({
	items: { type: Array, default: () => [] }
})
const emit = defineEmits(['go-detail', 'quick-checkin', 'checkin-note'])

const noteFor = ref('')
const noteText = ref('')

function goItem(clientId) {
	emit('go-detail', clientId)
}

function metaText(item) {
	return item.est_minutes > 0 ? ('约 ' + item.est_minutes + ' 分钟') : '没写时长'
}

function quickCheckin(item) {
	if (!item || !item.recurType) return
	emit('quick-checkin', item)
}

/** 长按循环任务：展开行内输入，补写这次做了什么 */
function openNote(item) {
	if (!item || !item.recurType) return
	noteFor.value = item.client_id
	noteText.value = ''
}

function cancelNote() {
	noteFor.value = ''
	noteText.value = ''
}

function saveNote(item) {
	emit('checkin-note', { clientId: item.client_id, note: noteText.value })
	cancelNote()
}
</script>

<template>
	<view class="daily-card">
		<view class="dc-head">
			<view class="dc-left">
				<text class="dc-title">今日行动</text>
				<text class="dc-sub">{{ items.length ? '挑一件最小的开始，做完就够' : '允许空日' }}</text>
			</view>
			<text v-if="items.length" class="dc-count">{{ items.length }}/3</text>
		</view>

		<view v-if="!items.length" class="dc-empty">
			<text class="dc-empty-text">今天没有待做的小事，歇着也行；想动了再来计划页看看。</text>
		</view>
		<view v-else class="dc-list">
			<view v-for="(item, index) in items" :key="item.client_id" class="dc-block">
				<view
					class="dc-item" @tap="goItem(item.client_id)" @longpress.stop="openNote(item)"
				>
					<text class="dc-idx">{{ index + 1 }}</text>
					<view class="dc-body">
						<view class="dc-title-row">
							<text class="dc-name">{{ item.title }}</text>
							<text v-if="item.recurType" class="dc-badge">{{ item.recurText }}</text>
						</view>
						<text class="dc-meta">{{ metaText(item) }} · 来自「{{ item.sourceTitle }}」<text v-if="item.progressText" class="dc-progress"> · {{ item.progressText }}</text></text>
					</view>
					<view v-if="item.recurType" class="dc-check" @tap.stop="quickCheckin(item)" @longpress.stop="openNote(item)">
						<text>打卡</text>
					</view>
					<text v-else class="dc-arrow">›</text>
				</view>
				<view v-if="noteFor === item.client_id" class="dc-note">
					<textarea
						v-model="noteText"
						class="dc-note-input"
						placeholder="这次做了什么？（可空）"
						:maxlength="100"
						:auto-height="true"
					/>
					<view class="dc-note-actions">
						<view class="dc-note-btn" @tap.stop="cancelNote"><text>取消</text></view>
						<view class="dc-note-btn primary" @tap.stop="saveNote(item)"><text>记录</text></view>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
.daily-card {
	margin: 12rpx 20rpx 0;
	padding: 20rpx;
	background: #FFFFFF;
	border-radius: 16rpx;
}

.dc-head {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	margin-bottom: 12rpx;
}

.dc-left {
	flex: 1;
}

.dc-title {
	font-size: 28rpx;
	font-weight: 700;
	color: #18181B;
	padding-left: 12rpx;
	border-left: 4rpx solid #18181B;
}

.dc-sub {
	display: block;
	font-size: 22rpx;
	color: #71717A;
	margin-top: 4rpx;
	padding-left: 16rpx;
}

.dc-count {
	font-size: 24rpx;
	font-weight: 700;
	color: #A1A1AA;
	font-variant-numeric: tabular-nums;
}

.dc-empty {
	padding: 8rpx 0 4rpx;
}

.dc-empty-text {
	font-size: 24rpx;
	color: #A1A1AA;
	line-height: 1.6;
}

.dc-list {
	display: flex;
	flex-direction: column;
	gap: 12rpx;
}

.dc-block {
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}

.dc-note {
	display: flex;
	flex-direction: column;
	gap: 8rpx;
	padding: 12rpx 16rpx;
	background: #FAFAFA;
	border-radius: 12rpx;
}

.dc-note-input {
	width: 100%;
	font-size: 24rpx;
	color: #18181B;
	line-height: 1.5;
}

.dc-note-actions {
	display: flex;
	justify-content: flex-end;
	gap: 12rpx;
}

.dc-note-btn {
	padding: 8rpx 24rpx;
	border-radius: 999rpx;
	font-size: 22rpx;
	font-weight: 600;
	background: #E4E4E7;
	color: #3F3F46;

	&:active { transform: scale(0.95); }
}

.dc-note-btn.primary {
	background: #18181B;
	color: #FFFFFF;
}

.dc-item {
	display: flex;
	align-items: center;
	gap: 14rpx;
	padding: 14rpx 16rpx;
	background: #F4F4F5;
	border-radius: 12rpx;

	&:active {
		background: #E4E4E7;
		transform: scale(0.98);
	}
}

.dc-idx {
	width: 36rpx;
	height: 36rpx;
	border-radius: 50%;
	background: #18181B;
	color: #FFFFFF;
	font-size: 22rpx;
	font-weight: 700;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.dc-body {
	flex: 1;
	min-width: 0;
}

.dc-name {
	display: block;
	font-size: 26rpx;
	font-weight: 600;
	color: #18181B;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.dc-meta {
	display: block;
	font-size: 20rpx;
	color: #71717A;
	margin-top: 2rpx;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.dc-arrow {
	font-size: 32rpx;
	color: #A1A1AA;
	flex-shrink: 0;
}

@media (prefers-color-scheme: dark) {
	.daily-card { background: #27272A; }
	.dc-title { color: #FAFAFA; border-left-color: #FAFAFA; }
	.dc-sub { color: #71717A; }
	.dc-count { color: #52525B; }
	.dc-empty-text { color: #52525B; }
	.dc-item { background: #3F3F46; &:active { background: #52525B; } }
	.dc-idx { background: #FAFAFA; color: #18181B; }
	.dc-name { color: #FAFAFA; }
	.dc-meta { color: #A1A1AA; }
	.dc-arrow { color: #52525B; }
}

.dc-title-row {
	display: flex;
	align-items: center;
	gap: 10rpx;
	min-width: 0;
}
.dc-badge {
	flex-shrink: 0;
	font-size: 18rpx;
	font-weight: 600;
	color: #71717A;
	background: rgba(0, 0, 0, 0.05);
	border-radius: 999rpx;
	padding: 2rpx 10rpx;
}
.dc-progress {
	color: #52525B;
}
.dc-check {
	flex-shrink: 0;
	background: #18181B;
	color: #FFFFFF;
	font-size: 22rpx;
	font-weight: 600;
	padding: 8rpx 20rpx;
	border-radius: 999rpx;

	&:active {
		background: #3F3F46;
		transform: scale(0.95);
	}
}
@media (prefers-color-scheme: dark) {
	.dc-badge { color: #A1A1AA; background: #3F3F46; }
	.dc-progress { color: #71717A; }
	.dc-check { background: #FAFAFA; color: #18181B; &:active { background: #A1A1AA; } }
	.dc-note { background: #27272A; }
	.dc-note-input { color: #FAFAFA; }
	.dc-note-btn { background: #3F3F46; color: #E4E4E7; }
	.dc-note-btn.primary { background: #FAFAFA; color: #18181B; }
}
</style>
