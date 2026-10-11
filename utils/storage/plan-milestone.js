/**
 * plan-milestone.js — 长效计划的记录沉淀（4.26.0）
 *
 * 背景（用户画像 + 实测需求）：长效打卡计划（如 6 个月学习路线）完成后，
 * 记录流里应该有对应的反馈——打开记录页就能看到「阶段一完成」「计划启动」这类沉淀，
 * 而不是进展只锁在计划详情页里。
 *
 * 两个自动写入点（都幂等，登记表 siji_plan_milestones 兜底）：
 *   1. 启动记录：根计划下的第一次打卡 → 「开始行动：{计划名}」
 *   2. 里程碑记录：阶段/根计划完成（status→2，savePlan 统一收口）→ 「里程碑：{阶段名} 完成」
 *
 * 纯组装函数与登记表在这里；写入调用在 plan.js 的 savePlan / logPlanCheckIn（收口层）。
 * 日常打卡不写记录（防刷屏）——打卡的日常反馈走成果引擎（晚间收尾问询）与计划详情。
 */
import { saveDiary } from './diary.js'

const MILESTONE_REG_KEY = 'siji_plan_milestones'

/** 读取登记表（已写过的启动/里程碑键 → 日期） */
function readRegistry() {
  try {
    const raw = uni.getStorageSync(MILESTONE_REG_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

/** 幂等检查 + 登记：已写返回 false（不再写），未写登记并返回 true */
export function claimMilestoneKey(key, now = Date.now()) {
  const reg = readRegistry()
  if (reg[key]) return false
  reg[key] = new Date(now).toISOString().slice(0, 10)
  uni.setStorageSync(MILESTONE_REG_KEY, JSON.stringify(reg))
  return true
}

/** 阶段进度提示语（阶段完成时带一句整体进度，只报总数不硬凑序号） */
export function phaseIndexText(stageTitle, totalStages) {
  return Number(totalStages) > 1 ? `（整条路线共 ${totalStages} 个阶段）` : ''
}

/**
 * 组装启动记录（纯函数）：根计划下的第一次打卡
 * @returns diary 记录对象（未落库）
 */
export function buildStartRecord(rootPlan, now = Date.now()) {
  const d = new Date(now)
  const pad = n => String(n).padStart(2, '0')
  const today = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
  return {
    client_id: 'ms_start_' + rootPlan.client_id,
    title: '开始行动：' + (rootPlan.title || '计划'),
    record_type: 'note',
    type: 'diary',
    tags: (Array.isArray(rootPlan.tags) && rootPlan.tags.length > 0 ? rootPlan.tags.slice() : ['学习']).concat(['里程碑']),
    category: '',
    images: [],
    pinned: 0,
    emotion: '',
    ai_summary: '',
    ai_advice: '',
    _planId: rootPlan.client_id,
    _planMilestone: 'start',
    content: [
      '# 开始行动：' + (rootPlan.title || '计划'),
      '',
      '今天打出了这个计划的第一次卡 —— 长路线走起来的标志。',
      '',
      '## 目标回顾',
      rootPlan.description || '（计划没有写目标描述）',
      '',
      '## 下一步',
      '按阶段排期推进，每次只看眼前那一步。',
      '',
      '计划详情与打卡进度在「计划」页；每完成一个阶段，这里会出现一条里程碑。'
    ].join('\n'),
    created_at: now,
    updated_at: now,
    is_deleted: 0
  }
}

/**
 * 组装里程碑记录（纯函数）：阶段或根计划完成
 * @param {Object} donePlan 刚完成的计划（阶段或根）
 * @param {Object} rootPlan 所属根计划（donePlan 是根时与 donePlan 相同）
 * @param {number} stageCount 根计划下的阶段总数（无阶段传 0）
 * @param {Object} stats 打卡统计 { stageCheckins, totalCheckins }
 * @returns diary 记录对象（未落库）
 */
export function buildMilestoneRecord(donePlan, rootPlan, stageCount, stats, now = Date.now()) {
  const isRoot = !donePlan.parent_id
  const d = new Date(now)
  const pad = n => String(n).padStart(2, '0')
  const today = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
  const title = isRoot
    ? '里程碑：' + (rootPlan.title || '计划') + ' 全部完成'
    : '里程碑：' + (donePlan.title || '阶段') + ' 完成'
  const lines = [
    '# ' + title,
    '',
    isRoot ? '整条路线走完了。' : phaseIndexText(donePlan.title, stageCount) + '这个阶段收尾了。',
    '',
    '## 完成回顾',
    donePlan.description || rootPlan.description || '（没有写目标描述）',
    ''
  ]
  const stageCheckins = Number(stats && stats.stageCheckins) || 0
  const totalCheckins = Number(stats && stats.totalCheckins) || 0
  if (stageCheckins > 0) lines.push('## 打卡数据', '本阶段打卡 ' + stageCheckins + ' 次；整条路线累计 ' + totalCheckins + ' 次。', '')
  if (!isRoot && stageCount > 0) lines.push('## 下一步', '进入下一阶段，打卡与提醒会自动跟上。', '')
  if (isRoot) lines.push('## 下一步', '路线收官 —— 回头看看 6 个月前的自己。', '')
  return {
    client_id: 'ms_done_' + donePlan.client_id,
    title: title,
    record_type: 'note',
    type: 'diary',
    tags: (Array.isArray(rootPlan.tags) && rootPlan.tags.length > 0 ? rootPlan.tags.slice() : ['学习']).concat(['里程碑']),
    category: '',
    images: [],
    pinned: 0,
    emotion: '',
    ai_summary: '',
    ai_advice: '',
    _planId: rootPlan.client_id,
    _planMilestone: 'done',
    content: lines.join('\n'),
    created_at: now,
    updated_at: now,
    is_deleted: 0
  }
}

/** 根计划体系内的累计打卡数（根自身 + 全部子孙） */
function countCheckinsUnder(planList, rootId) {
  let total = 0
  const walk = (p) => {
    total += (Array.isArray(p.checkins) ? p.checkins.length : 0)
    planList.forEach(q => { if (q && q.parent_id === p.client_id) walk(q) })
  }
  const root = planList.find(p => p && p.client_id === rootId)
  if (root) walk(root)
  return total
}

/** 沿 parent 链向上找根计划；donePlan 自己是根时返回自身；找不到返回 null */
function findRootOf(planList, plan) {
  let cur = plan
  let guard = 0
  while (cur && cur.parent_id && guard < 10) {
    cur = planList.find(p => p && p.client_id === cur.parent_id)
    guard++
  }
  return cur || null
}

/**
 * 完成里程碑写入入口（plan.js savePlan 完成分支调用；幂等，失败不影响计划保存）
 * 只对「分阶段结构」（根下有子计划）的体系、且完成的是「阶段」或「根」写记录 ——
 * 更深层（每周检查点等）完成不写，无子计划的普通小计划完成也不写，都为防刷屏。
 * @returns {Object|null} 写入的记录（未触发/失败返回 null）
 */
export function writePlanMilestoneIfNeeded(planList, donePlan, now = Date.now()) {
  try {
    if (!donePlan || !donePlan.client_id || !Array.isArray(planList)) return null
    const root = findRootOf(planList, donePlan)
    if (!root || root.is_deleted === 1) return null
    const stageCount = planList.filter(p => p && p.parent_id === root.client_id && p.is_deleted !== 1).length
    if (stageCount === 0) return null // 单发计划（无阶段结构）不写，记录流只留长路线的痕迹
    if (donePlan.parent_id) {
      const parent = planList.find(p => p && p.client_id === donePlan.parent_id)
      if (parent && parent.parent_id) return null // 深于阶段（检查点等），不写
    }
    const rec = buildMilestoneRecord(donePlan, root, donePlan.parent_id ? stageCount : 0, {
      // 阶段的打卡数要算整个阶段子树（打卡通常打在每周检查点上，阶段自身 checkins 恒 0）
      stageCheckins: donePlan.parent_id
        ? countCheckinsUnder(planList, donePlan.client_id)
        : (Array.isArray(donePlan.checkins) ? donePlan.checkins.length : 0),
      totalCheckins: countCheckinsUnder(planList, root.client_id)
    }, now)
    if (!claimMilestoneKey('ms_done_' + donePlan.client_id, now)) return null
    saveDiary(rec)
    return rec
  } catch (e) {
    return null
  }
}

/**
 * 启动记录写入入口（plan.js logPlanCheckIn 首次打卡时调用；幂等）
 * 分阶段体系的第一次打卡 → 记录流出现「开始行动」，长路线从这里开始可见；
 * 普通单发计划的打卡不写（高频，会刷屏）。
 * @returns {Object|null}
 */
export function writePlanStartIfNeeded(planList, checkedPlan, now = Date.now()) {
  try {
    if (!checkedPlan || !Array.isArray(planList)) return null
    const root = findRootOf(planList, checkedPlan)
    if (!root || root.is_deleted === 1) return null
    const stageCount = planList.filter(p => p && p.parent_id === root.client_id && p.is_deleted !== 1).length
    if (stageCount === 0) return null
    if (!claimMilestoneKey('ms_start_' + root.client_id, now)) return null
    const rec = buildStartRecord(root, now)
    saveDiary(rec)
    return rec
  } catch (e) {
    return null
  }
}
