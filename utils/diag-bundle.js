/**
 * 诊断包收集（纯同步收集 + 可读文本拼装）
 *
 * 用途：用户报告问题时，设置 → 数据管理 → 导出诊断包，把元数据与错误日志
 * 交给开发者定位环境问题（版本 / 平台 / 存储水位 / 会话规模 / 设置摘要 / 最近错误）。
 *
 * 隐私红线（结构与实现双重保证）：
 *  - 绝不读取 siji_provider_keys / siji_custom_providers（API Key）
 *  - 绝不导出对话正文、记录内容、画像字段 —— 会话只数字量，不取内容
 *  - 错误日志本身可能含消息片段，属可接受范围（日志里已有），最多带最近 50 条
 *
 * 纯函数可单测：tests/diag-bundle.test.js（mock uni storage）
 */

import { getVersion } from '@/utils/version-check.js'
import { getErrorQueue } from '@/utils/error-reporter.js'

/** 会话存储键（store/chat/persist.js 的 CONV_STORAGE_KEY，私有导出不在对外链路） */
const CONV_STORAGE_KEY = 'siji_conversations'

/** 错误日志最多带多少条 */
const MAX_ERRORS = 50

/** 编译目标平台标记（三端构建各留一个分支；vitest 裸跑时走第一个分支返回 'app'） */
export function getPlatformName() {
	// #ifdef APP-PLUS
	return 'app'
	// #endif
	// #ifdef H5
	return 'h5'
	// #endif
	// #ifdef MP-WEIXIN
	return 'mp-weixin'
	// #endif
	return 'unknown'
}

/** 容错读 JSON（persist 层可能存 JSON 字符串，也可能已是对象） */
function readJson(value) {
	if (typeof value !== 'string' || !value) return value
	try {
		return JSON.parse(value)
	} catch (e) {
		return null
	}
}

/** 读会话规模：只数条数，绝不取正文 */
function collectConversationStats() {
	let conversations = readJson(uni.getStorageSync(CONV_STORAGE_KEY))
	if (!Array.isArray(conversations)) conversations = []
	let messages = 0
	conversations.forEach(conv => {
		if (conv && Array.isArray(conv.messages)) messages += conv.messages.length
	})
	return { conversations: conversations.length, messages }
}

/** 读存储水位：只有数量与大小，不导出键名与内容 */
function collectStorageInfo() {
	try {
		const info = uni.getStorageInfoSync() || {}
		const keys = Array.isArray(info.keys) ? info.keys : []
		return {
			count: keys.length,
			currentSizeKB: Number(info.currentSize) || 0,
			limitSizeKB: Number(info.limitSize) || 0
		}
	} catch (e) {
		return { count: 0, currentSizeKB: 0, limitSizeKB: 0 }
	}
}

/** 读设置摘要（键名来源见 utils/font-scale.js / utils/theme.js / utils/ai/providers.js） */
function collectSettings() {
	const pick = (key, fallback) => {
		try {
			const v = uni.getStorageSync(key)
			return (v === '' || v == null) ? fallback : String(v)
		} catch (e) {
			return fallback
		}
	}
	return {
		fontScale: pick('siji_font_scale', 'normal'),
		theme: pick('siji_theme_mode', 'system'),
		provider: pick('siji_ai_provider', 'deepseek'),
		model: pick('siji_ai_model', '')
	}
}

/** 错误条目归一化：浅拷贝定长字段，避免把存储对象直接暴露给调用方 */
function normalizeErrors() {
	let queue = []
	try {
		queue = getErrorQueue() || []
	} catch (e) {
		queue = []
	}
	return queue.slice(-MAX_ERRORS).map(entry => ({
		timestamp: entry && entry.timestamp ? entry.timestamp : 0,
		message: entry && entry.message ? String(entry.message) : '',
		stack: entry && entry.stack ? String(entry.stack) : '',
		context: entry && entry.context ? entry.context : {}
	}))
}

/**
 * 收集诊断包（纯同步；所有 uni 调用兜底 try/catch，任何失败返回安全空值）
 * @returns {{
 *   collectedAt: string, version: string, platform: string,
 *   errors: Array<{timestamp:number,message:string,stack:string,context:object}>,
 *   storageKeys: {count:number,currentSizeKB:number,limitSizeKB:number},
 *   conversationCount: {conversations:number,messages:number},
 *   settings: {fontScale:string,theme:string,provider:string,model:string}
 * }}
 */
export function collectDiagBundle() {
	let version = '1.0.0'
	try {
		version = getVersion() || '1.0.0'
	} catch (e) { /* 用兜底版本 */ }
	return {
		collectedAt: new Date().toISOString(),
		version,
		platform: getPlatformName(),
		errors: normalizeErrors(),
		storageKeys: collectStorageInfo(),
		conversationCount: collectConversationStats(),
		settings: collectSettings()
	}
}

/** 毫秒时间戳 → 本地可读时间（收集时间 / 错误时间共用） */
function formatTime(ts) {
	const d = new Date(Number(ts))
	if (isNaN(d.getTime())) return '-'
	const pad = n => String(n).padStart(2, '0')
	return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
		' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
}

/** 对象安全序列化（单行，失败降级 String） */
function stringifyInline(value) {
	try {
		return JSON.stringify(value)
	} catch (e) {
		return String(value)
	}
}

/**
 * 诊断包 → 可读 markdown 文本（导出 / 粘贴用）
 * @param {object} bundle collectDiagBundle() 的返回值
 * @returns {string}
 */
export function buildDiagText(bundle) {
	const b = bundle || {}
	const lines = []
	lines.push('# 思迹诊断包')
	lines.push('')
	lines.push('- 导出时间: ' + (b.collectedAt ? formatTime(Date.parse(b.collectedAt)) : '-'))
	lines.push('- 应用版本: ' + (b.version || '-'))
	lines.push('- 平台: ' + (b.platform || '-'))
	lines.push('')
	lines.push('## 存储概况')
	lines.push('')
	const storage = b.storageKeys || {}
	lines.push('- 存储键数量: ' + (storage.count || 0) + ' 个')
	lines.push('- 数据总量: ' + (storage.currentSizeKB || 0) + ' KB（上限 ' + (storage.limitSizeKB || 0) + ' KB）')
	const conv = b.conversationCount || {}
	lines.push('- 会话数: ' + (conv.conversations || 0) + ' 个，消息总数: ' + (conv.messages || 0) + ' 条')
	lines.push('')
	lines.push('## 设置摘要')
	lines.push('')
	const s = b.settings || {}
	lines.push('- 字号档位: ' + (s.fontScale || '-'))
	lines.push('- 主题模式: ' + (s.theme || '-'))
	lines.push('- AI 厂商: ' + (s.provider || '-'))
	lines.push('- AI 模型: ' + (s.model || '-'))
	lines.push('')
	lines.push('## 最近错误（' + ((b.errors && b.errors.length) || 0) + ' 条）')
	lines.push('')
	if (Array.isArray(b.errors) && b.errors.length > 0) {
		b.errors.forEach((e, i) => {
			lines.push('### #' + (i + 1) + ' ' + formatTime(e.timestamp))
			lines.push('')
			if (e.message) lines.push(e.message)
			if (e.stack) {
				lines.push('```')
				lines.push(e.stack)
				lines.push('```')
			}
			if (e.context && Object.keys(e.context).length > 0) {
				lines.push('context: ' + stringifyInline(e.context))
			}
			lines.push('')
		})
	} else {
		lines.push('最近没有记录到错误。')
		lines.push('')
	}
	lines.push('> 隐私说明：本诊断包只含元数据与错误日志，不含 API Key、对话正文与记录内容。')
	return lines.join('\n')
}
