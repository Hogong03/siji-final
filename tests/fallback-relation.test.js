import { describe, it, expect, vi } from 'vitest'
import { extractFallbackAction } from '../utils/ai/fallback.js'
import { autoExecuteAndDisplay } from '../utils/ai/autoExecutor.js'

describe('extractFallbackAction — 关系图谱兜底', () => {
  it('用户说"汪澄是我女朋友" + AI回复"已记录" → 提取 create_relation', () => {
    const action = extractFallbackAction('汪澄是我女朋友', '已记录，汪澄，你的女朋友。👩‍❤️‍👨')
    expect(action).not.toBeNull()
    expect(action.type).toBe('create_relation')
    expect(action.payload.name).toBe('汪澄')
    expect(action.payload.relation).toBe('女朋友')
  })

  it('用户说"记住朱大根是我的朋友" → 提取 create_relation', () => {
    const action = extractFallbackAction('记住朱大根是我的朋友', '已帮你记录下朱大根，你的朋友。')
    expect(action).not.toBeNull()
    expect(action.type).toBe('create_relation')
    expect(action.payload.name).toBe('朱大根')
    expect(action.payload.relation).toBe('朋友')
  })

  it('用户说"张三是我同事" → relation=同事', () => {
    const action = extractFallbackAction('张三是我同事', '已记录')
    expect(action).not.toBeNull()
    expect(action.payload.name).toBe('张三')
    expect(action.payload.relation).toBe('同事')
  })

  it('用户说"李四是我老婆" → relation=老婆', () => {
    const action = extractFallbackAction('李四是我老婆', '已记录')
    expect(action).not.toBeNull()
    expect(action.payload.name).toBe('李四')
    expect(action.payload.relation).toBe('老婆')
  })

  it('用户说"叫王五，是我同学" → name=王五 relation=同学', () => {
    const action = extractFallbackAction('叫王五，是我同学', '已帮你记录')
    expect(action).not.toBeNull()
    expect(action.payload.name).toBe('王五')
    expect(action.payload.relation).toBe('同学')
  })

  it('用户说"朱大根是我同事" + AI回复"已更新" → 提取 create_relation', () => {
    const action = extractFallbackAction('朱大根是我同事', '已更新，朱大根，你的同事。👩‍💼👨‍💼')
    expect(action).not.toBeNull()
    expect(action.type).toBe('create_relation')
    expect(action.payload.name).toBe('朱大根')
    expect(action.payload.relation).toBe('同事')
  })

  it('非关系消息 → 返回 null', () => {
    const action = extractFallbackAction('今天天气不错', '嗯，确实')
    expect(action).toBeNull()
  })
})

describe('extractFallbackAction — 画像兜底（爱好错别字容错）', () => {
  it('用户说"我的爱好式篮球帮我记录一下"（式=是）→ 提取 hobbies=篮球', () => {
    const action = extractFallbackAction('我的爱好式篮球帮我记录一下', '好的，已记录你的爱好为篮球')
    expect(action).not.toBeNull()
    expect(action.type).toBe('smart_update_profile')
    expect(action.payload.updates).toContainEqual({ card: 'lifestyle', field: 'hobbies', value: '篮球' })
  })

  it('用户说"我的爱好为·唱跳rap篮球" → 提取 hobbies=唱跳rap篮球', () => {
    const action = extractFallbackAction('我的爱好为·唱跳rap篮球', '已记录')
    expect(action).not.toBeNull()
    expect(action.type).toBe('smart_update_profile')
    expect(action.payload.updates).toContainEqual({ card: 'lifestyle', field: 'hobbies', value: '唱跳rap篮球' })
  })

  it('用户说"我的爱好是打篮球" → 提取 hobbies=打篮球', () => {
    const action = extractFallbackAction('我的爱好是打篮球', '已记录')
    expect(action).not.toBeNull()
    expect(action.payload.updates).toContainEqual({ card: 'lifestyle', field: 'hobbies', value: '打篮球' })
  })
})

describe('extractFallbackAction — 记录指令兜底（明确指令/纯指令拦截）', () => {
  it('用户说"帮我写一篇日记昨天去打球了很开兴" + AI 未声称操作 → 创建记录', () => {
    const action = extractFallbackAction('帮我写一篇日记昨天去打球了很开兴', '昨天打球真的很开心，感觉身心都得到了放松。')
    expect(action).not.toBeNull()
    expect(action.type).toBe('create_diary')
    expect(action.payload.title).toBe('昨天去打球了很开兴')
  })

  it('用户说"帮我写一篇日记，关于昨天晚上我去打球了很开心" → 创建记录', () => {
    const action = extractFallbackAction('帮我写一篇日记，关于昨天晚上我去打球了很开心', '昨晚打球真的很开心，感觉整个人都轻松了不少。')
    expect(action).not.toBeNull()
    expect(action.type).toBe('create_diary')
    expect(action.payload.title).toContain('昨天晚上我去打球')
  })

  it('纯指令"帮我记录一下"无内容 → 不建记录', () => {
    const action = extractFallbackAction('帮我记录一下', '好的，已记录你的爱好是大浴帽球。')
    expect(action).toBeNull()
  })

  it('纯指令"写一篇记录"无内容 → 不建记录', () => {
    const action = extractFallbackAction('写一篇记录', '好的，已为你创建一篇新的记录。')
    expect(action).toBeNull()
  })

  it('用户重复粘贴"我的爱好式大浴帽球" + AI 未声称 → 提取 hobbies=大浴帽球', () => {
    const action = extractFallbackAction('帮我记录一下帮我记录一下我的爱好式大浴帽球我的爱好式大浴帽球', '你的爱好是大浴帽球，听起来很有趣！')
    expect(action).not.toBeNull()
    expect(action.type).toBe('smart_update_profile')
    expect(action.payload.updates).toContainEqual({ card: 'lifestyle', field: 'hobbies', value: '大浴帽球' })
  })
})

describe('autoExecuteAndDisplay — Agent 模式前端兜底', () => {
  it('模型声称已记录但无工具执行 → 兜底提取并执行 smart_update_profile', () => {
    const store = {
      executeAction: vi.fn(() => ({
        success: true,
        message: '已更新个人信息：hobbies(+1)',
        detail: { type: 'profile', updatedFields: ['hobbies(+1)'] }
      })),
      updateLastMessage: vi.fn()
    }
    autoExecuteAndDisplay(
      store,
      { execResults: [] },
      '好的，已记录你的爱好为篮球',
      '我的爱好式篮球帮我记录一下',
      { source: 'agent' }
    )
    expect(store.executeAction).toHaveBeenCalledWith({
      type: 'smart_update_profile',
      payload: { updates: [{ card: 'lifestyle', field: 'hobbies', value: '篮球' }], suggestions: [] },
      needConfirm: false
    })
    const lastCall = store.updateLastMessage.mock.calls[0][0]
    expect(lastCall.actionCard.type).toBe('smart_update_profile')
  })

  it('模型已正确执行写入 → 不再兜底', () => {
    const store = {
      executeAction: vi.fn(),
      updateLastMessage: vi.fn()
    }
    autoExecuteAndDisplay(
      store,
      { execResults: [{ ok: true, name: 'smart_update_profile', message: '已更新', detail: { type: 'profile' } }] },
      '好的，已更新你的爱好为篮球',
      '我的爱好式篮球帮我记录一下',
      { source: 'agent' }
    )
    expect(store.executeAction).not.toHaveBeenCalled()
  })

  it('模型未声称操作 → 不兜底', () => {
    const store = {
      executeAction: vi.fn(),
      updateLastMessage: vi.fn()
    }
    autoExecuteAndDisplay(store, { execResults: [] }, '嗯，明白', '我的爱好是篮球', { source: 'agent' })
    expect(store.executeAction).not.toHaveBeenCalled()
  })
})
