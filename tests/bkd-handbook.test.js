/**
 * test: BKD 技术手册种子 + 六级内容下线清理（4.19.0）
 *
 * 覆盖 utils/storage/bkd-handbook.js（ensureBkdHandbook 幂等补发 / seed_v 刷新 / 软删不复活）
 * 与 utils/storage/seed-cleanup.js（removeCet6Content：diary 按 seed 与旧前缀软删、
 * tpl_cet6 模板软删、普通记录与用户计划不受影响、幂等）。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import './setup.js'
import { ensureBkdHandbook, BKD_ARTICLE_IDS, BKD_TAG, BKD_SEED_VERSION } from '../utils/storage/bkd-handbook.js'
import { removeCet6Content } from '../utils/storage/seed-cleanup.js'

const NOW = new Date('2026-10-07T12:00:00+08:00').getTime()
const MONTH_KEY = 'diary_2026-10'

function rawList(key) {
  const raw = uni.getStorageSync(key)
  if (!raw) return []
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw } catch (e) { return [] }
}

function putList(key, list) {
  uni.setStorageSync(key, JSON.stringify(list))
}

describe('ensureBkdHandbook（BKD 手册补发）', () => {
  beforeEach(() => {
    uni.clearStorageSync()
  })

  it('空库首跑：4 篇全补发，带 seed 标记与「技术手册」标签', () => {
    const r = ensureBkdHandbook(NOW)
    expect(r.added).toBe(4)
    expect(r.updated).toBe(0)
    expect(r.ids.sort()).toEqual([...BKD_ARTICLE_IDS].sort())
    const list = rawList(MONTH_KEY)
    expect(list.length).toBe(4)
    list.forEach(item => {
      expect(item.seed).toBe('bkd-handbook')
      expect(item.seed_v).toBe(BKD_SEED_VERSION)
      expect(item.tags).toContain(BKD_TAG)
      expect(item.record_type).toBe('note')
      expect(item.is_deleted).toBe(0)
      expect(item.content).toContain('## ')
    })
  })

  it('幂等：再跑一次零补发零刷新', () => {
    ensureBkdHandbook(NOW)
    const r2 = ensureBkdHandbook(NOW)
    expect(r2.added).toBe(0)
    expect(r2.updated).toBe(0)
    expect(rawList(MONTH_KEY).length).toBe(4)
  })

  it('seed_v 落后的记录被刷新内容', () => {
    ensureBkdHandbook(NOW)
    const list = rawList(MONTH_KEY)
    list[0].seed_v = 0
    list[0].content = '旧版内容'
    putList(MONTH_KEY, list)
    const r = ensureBkdHandbook(NOW)
    expect(r.updated).toBe(1)
    const after = rawList(MONTH_KEY).find(x => x.client_id === list[0].client_id)
    expect(after.content).not.toBe('旧版内容')
    expect(after.seed_v).toBe(BKD_SEED_VERSION)
  })

  it('用户删掉的（软删）不复活、不刷新', () => {
    ensureBkdHandbook(NOW)
    const list = rawList(MONTH_KEY)
    list[1].is_deleted = 1
    list[1].content = '用户改过的东西'
    putList(MONTH_KEY, list)
    const r = ensureBkdHandbook(NOW)
    expect(r.added).toBe(0)
    expect(r.updated).toBe(0)
    const after = rawList(MONTH_KEY).find(x => x.client_id === list[1].client_id)
    expect(after.is_deleted).toBe(1)
    expect(after.content).toBe('用户改过的东西')
  })
})

describe('removeCet6Content（六级内容下线清理）', () => {
  beforeEach(() => {
    uni.clearStorageSync()
  })

  it('按 seed 与旧前缀软删，普通记录与已软删的不动', () => {
    putList(MONTH_KEY, [
      { client_id: 'tip_cet6_ch_writing', seed: 'cet6', is_deleted: 0 },
      { client_id: 'tip_cet6_writing_1', is_deleted: 0 },
      { client_id: 'mat_cet6_vocab', seed: 'cet6', is_deleted: 0 },
      { client_id: 'd1-normal', is_deleted: 0 },
      { client_id: 'tip_cet6_reading_2', is_deleted: 1 }
    ])
    const r = removeCet6Content(NOW)
    expect(r.diaryRemoved).toBe(3)
    const list = rawList(MONTH_KEY)
    expect(list.find(x => x.client_id === 'd1-normal').is_deleted).toBe(0)
    expect(list.find(x => x.client_id === 'tip_cet6_ch_writing').is_deleted).toBe(1)
    expect(list.find(x => x.client_id === 'tip_cet6_writing_1').is_deleted).toBe(1)
    expect(list.find(x => x.client_id === 'tip_cet6_reading_2').is_deleted).toBe(1)
  })

  it('tpl_cet6 模板软删；用户从模板建的计划（plan_all）不受影响', () => {
    uni.setStorageSync('plan_template_all', JSON.stringify([
      { client_id: 'tpl_cet6', name: '六级备考', is_deleted: 0 },
      { client_id: 'tpl_study', name: '考试备考', is_deleted: 0 }
    ]))
    uni.setStorageSync('plan_all', JSON.stringify([
      { client_id: 'plan_from_cet6', name: '六级备考', is_deleted: 0 }
    ]))
    const r = removeCet6Content(NOW)
    expect(r.tplRemoved).toBe(1)
    expect(rawList('plan_template_all').find(x => x.client_id === 'tpl_cet6').is_deleted).toBe(1)
    expect(rawList('plan_template_all').find(x => x.client_id === 'tpl_study').is_deleted).toBe(0)
    expect(rawList('plan_all').find(x => x.client_id === 'plan_from_cet6').is_deleted).toBe(0)
  })

  it('幂等：清过再跑统计为零', () => {
    putList(MONTH_KEY, [{ client_id: 'tip_cet6_ch_writing', seed: 'cet6', is_deleted: 0 }])
    uni.setStorageSync('plan_template_all', JSON.stringify([{ client_id: 'tpl_cet6', is_deleted: 0 }]))
    removeCet6Content(NOW)
    const r2 = removeCet6Content(NOW)
    expect(r2.diaryRemoved).toBe(0)
    expect(r2.tplRemoved).toBe(0)
  })
})
