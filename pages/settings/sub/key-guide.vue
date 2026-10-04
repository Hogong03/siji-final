<script setup>
/**
 * 连接 AI（免 Key 引导流）
 *
 * 四家厂商的申请引导 + Key 验证保存：
 * - 申请页打开：App 用 plus.runtime.openURL、H5 用 window.open、小程序复制链接
 * - 「验证并保存」：verifyProviderKey 通过后 setProviderKey + setAiProvider 再返回
 * - Key 只存本机（crypto.js 加密），本页不做任何上传
 */
import { ref, computed } from 'vue'
import { useAppStore } from '@/store/index.js'
import { AI_PROVIDERS } from '@/utils/ai/providers.js'
import { verifyProviderKey, PROVIDER_CONSOLE_URLS } from '@/utils/ai/key-verify.js'

const store = useAppStore()

// ──── 厂商引导卡数据（卖点与申请步骤写死，控制台地址来自 key-verify.js） ────
const GUIDE_SELL = {
	deepseek: '直连官网按量付费，不用订阅，价格低',
	zhipu: '有免费模型可用，语音转文字也走智谱',
	qwen: '阿里云百炼出品，模型选择多',
	moonshot: 'Kimi 系列旗舰，长上下文表现好；读 Word/PDF 文档也走它的云端解析'
}
const GUIDE_STEPS = {
	deepseek: ['打开 platform.deepseek.com 注册账号', '左侧「API keys」创建并复制 sk- 开头的 Key'],
	zhipu: ['打开 open.bigmodel.cn 注册账号', '右上角「API Keys」新建并复制 Key'],
	qwen: ['打开 bailian.console.aliyun.com 开通百炼', '「API-KEY 管理」创建并复制 sk- 开头的 Key'],
	moonshot: ['打开 platform.moonshot.cn 注册账号', '「API Key 管理」新建并复制 sk- 开头的 Key']
}
const LOGO_MAP = { deepseek: 'ds', zhipu: 'zg', qwen: 'qw', moonshot: 'ms' }

const guideList = Object.keys(PROVIDER_CONSOLE_URLS).map(id => ({
	id,
	name: AI_PROVIDERS[id].name,
	sell: GUIDE_SELL[id],
	steps: GUIDE_STEPS[id],
	url: PROVIDER_CONSOLE_URLS[id],
	logo: `/static/icons/provider-${LOGO_MAP[id]}-v2.png`
}))

function openConsole(p) {
	// #ifdef APP-PLUS
	plus.runtime.openURL(p.url)
	// #endif
	// #ifdef H5
	window.open(p.url, '_blank')
	// #endif
	// #ifdef MP-WEIXIN
	uni.setClipboardData({
		data: p.url,
		success: () => uni.showToast({ title: '链接已复制，请在浏览器打开', icon: 'none' })
	})
	// #endif
}

// ──── 已拿到 Key：选择厂商 + 验证保存 ────
const selected = ref('zhipu')
const keyInput = ref('')
const verifying = ref(false)
const verifyError = ref('')
const verifyOk = ref(false)

const currentPlaceholder = computed(() => {
	const p = AI_PROVIDERS[selected.value]
	return (p && p.keyPlaceholder) || '粘贴你的 API Key'
})

async function verifyAndSave() {
	if (verifying.value) return
	verifyError.value = ''
	verifyOk.value = false
	const key = keyInput.value.trim()
	if (!key) {
		verifyError.value = '请先粘贴 Key'
		return
	}
	verifying.value = true
	try {
		const r = await verifyProviderKey(selected.value, key)
		if (!r.ok) {
			verifyError.value = r.message
			return
		}
		store.setProviderKey(selected.value, key)
		store.setAiProvider(selected.value)
		verifyOk.value = true
		uni.showToast({ title: '已连接', icon: 'success' })
		setTimeout(() => { uni.navigateBack() }, 600)
	} finally {
		verifying.value = false
	}
}

function goBack() {
	uni.navigateBack()
}
</script>

<template>
	<view class="key-guide-page">
		<!-- 顶部说明 -->
		<view class="intro">
			<text class="intro-text">思迹的 AI 能力由你自己申请的厂商 Key 驱动：Key 加密后只保存在本机，对话数据不上传任何服务器。</text>
		</view>

		<!-- 四家厂商卡 -->
		<view v-for="p in guideList" :key="p.id" class="guide-card">
			<view class="guide-head">
				<image :src="p.logo" mode="aspectFit" class="guide-logo" />
				<view class="guide-info">
					<text class="guide-name">{{ p.name }}</text>
					<text class="guide-sell">{{ p.sell }}</text>
				</view>
				<view class="guide-open" @tap="openConsole(p)">
					<text class="guide-open-text">打开申请页</text>
				</view>
			</view>
			<view class="guide-steps">
				<text class="guide-step">1. {{ p.steps[0] }}</text>
				<text class="guide-step">2. {{ p.steps[1] }}</text>
			</view>
		</view>

		<!-- 已拿到 Key -->
		<view class="have-key">
			<text class="have-key-title">已拿到 Key？</text>
			<view class="provider-chips">
				<view
					v-for="p in guideList" :key="p.id"
					class="chip"
					:class="{ active: selected === p.id }"
					@tap="selected = p.id"
				>
					<text class="chip-text">{{ p.name }}</text>
				</view>
			</view>
			<input
				v-model="keyInput"
				class="key-input"
				type="password"
				:placeholder="currentPlaceholder"
				:maxlength="200"
			/>
			<view class="verify-btn" :class="{ disabled: verifying || !keyInput.trim() }" @tap="verifyAndSave">
				<text class="verify-btn-text">{{ verifying ? '验证中…' : '验证并保存' }}</text>
			</view>
			<text v-if="verifyError" class="verify-error">{{ verifyError }}</text>
			<text v-if="verifyOk" class="verify-ok">验证通过，已连接</text>
		</view>

		<!-- 暂不配置 -->
		<view class="skip-row" @tap="goBack">
			<text class="skip-text">暂不配置，先逛逛</text>
		</view>
	</view>
</template>

<style lang="scss" scoped>
.key-guide-page {
	min-height: 100vh;
	background: #F4F4F5;
	padding: 24rpx;
	padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
	box-sizing: border-box;
}

/* ──── 顶部说明 ──── */
.intro {
	background: #FFFFFF;
	border: 1rpx solid #E4E4E7;
	border-radius: 16rpx;
	padding: 20rpx 24rpx;
	margin-bottom: 20rpx;
}
.intro-text {
	font-size: 26rpx;
	line-height: 1.6;
	color: #71717A;
}

/* ──── 厂商引导卡 ──── */
.guide-card {
	background: #FFFFFF;
	border: 1rpx solid #E4E4E7;
	border-radius: 16rpx;
	padding: 24rpx;
	margin-bottom: 20rpx;
}
.guide-head {
	display: flex;
	align-items: center;
	gap: 16rpx;
}
.guide-logo {
	width: 72rpx;
	height: 72rpx;
	border-radius: 16rpx;
	flex-shrink: 0;
}
.guide-info {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 4rpx;
}
.guide-name {
	font-size: 30rpx;
	font-weight: 600;
	color: #18181B;
}
.guide-sell {
	font-size: 24rpx;
	color: #71717A;
}
.guide-open {
	flex-shrink: 0;
	height: 60rpx;
	line-height: 60rpx;
	padding: 0 24rpx;
	border: 1rpx solid #18181B;
	border-radius: 12rpx;
}
.guide-open-text {
	font-size: 24rpx;
	color: #18181B;
}
.guide-steps {
	margin-top: 16rpx;
	padding-top: 16rpx;
	border-top: 1rpx solid #F4F4F5;
	display: flex;
	flex-direction: column;
	gap: 6rpx;
}
.guide-step {
	font-size: 24rpx;
	line-height: 1.5;
	color: #71717A;
}

/* ──── 已拿到 Key ──── */
.have-key {
	background: #FFFFFF;
	border: 1rpx solid #E4E4E7;
	border-radius: 16rpx;
	padding: 24rpx;
	margin-top: 32rpx;
	display: flex;
	flex-direction: column;
	gap: 20rpx;
}
.have-key-title {
	font-size: 30rpx;
	font-weight: 600;
	color: #18181B;
}
.provider-chips {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
}
.chip {
	height: 60rpx;
	line-height: 58rpx;
	padding: 0 24rpx;
	border: 1rpx solid #E4E4E7;
	border-radius: 12rpx;
	background: #F4F4F5;
}
.chip-text {
	font-size: 24rpx;
	color: #52525B;
}
.chip.active {
	background: #000000;
	border-color: #000000;
}
.chip.active .chip-text {
	color: #FFFFFF;
}
.key-input {
	height: 80rpx;
	background: #F4F4F5;
	border: 1rpx solid #E4E4E7;
	border-radius: 12rpx;
	padding: 0 24rpx;
	font-size: 26rpx;
	color: #18181B;
}
.verify-btn {
	height: 80rpx;
	background: #000000;
	border-radius: 12rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}
.verify-btn.disabled {
	opacity: 0.4;
}
.verify-btn-text {
	font-size: 28rpx;
	font-weight: 600;
	color: #FFFFFF;
}
.verify-error {
	font-size: 24rpx;
	line-height: 1.5;
	color: #B91C1C;
}
.verify-ok {
	font-size: 24rpx;
	line-height: 1.5;
	color: #18181B;
	font-weight: 600;
}

/* ──── 暂不配置 ──── */
.skip-row {
	padding: 28rpx 0 8rpx;
	display: flex;
	justify-content: center;
}
.skip-text {
	font-size: 26rpx;
	color: #71717A;
	text-decoration: underline;
}

/* ──── 深色模式 ──── */
/* #ifndef MP-WEIXIN */
html.theme-dark {
	.key-guide-page { background: #000000; }
	.intro, .guide-card, .have-key {
		background: #18181B;
		border-color: #27272A;
	}
	.intro-text, .guide-sell, .guide-step, .skip-text { color: #A1A1AA; }
	.guide-name, .have-key-title, .verify-ok { color: #FAFAFA; }
	.guide-open {
		border-color: #FAFAFA;
	}
	.guide-open-text { color: #FAFAFA; }
	.guide-steps { border-top-color: #27272A; }
	.chip {
		background: #27272A;
		border-color: #3F3F46;
	}
	.chip-text { color: #A1A1AA; }
	.chip.active {
		background: #FAFAFA;
		border-color: #FAFAFA;
	}
	.chip.active .chip-text { color: #000000; }
	.key-input {
		background: #27272A;
		border-color: #3F3F46;
		color: #F4F4F5;
	}
	.verify-btn { background: #FAFAFA; }
	.verify-btn-text { color: #000000; }
	.verify-error { color: #F87171; }
}
/* #endif */
/* #ifdef MP-WEIXIN */
@media (prefers-color-scheme: dark) {
	.key-guide-page { background: #000000; }
	.intro, .guide-card, .have-key {
		background: #18181B;
		border-color: #27272A;
	}
	.intro-text, .guide-sell, .guide-step, .skip-text { color: #A1A1AA; }
	.guide-name, .have-key-title, .verify-ok { color: #FAFAFA; }
	.guide-open {
		border-color: #FAFAFA;
	}
	.guide-open-text { color: #FAFAFA; }
	.guide-steps { border-top-color: #27272A; }
	.chip {
		background: #27272A;
		border-color: #3F3F46;
	}
	.chip-text { color: #A1A1AA; }
	.chip.active {
		background: #FAFAFA;
		border-color: #FAFAFA;
	}
	.chip.active .chip-text { color: #000000; }
	.key-input {
		background: #27272A;
		border-color: #3F3F46;
		color: #F4F4F5;
	}
	.verify-btn { background: #FAFAFA; }
	.verify-btn-text { color: #000000; }
	.verify-error { color: #F87171; }
}
/* #endif */
</style>
