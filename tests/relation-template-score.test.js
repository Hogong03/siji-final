/**
 * test: 关系模板不得预填亲密度（4.39.0）
 *
 * 背景：模板此前带 score 5/6/7/8/9，用户点一下模板再提交，产品预设值就变成「用户评价」，
 * 直接污染平均亲密度统计、关系图谱排序与情景模拟人设。
 *
 * 本轮规则（不动存储结构）：
 *  - 模板只填 role / context / traits / preferences / notes，**不含亲密度**
 *  - 新建表单默认值仍是 5（不扩大改动范围）
 *  - 编辑已有关系时套模板，不覆盖用户已评的分数
 *  - 用户手动拖滑块后，分数照常保存（唯一合法写入路径）
 *
 * 断言对象是 utils/relation-templates.js 的纯函数（模板逻辑已从 .vue 抽出）——
 * 不靠读源码文本判断，避免「注释里提一句就被骗过」。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import './setup.js'
import { resetStorage } from './setup.js'
import { setActivePinia, createPinia } from 'pinia'
import { useDataStore } from '../store/data.js'
import { RELATION_TEMPLATES, buildRelationForm, applyRelationTemplate } from '../utils/relation-templates.js'
import { createRelation, getRelationById, DEFAULT_RELATIONSHIP_SCORE } from '../utils/relations.js'

let store

beforeEach(() => {
  resetStorage()
  setActivePinia(createPinia())
  store = useDataStore()
})

describe('模板数据层：不携带亲密度', () => {
  it('6 个模板都没有 score / relationship_score 字段（防回潮）', () => {
    expect(RELATION_TEMPLATES.length).toBe(6)
    RELATION_TEMPLATES.forEach(tpl => {
      expect('score' in tpl).toBe(false)
      expect('relationship_score' in tpl).toBe(false)
    })
  })
})

describe('应用模板不改亲密度', () => {
  it('新建表单：逐个应用全部模板，分数始终是默认值', () => {
    RELATION_TEMPLATES.forEach(tpl => {
      const form = buildRelationForm()
      applyRelationTemplate(form, tpl)
      expect(form.relationship_score).toBe(DEFAULT_RELATIONSHIP_SCORE)
    })
  })

  it('模板不会把分数改成 6/7/8/9（领导/朋友/家人/伴侣 四个高危模板）', () => {
    const highRisk = ['领导', '朋友', '家人', '伴侣']
    const form = buildRelationForm()
    highRisk.forEach(role => {
      const tpl = RELATION_TEMPLATES.find(t => t.role === role)
      expect(tpl).toBeTruthy()
      applyRelationTemplate(form, tpl)
      expect([6, 7, 8, 9]).not.toContain(form.relationship_score)
      expect(form.relationship_score).toBe(5)
    })
  })

  it('编辑已有关系：用户评过 8 分，逐个套用模板后仍是 8', () => {
    const form = buildRelationForm({ name: '阿伟', relationship_score: 8 })
    RELATION_TEMPLATES.forEach(tpl => applyRelationTemplate(form, tpl))
    expect(form.relationship_score).toBe(8)
  })

  it('用户手动调滑块后，再套模板也不会被覆盖', () => {
    const form = buildRelationForm()
    applyRelationTemplate(form, RELATION_TEMPLATES.find(t => t.role === '伴侣'))
    form.relationship_score = 3 // 用户拖滑块
    applyRelationTemplate(form, RELATION_TEMPLATES.find(t => t.role === '家人'))
    expect(form.relationship_score).toBe(3)
  })

  it('新建表单默认值仍是 5（改动范围没有扩大）', () => {
    expect(buildRelationForm().relationship_score).toBe(5)
    expect(DEFAULT_RELATIONSHIP_SCORE).toBe(5)
  })
})

describe('模板其他字段填充不受影响', () => {
  it('role / context / traitsStr / preferencesStr / notes 全部照常写入', () => {
    const tpl = RELATION_TEMPLATES.find(t => t.role === '领导')
    const form = applyRelationTemplate(buildRelationForm(), tpl)
    expect(form.role).toBe('领导')
    expect(form.context).toBe(tpl.context)
    expect(form.traitsStr).toBe(tpl.traits)
    expect(form.preferencesStr).toBe(tpl.preferences)
    expect(form.notes).toBe(tpl.notes)
  })

  it('空模板（其他）应用后不清空已有输入的其他字段之外的东西', () => {
    const form = buildRelationForm({ name: '阿伟' })
    applyRelationTemplate(form, RELATION_TEMPLATES.find(t => t.role === '其他'))
    expect(form.name).toBe('阿伟') // 姓名不受模板影响
    expect(form.context).toBe('')
    expect(form.notes).toBe('')
  })

  it('参数缺失时安全返回（不比不存在的模板崩）', () => {
    const form = buildRelationForm()
    expect(applyRelationTemplate(form, null)).toBe(form)
    expect(applyRelationTemplate(null, RELATION_TEMPLATES[0])).toBeNull()
  })
})

describe('提交链路：用户手动评分仍然生效', () => {
  it('套模板 + 手动拖滑块 → 提交后落库为用户给的分', () => {
    const form = applyRelationTemplate(
      buildRelationForm({ name: '阿伟' }),
      RELATION_TEMPLATES.find(t => t.role === '朋友')
    )
    form.relationship_score = 9 // 用户手动评价

    const rel = createRelation({
      name: form.name,
      role: form.role,
      context: form.context,
      relationship_score: form.relationship_score,
      notes: form.notes
    }, { trustScore: true }) // UI 手动路径

    expect(rel.relationship_score).toBe(9)
    expect(rel.role).toBe('朋友')
    expect(getRelationById(rel.id).relationship_score).toBe(9)
  })

  it('不手动评分时，落库是默认值而不是模板预设值', () => {
    const form = applyRelationTemplate(
      buildRelationForm({ name: '家人甲' }),
      RELATION_TEMPLATES.find(t => t.role === '家人')
    )
    const rel = createRelation({ name: form.name, role: form.role }, { trustScore: true })
    expect(rel.relationship_score).toBe(5)
  })
})
