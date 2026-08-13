/**
 * 技能注册表 — Agent 可选能力模块
 * 每个技能定义：id, name, description, icon, systemPromptSection
 * systemPromptSection 会被注入到 Agent 的 system prompt 中
 */

export const SKILL_REGISTRY = [
  {
    id: 'memory',
    name: '长期记忆',
    icon: '🧠',
    description: '记住用户的重要信息、偏好和历史对话',
    systemPromptSection: `## 长期记忆
你可以记住用户透露的重要信息（偏好、习惯、重要事件）。当用户说"记住这个"或透露关键信息时，主动调用 smart_update_profile 工具更新画像。回答问题时可参考用户画像数据。`
  },
  {
    id: 'relation',
    name: '人脉图谱',
    icon: '👥',
    description: '管理人物关系、互动记录、关系亲密度',
    systemPromptSection: `## 人脉图谱
你可以创建和管理人物关系。当用户介绍新人物时调用 create_relation，提到互动时可调用 log_interaction。查询人物信息时调用 query_relation。`
  },
  {
    id: 'decision',
    name: '决策助手',
    icon: '⚖️',
    description: '帮助用户分析选择、记录决策过程、复盘结果',
    systemPromptSection: `## 决策助手
当用户面临选择时，主动调用 create_decision 创建决策日志。帮用户分析选项的利弊，用"机会成本-风险-时机"三维框架引导思考。可调用 query_decision 查阅历史决策。`
  },
  {
    id: 'plan_phases',
    name: '阶段化计划',
    icon: '📋',
    description: '将大目标拆解为多阶段计划，含里程碑和子任务',
    systemPromptSection: `## 阶段化计划
对于大目标，调用 create_plan_phases 而非 create_plan，自动拆解为 2-6 个阶段。每阶段含时间窗口、里程碑和子任务。`
  },
  {
    id: 'summary',
    name: '智能总结',
    icon: '📊',
    description: '生成记录周报/月报、消费分析报告',
    systemPromptSection: `## 智能总结
用户要求总结时，调用 summarize_diaries 生成周报/月报。可结合 query_stat 分析消费趋势，给出数据驱动的洞察。`
  },
  {
    id: 'vision',
    name: '图片识别',
    icon: '📷',
    description: '识别图片内容（截图、账单、风景等）',
    systemPromptSection: `## 图片识别
用户发送图片时，先识别图片内容再处理。支持截图识别、账单识别、文字提取等场景。`
  },
  {
    id: 'simulation',
    name: '情景演练',
    icon: '🎭',
    description: '模拟社交场景对话，练习沟通技巧',
    systemPromptSection: `## 情景演练
用户要求模拟对话时，调用 start_simulation 进入演练模式。支持社交、计划、关系三种模式。演练结束后调用 end_simulation 保存报告。`
  }
]

/** 获取技能 by id */
export function getSkill(id) {
  return SKILL_REGISTRY.find(s => s.id === id)
}

/** 获取多个技能的 systemPromptSection 拼接 */
export function buildSkillsPrompt(skillIds = []) {
  if (!skillIds || skillIds.length === 0) return ''
  const sections = skillIds
    .map(id => getSkill(id))
    .filter(Boolean)
    .map(s => s.systemPromptSection)
    .filter(Boolean)
  return sections.length ? '\n\n' + sections.join('\n\n') : ''
}

/** 获取内置 Agent 的默认技能 */
export const BUILTIN_AGENT_SKILLS = {
  'siji': ['memory', 'relation', 'decision', 'plan_phases', 'summary', 'vision', 'simulation'],
  'workplace_advisor': ['memory', 'relation', 'decision', 'plan_phases'],
  'relationship_advisor': ['memory', 'relation', 'decision'],
  'career_coach': ['memory', 'relation', 'plan_phases', 'summary']
}
