/**
 * tools/agent.js — Agent 管理工具（3.0：AI 对话直接创建 Agent）
 * 3.1：技能体系下线；Agent 结构 {name, description, systemPrompt, starts?, icon?}
 * 白名单校验：icon 防越权值注入；systemPrompt/starts 限长
 */

/** AI 可选的图标（新场景默认自定义图标） */
export const AGENT_ICON_OPTIONS = [
  '/static/icons/agent-custom-v2.png',
  '/static/icons/agent-relationship-v2.png',
  '/static/icons/agent-psychologist-v2.png',
  '/static/icons/agent-siji-v2.png'
]

/** 人设最大字符数，超出拒绝并要求精简 */
export const AGENT_PROMPT_MAX = 4000

const startsSchema = {
  type: 'array',
  maxItems: 3,
  items: { type: 'string', maxLength: 20 },
  description: '开场引导（1-3 条，每条 ≤20 字）：用户切换到此 Agent 后可直接点击发送的示例开场，贴合用途一次生成 3 条'
}

export const AGENT_TOOLS = [
  {
    name: 'create_agent',
    description: '创建新的自定义 Agent（AI 助手人设）。用户要求「创建一个 XX Agent/助手/教练/顾问」时使用。调用前必须先用对话确认用途与关键要点，确认后一次生成完整人设方案并调用（含 3 条开场引导），禁止未经确认直接创建。',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Agent 名称，中文，2-10 字' },
        description: { type: 'string', description: '一句话简介（用途与风格），可省略' },
        systemPrompt: { type: 'string', description: '人设系统提示词：身份、能力、回复风格、行为规则，中文，不超过 4000 字符' },
        starts: startsSchema,
        icon: { type: 'string', enum: AGENT_ICON_OPTIONS, description: '图标路径，默认 agent-custom-v2' }
      },
      required: ['name', 'systemPrompt']
    }
  }
]

/** 创建参数校验与归一化 — 工具直接执行与「确认卡」确认后执行共用同一套规则 */
export function buildAgentPayload(raw = {}) {
  const name = String(raw.name || '').trim()
  if (!name) return { ok: false, text: '缺少 Agent 名称，请补充名称后重试' }
  const systemPrompt = String(raw.systemPrompt || '').trim()
  if (!systemPrompt) return { ok: false, text: '人设不能为空，请描述这个 Agent 的身份与风格' }
  if (systemPrompt.length > AGENT_PROMPT_MAX) {
    return { ok: false, text: '人设过长（' + systemPrompt.length + ' 字符），请精简到 ' + AGENT_PROMPT_MAX + ' 字符以内' }
  }
  const icon = AGENT_ICON_OPTIONS.includes(raw.icon) ? raw.icon : '/static/icons/agent-custom-v2.png'
  // 3.1：存量请求可能仍带 skills 字段，静默忽略（不清洗、不报错）
  const starts = Array.isArray(raw.starts)
    ? raw.starts.map(s => String(s || '').trim()).filter(Boolean).slice(0, 3)
    : []
  return {
    ok: true,
    data: {
      name: name.length > 12 ? name.substring(0, 12) : name,
      description: String(raw.description || '').trim().substring(0, 100),
      systemPrompt,
      starts: starts.map(s => (s.length > 20 ? s.substring(0, 20) : s)),
      icon
    }
  }
}
