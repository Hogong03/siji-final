/**
 * test: 长效计划的记录沉淀（4.26.0）
 *
 * 需求（画像驱动）：长效打卡计划（如 6 个月学习路线）的进展要在记录流可见 ——
 * 首次打卡自动出现「开始行动」记录，阶段/根完成自动出现「里程碑」记录；
 * 日常小计划与每周检查点不写（防刷屏）；全部幂等（登记表 + 唯一 client_id）。
 *
 * 收口在 storage 层：savePlan 完成分支 + logPlanCheckIn 首次打卡，
 * UI 快切 / AI update_plan / 提醒直达打卡全路径自动生效。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import './setup.js'
import {
  savePlan, getPlanList, logPlanCheckIn, getRawList
} from '../utils/storage/plan.js'
import { getDiaryList } from '../utils/storage/diary.js'

const DAY_MS = 86400000
const NOW = new Date(2026, 9, 12, 15, 0, 0, 0).getTime()

/** 拼一个分阶段计划树：根 + 2 阶段 + 阶段一下 1 个周检查点 */
function seedLearningTree() {
  savePlan({ client_id: 'root', title: '全栈转AI工程师', status: 1, tags: ['学习'], description: '六个月四阶段成长路线' })
  savePlan({ client_id: 'stage1', parent_id: 'root', title: '阶段一：前端巩固', status: 1, description: '追踪完整调用链', tags: [] })
  savePlan({ client_id: 'stage2', parent_id: 'root', title: '阶段二：Java 后端', status: 0, description: '接口全流程', tags: [] })
  savePlan({ client_id: 'ckpt1', parent_id: 'stage1', title: '每周产出：弄懂一条调用链', status: 1, description: '', tags: [] })
}

function diaryOfMonth(ts) {
  const d = new Date(ts)
  const pad = n => String(n).padStart(2, '0')
  return getDiaryList(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`)
}

describe('启动记录：分阶段体系的第一次打卡', () => {
  beforeEach(() => { uni.clearStorageSync() })

  it('首次打卡（打在检查点上）→ 记录出现「开始行动」，带学习标签与里程碑标签', () => {
    seedLearningTree()
    logPlanCheckIn('ckpt1', '弄懂了登录链路')
    const diaries = diaryOfMonth(NOW)
    const start = diaries.find(d => d._planMilestone === 'start')
    expect(start).toBeTruthy()
    expect(start.title).toBe('开始行动：全栈转AI工程师')
    expect(start.tags).toContain('学习')
    expect(start.tags).toContain('里程碑')
    expect(start._planId).toBe('root')
    expect(start.content).toContain('# 开始行动')
    expect(start.content).toContain('六个月四阶段成长路线')
  })

  it('第二次打卡不再写（幂等）；普通单发计划打卡不写', () => {
    seedLearningTree()
    logPlanCheckIn('ckpt1', '第一次')
    logPlanCheckIn('ckpt1', '第二天', new Date(NOW + DAY_MS).toISOString().slice(0, 10))
    // 幂等：仍是同一条启动记录（两月分片去重后计数）
    const seen = new Set()
    diaryOfMonth(NOW).concat(diaryOfMonth(NOW + DAY_MS)).filter(d => d._planMilestone === 'start').forEach(d => seen.add(d.client_id))
    expect(seen.size).toBe(1)
    // 普通单发计划（无阶段结构）打卡不写
    savePlan({ client_id: 'single', title: '买牛奶', status: 1 })
    logPlanCheckIn('single', '')
    const ids = new Set()
    diaryOfMonth(NOW).concat(diaryOfMonth(NOW + DAY_MS)).filter(d => d._planId === 'single').forEach(d => ids.add(d.client_id))
    expect(ids.size).toBe(0)
  })
})

describe('里程碑记录：阶段/根完成自动沉淀', () => {
  beforeEach(() => { uni.clearStorageSync() })

  it('阶段完成（UI 快切 savePlan 路径）→ 里程碑记录含回顾/打卡数据/下一步', () => {
    seedLearningTree()
    logPlanCheckIn('ckpt1', '第一次')
    savePlan({ client_id: 'stage1', title: '阶段一：前端巩固', status: 2, description: '追踪完整调用链', parent_id: 'root' })
    const ms = diaryOfMonth(NOW).find(d => d._planMilestone === 'done')
    expect(ms).toBeTruthy()
    expect(ms.title).toBe('里程碑：阶段一：前端巩固 完成')
    expect(ms.content).toContain('## 完成回顾')
    expect(ms.content).toContain('追踪完整调用链')
    expect(ms.content).toContain('本阶段打卡 1 次')
    expect(ms.content).toContain('## 下一步')
    expect(ms.tags).toContain('学习')
  })

  it('根完成 → 「全部完成」；检查点完成（深层）不写；撤销再完成不重复写', () => {
    seedLearningTree()
    logPlanCheckIn('ckpt1', 'x')
    // 深层检查点完成：不写
    savePlan({ client_id: 'ckpt1', parent_id: 'stage1', title: '每周产出：弄懂一条调用链', status: 2 })
    expect(diaryOfMonth(NOW).find(d => d._planMilestone === 'done')).toBeFalsy()
    // 阶段完成：写
    savePlan({ client_id: 'stage1', parent_id: 'root', title: '阶段一：前端巩固', status: 2 })
    expect(diaryOfMonth(NOW).find(d => d._planMilestone === 'done')).toBeTruthy()
    // 撤销（status 回 1）→ 再完成：登记表拦截，不重复写
    savePlan({ client_id: 'stage1', parent_id: 'root', title: '阶段一：前端巩固', status: 1 })
    savePlan({ client_id: 'stage1', parent_id: 'root', title: '阶段一：前端巩固', status: 2 })
    const dones = diaryOfMonth(NOW).filter(d => d._planMilestone === 'done')
    expect(dones).toHaveLength(1)
    // 根完成：「全部完成」标题
    savePlan({ client_id: 'root', title: '全栈转AI工程师', status: 2, tags: ['学习'] })
    const rootMs = diaryOfMonth(NOW).find(d => d.client_id === 'ms_done_root')
    expect(rootMs.title).toContain('全部完成')
  })

  it('普通单发计划完成不写（记录流只留长路线痕迹）', () => {
    savePlan({ client_id: 'single', title: '买牛奶', status: 1 })
    savePlan({ client_id: 'single', title: '买牛奶', status: 2 })
    expect(diaryOfMonth(NOW).filter(d => d._planMilestone === 'done')).toHaveLength(0)
  })
})
