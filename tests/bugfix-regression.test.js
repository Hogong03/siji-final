/**
 * 回归测试 — 2026-08-28 反馈问题修复
 * 覆盖：
 *  1. 记录创建：单行内容不得丢失（内容不再为空）
 *  2. 记录类型：模型未传 record_type 时按正文推断
 *  3. 人脉互动：log_interaction 支持按姓名匹配，返回 relation_id
 *  4. 聊天跳转：画像/人脉/决策/阶段计划卡片跳转路由补全
 *  5. 图片识别：重试时保留 [图片识别结果] 组合消息
 *  6. 关系上下文：消息提到人脉姓名时注入关系详情（含 ID）
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useDataStore } from '../store/data.js'
import { useChatNavigation } from '../composables/useChatNavigation.js'
import { buildChatMessages } from '../utils/ai/chat-helpers.js'
import { retryStreamWithBackoff } from '../utils/ai/streamRetry.js'
import { resetStorage } from './setup.js'
import './setup.js'

let store
beforeEach(() => {
  resetStorage()
  setActivePinia(createPinia())
  store = useDataStore()
})

describe('记录创建：单行内容不丢失', () => {
  it('模型传 content 单行文本 → 标题与正文都有内容', () => {
    const r = store.executeAction({ type: 'create_diary', payload: { content: '今天跑了 5 公里' } })
    expect(r.success).toBe(true)
    expect(r.detail.title).toBe('今天跑了 5 公里')
    expect(r.detail.content).toBe('今天跑了 5 公里')
  })

  it('多行内容：首行作标题，其余作正文', () => {
    const r = store.executeAction({ type: 'create_diary', payload: { content: '周末计划\n周六爬山\n周日休息' } })
    expect(r.detail.title).toBe('周末计划')
    expect(r.detail.content).toBe('周六爬山\n周日休息')
  })

  it('模型误传 title 时正文兜底', () => {
    const r = store.executeAction({ type: 'create_diary', payload: { title: '昨天打球很开心', content: '' } })
    expect(r.detail.title).toBe('昨天打球很开心')
    expect(r.detail.content).toBe('昨天打球很开心')
  })

  it('模型未传 record_type 时按正文关键词推断', () => {
    const d = store.executeAction({ type: 'create_diary', payload: { content: '记个日记，昨天打球很开心' } })
    expect(d.detail.record_type).toBe('diary')
    const i = store.executeAction({ type: 'create_diary', payload: { content: '有个想法，把房间改造一下' } })
    expect(i.detail.record_type).toBe('idea')
    const n = store.executeAction({ type: 'create_diary', payload: { content: '随便记一笔' } })
    expect(n.detail.record_type).toBe('note')
  })
})

describe('人脉互动：log_interaction 支持按姓名匹配', () => {
  it('先建关系，再按姓名记录互动，互动记录可查', () => {
    const c = store.executeAction({ type: 'create_relation', payload: { name: '阿伟', role: '产品经理' } })
    expect(c.success).toBe(true)
    const id = c.detail.id

    const r = store.executeAction({ type: 'log_interaction', payload: { relation_name: '阿伟', scene: '午餐', content: '和阿伟吃了午饭' } })
    expect(r.success).toBe(true)
    expect(r.detail.relation_id).toBe(id)

    const q = store.executeAction({ type: 'query_interaction', payload: { relation_id: id } })
    expect(q.success).toBe(true)
    expect(q.detail.count).toBe(1)
    expect(q.detail.items[0].content).toBe('和阿伟吃了午饭')
  })

  it('未知人名返回明确错误', () => {
    const r = store.executeAction({ type: 'log_interaction', payload: { relation_name: '不存在的人', scene: '日常', content: 'x' } })
    expect(r.success).toBe(false)
    expect(r.message).toContain('关系卡片不存在')
  })
})

describe('聊天卡片跳转路由', () => {
  function spyNav() {
    return vi.spyOn(uni, 'navigateTo').mockImplementation(() => {})
  }

  it('画像更新卡片 → 跳转画像页', () => {
    const spy = spyNav()
    const { handleConfirmActionCard } = useChatNavigation()
    handleConfirmActionCard({ type: 'smart_update_profile', payload: { type: 'profile', updatedFields: ['nickname'] } })
    expect(spy).toHaveBeenCalledWith({ url: '/pages/settings/sub/profile' })
    spy.mockRestore()
  })

  it('旧版 update_profile 卡片 → 跳转画像页', () => {
    const spy = spyNav()
    const { handleConfirmActionCard } = useChatNavigation()
    handleConfirmActionCard({ type: 'update_profile', payload: { type: 'profile', nickname: '朱小根' } })
    expect(spy).toHaveBeenCalledWith({ url: '/pages/settings/sub/profile' })
    spy.mockRestore()
  })

  it('互动记录卡片 → 跳转人脉详情', () => {
    const spy = spyNav()
    const { handleConfirmActionCard } = useChatNavigation()
    handleConfirmActionCard({ type: 'log_interaction', payload: { type: 'interaction', relation_id: 'rel_1', relation_name: '阿伟' } })
    expect(spy).toHaveBeenCalledWith({ url: '/pages/settings/sub/relation-detail?id=rel_1' })
    spy.mockRestore()
  })

  it('阶段计划卡片 → 跳转计划详情', () => {
    const spy = spyNav()
    const { handleConfirmActionCard } = useChatNavigation()
    handleConfirmActionCard({ type: 'create_plan_phases', payload: { type: 'plan', id: 'plan_1' } })
    expect(spy).toHaveBeenCalledWith({ url: '/pages/plan/detail?clientId=plan_1' })
    spy.mockRestore()
  })

  it('multi 卡片首个为画像 → 跳转画像页', () => {
    const spy = spyNav()
    const { handleConfirmActionCard } = useChatNavigation()
    handleConfirmActionCard({ type: 'multi', payload: [{ type: 'profile', updatedFields: ['nickname'] }, { type: 'bill', id: 'bill_1' }] })
    expect(spy).toHaveBeenCalledWith({ url: '/pages/settings/sub/profile' })
    spy.mockRestore()
  })
})

describe('图片识别组合消息重试', () => {
  it('重试过程保留 [图片识别结果] 描述，不做裁剪', async () => {
    vi.useFakeTimers()
    try {
      const calls = []
      const streamFn = vi.fn((msg) => {
        calls.push(msg)
        return calls.length < 3
          ? Promise.resolve({ reply: '', _emptyReply: true })
          : Promise.resolve({ reply: '看到了图片内容', action: null })
      })
      const original = '识别这张图片\n\n[图片识别结果]\n这是微信聊天截图，含金额 25 元'
      const p = retryStreamWithBackoff(streamFn, original, vi.fn(), { stopped: false })
      await vi.advanceTimersByTimeAsync(10000)
      const { result } = await p
      expect(result.reply).toBe('看到了图片内容')
      expect(calls).toHaveLength(3)
      expect(calls[0]).toBe(original)
      expect(calls[1]).toBe(original)
      // 第二次重试仍保留完整图片描述，仅追加简短回复提示
      expect(calls[2]).toBe(original + '（请简短回复）')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('回复防误删（AI 自我介绍/闲聊不被改写）', () => {
  it('Agent 模式：自我介绍提到“帮你记账”但非操作 → 保留原回复', async () => {
    const { autoExecuteAndDisplay } = await import('../utils/ai/autoExecutor.js')
    const store = {
      executeAction: vi.fn(() => ({ success: false, message: '无需执行' })),
      updateLastMessage: vi.fn()
    }
    autoExecuteAndDisplay(
      store,
      { execResults: [] },
      '我是思迹，你的个人生活小助手～平时帮你记记账、写写日记、做做计划。',
      '介绍一下你自己',
      { source: 'agent' }
    )
    const last = store.updateLastMessage.mock.calls[0][0]
    expect(last.content).toContain('我是思迹')
    expect(last.content).not.toContain('没能自动记录')
  })

  it('JSON 模式：闲聊回复不含操作指令 → 保留原回复', async () => {
    const { autoExecuteAndDisplay } = await import('../utils/ai/autoExecutor.js')
    const store = {
      executeAction: vi.fn(() => ({ success: false, message: '无需执行' })),
      updateLastMessage: vi.fn()
    }
    autoExecuteAndDisplay(
      store,
      { reply: '好啊，那就随便聊聊。今天有没有什么好玩的事？', action: null, actions: [] },
      '好啊，那就随便聊聊。今天有没有什么好玩的事？',
      '没什么就像简单聊聊',
      { source: 'json' }
    )
    const last = store.updateLastMessage.mock.calls[0][0]
    expect(last.content).toContain('随便聊聊')
    expect(last.content).not.toContain('没能自动记录')
  })

  it('JSON 模式：回复含"帮你细细分析"且用户消息含"聊天记录" → 不误判为操作声称（反馈 2026-08-29 复现）', async () => {
    const { autoExecuteAndDisplay } = await import('../utils/ai/autoExecutor.js')
    const store = {
      executeAction: vi.fn(() => ({ success: false, message: '无需执行' })),
      updateLastMessage: vi.fn()
    }
    const reply = '好啊，我准备好了。你先慢慢发，我等你5张都发完，再一起看这段聊天记录，帮你细细分析你们之间的关系。'
    autoExecuteAndDisplay(
      store,
      { reply, action: null, actions: [] },
      reply,
      '接下来我要给你发5张图片，是我和我女朋友的聊天记录，你要总结这些聊天记录的内容，分析我和我女朋友之间的关系，嗯，在我发完全部5张图片的时候，你要给出具体的分析结果',
      { source: 'json' }
    )
    const last = store.updateLastMessage.mock.calls[0][0]
    expect(last.content).toBe(reply)
    expect(last.content).not.toContain('没能自动记录')
    expect(last.content).not.toContain('收到')
  })

  it('JSON 模式：明确记账指令 + AI 声称"已记录"但未执行 → 仍修正 reply 提示重述', async () => {
    const { autoExecuteAndDisplay } = await import('../utils/ai/autoExecutor.js')
    const store = {
      executeAction: vi.fn(() => ({ success: false, message: '无需执行' })),
      updateLastMessage: vi.fn()
    }
    autoExecuteAndDisplay(
      store,
      { reply: '已记录，午餐 25 块', action: null, actions: [] },
      '已记录，午餐 25 块',
      '帮我记一下午餐25块',
      { source: 'json' }
    )
    const last = store.updateLastMessage.mock.calls[0][0]
    expect(last.content).toContain('没能自动记录，再告诉我一次具体要记什么？')
  })
})

describe('人物介绍与互动落库', () => {
  it('介绍新朋友 → create_relation 落库（含角色与备注）', () => {
    const r = store.executeAction({ type: 'create_relation', payload: { name: '阿伟', role: '朋友', context: '产品经理' } })
    expect(r.success).toBe(true)
    const q = store.executeAction({ type: 'query_relation', payload: { keyword: '阿伟' } })
    expect(q.success).toBe(true)
    expect(q.detail.items[0].name).toBe('阿伟')
    expect(q.detail.items[0].role).toBe('朋友')
  })

  it('兜底提取：AI 声称已记住但无 action → create_relation 使用 role 字段', async () => {
    const { extractFallbackAction } = await import('../utils/ai/fallback.js')
    const action = extractFallbackAction('认识了一个新朋友叫阿伟，产品经理', '好的，已帮你记住阿伟啦')
    expect(action.type).toBe('create_relation')
    expect(action.payload.role).toBe('朋友')
    expect(action.payload.context).toBe('产品经理')
  })
})

describe('关系上下文注入', () => {

  it('消息提到人脉姓名时注入关系详情（含 ID）', () => {
    resetStorage()
    uni.setStorageSync('siji_relations', JSON.stringify([{
      id: 'rel_abc123', name: '阿伟', role: '产品经理', context: '', traits: [], preferences: [], notes: '',
      relationship_score: 7, last_interaction: '', created_at: Date.now(), updated_at: Date.now(), is_deleted: 0
    }]))
    const messages = buildChatMessages('今天和阿伟吃了午饭', [], { provider: 'deepseek' })
    const system = messages[0].content
    expect(system).toContain('阿伟')
    expect(system).toContain('rel_abc123')
  })

  it('未提到人脉时不注入关系上下文', () => {
    resetStorage()
    uni.setStorageSync('siji_relations', JSON.stringify([{
      id: 'rel_abc123', name: '阿伟', role: '产品经理', context: '', traits: [], preferences: [], notes: '',
      relationship_score: 7, last_interaction: '', created_at: Date.now(), updated_at: Date.now(), is_deleted: 0
    }]))
    const messages = buildChatMessages('今天天气不错', [], { provider: 'deepseek' })
    expect(messages[0].content).not.toContain('rel_abc123')
  })
})

describe('反馈 2026-09-15：开场白逗号 + 反馈导出里的版本号', () => {
  it('欢迎语用全角逗号（导出记录里是「夜深了,我是思迹。」）', async () => {
    const { useWelcomeMessage } = await import('../composables/useWelcomeMessage.js')
    const msg = useWelcomeMessage().getWelcomeMessage()
    expect(msg).toContain('，我是思迹。')
    expect(/,我是思迹/.test(msg)).toBe(false)
  })

  it('App 端版本预热不炸：plus 不存在时安全返回，getVersion 仍是字符串', async () => {
    const { primeAppVersion, getVersion } = await import('../utils/version-check.js')
    expect(() => primeAppVersion()).not.toThrow()
    expect(typeof getVersion()).toBe('string')
  })
})

describe('会话标签映射（store/index.js 聚合入口）', () => {
  it('addTagToConversation / removeTagFromConversation 已映射可用（反馈 2026-08-30 点击确定报错）', async () => {
    const { useAppStore } = await import('../store/index.js')
    setActivePinia(createPinia())
    const app = useAppStore()
    const conv = app.createConversation()
    expect(typeof app.addTagToConversation).toBe('function')
    expect(typeof app.removeTagFromConversation).toBe('function')
    app.addTagToConversation(conv.id, '工作')
    expect(app.conversations.find(c => c.id === conv.id).tags).toContain('工作')
    app.removeTagFromConversation(conv.id, '工作')
    expect(app.conversations.find(c => c.id === conv.id).tags).not.toContain('工作')
  })
})
