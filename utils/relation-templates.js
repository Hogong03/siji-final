/**
 * relation-templates.js — 人脉关系模板（4.39.0 从 pages/settings/sub/relations.vue 抽出）
 *
 * 为什么抽出来：模板「应用后不得改动亲密度」这条规则需要真断言，而 .vue 内部逻辑只能靠
 * 读源码文本判断（AGENTS 明令「别用文本启发式」——注释里提一句就被骗过）。这里保持纯数据 + 纯函数。
 *
 * 亲密度规则：模板**只填角色与画像信息，不含任何分数**。
 * 产品预设分数一旦预填，用户点一下提交就变成「用户评价」，直接污染平均亲密度统计与情景模拟人设。
 */

import { DEFAULT_RELATIONSHIP_SCORE } from './relations.js'

/** 关系模板：role / context / traits / preferences / notes，**没有 score** */
export const RELATION_TEMPLATES = [
  {
    role: '同事', icon: '💼', hint: '项目合作',
    context: '公司/团队',
    traits: '专业, 讲效率',
    preferences: '就事论事, 重视结果',
    notes: ''
  },
  {
    role: '领导', icon: '🎯', hint: '上下级',
    context: '公司/部门',
    traits: '决策型, 注重细节',
    preferences: '汇报要有结论, 不喜欢意外',
    notes: '直接上级，周一对齐'
  },
  {
    role: '朋友', icon: '🤝', hint: '日常社交',
    context: '朋友聚会/线上',
    traits: '幽默, 靠谱',
    preferences: '随意聊天, 分享生活',
    notes: ''
  },
  {
    role: '家人', icon: '🏠', hint: '亲属',
    context: '家庭',
    traits: '关心我, 有时唠叨',
    preferences: '多打电话, 陪伴比礼物重要',
    notes: ''
  },
  {
    role: '伴侣', icon: '❤️', hint: '亲密关系',
    context: '生活',
    traits: '温柔, 敏感',
    preferences: '需要倾听, 不喜欢冷战',
    notes: '重要纪念日记录'
  },
  {
    role: '其他', icon: '👤', hint: '自定义',
    context: '',
    traits: '',
    preferences: '',
    notes: ''
  }
]

/**
 * 建卡/编辑表单的初始值（亲密度固定为系统默认值，模板不会改它）
 * @param {object} [overrides]
 */
export function buildRelationForm(overrides = {}) {
  return {
    name: '',
    role: '同事',
    context: '',
    traitsStr: '',
    preferencesStr: '',
    relationship_score: DEFAULT_RELATIONSHIP_SCORE,
    notes: '',
    ...overrides
  }
}

/**
 * 应用模板：只覆盖 role / context / traitsStr / preferencesStr / notes。
 * **绝不触碰 form.relationship_score** —— 新建（默认 5）与编辑已有关系（用户已评 X 分）两种场景都成立。
 * @param {object} form 会被就地修改并返回
 * @param {object} tpl
 */
export function applyRelationTemplate(form, tpl) {
  if (!form || !tpl) return form
  form.role = tpl.role
  form.context = tpl.context
  form.traitsStr = tpl.traits
  form.preferencesStr = tpl.preferences
  form.notes = tpl.notes
  return form
}
