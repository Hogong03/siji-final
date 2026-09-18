/**
 * 长文能力（4.3.0）
 *
 * 三件事的回归：
 *   1. 输出上限：四家厂商都声明 maxTokens，请求体必须带上（以前不带，长度全看厂商默认值）
 *   2. 长文例外：提示词里要有「写长文」的例外规则，并要求写完存成记录
 *   3. 长文入口：气泡 ≥800 字给「按章节阅读」（静态回归：组件与聊天页的接线都在）
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import './setup.js'
import { PROVIDER_MAX_TOKENS, getMaxTokens, AI_PROVIDERS, buildProviderRequest } from '../utils/ai/providers.js'
import { BEHAVIOR_RULES, CORE_ACTIONS } from '../utils/ai/prompt-actions.js'
import { buildSystemPrompt } from '../utils/ai/prompt-builder.js'

const ROOT = process.cwd()
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')

describe('输出上限：四家厂商都声明，请求体都带', () => {
  it('四家厂商都有 maxTokens，取值函数给出正数', () => {
    Object.keys(AI_PROVIDERS).forEach(id => {
      expect(PROVIDER_MAX_TOKENS[id]).toBeGreaterThan(0)
      expect(getMaxTokens(id)).toBeGreaterThanOrEqual(4096)
    })
    expect(getMaxTokens('不存在的厂商')).toBe(4096)   // 回落值
    expect(getMaxTokens('')).toBe(4096)
  })

  it('非流式请求体带上 max_tokens', () => {
    const req = buildProviderRequest('deepseek', 'deepseek-v4-flash', [{ role: 'user', content: 'hi' }], 'k', 0.7)
    expect(req.data.max_tokens).toBe(PROVIDER_MAX_TOKENS.deepseek)
  })

  it('三条流式路径（H5 SSE / App chunked / Agent 工具轮与最终轮）都带 max_tokens', () => {
    const sse = read('utils/ai/chat-sse.js')
    expect(sse).toContain('max_tokens: getMaxTokens(cfg.provider)')
    const chunked = read('utils/ai/chat-chunked.js')
    expect(chunked).toContain('max_tokens: getMaxTokens(cfg.provider)')
    const transport = read('utils/ai/agent-transport.js')
    expect(transport).toContain('max_tokens: getMaxTokens(provider.id)')
    // 两处：工具轮 + 最终流式
    expect(transport.split('max_tokens: getMaxTokens(provider.id)').length - 1).toBe(2)
  })
})

describe('长文例外：提示词要求写全篇并存成记录', () => {
  it('行为准则里有长文规则：不受简洁约束 + 写完 create_diary + 告知查看入口', () => {
    const rules = BEHAVIOR_RULES.join('\n')
    expect(rules).toContain('写篇文章')
    expect(rules).toContain('800-3000 字')
    expect(rules).toContain('create_diary')
    expect(rules).toContain('已存成记录')
    expect(rules).toContain('禁止只回复一段摘要')
  })

  it('create_diary 的说明里点明「长文也走这个工具」', () => {
    expect(CORE_ACTIONS).toContain('长文（攻略/方案/文章/长总结）也走这个工具')
  })

  it('核心铁律的「闲聊 1-3 句」标了适用范围，不再压长文', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toContain('闲聊 1-3 句')
    expect(prompt).toContain('日常闲聊适用')
  })
})

describe('长文入口：气泡 ≥800 字给「按章节阅读」', () => {
  it('气泡组件：阈值 800、按钮接线、事件名都在', () => {
    const bubble = read('components/chat/MessageBubble.vue')
    expect(bubble).toContain('const LONG_TEXT_MIN = 800')
    expect(bubble).toContain('isLongText')
    expect(bubble).toContain("emit('read-long', props.message)")
    expect(bubble).toContain("'read-long'")
    expect(bubble).toContain('按章节阅读')
  })

  it('聊天页：接住事件 → 已存记录直接读，没存过就落一条再读', () => {
    const chat = read('pages/chat/index.vue')
    expect(chat).toContain('@read-long="handleReadLong"')
    expect(chat).toContain('function handleReadLong(msg)')
    expect(chat).toContain("type: 'create_diary'")
    expect(chat).toContain('/pages/diary/read?clientId=')
  })
})