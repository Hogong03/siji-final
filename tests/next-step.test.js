/**
 * next-step.js 测试（3.5.13：对话收尾的最小行动单卡）
 *
 * 覆盖：取最小叶子（与今日行动条同口径）、无候选返回 null、每天最多一次的展示节流。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { resetStorage } from './setup.js'
import { pickNextStep, shouldOfferNextStep, markNextStepShown } from '../utils/next-step.js'

const T0 = new Date(2026, 8, 14, 10, 0, 0).getTime()

let seq = 0
function mkPlan(over) {
  seq += 1
  return Object.assign({
    client_id: 'n' + seq,
    title: '计划' + seq,
    status: 1,
    parent_id: '',
    est_minutes: 0,
    created_at: T0 + seq,
    is_deleted: 0
  }, over)
}

beforeEach(() => {
  resetStorage()
})

describe('pickNextStep：取最小的一件', () => {
  it('同一主计划里取预计耗时最小的叶子', () => {
    const plans = [
      mkPlan({ client_id: 'root', title: '恢复体力' }),
      mkPlan({ client_id: 'big', parent_id: 'root', title: '跑步 5 公里', est_minutes: 40 }),
      mkPlan({ client_id: 'small', parent_id: 'root', title: '出门走 5 分钟', est_minutes: 5 })
    ]
    expect(pickNextStep(plans)).toMatchObject({
      client_id: 'small',
      title: '出门走 5 分钟',
      minutes: 5,
      sourceTitle: '恢复体力'
    })
  })

  it('多主计划时先出更小的那件', () => {
    const plans = [
      mkPlan({ client_id: 'a', title: '学英语' }),
      mkPlan({ client_id: 'a1', parent_id: 'a', title: '背 50 个词', est_minutes: 30 }),
      mkPlan({ client_id: 'b', title: '整理房间' }),
      mkPlan({ client_id: 'b1', parent_id: 'b', title: '收桌面', est_minutes: 5 })
    ]
    expect(pickNextStep(plans).client_id).toBe('b1')
  })

  it('没有候选（全完成 / 冷藏 / 已删除）→ null', () => {
    const plans = [
      mkPlan({ client_id: 'root', title: '计划' }),
      mkPlan({ client_id: 'done', parent_id: 'root', status: 2 }),
      mkPlan({ client_id: 'frozen', parent_id: 'root', frozen_at: T0 }),
      mkPlan({ client_id: 'del', parent_id: 'root', is_deleted: 1 })
    ]
    expect(pickNextStep(plans)).toBeNull()
  })

  it('不传 plans 时走 getPlanList', () => {
    uni.setStorageSync('plan_all', JSON.stringify([
      mkPlan({ client_id: 'root', title: '计划' }),
      mkPlan({ client_id: 'leaf', parent_id: 'root', title: '最小的一件', est_minutes: 3 })
    ]))
    expect(pickNextStep()).toMatchObject({ client_id: 'leaf', minutes: 3 })
  })
})

describe('每天最多一次', () => {
  it('首次可给，标记后当天不再给，跨天恢复', () => {
    expect(shouldOfferNextStep(T0)).toBe(true)
    markNextStepShown(T0)
    expect(shouldOfferNextStep(T0 + 60 * 1000)).toBe(false)
    expect(shouldOfferNextStep(T0 + 6 * 60 * 60 * 1000)).toBe(false)
    expect(shouldOfferNextStep(T0 + 24 * 60 * 60 * 1000)).toBe(true)
  })
})
