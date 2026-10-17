/**
 * test: 内置个人画像种子（4.28.0）
 *
 * 覆盖 utils/storage/profile-seed.js：
 *   - ensureProfileSeed 幂等补发 / seed_v 刷新 / 软删不复活
 *   - 「我的画像」画像卡写入：存在即不重写、不动 enabled
 *   - utils/seed-records.js 的 prof_ 前缀注册（内置徽标判定）
 */
import { describe, it, expect, beforeEach } from 'vitest'
import './setup.js'
import { ensureProfileSeed, PROFILE_ARTICLE_IDS, PROFILE_TAG, PROFILE_SEED_VERSION, PROFILE_CARD_TITLE } from '../utils/storage/profile-seed.js'
import { isSeedRecord } from '../utils/seed-records.js'
import { getProfile } from '../utils/profile.js'

const NOW = new Date('2026-10-12T12:00:00+08:00').getTime()
const MONTH_KEY = 'diary_2026-10'

function rawList(key) {
  const raw = uni.getStorageSync(key)
  if (!raw) return []
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw } catch (e) { return [] }
}

function putList(key, list) {
  uni.setStorageSync(key, JSON.stringify(list))
}

describe('ensureProfileSeed（个人画像补发）', () => {
  beforeEach(() => {
    uni.clearStorageSync()
  })

  it('空库首跑：4 篇全补发，带 seed 标记与「个人画像」标签', () => {
    const r = ensureProfileSeed(NOW)
    expect(r.added).toBe(4)
    expect(r.updated).toBe(0)
    expect(r.ids.sort()).toEqual([...PROFILE_ARTICLE_IDS].sort())
    const list = rawList(MONTH_KEY)
    expect(list.length).toBe(4)
    list.forEach(item => {
      expect(item.seed).toBe('profile-seed')
      expect(item.seed_v).toBe(PROFILE_SEED_VERSION)
      expect(item.tags).toContain(PROFILE_TAG)
      expect(item.record_type).toBe('note')
      expect(item.is_deleted).toBe(0)
      expect(item.content).toContain('## ')
    })
  })

  it('幂等：再跑一次零补发零刷新', () => {
    ensureProfileSeed(NOW)
    const r2 = ensureProfileSeed(NOW)
    expect(r2.added).toBe(0)
    expect(r2.updated).toBe(0)
    expect(rawList(MONTH_KEY).length).toBe(4)
  })

  it('seed_v 落后的记录被刷新内容', () => {
    ensureProfileSeed(NOW)
    const list = rawList(MONTH_KEY)
    list[0].seed_v = 0
    list[0].content = '旧版内容'
    putList(MONTH_KEY, list)
    const r = ensureProfileSeed(NOW)
    expect(r.updated).toBe(1)
    const after = rawList(MONTH_KEY).find(x => x.client_id === list[0].client_id)
    expect(after.content).not.toBe('旧版内容')
    expect(after.seed_v).toBe(PROFILE_SEED_VERSION)
  })

  it('用户删掉的（软删）不复活、不刷新', () => {
    ensureProfileSeed(NOW)
    const list = rawList(MONTH_KEY)
    list[1].is_deleted = 1
    list[1].content = '用户改过的东西'
    putList(MONTH_KEY, list)
    const r = ensureProfileSeed(NOW)
    expect(r.added).toBe(0)
    expect(r.updated).toBe(0)
    const after = rawList(MONTH_KEY).find(x => x.client_id === list[1].client_id)
    expect(after.is_deleted).toBe(1)
    expect(after.content).toBe('用户改过的东西')
  })
})

describe('「我的画像」画像卡', () => {
  beforeEach(() => {
    uni.clearStorageSync()
  })

  it('首跑写入画像卡：固定 id、含画像字段、不动 enabled', () => {
    const r = ensureProfileSeed(NOW)
    expect(r.cardAdded).toBe(true)
    const profile = getProfile()
    const card = profile.cards.find(c => c.title === PROFILE_CARD_TITLE)
    expect(card).toBeTruthy()
    expect(card.id).toBe('portrait')
    expect(card.fields['职业方向']).toContain('AI 工程')
    expect(card.fields['人生关键词']).toContain('不要后悔')
    // 内置画像不应擅自打开注入开关
    expect(profile.enabled).toBe(false)
  })

  it('已存在画像卡时不重写；用户自定义过的不被覆盖', () => {
    ensureProfileSeed(NOW)
    // 用户改了画像卡字段
    const profile = getProfile()
    const card = profile.cards.find(c => c.title === PROFILE_CARD_TITLE)
    card.fields['职业方向'] = '用户自己改的方向'
    // 沿用 saveProfile 落盘
    uni.setStorageSync('siji_my_profile', JSON.stringify(profile))
    const r2 = ensureProfileSeed(NOW)
    expect(r2.cardAdded).toBe(false)
    const after = getProfile().cards.find(c => c.title === PROFILE_CARD_TITLE)
    expect(after.fields['职业方向']).toBe('用户自己改的方向')
  })
})

describe('seed-records 前缀注册', () => {
  it('prof_ 前缀命中内置徽标；普通记录不命中', () => {
    expect(isSeedRecord({ client_id: 'prof_portrait' })).toBe(true)
    expect(isSeedRecord({ client_id: 'bkdh_read_path' })).toBe(true)
    expect(isSeedRecord({ client_id: 'd1-normal' })).toBe(false)
  })
})
