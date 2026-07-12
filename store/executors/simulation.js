import { createSimulation } from '@/utils/simulation.js'
import { invalidatePromptCache } from '@/utils/ai/prompt-builder.js'

/**
 * Simulation 相关 executor 工厂函数
 * @param {{ undoStack, cidCache, generateEntityId }} ctx 上下文
 */
export function createSimulationExecutors(ctx) {
  // ==================== 社交沙盘操作 ====================

  function execStartSimulation(p) {
    const relation = p.relation_id ? getRelationById(p.relation_id) : null
    const sim = createSimulation({
      relationId: p.relation_id || '',
      relationName: relation?.name || p.relation_name || '模拟对象',
      scene: p.scene || '日常对话',
      goal: p.goal || ''
    })
    invalidatePromptCache()
    return {
      success: true,
      message: `已创建模拟演练：与「${sim.relation_name}」在「${sim.scene}」场景下对话`,
      detail: {
        type: 'start_simulation',
        simulation_id: sim.id,
        relation_name: sim.relation_name,
        scene: sim.scene,
        goal: sim.goal
      }
    }
  }

  function execEndSimulation(p) {
    invalidatePromptCache()
    return {
      success: true,
      message: '模拟演练已结束，请查看复盘报告',
      detail: { type: 'end_simulation', simulation_id: p.simulation_id || '' }
    }
  }

  return { execStartSimulation, execEndSimulation }
}
