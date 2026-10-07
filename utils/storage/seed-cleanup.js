/**
 * seed-cleanup.js — 内置种子内容下线清理（4.19.0）
 *
 * 规矩与 ensureCet6Tips 的补发机制对称：软删（is_deleted=1），不破坏用户数据；
 * 清理函数幂等（已软删的跳过），每次 appReady 调用直到下一个大版本再回收本文件。
 *
 * 4.19.0 下线六级内容（用户已不考六级）：
 *   - 记录：seed === 'cet6'（章节版 4 章 + 复习资料 6 篇）或 client_id 以
 *     tip_cet6_ / mat_cet6_ 开头（3.8.0 的 12 条短技巧旧版，当时没打 seed 标记）
 *   - 计划模板：plan_template_all 里的 tpl_cet6「六级备考」
 *     （定义已从 plan.js 的 DEFAULT_TEMPLATES 删除，软删后不会被补发复活；
 *      用户从模板创建出的计划 client_id 是 plan_ 前缀，不受影响）
 */
import { getRawList, getMonthFromDate } from './helpers.js'
import { asyncSetStorageJSON } from '../store-helpers.js'

const CET6_CLIENT_ID_PREFIXES = ['tip_cet6_', 'mat_cet6_']

/**
 * 可能装着种子记录的记录分片：近 13 个月 + getStorageInfoSync 列出的所有 diary_* key
 * （与 cet6-tips.js 时代的扫描口径一致）
 * @param {number} at
 * @returns {string[]}
 */
function candidateDiaryKeys(at) {
	const base = new Date(at)
	const keys = new Set()
	for (let i = 0; i <= 12; i++) {
		const d = new Date(base.getFullYear(), base.getMonth() - i, 1)
		keys.add('diary_' + getMonthFromDate(d.getTime()))
	}
	try {
		const info = (typeof uni !== 'undefined' && uni.getStorageInfoSync) ? uni.getStorageInfoSync() : null
		const all = (info && info.keys) || []
		all.forEach(k => { if (/^diary_\d{4}-\d{2}$/.test(k)) keys.add(k) })
	} catch (e) { /* 拿不到存储清单也不影响：近 13 个月已经覆盖 */ }
	return Array.from(keys)
}

function isCet6Record(item) {
	if (!item || item.is_deleted === 1) return false
	if (item.seed === 'cet6') return true
	const id = String(item.client_id || '')
	return CET6_CLIENT_ID_PREFIXES.some(p => id.indexOf(p) === 0)
}

/**
 * 下线六级种子内容（幂等，全软删）
 * @param {number} [now] 注入时间（测试用）
 * @returns {{ diaryRemoved: number, tplRemoved: number }}
 */
export function removeCet6Content(now) {
	const at = Number(now) || Date.now()
	let diaryRemoved = 0

	candidateDiaryKeys(at).forEach(key => {
		const list = getRawList(key)
		let changed = false
		list.forEach(item => {
			if (!isCet6Record(item)) return
			item.is_deleted = 1
			item.updated_at = at
			changed = true
			diaryRemoved++
		})
		if (changed) asyncSetStorageJSON(key, list)
	})

	let tplRemoved = 0
	const tpls = getRawList('plan_template_all')
	if (tpls.length > 0) {
		let changed = false
		tpls.forEach(t => {
			if (!t || t.is_deleted === 1) return
			if (t.client_id !== 'tpl_cet6') return
			t.is_deleted = 1
			t.updated_at = at
			changed = true
			tplRemoved++
		})
		if (changed) asyncSetStorageJSON('plan_template_all', tpls)
	}

	return { diaryRemoved, tplRemoved }
}
