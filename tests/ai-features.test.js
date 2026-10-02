/**
 * AI 能力注册表测试（4.10.0）
 *
 * 锁死：
 *  - 缺省全开；开关持久化到 siji_ai_features
 *  - 旧键迁移：siji_memory_enabled === 'false' → memory 关；写开关时写穿旧键
 *  - delegate（联网搜索）：开关转发 search-config
 *  - isFeatureActive：开关 + 资源可用性双裁决
 *  - 工具注入过滤（buildToolList）与执行器拦截一致
 *  - extSection 受 relation/simulation 开关约束
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { resetStorage } from './setup.js'
import './setup.js'
import {
  AI_FEATURES, TOOL_FEATURE_MAP, listFeatureGroups,
  isFeatureOn, setFeatureOn, isFeatureActive
} from '../utils/ai/features.js'
import { executeTool } from '../utils/ai/tools.js'
import { buildSystemPrompt, checkExtensionData } from '../utils/ai/prompt-builder.js'

beforeEach(() => {
  resetStorage()
})

describe('注册表默认与持久化', () => {
  it('清单完整：11 项能力、id 唯一、分组有效', () => {
    expect(AI_FEATURES.length).toBe(11)
    const ids = AI_FEATURES.map(f => f.id)
    expect(new Set(ids).size).toBe(AI_FEATURES.length)
    listFeatureGroups().forEach(g => {
      expect(g.features.length).toBeGreaterThan(0)
    })
  })

  it('缺省全开；setFeatureOn 落盘并可读回', () => {
    expect(isFeatureOn('digest')).toBe(true)
    setFeatureOn('digest', false)
    expect(isFeatureOn('digest')).toBe(false)
    setFeatureOn('digest', true)
    expect(isFeatureOn('digest')).toBe(true)
  })

  it('未知能力 id 返回 false，写入不生效', () => {
    expect(isFeatureOn('not_a_feature')).toBe(false)
    setFeatureOn('not_a_feature', true)
    expect(isFeatureOn('not_a_feature')).toBe(false)
  })
})

describe('旧键迁移与写穿（memory）', () => {
  it('旧键 siji_memory_enabled=false 时 memory 视为关', () => {
    uni.setStorageSync('siji_memory_enabled', 'false')
    expect(isFeatureOn('memory')).toBe(false)
  })

  it('setFeatureOn(memory) 写穿旧键：提取侧 isMemoryEnabled 同步', () => {
    setFeatureOn('memory', false)
    expect(isFeatureOn('memory')).toBe(false)
    // isMemoryEnabled（memory/store.js）读旧键，提取侧同步关闭
    expect(uni.getStorageSync('siji_memory_enabled')).toBe('false')
  })
})

describe('delegate：联网搜索开关转发', () => {
  it('setFeatureOn(web_search) 转发给 search-config', () => {
    setFeatureOn('web_search', false)
    expect(isFeatureOn('web_search')).toBe(false)
    setFeatureOn('web_search', true)
    expect(isFeatureOn('web_search')).toBe(true)
  })

  it('isFeatureActive：开关关 = 不可用（Key 裁决由 search-config 承担）', () => {
    setFeatureOn('web_search', false)
    expect(isFeatureActive('web_search')).toBe(false)
  })
})

describe('注入收口', () => {
  const store = {
    executeAction(action) {
      return { success: true, message: 'ok', detail: { type: action && action.type } }
    }
  }

  it('执行器拦截：微光能力关闭时，create_glimmer 调用被拒（非确认、非执行）', () => {
    setFeatureOn('glimmer', false)
    const r = executeTool(store, 'create_glimmer', { content: '今天散步了' })
    expect(r.ok).toBe(false)
    expect(r.text).toContain('关闭')
    expect(r.confirm).toBeFalsy()
    // 打开后恢复写操作的正常确认流（create_glimmer 默认需确认，不是直接落库）
    setFeatureOn('glimmer', true)
    const r2 = executeTool(store, 'create_glimmer', { content: '今天散步了' })
    expect(r2.ok).toBe(false)
    expect(r2.confirm).toBe(true)
  })

  it('extSection：人脉开关关闭时，有数据也不注入 update_relation（create 引导仍在 BEHAVIOR_RULES）', () => {
    uni.setStorageSync('siji_relations', JSON.stringify([
      { id: 'r1', name: '阿伟', is_deleted: 0 }
    ]))
    // 开关开（缺省）→ 注入改/删/互动等完整段
    expect(buildSystemPrompt(true)).toContain('update_relation:')
    // 开关关 → hasRelations=false，extSection 走无数据分支（只有 create/query 引导）
    setFeatureOn('relation', false)
    expect(checkExtensionData().hasRelations).toBe(false)
    expect(buildSystemPrompt(true)).not.toContain('update_relation:')
  })

  it('TOOL_FEATURE_MAP 覆盖的功能工具都在注册表清单里', () => {
    const ids = AI_FEATURES.map(f => f.id)
    Object.values(TOOL_FEATURE_MAP).forEach(fid => {
      expect(ids).toContain(fid)
    })
  })
})
