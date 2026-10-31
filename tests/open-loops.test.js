/**
 * open-loops.test.js — M2.1 开放事项：规则、去重、状态机、容量
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  detectCandidates,
  classifyKind,
  titleOf,
  normalizeTitle,
  detectHint
} from '../utils/open-loops-rules.js'
import {
  createFromCandidate,
  getAllLoops,
  getOpenLoops,
  isSameLoop,
  findMergeTarget,
  canTransition,
  transitionLoop,
  updateLoopFields,
  softDeleteLoop,
  planCapacity,
  markDismissed,
  isDismissed,
  getLoopStats,
  recordRejected,
  getEvictLog,
  appendEvictLog,
  LOOP_MAX
} from '../utils/open-loops.js'

function cand(title, extra = {}) {
  return { title, kind: 'idea', quote: title, hint: '', idem: 'idem-' + title, ...extra }
}

beforeEach(() => {
  uni.clearStorageSync()
})

describe('规则层：8 类句式', () => {
  it('R1 想法表达', () => {
    const [c] = detectCandidates('最近又想学一下 Python。')
    expect(c.mode).toBe('create')
    expect(c.rule).toBe('R1')
    expect(c.title).toContain('Python')
    expect(c.kind).toBe('idea')
  })

  it('R2 延后承诺', () => {
    const [c] = detectCandidates('回头我把环境搭一下')
    expect(c.rule).toBe('R2')
    expect(c.kind).toBe('commitment')
  })

  it('R3 时间意向', () => {
    const [c] = detectCandidates('这周找时间跑一遍 RAG')
    expect(c.rule).toBe('R3')
    expect(c.kind).toBe('plan')
  })

  it('R4 未完成事项', () => {
    const [c] = detectCandidates('上次那个功能还没弄完')
    expect(c.rule).toBe('R4')
    expect(c.kind).toBe('topic')
  })

  it('R5 持续关注', () => {
    const [c] = detectCandidates('最近一直在关注 AI Agent')
    expect(c.rule).toBe('R5')
  })

  it('R6 暂停只对已有事项生效', () => {
    const loops = [{ id: 'l1', title: 'RAG 项目', status: 'open' }]
    const [c] = detectCandidates('之前那个项目先放一放', { loops })
    expect(c.mode).toBe('pause')
    expect(c.loopId).toBe('l1')
    expect(detectCandidates('先放一放', { loops: [] })).toEqual([])
  })

  it('R7 重启只对暂停/放下的事项生效', () => {
    const loops = [{ id: 'l2', title: 'RAG 项目', status: 'paused' }]
    const [c] = detectCandidates('之前那个准备重新开始', { loops })
    expect(c.mode).toBe('resume')
    expect(c.loopId).toBe('l2')
    expect(detectCandidates('重新开始', { loops: [{ id: 'l3', title: 'X 项目', status: 'open' }] })).toEqual([])
  })

  it('R8 反复提及不弹新卡（交给合并累加）', () => {
    const loops = [{ id: 'l1', title: 'RAG 项目', status: 'open' }]
    // 单纯提到已有事项、没有任何意图句式 → 不产生候选
    expect(detectCandidates('RAG 项目今天没动', { loops })).toEqual([])
  })

  it('反例：提问/查询/闲聊不生成候选', () => {
    expect(detectCandidates('我有哪些计划？')).toEqual([])
    expect(detectCandidates('RAG 是什么？')).toEqual([])
    expect(detectCandidates('今天天气不错，出去走了走')).toEqual([])
    expect(detectCandidates('好')).toEqual([])
  })

  it('kind 与标题抽取', () => {
    expect(classifyKind('回头我处理一下')).toBe('commitment')
    expect(classifyKind('这周找时间研究 RAG')).toBe('plan')
    expect(classifyKind('上次的还没弄完')).toBe('topic')
    expect(classifyKind('最近想学 Python')).toBe('idea')
    expect(titleOf('最近又想学一下 Python。')).toBe('学一下 Python')
    expect(normalizeTitle('  RAG 项目！！ ')).toBe('rag项目')
  })

  it('next_hint 只取明确的卡点', () => {
    expect(detectHint('之前的 RAG 项目还没完成，主要卡在向量数据库的配置')).toBe('向量数据库的配置')
    expect(detectHint('我想学 RAG')).toBe('')
  })
})

describe('写入：确认、幂等、合并', () => {
  it('确认后落库一条 open', () => {
    const r = createFromCandidate(cand('学 Python'))
    expect(r.ok).toBe(true)
    expect(r.created).toBe(true)
    expect(getAllLoops()).toHaveLength(1)
    expect(getAllLoops()[0].status).toBe('open')
    expect(getAllLoops()[0].touches).toBe(1)
  })

  it('同一 idem 连点两次 → 只有一条', () => {
    const c = cand('学 Python', { idem: 'same' })
    createFromCandidate(c)
    const second = createFromCandidate(c)
    expect(second.duplicate).toBe(true)
    expect(getAllLoops()).toHaveLength(1)
  })

  it('同一件事说三次 → 一条，touches=3，证据 3 条', () => {
    createFromCandidate(cand('学 Python', { idem: 'a' }))
    createFromCandidate(cand('学 Python', { idem: 'b' }))
    createFromCandidate(cand('学 Python', { idem: 'c' }))
    const list = getAllLoops()
    expect(list).toHaveLength(1)
    expect(list[0].touches).toBe(3)
    expect(list[0].evidence).toHaveLength(3)
  })

  it('相似但不同：学 Python ≠ 学 Python 爬虫', () => {
    createFromCandidate(cand('学 Python'))
    createFromCandidate(cand('学 Python 爬虫'))
    expect(getAllLoops()).toHaveLength(2)
    expect(isSameLoop({ title: '学 Python' }, { title: '学 Python 爬虫' })).toBe(false)
  })

  it('通用后缀：RAG 与 RAG 项目算同一件', () => {
    expect(isSameLoop({ title: 'RAG' }, { title: 'RAG 项目' })).toBe(true)
    createFromCandidate(cand('RAG'))
    createFromCandidate(cand('RAG 项目'))
    expect(getAllLoops()).toHaveLength(1)
  })

  it('空标题拒绝落库', () => {
    expect(createFromCandidate({ title: '   ' }).ok).toBe(false)
  })

  it('证据上限 5 条', () => {
    for (let i = 0; i < 8; i++) createFromCandidate(cand('RAG', { idem: 'k' + i }))
    expect(getAllLoops()[0].evidence).toHaveLength(5)
    expect(getAllLoops()[0].touches).toBe(8)
  })
})

describe('状态机', () => {
  it('合法转换表', () => {
    expect(canTransition('open', 'paused')).toBe(true)
    expect(canTransition('open', 'done')).toBe(true)
    expect(canTransition('open', 'dropped')).toBe(true)
    expect(canTransition('paused', 'open')).toBe(true)
    expect(canTransition('done', 'open')).toBe(true)
    expect(canTransition('dropped', 'open')).toBe(true)
    expect(canTransition('done', 'paused')).toBe(false)
    expect(canTransition('dropped', 'done')).toBe(false)
    expect(canTransition('open', 'open')).toBe(false)
  })

  it('用户主动暂停 / 完成 / 重新开始', () => {
    const { loop } = createFromCandidate(cand('RAG 项目'))
    expect(transitionLoop(loop.id, 'paused').ok).toBe(true)
    expect(getAllLoops()[0].status).toBe('paused')
    expect(transitionLoop(loop.id, 'open').ok).toBe(true)
    expect(transitionLoop(loop.id, 'done').ok).toBe(true)
    expect(transitionLoop(loop.id, 'open').ok).toBe(true)
  })

  it('非法转换被拒绝且不改数据', () => {
    const { loop } = createFromCandidate(cand('RAG 项目'))
    transitionLoop(loop.id, 'done')
    expect(transitionLoop(loop.id, 'paused').ok).toBe(false)
    expect(getAllLoops()[0].status).toBe('done')
  })

  it('没被提及不会自动变状态', () => {
    const { loop } = createFromCandidate(cand('RAG 项目'))
    expect(getAllLoops()[0].status).toBe('open')
    expect(getAllLoops()[0].last_at).toBe(loop.last_at)
  })

  it('改标题/补进度不新建', () => {
    const { loop } = createFromCandidate(cand('RAG'))
    updateLoopFields(loop.id, { title: 'RAG 检索练习', next_hint: '向量库配置' })
    const list = getAllLoops()
    expect(list).toHaveLength(1)
    expect(list[0].title).toBe('RAG 检索练习')
    expect(list[0].next_hint).toBe('向量库配置')
  })

  it('软删除后不再出现在未闭环列表', () => {
    const { loop } = createFromCandidate(cand('RAG'))
    softDeleteLoop(loop.id)
    expect(getOpenLoops()).toHaveLength(0)
    expect(uni.getStorageSync('siji_open_loops')).toContain('is_deleted')
  })
})

describe('容量：200 条与淘汰顺序', () => {
  const filler = (n, status) =>
    Array.from({ length: n }, (_, i) => ({ id: `${status}${i}`, title: `${status}${i}`, status, last_at: i, is_deleted: 0 }))

  it('open 永不自动淘汰：满额拒绝新增', () => {
    const list = filler(LOOP_MAX, 'open')
    expect(planCapacity(list)).toEqual({ ok: false, reason: 'capacity' })
  })

  it('按 dropped → done → paused 顺序腾位', () => {
    const list = [...filler(LOOP_MAX - 3, 'open'), ...filler(1, 'paused'), ...filler(1, 'done'), ...filler(1, 'dropped')]
    const r = planCapacity(list)
    expect(r.ok).toBe(true)
    expect(r.evictIds).toEqual(['dropped0'])
  })

  it('没有可淘汰的非 open 时拒绝，不删 open', () => {
    const list = filler(LOOP_MAX, 'open')
    const r = planCapacity(list)
    expect(r.ok).toBe(false)
    expect(list.filter((l) => l.status === 'open')).toHaveLength(LOOP_MAX)
  })

  it('真实落库：满额时新增被拒且原数据完整', () => {
    const full = filler(LOOP_MAX, 'open')
    uni.setStorageSync('siji_open_loops', JSON.stringify(full))
    const r = createFromCandidate(cand('新的一件事'))
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('capacity')
    expect(getAllLoops()).toHaveLength(LOOP_MAX)
  })

  it('有可淘汰项时静默腾位并新增', () => {
    const full = [...filler(LOOP_MAX - 1, 'open'), { id: 'd1', title: '旧事', status: 'dropped', last_at: 1, is_deleted: 0 }]
    uni.setStorageSync('siji_open_loops', JSON.stringify(full))
    const r = createFromCandidate(cand('新的一件事'))
    expect(r.ok).toBe(true)
    expect(getAllLoops()).toHaveLength(LOOP_MAX)
    expect(getAllLoops().some((l) => l.id === 'd1')).toBe(false)
  })

  it('淘汰写日志：能追溯 id / 状态 / 时间', () => {
    const full = [...filler(LOOP_MAX - 1, 'open'), { id: 'd1', title: '旧事', status: 'dropped', last_at: 123, is_deleted: 0 }]
    uni.setStorageSync('siji_open_loops', JSON.stringify(full))
    createFromCandidate(cand('新的一件事'))
    const log = getEvictLog()
    expect(log).toHaveLength(1)
    expect(log[0].id).toBe('d1')
    expect(log[0].status).toBe('dropped')
    expect(log[0].last_at).toBe(123)
    expect(log[0].evicted_at).toBeGreaterThan(0)
    expect(log[0].reason).toBe('capacity')
  })

  it('淘汰日志是环形的：最多保留 50 条', () => {
    const items = Array.from({ length: 60 }, (_, i) => ({ id: 'e' + i, title: 't' + i, status: 'done', last_at: i }))
    appendEvictLog(items)
    const log = getEvictLog(100)
    expect(log).toHaveLength(50)
    expect(log[0].id).toBe('e59')
  })
})

describe('弃用与统计', () => {
  it('拒绝后同标题 7 天内不再问', () => {
    markDismissed('学 Python')
    expect(isDismissed('学 Python')).toBe(true)
    expect(isDismissed(' 学 python！ ')).toBe(true)
    expect(isDismissed('别的')).toBe(false)
  })

  it('拒绝计数用于误提取率', () => {
    recordRejected()
    recordRejected()
    expect(getLoopStats().rejected).toBe(2)
  })
})
