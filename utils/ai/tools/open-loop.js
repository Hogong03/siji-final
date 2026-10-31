/**
 * tools/open-loop.js — 开放事项工具（M2.3）
 *
 * 只给 Agent 查询权限。写入不注册成工具：新建走对话内联确认卡，
 * 状态变更走 update_open_loop 这个 action（CORE_ACTIONS，不给 Agent 自动执行）。
 */
export const OPEN_LOOP_TOOLS = [
  {
    name: 'query_open_loops',
    description: '查看「悬着的事」：用户问「我有哪些没定下来的事/之前说的事/手上悬着什么/上次那个还在吗」时调用。只读，不创建、不改状态。',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['open', 'paused', 'done', 'dropped', 'all'], description: '默认 open（未闭环）' },
        kind: { type: 'string', enum: ['idea', 'topic', 'plan', 'commitment'], description: '可选，按类型过滤' },
        keyword: { type: 'string', description: '可选，按标题/进度关键词过滤' }
      },
      required: []
    }
  }
]
