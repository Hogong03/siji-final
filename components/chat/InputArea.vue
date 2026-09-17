<script setup>
/**
 * 输入区组件 v12 —— 图片识别 + 文件读取（3.6.0）
 *
 * 一行输入：图片 / 文件 -> 文本 -> 发送/停止
 * 语音功能已移除；文本类文件本地直读，pdf/office 走解析后端
 */
import SijiIcon from '@/components/common/SijiIcon.vue'
import { ref, computed } from 'vue'
import { chooseAndCompress, compressFileObject, compressImagePath } from '@/utils/image.js'
import { pickOneFile, readPickedFile, fileCardText, classifyFile } from '@/utils/files/index.js'

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
		if (!r.ok) { hint(r.reason); return }
		selectedFile.value = r
		emit('file-selected', r)
	} catch (e) {
		hint('读取失败，请换个文件试试')
	} finally {
		fileLoading.value = false
	}
}
function clearFile() { selectedFile.value = null; emit('file-cleared') }

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
			<view class="img-preview-del" @tap="clearImage"><text>×</text></view>
		</view>

		<!-- 文件预览 -->
		<view v-if="selectedFile" class="img-preview">
			<text class="file-badge">文件</text>
			<text class="img-preview-label">{{ fileLabel }}</text>
			<view class="img-preview-del" @tap="clearFile"><text>×</text></view>
		</view>

		<!-- 输入行 -->
		<view class="input-row">
			<view class="side-btn" @tap="pickImage">
				<SijiIcon name="image" size="sm" color="#71717A" :style="{ opacity: imageLoading ? 0.4 : 1 }" />
			</view>
			<view class="side-btn" @tap="pickFile">
				<SijiIcon name="file" size="sm" color="#71717A" :style="{ opacity: fileLoading ? 0.4 : 1 }" />
			</view>

			<view class="input-wrap">
				<textarea
					class="text-input"
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
				<text class="send-icon">↑</text>
			</view>
			<view v-else class="stop-btn" @tap="$emit('stop')">
				<text class="stop-icon">■</text>
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
.img-preview-del {
	width: 36rpx; height: 36rpx; border-radius: 50%; background: rgba(0,0,0,.1);
	display: flex; align-items: center; justify-content: center; font-size: 24rpx; color: #71717A;
}

/* ──── 输入行 ──── */
.input-row { display: flex; align-items: flex-end; gap: $spacing-sm; }

.side-btn {
	width: 48rpx; height: 48rpx; border-radius: 50%; background: #F4F4F5; border: 1rpx solid #E4E4E7;
	display: flex; align-items: center; justify-content: center; flex-shrink: 0;
	margin-bottom: 12rpx;
	transition: transform 0.12s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s;
	&:active { transform: scale(0.9); background: #E4E4E7; }
}

.input-wrap {
	flex: 1; min-height: 72rpx; max-height: 350rpx; padding: 12rpx 24rpx;
	background: #F4F4F5; border-radius: 36rpx; border: 1rpx solid #E4E4E7;
	display: flex; align-items: center; overflow-y: auto;
	transition: border-color 0.2s ease, background-color 0.2s ease;
	&:focus-within {
		border-color: #000000;
		background: #E4E4E7;
	}
}
.text-input {
	width: 100%; font-size: $font-md; line-height: 1.5; color: #18181B;
	background: transparent; border: none; outline: none; padding: 0; min-height: 40rpx;
}

.send-btn, .stop-btn {
	width: 72rpx; height: 72rpx; border-radius: 50%; flex-shrink: 0;
	display: flex; align-items: center; justify-content: center; transition: all .2s;
}
.send-btn {
	background: #A1A1AA; opacity: .5;
	&.active {
		background: #000000; opacity: 1;
		&:active { transform: scale(1.05); }
	}
}
.send-icon { color: #FFFFFF; font-size: 36rpx; font-weight: 700; }
.stop-btn { background: #18181B; &:active { transform: scale(.9); } }
.stop-icon { color: #FFFFFF; font-size: 28rpx; }

/* ──── 深色模式 ──── */
@media (prefers-color-scheme: dark) {
	.input-area { background: #18181B; border-top-color: #27272A; }
	.side-btn {
		background: #27272A; border-color: #3F3F46;
		&:active { background: #3F3F46; }
	}
	.img-preview { background: #27272A; border-color: #3F3F46; }
	.img-preview-label { color: #A1A1AA; }
	.file-badge { color: #A1A1AA; border-color: #3F3F46; }
	.input-wrap {
		background: #27272A; border-color: #3F3F46;
		&:focus-within {
			border-color: #FAFAFA;
			background: #18181B;
		}
	}
	.send-btn {
		background: #3F3F46; opacity: .6;
		&.active {
			background: #FAFAFA; opacity: 1;
		}
	}
	.send-icon { color: #000000; }
	.text-input { color: #F4F4F5; }
}
</style>
