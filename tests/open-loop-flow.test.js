/**
 * open-loop-flow.test.js — M2.3 链路：确认 → 落库 → 情境包 → 状态
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { detectCandidates } from '../utils/open-loops-rules.js'
import { createFromCandidate, getAllLoops, transitionLoop, markDismissed, isDismissed } from '../utils/open-loops.js'
import { buildContextPacket, renderContextPacket } from '../utils/context-pack.js'
import { createOpenLoopExecutors } from '../store/executors/open-loop.js'
import { buildChatMessages } from '../utils/ai/chat-helpers.js'

const { execQueryOpenLoops, execUpdateOpenLoop } = createOpenLoopExecutors()
const NOW = Date.now()

function confirmFrom(text, extra = {}) {
  const [cand] = detectCandidates(text)
  const c = Object.assign({}, cand, { idem: 'idem-' + text, conversation_id: 'conv-1' }, extra)
  return { cand: c, res: createFromCandidate(c, { now: NOW }) }
}

beforeEach(() => {
  uni.clearStorageSync()
})

describe('从一句话到情境包', () => {
  it('确认后出现在悬着那一行', () => {
    const { res } = confirmFrom('最近又想学一下 Python')
    expect(res.ok).toBe(true)
    const text = renderContextPacket(buildContextPacket({ now: NOW + 3 * 86400000, deps: {
      plans: () => [], bills: () => [], budget: () => 0, diaries: () => [],
      profile: () => ({ enabled: false, cards: [] }), relations: () => [], interactions: () => []
    } }))
    expect(text).toContain('悬着：')
    expect(text).toContain('Python')
    expect(text).toContain('（3 天）')
  })

  it('完成后不再出现在悬着列表', () => {
    const { res } = confirmFrom('最近又想学一下 Python')
    const id = res.loop.id
    expect(execUpdateOpenLoop({ id, status: 'done' }).success).toBe(true)
    expect(execQueryOpenLoops({ status: 'open' }).detail.count).toBe(0)
    expect(getAllLoops()[0].status).toBe('done')
  })
})

describe('工具：查询与更新', () => {
  it('查询返回标题/类型/悬了几天', () => {
    confirmFrom('最近又想学一下 Python')
    const r = execQueryOpenLoops({ status: 'open' })
    expect(r.success).toBe(true)
    expect(r.detail.items[0].title).toContain('Python')
    expect(r.detail.items[0].kind).toBe('idea')
    expect(typeof r.detail.items[0].days).toBe('number')
  })

  it('暂停 / 完成 / 重新开始 都走白名单', () => {
    const { res } = confirmFrom('最近又想学一下 Python')
    expect(execUpdateOpenLoop({ id: res.loop.id, status: 'paused' }).success).toBe(true)
    expect(execUpdateOpenLoop({ id: res.loop.id, status: 'open' }).success).toBe(true)
    expect(execUpdateOpenLoop({ id: res.loop.id, status: 'done' }).success).toBe(true)
    const bad = execUpdateOpenLoop({ id: res.loop.id, status: 'paused' })
    expect(bad.success).toBe(false)
  })

  it('按标题也能找到（模型没带 id 时）', () => {
    confirmFrom('最近又想学一下 Python')
    const r = execUpdateOpenLoop({ title: 'Python', status: 'done' })
    expect(r.success).toBe(true)
  })

  it('找不到时如实报错，不新建', () => {
    const r = execUpdateOpenLoop({ title: '根本不存在的事', status: 'done' })
    expect(r.success).toBe(false)
    expect(getAllLoops()).toHaveLength(0)
  })

  it('next_hint 只在用户说了卡点时写入', () => {
    const { res } = confirmFrom('上次那个功能还没弄完，主要卡在向量数据库的配置')
    expect(res.loop.next_hint).toBe('向量数据库的配置')
    const { res: r2 } = confirmFrom('最近又想学一下 Go')
    expect(r2.loop.next_hint).toBe('')
  })
})

describe('与 M1 的兼容', () => {
  it('对话注入里同时有画像摘要与悬着的事，顺序在 system 末尾', () => {
    confirmFrom('最近又想学一下 Python')
    uni.setStorageSync('siji_my_profile', JSON.stringify({
      enabled: true, version: 2,
      cards: [{ id: 'portrait', title: '我的画像', fields: { 职业方向: 'AI 工程' } }]
    }))
    const system = buildChatMessages('最近有点乱', [], {})[0].content
    expect(system).toContain('【用户画像摘要】')
    expect(system).toContain('【当前情境】')
    expect(system).toContain('悬着：')
    expect(system.indexOf('【用户画像摘要】')).toBeLessThan(system.indexOf('【当前情境】'))
  })

  it('没有开放事项时不出悬着行（M1 行为不变）', () => {
    const system = buildChatMessages('今天天气不错', [], {})[0].content
    expect(system).not.toContain('悬着：')
  })
})

describe('确认卡点击序列（数据层实测）', () => {
  const candOf = (text, idem) => {
    const [c] = detectCandidates(text)
    return Object.assign({}, c, { idem, conversation_id: 'conv-9' })
  }

  it('连点两次「记下来」→ 只有一条', () => {
    const c = candOf('最近又想学一下 Python', 'conv-9:1')
    expect(createFromCandidate(c, { now: NOW }).created).toBe(true)
    expect(createFromCandidate(c, { now: NOW }).duplicate).toBe(true)
    expect(getAllLoops()).toHaveLength(1)
  })

  it('先改标题再确认 → 一条，标题是改过的', () => {
    const c = candOf('最近又想学一下 Python', 'conv-9:2')
    const r = createFromCandidate(Object.assign({}, c, { title: '系统学 Python' }), { now: NOW })
    expect(r.created).toBe(true)
    expect(getAllLoops()[0].title).toBe('系统学 Python')
  })

  it('确认后又改标题重提 → 更新原条，不新建', () => {
    const c = candOf('最近又想学一下 Python', 'conv-9:3')
    createFromCandidate(c, { now: NOW })
    const r = createFromCandidate(Object.assign({}, c, { title: '系统学 Python' }), { now: NOW })
    expect(r.duplicate).toBe(true)
    expect(getAllLoops()).toHaveLength(1)
    expect(getAllLoops()[0].title).toBe('系统学 Python')
  })

  it('点「不用了」→ 不落库，7 天内不再问', () => {
    const c = candOf('最近又想学一下 Python', 'conv-9:4')
    // 卡片点「不用了」走的就是这两步（markDismissed + 不调用 createFromCandidate）
    markDismissed(c.title)
    expect(isDismissed(c.title)).toBe(true)
    expect(getAllLoops()).toHaveLength(0)
  })
})

describe('状态不会被"没提及"改变', () => {
  it('时间流逝不改状态', () => {
    const { res } = confirmFrom('最近又想学一下 Python')
    const before = getAllLoops()[0]
    // 模拟三天后只读一次情境包
    renderContextPacket(buildContextPacket({ now: NOW + 3 * 86400000, deps: {} }))
    const after = getAllLoops()[0]
    expect(after.status).toBe(before.status)
    expect(after.touches).toBe(before.touches)
  })

  it('非法状态值被忽略，不写坏数据', () => {
    const { res } = confirmFrom('最近又想学一下 Python')
    const r = transitionLoop(res.loop.id, 'archived')
    expect(r.ok).toBe(false)
    expect(getAllLoops()[0].status).toBe('open')
  })
})
