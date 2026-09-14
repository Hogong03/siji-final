/**
 * M1 纠错回归集（3.2 升级方案 2.2）— 把历史真实反馈固化为可回归断言
 *
 * 覆盖场景：
 *  1-2  计划变更变成新增（先 query_plan 再 update_plan，禁止 create_plan）
 *  3-4  自定义属性不新增/不更改 + 重复上报旧字段
 *  5    错别字「式/是」容忍（自由文本字段，无枚举白名单）
 *  6    一句话多个意图只处理一半
 *  7    「记错了 / 不是 X 是 Y」先查后改
 *  8-9  口头时间必须从原话计算、未说的天数禁止编造
 *  10   事实 + 指令同句需拆解落库
 *  11   关键工具双注册（TOOL_DEFINITIONS + CORE_ACTIONS）
 *  12-13 mock 工具调用序列级用例（D1：query→update 顺序、多意图同轮双写）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resetStorage } from './setup.js'
import './setup.js'
import { BEHAVIOR_RULES, CORE_ACTIONS } from '../utils/ai/prompt-actions.js'
import { AGENT_TOOL_INSTRUCTION, runAgentLoop } from '../utils/ai/agent-loop.js'
import { TOOL_DEFINITIONS } from '../utils/ai/tools.js'

const RULES = BEHAVIOR_RULES.join('\n')
const CORE_LINES = CORE_ACTIONS.split('\n')
const lineOf = (name) => CORE_LINES.find(l => l.includes(`${name}:`)) || ''

describe('M1 静态回归：提示词关键句 + schema 约束', () => {
  it('1. 计划变更 → BEHAVIOR_RULES 禁止 create_plan 新建同名计划', () => {
    expect(RULES).toContain('query_plan 找到原计划后 update_plan')
    expect(RULES).toContain('禁止 create_plan 新建同名计划')
  })

  it('2. 计划变更 → CORE_ACTIONS update_plan 行引导「不知道 ID 先 query_plan」', () => {
    const line = lineOf('update_plan')
    expect(line).toContain('不知道ID先 query_plan')
    expect(line).toContain('禁止新建同名计划')
  })

  it('3. 自定义属性 schema：updates item required = card/field/value 且只更新本次提到的字段', () => {
    const tool = TOOL_DEFINITIONS.find(t => t.name === 'smart_update_profile')
    expect(tool).toBeDefined()
    expect(tool.parameters.properties.updates.items.required).toEqual(['card', 'field', 'value'])
    const updatesDesc = JSON.stringify(tool.parameters.properties.updates)
    expect(updatesDesc).toContain('只更新用户本次提到的字段')
    expect(updatesDesc).toContain('未提及的旧字段禁止重复上报')
    expect(tool.description).toContain('值有变更')
    expect(tool.description).toContain('禁止新增一条内容重复的属性')
    expect(CORE_ACTIONS).toContain('只更新用户本次提到的字段')
  })

  it('4. 自定义属性 → BEHAVIOR_RULES 禁止重复上报未提及的旧字段', () => {
    expect(RULES).toContain('禁止只口头回复不落库')
    expect(RULES).toContain('禁止重复上报未提及的旧字段')
  })

  it('5. 错别字容忍规则存在 + 属性值为自由文本（无枚举白名单）', () => {
    expect(RULES).toContain('错别字不影响语义')
    const tool = TOOL_DEFINITIONS.find(t => t.name === 'smart_update_profile')
    const valueJson = JSON.stringify(tool.parameters.properties.updates.items.properties.value)
    const fieldJson = JSON.stringify(tool.parameters.properties.updates.items.properties.field)
    expect(valueJson).not.toContain('enum')
    expect(fieldJson).not.toContain('enum')
  })

  it('6. 多意图 → 拆解句与工具循环多调用句都存在', () => {
    expect(RULES).toContain('一句话含多个意图')
    expect(RULES).toContain('禁止只处理第一个意图')
    expect(AGENT_TOOL_INSTRUCTION).toContain('一次发起多个工具调用全部执行')
    expect(AGENT_TOOL_INSTRUCTION).toContain('禁止只处理第一个意图')
  })

  it('7. 「记错了/不是 X 是 Y」→ 先 query 确认再 update_* 直接修正', () => {
    expect(RULES).toContain('先 query 确认，再 update_* 直接修正')
    expect(AGENT_TOOL_INSTRUCTION).toContain('先 query 确认目标记录，再 update_* 直接修正本地数据')
    expect(AGENT_TOOL_INSTRUCTION).toContain('不要只说"建议手动修改"')
  })

  it('8. 口头时间（后天/下周）→ deadline/start_time/end_time 从原话计算', () => {
    const line = lineOf('create_plan')
    expect(line).toContain('从原话计算')
    expect(line).toContain('deadline/start_time/end_time 必填')
  })

  it('9. 未说的天数/日期禁止编造', () => {
    const line = lineOf('create_plan')
    expect(line).toContain('用户没说的天数/日期禁止编造')
  })

  it('10. 「记一下我的 MBTI 是 INFP」→ 拆解事实+指令并落库', () => {
    expect(RULES).toContain('拆解事实+指令并落库')
    expect(RULES).toContain('错别字不影响语义')
  })

  it('3.3 计划拆小 + 执行不重建 → 规则句与 schema 提示存在', () => {
    expect(RULES).toContain('每条收敛到 5-15 分钟可执行的一步')
    expect(RULES).toContain('禁止重新规划、禁止新建计划')
    const createTool = TOOL_DEFINITIONS.find(t => t.name === 'create_plan')
    const updateTool = TOOL_DEFINITIONS.find(t => t.name === 'update_plan')
    const subtasksJson = JSON.stringify(createTool.parameters.properties.subtasks)
    expect(subtasksJson).toContain('est_minutes')
    expect(subtasksJson).toContain('5-15 分钟可执行')
    expect(JSON.stringify(updateTool.parameters.properties.subtasks)).toContain('超过 15 分钟必须继续拆出下一级子计划')
  })

  it('11. 关键工具双注册：TOOL_DEFINITIONS 与 CORE_ACTIONS 均出现', () => {
    const KEY_TOOLS = [
      'query_diary', 'create_diary',
      'query_bill', 'create_bill',
      'query_plan', 'create_plan',
      'smart_update_profile', 'create_agent'
    ]
    const names = new Set(TOOL_DEFINITIONS.map(t => t.name))
    for (const name of KEY_TOOLS) {
      expect(names.has(name), `TOOL_DEFINITIONS 缺少 ${name}`).toBe(true)
      expect(CORE_ACTIONS.includes(`- ${name}:`), `CORE_ACTIONS 缺少 ${name}`).toBe(true)
    }
  })
})

describe('M1 mock 序列：工具循环行为级断言（D1）', () => {
  beforeEach(() => {
    resetStorage()
    // 开启「AI 自动执行写操作」，跳过确认闸门，只验证工具循环序列
    global.uni.setStorageSync('siji_auto_write', '1')
  })

  /** 构造一个由脚本决定每轮回复的 responder：round1 → 首批 tool_calls，round2 → 第二批，之后纯文本 */
  function scriptedResponder(rounds) {
    let round = 0
    return async (body) => {
      round++
      const script = rounds[Math.min(round - 1, rounds.length - 1)]
      if (typeof script === 'string') {
        return { message: { role: 'assistant', content: script }, id: `mock_${round}` }
      }
      const toolCalls = script.map((fn, i) => ({
        id: `call_${round}_${i}`,
        type: 'function',
        function: { name: fn.name, arguments: JSON.stringify(fn.args || {}) }
      }))
      return { message: { role: 'assistant', content: '', tool_calls: toolCalls }, id: `mock_${round}` }
    }
  }

  function makeStore() {
    const executeAction = vi.fn(({ type, payload }) => {
      if (type === 'query_plan') {
        return {
          success: true,
          message: '找到 1 个计划',
          detail: {
            type: 'query_plan', count: 1,
            items: [{ client_id: 'plan_001', title: '学习计划', status: 1, deadline: '2026-09-20', subtasks: [] }]
          }
        }
      }
      if (type === 'update_plan') {
        return { success: true, message: '计划已更新', detail: { type: 'update_plan', client_id: payload.client_id } }
      }
      if (type === 'create_diary') {
        return { success: true, message: '已记录', detail: { type: 'create_diary', title: '测试记录', content: payload.content } }
      }
      if (type === 'smart_update_profile') {
        return { success: true, message: '画像已更新', detail: { type: 'smart_update_profile', updates: payload.updates } }
      }
      return { success: false, message: `未 stub 的 action: ${type}` }
    })
    return { store: { executeAction }, executeAction }
  }

  async function runLoop(message, responder) {
    const { store, executeAction } = makeStore()
    const cfg = {
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      apiKey: 'test-key',
      temperature: 0.7,
      _mockResponder: responder
    }
    const result = await runAgentLoop(store, message, 'conv_m1', cfg, [])
    return { result, executeAction }
  }

  it('12. 计划纠错序列：先 query_plan 确认，再 update_plan 修正，全程无 create_plan', async () => {
    const responder = scriptedResponder([
      [{ name: 'query_plan', args: { status: 'all' } }],
      [{ name: 'update_plan', args: { client_id: 'plan_001', deadline: '2026-09-22' } }],
      '好的，学习计划已按你说的改到 9 月 22 日。'
    ])
    const { result, executeAction } = await runLoop('把学习计划改到 9 月 22 日，之前定的 20 日不对', responder)

    // 调用顺序：先查后改
    expect(result.toolCalls.map(c => c.name)).toEqual(['query_plan', 'update_plan'])
    expect(result.toolCalls.some(c => c.name === 'create_plan')).toBe(false)
    expect(executeAction).toHaveBeenCalledTimes(2)
    expect(executeAction).toHaveBeenNthCalledWith(1, { type: 'query_plan', payload: { status: 'all' } })
    expect(executeAction).toHaveBeenNthCalledWith(2, { type: 'update_plan', payload: { client_id: 'plan_001', deadline: '2026-09-22' } })
    // 执行结果记录两轮工具都成功，最终回复带自然语言总结
    expect(result.execResults.filter(r => r.ok).map(r => r.name)).toEqual(['query_plan', 'update_plan'])
    expect(result.reply).toContain('9 月 22 日')
  })

  it('13. 多意图同句：create_diary 与 smart_update_profile 同轮全部执行', async () => {
    const responder = scriptedResponder([
      [
        { name: 'create_diary', args: { content: '中午吃了火锅', record_type: 'diary' } },
        { name: 'smart_update_profile', args: { updates: [{ card: 'lifestyle', field: 'dietary', value: '爱吃火锅' }] } }
      ],
      '已帮你记录午餐，并把「爱吃火锅」存进你的饮食偏好。'
    ])
    const { result, executeAction } = await runLoop('记一笔中午吃了火锅，顺便记一下我的饮食偏好是爱吃火锅', responder)

    expect(result.toolCalls.map(c => c.name)).toEqual(['create_diary', 'smart_update_profile'])
    expect(result.execResults.filter(r => r.ok).map(r => r.name)).toEqual(['create_diary', 'smart_update_profile'])
    expect(executeAction).toHaveBeenCalledWith({ type: 'create_diary', payload: { content: '中午吃了火锅', record_type: 'diary' } })
    expect(executeAction).toHaveBeenCalledWith({
      type: 'smart_update_profile',
      payload: { updates: [{ card: 'lifestyle', field: 'dietary', value: '爱吃火锅' }] }
    })
    expect(result.reply).toBeTruthy()
  })
})
