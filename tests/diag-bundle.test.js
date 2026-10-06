/**
 * 诊断包测试（utils/diag-bundle.js）
 *
 * 覆盖：
 *  - collectDiagBundle 结构断言：collectedAt / version / platform 存在
 *  - 错误队列：正确读出 + 截最近 50 条
 *  - 会话规模：只数字量（会话数 / 消息总数），JSON 字符串与对象两种存储形态
 *  - 存储水位：keys 数量与大小字段
 *  - 设置摘要：种子值读取 + 缺省回落
 *  - 隐私红线：siji_provider_keys 的值、对话正文、记录内容绝不进 bundle 与导出文本
 *  - buildDiagText：markdown 分段可读
 *  - 附：isSeedRecord 前缀判定（utils/seed-records.js，任务一的纯函数）
 */
import { describe, it, expect, beforeEach } from 'vitest'
import './setup.js'
import { resetStorage } from './setup.js'
import { collectDiagBundle, buildDiagText } from '@/utils/diag-bundle.js'
import { isSeedRecord, SEED_BADGE } from '@/utils/seed-records.js'

/** 造一批数据：错误队列 / 会话（含正文）/ 记录 / 敏感 Key / 设置 */
function seedAll() {
  const store = global.uni._storage
  // 错误队列：直接写对象数组（对齐真机 setStorageSync(数组) 的语义，绕开 mock 的字符串化）
  store['siji_error_queue'] = [
    { timestamp: 1700000000000, message: 'boom-1', stack: 'Error: boom-1\n  at foo', context: { page: 'chat' }, device: {} },
    { timestamp: 1700000001000, message: 'boom-2', stack: '', context: {}, device: {} }
  ]
  store['siji_conversations'] = JSON.stringify([
    { id: 'c1', title: '会话1', messages: [{ role: 'user', content: '对话正文甲-XYZ' }, { role: 'assistant', content: '回复乙' }] },
    { id: 'c2', title: '会话2', messages: [{ role: 'user', content: '对话正文丙' }] },
    { id: 'c3', title: '空会话', messages: [] }
  ])
  store['diary_2026-09'] = JSON.stringify([{ client_id: 'd1', title: '记录标题-XYZ', content: '记录正文' }])
  // 敏感数据：值要可辨识，导出文本里绝不出现
  store['siji_provider_keys'] = 'SECRET-KEY-PAYLOAD-QQQ'
  store['siji_custom_providers'] = JSON.stringify({ custom1: { key: 'SECRET-CUSTOM-QQQ' } })
  store['siji_my_profile'] = JSON.stringify({ nickname: '画像字段-XYZ' })
  // 设置
  store['siji_font_scale'] = 'large'
  store['siji_theme_mode'] = 'dark'
  store['siji_ai_provider'] = 'zhipu'
  store['siji_ai_model'] = 'glm-5.3'
}

describe('collectDiagBundle 结构', () => {
  beforeEach(() => {
    resetStorage()
    seedAll()
  })

  it('collectedAt / version / platform 存在且类型正确', () => {
    const b = collectDiagBundle()
    expect(typeof b.collectedAt).toBe('string')
    expect(isNaN(Date.parse(b.collectedAt))).toBe(false)
    expect(typeof b.version).toBe('string')
    expect(b.version.length).toBeGreaterThan(0)
    expect(['app', 'h5', 'mp-weixin', 'unknown']).toContain(b.platform)
  })

  it('错误队列正确读出（最近 50 条内）', () => {
    const b = collectDiagBundle()
    expect(b.errors).toHaveLength(2)
    expect(b.errors[0].message).toBe('boom-1')
    expect(b.errors[1].message).toBe('boom-2')
  })

  it('错误队列超过 50 条时截最近 50 条', () => {
    const store = global.uni._storage
    store['siji_error_queue'] = Array.from({ length: 60 }, (_, i) => ({
      timestamp: i, message: 'err-' + i, stack: '', context: {}
    }))
    const b = collectDiagBundle()
    expect(b.errors).toHaveLength(50)
    expect(b.errors[0].message).toBe('err-10')
    expect(b.errors[49].message).toBe('err-59')
  })

  it('错误队列为空 / 存储异常时不抛错，返回空数组', () => {
    resetStorage()
    const b = collectDiagBundle()
    expect(Array.isArray(b.errors)).toBe(true)
    expect(b.errors).toHaveLength(0)
    expect(b.conversationCount.conversations).toBe(0)
    expect(b.conversationCount.messages).toBe(0)
  })

  it('会话规模只数字量：3 个会话、3 条消息', () => {
    const b = collectDiagBundle()
    expect(b.conversationCount.conversations).toBe(3)
    expect(b.conversationCount.messages).toBe(3)
  })

  it('会话以对象数组存储（真机形态）时同样可数', () => {
    global.uni._storage['siji_conversations'] = [
      { id: 'c9', messages: [{ role: 'user', content: 'x' }] }
    ]
    const b = collectDiagBundle()
    expect(b.conversationCount.conversations).toBe(1)
    expect(b.conversationCount.messages).toBe(1)
  })

  it('storageKeys 只含数量与大小，不含键名数组', () => {
    const b = collectDiagBundle()
    expect(typeof b.storageKeys.count).toBe('number')
    expect(b.storageKeys.count).toBeGreaterThanOrEqual(8)
    expect(typeof b.storageKeys.currentSizeKB).toBe('number')
    expect(typeof b.storageKeys.limitSizeKB).toBe('number')
    expect(b.storageKeys.keys).toBeUndefined()
  })

  it('设置摘要读取种子值', () => {
    const b = collectDiagBundle()
    expect(b.settings).toEqual({
      fontScale: 'large',
      theme: 'dark',
      provider: 'zhipu',
      model: 'glm-5.3'
    })
  })

  it('设置缺省回落：normal / system / deepseek', () => {
    resetStorage()
    const b = collectDiagBundle()
    expect(b.settings.fontScale).toBe('normal')
    expect(b.settings.theme).toBe('system')
    expect(b.settings.provider).toBe('deepseek')
  })
})

describe('隐私红线', () => {
  beforeEach(() => {
    resetStorage()
    seedAll()
  })

  it('bundle 全量 JSON 不含 API Key 值 / 对话正文 / 记录内容 / 画像字段', () => {
    const b = collectDiagBundle()
    const json = JSON.stringify(b)
    expect(json).not.toContain('SECRET-KEY-PAYLOAD-QQQ')
    expect(json).not.toContain('SECRET-CUSTOM-QQQ')
    expect(json).not.toContain('对话正文甲-XYZ')
    expect(json).not.toContain('记录标题-XYZ')
    expect(json).not.toContain('画像字段-XYZ')
    expect(json).not.toContain('siji_provider_keys')
  })

  it('导出文本同样不含敏感内容，且带隐私说明', () => {
    const text = buildDiagText(collectDiagBundle())
    expect(text).not.toContain('SECRET-KEY-PAYLOAD-QQQ')
    expect(text).not.toContain('SECRET-CUSTOM-QQQ')
    expect(text).not.toContain('对话正文甲-XYZ')
    expect(text).not.toContain('回复乙')
    expect(text).not.toContain('记录正文')
    expect(text).toContain('不含 API Key')
  })
})

describe('buildDiagText', () => {
  beforeEach(() => {
    resetStorage()
    seedAll()
  })

  it('分段列出：头部 / 存储概况 / 设置摘要 / 最近错误', () => {
    const text = buildDiagText(collectDiagBundle())
    expect(text).toContain('# 思迹诊断包')
    expect(text).toContain('## 存储概况')
    expect(text).toContain('## 设置摘要')
    expect(text).toContain('## 最近错误（2 条）')
    expect(text).toContain('boom-1')
    expect(text).toContain('会话数: 3 个，消息总数: 3 条')
    expect(text).toContain('字号档位: large')
  })

  it('无错误时输出占位说明', () => {
    resetStorage()
    const text = buildDiagText(collectDiagBundle())
    expect(text).toContain('最近没有记录到错误')
  })

  it('入参为空对象时不抛错', () => {
    const text = buildDiagText({})
    expect(text).toContain('# 思迹诊断包')
    expect(text).toContain('最近没有记录到错误')
  })
})

describe('isSeedRecord（内置种子判定）', () => {
  it('tip_cet6_ / mat_cet6_ 前缀命中', () => {
    expect(isSeedRecord({ client_id: 'tip_cet6_ch_writing' })).toBe(true)
    expect(isSeedRecord({ client_id: 'mat_cet6_vocab' })).toBe(true)
  })

  it('普通记录 / 邻近前缀 / 空值不命中', () => {
    expect(isSeedRecord({ client_id: 'd1-abc-123' })).toBe(false)
    expect(isSeedRecord({ client_id: 'tip_cet6' })).toBe(false)
    expect(isSeedRecord({ client_id: 'xtip_cet6_x' })).toBe(false)
    expect(isSeedRecord({})).toBe(false)
    expect(isSeedRecord(null)).toBe(false)
  })

  it('搜索结果形态（{ client_id: item.id }）可用，徽标文案为「内置」', () => {
    expect(isSeedRecord({ client_id: 'tip_cet6_ch_reading' })).toBe(true)
    expect(SEED_BADGE).toBe('内置')
  })
})
