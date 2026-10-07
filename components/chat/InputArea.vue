<script setup>
/**
 * 输入区组件 v14 —— 图片识别 + 文件读取 + 语音转文字
 *
 * 一行输入：图片 / 文件 / 语音 -> 文本 -> 发送/停止
 * 语音（v14）：录音 ≤25s → 智谱 ASR 转写 → 填入输入框（不自动发送）；
 *   能力开关默认关（features.js 的 voice），无智谱 Key 时点击给引导提示
 * 文本类文件本地直读，pdf/office 走解析后端
 * v13：所有按钮触控热区扩到 ≥44px（88rpx），视觉圆点保持原尺寸
 */
import SijiIcon from '@/components/common/SijiIcon.vue'
import { ref, computed, onUnmounted } from 'vue'
import { chooseAndCompress, compressFileObject, compressImagePath } from '@/utils/image.js'
import { pickOneFile, readPickedFile, fileCardText, classifyFile, isDocParseAvailable } from '@/utils/files/index.js'
import { isFeatureOn } from '@/utils/ai/features.js'
import { isDark } from '@/utils/theme.js'
import { fontRpx } from '@/utils/font-scale.js'
import { getProviderKeys } from '@/utils/ai/providers.js'
import { startRecording, stopRecording, cancelRecording } from '@/utils/ai/recorder.js'
import { transcribeAudio } from '@/utils/ai/transcribe.js'

// ──── 按钮显隐（能力开关：图片识别 4.10.0 / 语音转文字 v14，默认关）────
const visionOn = ref(isFeatureOn('vision'))
const voiceOn = ref(isFeatureOn('voice'))
function onFeaturesChanged() {
	visionOn.value = isFeatureOn('vision')
	voiceOn.value = isFeatureOn('voice')
}
uni.$on('ai-features-changed', onFeaturesChanged)
onUnmounted(() => {
	uni.$off('ai-features-changed', onFeaturesChanged)
	// 离开页面时若还在录音，直接丢弃（不转写）
	if (recording.value) cancelRecording()
})

const props = defineProps({
	modelValue: { type: String, default: '' },
	disabled: { type: Boolean, default: false },
	isSending: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'send', 'stop', 'image-selected', 'image-cleared', 'file-selected', 'file-cleared'])

// ──── 文本输入 ────
const text = ref('')

function onInput(e) {
	// #ifdef H5
	text.value = e.target?.value ?? e.detail?.value ?? ''
	// #endif
	// #ifndef H5
	text.value = e.detail?.value ?? ''
	// #endif
	emit('update:modelValue', text.value)
	saveDraft(text.value)
}

// ──── 图片识别 ────
const selectedImage = ref(null)
const imageLoading = ref(false)

async function pickImage() {
	if (imageLoading.value) return
	imageLoading.value = true
	try {
		const r = await chooseAndCompress()
		if (r) { selectedImage.value = r; emit('image-selected', r) }
	} finally { imageLoading.value = false }
}
function clearImage() { selectedImage.value = null; emit('image-cleared') }

// ──── 文件读取（3.6.0） ────
const selectedFile = ref(null)
const fileLoading = ref(false)
const fileLabel = computed(() => (selectedFile.value ? fileCardText(selectedFile.value) : ''))

/** 长文案走模态框，短文案走 toast（App 端 toast 会截断） */
function hint(msg) {
	if (!msg) return
	if (msg.length > 14) {
		uni.showModal({ title: '这个文件读不了', content: msg, showCancel: false, confirmText: '知道了' })
		return
	}
	uni.showToast({ title: msg, icon: 'none' })
}

/**
 * 文档类读取失败：缺解析 Key 的场景给「去配置」直达（4.12.2）——
 * Word/PDF 走 Moonshot 云端解析，无 Key 时其他提示都是死胡同
 */
function hintDocKey(result) {
	if (result && result.kind === 'document' && !isDocParseAvailable()) {
		uni.showModal({
			title: '读 Word/PDF 需要解析 Key',
			content: '文档解析走云端完成（智谱 / Moonshot Key 均可，自动选用你已配置的那个）。现在去配置吗？',
			confirmText: '去配置',
			cancelText: '先不了',
			success: (res) => {
				if (res.confirm) uni.navigateTo({ url: '/pages/settings/sub/ai' })
			}
		})
		return
	}
	hint(result && result.reason)
}

async function pickFile() {
	if (fileLoading.value) return
	fileLoading.value = true
	try {
		const picked = await pickOneFile()
		if (!picked.ok) { hint(picked.reason); return }
		// 3.10.0：选到图片就当图片发（复用识别通道），不再要求用户再点一次图片按钮
		if (classifyFile(picked.pick.name, picked.pick.mime) === 'image') {
			const compressed = await compressImagePath(picked.pick.path)
			if (compressed) {
				selectedImage.value = compressed
				emit('image-selected', compressed)
				return
			}
			hint('这张图片读不了，换一张试试')
			return
		}
		const r = await readPickedFile(picked.pick)
		if (!r.ok) { hintDocKey(r); return }
		selectedFile.value = r
		emit('file-selected', r)
	} catch (e) {
		hint('读取失败，请换个文件试试')
	} finally {
		fileLoading.value = false
	}
}
function clearFile() { selectedFile.value = null; emit('file-cleared') }

// ──── 语音转文字（录音 → 智谱 ASR → 填入输入框，不自动发送）────
const recording = ref(false)
const transcribing = ref(false)

/** 点麦克风：空闲则开录，录音中则停并转写 */
async function toggleVoice() {
	if (recording.value) { stopAndTranscribe(); return }
	if (transcribing.value) return
	const keys = getProviderKeys()
	if (!keys || !keys.zhipu) {
		uni.showToast({ title: '语音转写走智谱，先在 AI 配置里填智谱 Key', icon: 'none' })
		return
	}
	const ok = await startRecording({
		// 25s 自动停（recorder.js 内置限时）：走与手动停止同一条转写路径
		onAutoStop: () => { stopAndTranscribe() }
	})
	if (!ok) {
		uni.showToast({ title: '无法开始录音，请检查麦克风权限', icon: 'none' })
		return
	}
	recording.value = true
}

async function stopAndTranscribe() {
	if (!recording.value) return
	recording.value = false
	transcribing.value = true
	try {
		const res = await stopRecording()
		if (!res || res.cancelled) return
		let text = ''
		// #ifdef H5
		if (res.blob) text = await transcribeAudio('', res.blob)
		// #endif
		// #ifndef H5
		if (res.path) text = await transcribeAudio(res.path)
		// #endif
		if (text) {
			setVoiceText(text)
		} else {
			uni.showToast({ title: '没听清，再试一次', icon: 'none' })
		}
	} catch (e) {
		uni.showToast({ title: (e && e.message) || '语音转写失败，请重试', icon: 'none' })
	} finally {
		transcribing.value = false
	}
}

/** 转写结果填进输入框（不自动发送），与草稿保存同一套 */
function setVoiceText(t) {
	if (!t) return
	text.value = t
	emit('update:modelValue', t)
	saveDraft(t)
}

// ──── H5 粘贴图片（截图/Ctrl+V 直接进压缩预览，阻止浏览器下载弹框） ────
function onPaste(e) {
	// #ifdef H5
	const cd = (e && e.clipboardData) || (e && e.detail && e.detail.clipboardData)
	if (!cd) return
	let file = null
	const items = cd.items || []
	for (let i = 0; i < items.length; i++) {
		const it = items[i]
		if (it && it.kind === 'file' && it.type && it.type.indexOf('image/') === 0) {
			file = (typeof it.getAsFile === 'function') ? it.getAsFile() : it
			break
		}
	}
	if (!file && cd.files && cd.files.length > 0) {
		file = Array.from(cd.files).find(f => f.type && f.type.indexOf('image/') === 0) || null
	}
	if (!file || imageLoading.value) return
	if (e.preventDefault) e.preventDefault()
	if (e.stopPropagation) e.stopPropagation()
	imageLoading.value = true
	compressFileObject(file).then(r => {
		if (r) { selectedImage.value = r; emit('image-selected', r) }
		else uni.showToast({ title: '图片处理失败，请点左侧图片按钮', icon: 'none' })
	}).finally(() => { imageLoading.value = false })
	// #endif
}

// ──── 发送 ────
const canSend = computed(() => !props.disabled && (text.value.trim() || selectedImage.value || selectedFile.value))

/**
 * 发送/停止键配色内联驱动（4.12.9）：html.theme-dark 深色块在 App 样式编译器上不可靠
 * （4.12.7/4.12.8 两轮实证：同一块内部分属性生效部分不生效，停止键白方块/图标显示不清）。
 * 配色直接由响应式 isDark 算出内联样式，内联优先级最高、三端编译器无解释空间；
 * scss 深色块保留（H5 主实现），两处值一致不冲突。
 */
const sendDotStyle = computed(() => {
  if (isDark.value) {
    return canSend.value ? { background: '#FAFAFA', opacity: 1 } : { background: '#3F3F46', opacity: 0.6 }
  }
  return canSend.value ? { background: '#000000', opacity: 1 } : { background: '#A1A1AA', opacity: 0.5 }
})
const sendIconStyle = computed(() => ({ color: (isDark.value && canSend.value) ? '#000000' : '#FFFFFF' }))
const stopDotStyle = computed(() => ({ background: isDark.value ? '#3F3F46' : '#18181B' }))
const stopIconStyle = computed(() => ({ color: isDark.value ? '#F4F4F5' : '#FFFFFF' }))

function handleSend() {
	if (!canSend.value) return
	const msg = text.value.trim()
	if (msg.length > 2000) {
		uni.showToast({ title: '单条消息不能超过2000字', icon: 'none' })
		return
	}
	emit('send', msg || (selectedFile.value ? '读一下这个文件' : '请识别并分析这张截图'))
}
function reset() {
	text.value = ''
	selectedImage.value = null
	selectedFile.value = null
	emit('update:modelValue', '')
	saveDraft('')
}

// ──── 草稿自动保存（300ms 轻量防抖） ────
const DRAFT_KEY = 'siji_chat_draft'
let draftTimer = null
function saveDraft(v) {
	if (draftTimer) clearTimeout(draftTimer)
	draftTimer = setTimeout(() => {
		try { uni.setStorageSync(DRAFT_KEY, v) } catch (e) {}
	}, 300)
}
function loadDraft() {
	try {
		const d = uni.getStorageSync(DRAFT_KEY)
		if (d) { text.value = d; emit('update:modelValue', d) }
	} catch (e) {}
}
loadDraft()

// ──── 对外接口（供父组件编辑重发/取图） ────
function setText(t) { if (t) { text.value = t; emit('update:modelValue', t) } }
defineExpose({ reset, setText, getImage: () => selectedImage.value, resetImage: () => { selectedImage.value = null } })
</script>

<template>
	<view class="input-area safe-area-bottom">
		<!-- 图片预览 -->
		<view v-if="selectedImage" class="img-preview">
			<image :src="selectedImage.base64" mode="aspectFill" class="img-preview-thumb" />
			<text class="img-preview-label">图片待发送</text>
			<view class="img-preview-del" @tap="clearImage"><view class="del-dot"><text>×</text></view></view>
		</view>

		<!-- 文件预览（4.17.0：解析中态 —— 大文档上传云端需要数秒） -->
		<view v-if="fileLoading && !selectedFile" class="img-preview">
			<text class="file-badge">文件</text>
			<text class="img-preview-label">正在解析文件，请稍候…</text>
		</view>
		<view v-if="selectedFile" class="img-preview">
			<text class="file-badge">文件</text>
			<text class="img-preview-label">{{ fileLabel }}</text>
			<view class="img-preview-del" @tap="clearFile"><view class="del-dot"><text>×</text></view></view>
		</view>

		<!-- 输入行 -->
		<view class="input-row">
			<view v-if="visionOn" class="side-btn" @tap="pickImage">
				<view class="side-dot">
					<SijiIcon name="image" size="sm" color="#71717A" :style="{ opacity: imageLoading ? 0.4 : 1 }" />
				</view>
			</view>
			<!-- 语音转文字：能力开关默认关；录音中切实心停止态，转写中半透明 -->
			<view v-if="voiceOn" class="side-btn" @tap="toggleVoice">
				<view class="side-dot" :class="{ recording: recording }">
					<view v-if="!recording" class="mic-glyph" :style="{ opacity: transcribing ? 0.4 : 1 }">
						<view class="mic-body" />
						<view class="mic-arc" />
					</view>
					<text v-else class="mic-stop">■</text>
				</view>
			</view>
			<view class="side-btn" @tap="pickFile">
				<view class="side-dot">
					<SijiIcon name="file" size="sm" color="#71717A" :style="{ opacity: fileLoading ? 0.4 : 1 }" />
				</view>
			</view>

			<view class="input-wrap">
				<textarea
					class="text-input"
					:style="{ fontSize: fontRpx(30) }"
					:value="text"
					placeholder="说点什么…"
					:auto-height="true"
					:maxlength="2000"
					:show-confirm-bar="false"
					:adjust-position="true"
					:cursor-spacing="20"
					confirm-type="send"
					disable-default-padding
					@input="onInput"
					@paste="onPaste"
					@confirm="handleSend"
				/>
			</view>

			<view v-if="!isSending" class="send-btn" :class="{ active: canSend }" @tap="handleSend">
				<view class="send-dot" :style="sendDotStyle"><text class="send-icon" :style="sendIconStyle">↑</text></view>
			</view>
			<view v-else class="stop-btn" @tap="$emit('stop')">
				<view class="stop-dot" :style="stopDotStyle"><text class="stop-icon" :style="stopIconStyle">■</text></view>
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
.input-area {
	background: #FFFFFF;
	border-top: 1rpx solid #E4E4E7;
	padding: $spacing-sm $spacing-md;
	padding-bottom: calc($spacing-sm + env(safe-area-inset-bottom));
	transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* ──── 图片预览 ──── */
.img-preview {
	display: flex; align-items: center; gap: $spacing-sm; padding: 8rpx 16rpx;
	background: #F4F4F5; border-radius: 16rpx; margin-bottom: $spacing-sm;
	border: 1rpx solid #E4E4E7;
}
.img-preview-thumb { width: 80rpx; height: 80rpx; border-radius: 8rpx; flex-shrink: 0; }
.img-preview-label { flex: 1; font-size: 26rpx; color: #71717A; }
.file-badge {
	font-size: 22rpx; color: #71717A; flex-shrink: 0;
	border: 1rpx solid #E4E4E7; border-radius: 6rpx; padding: 2rpx 8rpx;
}
/* 删除键：热区 64rpx（32px），视觉圆点 40rpx */
.img-preview-del {
	width: 64rpx; height: 64rpx; flex-shrink: 0;
	display: flex; align-items: center; justify-content: center;
}
.del-dot {
	width: 40rpx; height: 40rpx; border-radius: 50%; background: rgba(0,0,0,.1);
	display: flex; align-items: center; justify-content: center;
	font-size: 26rpx; color: #71717A;
}

/* ──── 输入行 ──── */
.input-row { display: flex; align-items: flex-end; gap: $spacing-sm; }

/* 图片/文件键：热区 88rpx（44px），视觉圆点 48rpx */
.side-btn {
	width: 88rpx; height: 88rpx; flex-shrink: 0;
	display: flex; align-items: center; justify-content: center;
}
.side-dot {
	width: 48rpx; height: 48rpx; border-radius: 50%; background: #F4F4F5; border: 1rpx solid #E4E4E7;
	display: flex; align-items: center; justify-content: center;
	margin-bottom: 12rpx;
	transition: transform 0.12s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s;
}
.side-btn:active .side-dot { transform: scale(0.9); background: #E4E4E7; }

/* 麦克风：static/icons 无 mic 图标，用 CSS 画线框麦克风；录音中切实心停止态 */
.mic-glyph {
	display: flex; flex-direction: column; align-items: center;
}
.mic-body {
	width: 14rpx; height: 24rpx; border-radius: 7rpx; background: #18181B;
}
.mic-arc {
	width: 26rpx; height: 12rpx;
	border: 3rpx solid #18181B; border-top: none;
	border-radius: 0 0 14rpx 14rpx;
	margin-top: 4rpx; box-sizing: border-box;
}
.side-dot.recording {
	background: #18181B; border-color: #18181B;
}
.side-dot.recording:active { background: #18181B; }
.mic-stop {
	color: #FFFFFF; font-size: 24rpx; line-height: 1;
}

.input-wrap {
	flex: 1; min-height: 72rpx; max-height: 350rpx; padding: 12rpx 24rpx;
	background: #F4F4F5; border-radius: 36rpx; border: 1rpx solid #E4E4E7;
	display: flex; align-items: center; overflow-y: auto;
	transition: border-color 0.2s ease, background-color 0.2s ease;
	&:focus-within {
		border-color: #000000;
	}
}
.text-input {
	width: 100%; font-size: $font-md; line-height: 1.5; color: #18181B;
	background: transparent; border: none; outline: none; padding: 0; min-height: 40rpx;
}

/* 发送/停止键：热区 88rpx（44px），视觉圆点 72rpx */
.send-btn, .stop-btn {
	width: 88rpx; height: 88rpx; flex-shrink: 0;
	display: flex; align-items: center; justify-content: center;
}
.send-dot, .stop-dot {
	width: 72rpx; height: 72rpx; border-radius: 50%;
	display: flex; align-items: center; justify-content: center; transition: all .2s;
}
.send-dot {
	background: #A1A1AA; opacity: .5;
}
.send-btn.active .send-dot {
	background: #000000; opacity: 1;
}
.send-btn:active .send-dot { transform: scale(1.05); }
.send-icon { color: #FFFFFF; font-size: 36rpx; font-weight: 700; }
.stop-dot { background: #18181B; }
.stop-btn:active .stop-dot { transform: scale(.9); }
.stop-icon { color: #FFFFFF; font-size: 28rpx; }

/* ──── 深色模式 ──── */
/* #ifndef MP-WEIXIN */
html.theme-dark {
	.input-area { background: #18181B; border-top-color: #27272A; }
	.side-dot {
		background: #27272A; border-color: #3F3F46;
	}
	.mic-body { background: #F4F4F5; }
	.mic-arc { border-color: #F4F4F5; }
	.side-dot.recording {
		background: #FAFAFA; border-color: #FAFAFA;
	}
	.mic-stop { color: #18181B; }
	.side-btn:active .side-dot { background: #3F3F46; }
	.del-dot { background: rgba(255,255,255,.12); }
	.img-preview { background: #27272A; border-color: #3F3F46; }
	.img-preview-label { color: #A1A1AA; }
	.file-badge { color: #A1A1AA; border-color: #3F3F46; }
	.input-wrap {
		background: #27272A; border-color: #3F3F46;
		&:focus-within {
			border-color: #FAFAFA;
		}
	}
	.send-dot {
		background: #3F3F46; opacity: .6;
	}
	.send-btn.active .send-dot {
		background: #FAFAFA; opacity: 1;
	}
	/* 黑箭头只配白圆（激活态）；未激活的深灰圆上保持浅色箭头，否则隐形（4.12.8） */
	.send-btn.active .send-icon { color: #000000; }
	.stop-dot { background: #3F3F46; }
	.stop-icon { color: #F4F4F5; }
	.text-input { color: #F4F4F5; }

}
/* #endif */
/* #ifdef MP-WEIXIN */
@media (prefers-color-scheme: dark) {
	.input-area { background: #18181B; border-top-color: #27272A; }
	.side-dot {
		background: #27272A; border-color: #3F3F46;
	}
	.mic-body { background: #F4F4F5; }
	.mic-arc { border-color: #F4F4F5; }
	.side-dot.recording {
		background: #FAFAFA; border-color: #FAFAFA;
	}
	.mic-stop { color: #18181B; }
	.side-btn:active .side-dot { background: #3F3F46; }
	.del-dot { background: rgba(255,255,255,.12); }
	.img-preview { background: #27272A; border-color: #3F3F46; }
	.img-preview-label { color: #A1A1AA; }
	.file-badge { color: #A1A1AA; border-color: #3F3F46; }
	.input-wrap {
		background: #27272A; border-color: #3F3F46;
		&:focus-within {
			border-color: #FAFAFA;
		}
	}
	.send-dot {
		background: #3F3F46; opacity: .6;
	}
	.send-btn.active .send-dot {
		background: #FAFAFA; opacity: 1;
	}
	.send-btn.active .send-icon { color: #000000; }
	.stop-dot { background: #3F3F46; }
	.stop-icon { color: #F4F4F5; }
	.text-input { color: #F4F4F5; }
}
/* #endif */
</style>
