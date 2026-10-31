/**
 * baseline-probe.test.js — 基线探针（阶段 0 留存，测量型）
 *
 * 用途：在任何阶段前后跑一遍，打印「模型实际看到什么」，用于对比迭代效果。
 * 原则：**只测量，不断言旧行为** —— 断言旧缺陷会让后面修好时假红。
 *      这里只断言「函数能跑通、输出是字符串」，其余数字进报告人工比对。
 *
 * 跑法：npx vitest run tests/baseline-probe.test.js --maxWorkers=1
 */
import { describe, it, expect } from 'vitest'
import { buildChatMessages } from '../utils/ai/chat-helpers.js'
import { buildAdvice } from '../utils/advice.js'

const DAY = 86400000
const NOW = Date.now()

const ymd = (offset = 0) => {
  const d = new Date(NOW + offset * DAY)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const month = () => {
  const d = new Date(NOW)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const PROFILE = {
  enabled: true,
  version: 2,
  cards: [{
    id: 'portrait',
    title: '我的画像',
    fields: { 职业方向: 'AI 工程 / RAG 方向', 人生关键词: '把想法做出来', MBTI: 'INFP' }
  }]
}

const MEMORIES = [
  { id: 'm1', content: '想往 AI 工程方向发展，正在自学 RAG', category: 'fact', createdAt: NOW - 3 * DAY, updatedAt: NOW - 3 * DAY },
  { id: 'm2', content: '上个月说过要每天读 20 页书', category: 'summary', createdAt: NOW - 20 * DAY, updatedAt: NOW - 20 * DAY }
]

const OLD_MEMORIES = [
  { id: 'o1', content: '妈妈生日是 3 月 12 日', category: 'fact', createdAt: NOW - 90 * DAY, updatedAt: NOW - 90 * DAY },
  { id: 'o2', content: '不喜欢吃香菜', category: 'preference', createdAt: NOW - 80 * DAY, updatedAt: NOW - 80 * DAY },
  { id: 'o3', content: '想换一份工作', category: 'fact', createdAt: NOW - 70 * DAY, updatedAt: NOW - 70 * DAY }
]

const PLANS = [
  { client_id: 'p1', title: '整理作品集', deadline: ymd(-6), status: 1, is_deleted: 0 },
  { client_id: 'p2', title: '交季度总结', deadline: ymd(-1), status: 1, is_deleted: 0 },
  { client_id: 'p3', title: '预约体检', deadline: ymd(0), status: 1, is_deleted: 0 }
]

const BILLS = [
  { amount: 4800, type: 'expense', category: '房租', bill_date: ymd(-10), created_at: NOW - 10 * DAY },
  { amount: 900, type: 'expense', category: '餐饮', bill_date: ymd(-2), created_at: NOW - 2 * DAY }
]

function seed(obj) {
  uni.clearStorageSync()
  for (const [k, v] of Object.entries(obj)) {
    uni.setStorageSync(k, typeof v === 'string' ? v : JSON.stringify(v))
  }
}

function sys(message) {
  return buildChatMessages(message, [], {})[0].content
}

/** 抽取注入段（从标记到结尾/下一分隔） */
function part(system, marker) {
  const i = system.indexOf(marker)
  return i < 0 ? '' : system.slice(i)
}

function report(tag, system) {
  const lines = [
    `chars=${system.length}`,
    `画像=${system.includes('【用户画像摘要】') ? 1 : 0}`,
    `记忆=${system.includes('长期记忆：') ? 1 : 0}`,
    `情境包=${system.includes('【当前情境】') ? 1 : 0}`
  ]
  console.log('[probe]', tag, lines.join(' '), '| 情境段=', part(system, '【当前情境】').replace(/\n/g, ' '))
}

describe('基线探针（测量，不判对错）', () => {
  it('P1 空库 + 想学 Python', () => {
    seed({})
    const s = sys('最近又想学一下 Python。')
    report('P1', s)
    expect(typeof s).toBe('string')
  })

  it('P2 画像 + 记忆 + 想学 Python', () => {
    seed({ siji_my_profile: PROFILE, siji_long_term_memory: MEMORIES })
    const s = sys('最近又想学一下 Python。')
    report('P2', s)
    console.log('[probe] P2 记忆含 RAG:', s.includes('RAG'), '| 关联指令:', /关联|提到过|之前说|你上次/.test(s))
    expect(typeof s).toBe('string')
  })

  it('P3 想学 RAG 但不想学', () => {
    seed({ siji_my_profile: PROFILE, siji_long_term_memory: MEMORIES })
    const s = sys('我想学 RAG，但是今天下班以后不太想学。')
    report('P3', s)
    console.log('[probe] P3 能量段:', /能量/.test(s), '| open_loops:', JSON.stringify(uni.getStorageSync('siji_open_loops') || null))
    expect(typeof s).toBe('string')
  })

  it('P4 三天后再提 RAG', () => {
    seed({ siji_my_profile: PROFILE, siji_long_term_memory: MEMORIES })
    const s = sys('上次说的 RAG 我还没开始，从哪开始好？')
    report('P4', s)
    console.log('[probe] P4 含进度:', /上次|停在|进度/.test(s))
    expect(typeof s).toBe('string')
  })

  it('P7 无关消息 + 旧记忆（误召回观察点）', () => {
    seed({ siji_long_term_memory: OLD_MEMORIES })
    const s = sys('今天天气不错。')
    report('P7', s)
    const hits = ['香菜', '生日', '换一份工作'].filter((k) => s.includes(k)).length
    console.log('[probe] P7 旧记忆注入:', hits, '/3')
    expect(hits).toBeGreaterThanOrEqual(0)
  })

  it('P5 首页建议', () => {
    seed({ siji_my_profile: PROFILE, siji_long_term_memory: MEMORIES, plan_all: PLANS, [`bill_${month()}`]: BILLS })
    const built = buildAdvice({ now: NOW, env: { aiReady: true, firstRun: false } })
    console.log('[probe] P5 count=', built.items.length, 'focus=', built.focus, 'keys=', built.items.map((i) => i.key).join('/'))
    console.log('[probe] P5 字段=', Object.keys(built.items[0] || {}).join(','))
    expect(Array.isArray(built.items)).toBe(true)
  })
})
