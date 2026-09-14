/**
 * Agent executor — create_agent 确认卡执行落点
 *
 * AI 对话创建 Agent 的写入统一走 data store 分发（与确认卡流程一致），
 * 参数校验复用 utils/ai/tools/agent.js 的 buildAgentPayload（工具直执行共用规则）。
 */
import { useAgentStore } from '../agent.js'
import { buildAgentPayload } from '../../utils/ai/tools/agent.js'

export function createAgentExecutors() {
  function execCreateAgent(payload) {
    const built = buildAgentPayload(payload)
    if (!built.ok) {
      return { success: false, message: built.text, detail: null }
    }
    const agentStore = useAgentStore()
    const agent = agentStore.createAgent(built.data)
    return {
      success: true,
      message: '已创建 Agent「' + agent.name + '」',
      detail: {
        type: 'create_agent',
        id: agent.id,
        name: agent.name,
        description: agent.description,
        icon: agent.icon,
        starts: agent.starts || []
      }
    }
  }

  return { execCreateAgent }
}
