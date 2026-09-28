import { describe, it, expect, beforeEach } from 'vitest'
import './setup.js'
import { encryptKeys } from '@/utils/crypto.js'
import {
  AI_PROVIDERS, supportsStructuredOutput, supportsStreamStructuredOutput, supportsContextCache, getReasoningConfig,
  supportsAsr, getAsrModel, getAsrEndpoint, getAsrMode, getAsrProvider
} from '@/utils/ai/providers.js'

describe('providers.js 能力位（D3/D4/C）', () => {
  beforeEach(() => { global.uni.clearStorageSync?.() })

  it('D3 结构化输出按模型路由：glm-5.2 开启、glm-4-flash 关闭', () => {
    expect(supportsStructuredOutput('zhipu', 'glm-5.2')).toBe(true)
    expect(supportsStructuredOutput('zhipu', 'glm-4-flash')).toBe(false)
    expect(supportsStructuredOutput('zhipu', 'glm-5.1')).toBe(false)
  })

  it('D3 结构化输出：deepseek / moonshot 保持支持，qwen 关闭', () => {
    expect(supportsStructuredOutput('deepseek', 'deepseek-v4-flash')).toBe(true)
    expect(supportsStructuredOutput('moonshot', 'kimi-k2.6')).toBe(true)
    expect(supportsStructuredOutput('qwen', 'qwen3.8-max')).toBe(false)
  })

  it('D3 流式能力位：deepseek 流式禁用 response_format（V4 空回复硬约束），其余按非流式路由', () => {
    // 非流式仍支持 json mode
    expect(supportsStructuredOutput('deepseek', 'deepseek-v4-flash')).toBe(true)
    // 流式路径必须禁用（DeepSeek V4 流式 + json_object 空回复）
    expect(supportsStreamStructuredOutput('deepseek', 'deepseek-v4-flash')).toBe(false)
    expect(supportsStreamStructuredOutput('deepseek', 'deepseek-v4-pro')).toBe(false)
    expect(supportsStreamStructuredOutput('deepseek', 'deepseek-v4-flash-vision-exp')).toBe(false)
    // 其他厂商流式与非流式一致
    expect(supportsStreamStructuredOutput('moonshot', 'kimi-k3')).toBe(true)
    expect(supportsStreamStructuredOutput('zhipu', 'glm-5.3')).toBe(true)
    expect(supportsStreamStructuredOutput('zhipu', 'glm-4-flash')).toBe(false)
    expect(supportsStreamStructuredOutput('qwen', 'qwen3.8-max')).toBe(false)
  })

  it('D3 上下文缓存能力位：智谱支持，其余关闭', () => {
    expect(supportsContextCache('zhipu')).toBe(true)
    expect(supportsContextCache('deepseek')).toBe(false)
    expect(supportsContextCache('qwen')).toBe(false)
    expect(supportsContextCache('moonshot')).toBe(true) // Kimi K3 自动上下文缓存
  })

  it('D4 推理分级：glm-5.2 日常对话不注入思考，复杂任务注入 high', () => {
    expect(getReasoningConfig('zhipu', 'glm-5.2', 'chat')).toBeNull()
    expect(getReasoningConfig('zhipu', 'glm-5.2', 'complex')).toEqual({
      thinking: { type: 'enabled' },
      reasoning_effort: 'high'
    })
    expect(getReasoningConfig('zhipu', 'glm-5.2', 'deep')).toEqual({
      thinking: { type: 'enabled' },
      reasoning_effort: 'max'
    })
  })

  it('D4 推理分级：不支持思考的模型任何任务都返回 null', () => {
    expect(getReasoningConfig('zhipu', 'glm-4-flash', 'complex')).toBeNull()
    expect(getReasoningConfig('deepseek', 'deepseek-v4-pro', 'deep')).toBeNull()
    expect(getReasoningConfig('qwen', 'qwen3.8-max', 'complex')).toBeNull()
    expect(getReasoningConfig('moonshot', 'kimi-k2.6', 'deep')).toBeNull()
  })

  it('D4 推理分级：glm-5.3 强制思考，日常 low / 复杂 high', () => {
    expect(getReasoningConfig('zhipu', 'glm-5.3', 'chat')).toEqual({
      thinking: { type: 'enabled' },
      reasoning_effort: 'low'
    })
    expect(getReasoningConfig('zhipu', 'glm-5.3', 'complex')).toEqual({
      thinking: { type: 'enabled' },
      reasoning_effort: 'high'
    })
    // glm-5.3-flash 同规则
    expect(getReasoningConfig('zhipu', 'glm-5.3-flash', 'chat').reasoning_effort).toBe('low')
  })

  it('D4 推理分级：kimi-k3 仅传顶层 reasoning_effort（不含 thinking 对象）', () => {
    expect(getReasoningConfig('moonshot', 'kimi-k3', 'chat')).toEqual({ reasoning_effort: 'low' })
    expect(getReasoningConfig('moonshot', 'kimi-k3', 'complex')).toEqual({ reasoning_effort: 'high' })
    expect(getReasoningConfig('moonshot', 'kimi-k3', 'deep')).toEqual({ reasoning_effort: 'max' })
  })

  it('模型注册表：最新模型就位且 visionModels 均存在于 models', () => {
    expect(supportsStructuredOutput('zhipu', 'glm-5.3')).toBe(true)
    expect(supportsStructuredOutput('zhipu', 'glm-5.3-flash')).toBe(true)
    expect(supportsStructuredOutput('moonshot', 'kimi-k3')).toBe(true)
    // 已下线/旧代模型不在注册表
    const ids = []
    for (const pid of Object.keys(AI_PROVIDERS)) {
      const p = AI_PROVIDERS[pid]
      ids.push(...p.models.map(m => m.id))
      for (const vid of p.visionModels || []) {
        expect(p.models.some(m => m.id === vid)).toBe(true)
      }
    }
    expect(ids).toContain('glm-5.3')
    expect(ids).toContain('glm-5.3-flash')
    expect(ids).toContain('qwen3.8-flash')
    expect(ids).toContain('qwen3.7-plus')
    expect(ids).toContain('qwen3.8-max')
    expect(ids).toContain('qwen3.5-omni-plus')
    expect(ids).toContain('kimi-k3')
    expect(ids).toContain('deepseek-v4-flash-vision-exp')
    expect(ids).not.toContain('kimi-k2.5')
    expect(ids).not.toContain('qwen-turbo')
    expect(ids).not.toContain('qwen-long')
  })

  it('C 语音能力位：智谱 ASR 元数据正确', () => {
    expect(supportsAsr('zhipu')).toBe(true)
    expect(getAsrModel('zhipu')).toBe('glm-asr-2512')
    expect(getAsrMode('zhipu')).toBe('multipart')
    expect(getAsrEndpoint('zhipu')).toContain('/audio/transcriptions')
    expect(supportsAsr('deepseek')).toBe(false)
  })

  it('C getAsrProvider：配置智谱 key 时返回 zhipu，未配置返回空', () => {
    expect(getAsrProvider()).toBe('')
    global.uni.setStorageSync('siji_provider_keys', encryptKeys({ zhipu: 'sk-zhipu-test' }))
    expect(getAsrProvider()).toBe('zhipu')
  })
})