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

/**
 * 获取多个技能的 systemPromptSection 拼接（通用版本，用于自定义 Agent）
 * @param {Array} skillIds - 技能 ID 数组
 * @param {string} [agentId] - Agent ID，如果是内置 Agent 则使用定制化技能 prompt
 * @returns {string} 拼接后的技能 prompt
 */
export function buildSkillsPrompt(skillIds = [], agentId = null) {
  if (!skillIds || skillIds.length === 0) return ''

  // 内置 Agent 使用定制化技能 prompt（skillPrompts 为 null 则走通用路径）
  if (agentId && BUILTIN_AGENT_SKILLS[agentId] && BUILTIN_AGENT_SKILLS[agentId].skillPrompts !== null) {
    return buildBuiltinAgentSkillsPrompt(agentId)
  }

  // 自定义 Agent 使用通用技能 prompt
  const sections = skillIds
    .map(id => getSkill(id))
    .filter(Boolean)
    .map(s => s.systemPromptSection)
    .filter(Boolean)
  return sections.length ? '\n\n' + sections.join('\n\n') : ''
}

/**
 * 内置 Agent 的默认技能 + 定制化技能 prompt
 * 每个内置 Agent 有自己专属的技能 prompt，而非通用版本
 */
export const BUILTIN_AGENT_SKILLS = {
  'siji': {
    skills: ['memory', 'relation', 'decision', 'plan_phases', 'summary', 'vision', 'simulation'],
    // 思迹助手使用通用技能 prompt（skillPrompts 为 null 表示走通用 SKILL_REGISTRY）
    skillPrompts: null
  },
  'workplace_advisor': {
    skills: ['memory', 'relation', 'decision', 'plan_phases', 'summary'],
    skillPrompts: {
      memory: `## 职场记忆
记住用户的职业信息（岗位、公司、行业、职级）、职场关系（同事/上级/下属）、关键事件（项目、考核、冲突）。当用户透露这些信息时主动调用 smart_update_profile 更新画像。回答职场问题时优先参考画像中的职业背景。`,
      relation: `## 职场人脉图谱
管理用户的职场人际关系。当用户提到同事、上级、客户时调用 create_relation 创建人物档案，记录对方的管理风格、利益诉求、与用户的互动历史。查询时调用 query_relation 获取关系背景，帮你给出更精准的应对策略。`,
      decision: `## 职场决策助手
用户面临跳槽、转行、晋升、是否接项目等决策时，主动调用 create_decision 创建决策日志。用「机会成本-风险-时机」三维框架分析：这个决定 3 个月后/1 年后有什么影响？最坏情况能承受吗？有没有第三选择？可调用 query_decision 查阅历史职场决策做参考。`,
      plan_phases: `## 职场发展计划
帮用户制定职业发展计划时，调用 create_plan_phases 拆解为多阶段。例如「3 个月晋升准备」→阶段1:梳理业绩数据→阶段2:向上级汇报→阶段3:正式申请。每阶段设里程碑和可量化的子任务。`,
      summary: `## 职场数据总结
用户要求总结时，调用 summarize_diaries 生成工作周报/月报。结合 query_stat 分析与工作相关的支出（如通勤、应酬、培训），帮用户发现时间分配和精力投入的模式。`
    }
  },
  'relationship_advisor': {
    skills: ['memory', 'relation', 'decision', 'plan_phases', 'summary'],
    skillPrompts: {
      memory: `## 情感记忆
记住用户的情感背景（恋爱状态、家庭关系、重要纪念日）、情感模式（依恋类型、冲突应对方式）、关键人物。用户透露这些信息时主动调用 smart_update_profile 更新画像。回答情感问题时参考画像中的关系背景，避免重复追问已知信息。`,
      relation: `## 关系图谱
管理用户的人际关系档案。当用户提到伴侣、家人、朋友时调用 create_relation 创建人物档案，记录关系阶段、互动模式、矛盾点。查询时调用 query_relation 了解关系背景，帮你给出更有针对性的沟通建议。`,
      decision: `## 情感决策助手
用户面临分手、复合、结婚、搬迁等重大情感决策时，主动调用 create_decision 创建决策日志。引导用户思考：这个决定对双方意味着什么？3 个月后会后悔吗？有没有折中方案？可调用 query_decision 查阅历史情感决策做参考。`,
      plan_phases: `## 关系改善计划
帮用户制定关系改善计划时，调用 create_plan_phases 拆解为多阶段。例如「30 天沟通改善计划」→阶段1:每日 15 分钟深度对话→阶段2:学习非暴力沟通表达→阶段3:建立每周关系复盘习惯。每阶段设可执行的行动项。`,
      summary: `## 情感数据总结
用户要求总结时，调用 summarize_diaries 生成情感周报/月报。结合记录数据分析情绪波动规律、关系互动频率、矛盾触发点，帮用户看见自己不易察觉的情感模式。`
    }
  },
  'career_coach': {
    skills: ['memory', 'relation', 'decision', 'plan_phases', 'summary'],
    skillPrompts: {
      memory: `## 求职记忆
记住用户的求职背景（目标岗位、目标行业、当前薪资、期望薪资）、求职进度（投递/面试/offer 情况）、面试反馈。用户透露这些信息时主动调用 smart_update_profile 更新画像。回答求职问题时参考画像，避免重复问已知信息。`,
      relation: `## 求用人脉图谱
管理用户的求职人脉（猎头、内推人、面试官、行业前辈）。当用户提到这些人时调用 create_relation 创建档案，记录对方的作用、沟通进展、可利用的资源。查询时调用 query_relation 获取内推/背调的人脉背景。`,
      decision: `## Offer 决策助手
用户面临 offer 选择时，主动调用 create_decision 创建决策日志。用「成长性-平台-薪资-风险」四维矩阵分析每个 offer。引导用户思考：1 年后哪个 offer 让你更值钱？最坏情况分别是什么？可调用 query_decision 查阅历史求职决策做参考。`,
      plan_phases: `## 求职计划
帮用户制定求职计划时，调用 create_plan_phases 拆解为多阶段。例如「2 个月求职冲刺」→阶段1:简历优化+目标公司筛选→阶段2:投递+内推→阶段3:面试准备+模拟→阶段4:offer 谈判。每阶段设里程碑和量化目标（如每周投 5 家）。`,
      summary: `## 求职数据总结
用户要求总结时，调用 summarize_diaries 生成求职周报。结合 query_stat 分析求职相关支出（如通勤、面试装备、培训），帮用户追踪求职进度和投入产出比。`
    }
  }
}

/**
 * 构建内置 Agent 的技能 prompt
 * @param {string} agentId - Agent ID
 * @returns {string} 拼接后的技能 prompt，空字符串表示无技能 prompt
 */
export function buildBuiltinAgentSkillsPrompt(agentId) {
  const config = BUILTIN_AGENT_SKILLS[agentId]
  if (!config || !config.skillPrompts) return ''  // null 或不存在 → 返回空，走通用路径
  const sections = Object.values(config.skillPrompts).filter(Boolean)
  return sections.length ? '\n\n' + sections.join('\n\n') : ''
}
