/**
 * traceback-eval.js — 关系回溯触发范围评估器（4.41.0）
 *
 * 只做观测与统计，不做断言：把 traceback-corpus.js 的语料跑一遍，产出四类指标——
 *   1. 召回率：该触发的是否触发
 *   2. 误触发率（注入层）：不该注入的是否注入了
 *   3. 人物匹配准确率：注入时是否关联到正确的人（多人场景单独看）
 *   4. 行为安全性：无记录/无人物时是否仍然不编造
 *
 * 纯本地确定性评估：不调模型、不联网，同一份语料在任何机器上结果一致。
 * 断言在 tests/relation-traceback-trigger.test.js，报告在 docs/关系回溯触发评估.md。
 */
import { createRelation, logInteraction } from '../../relations.js'
import { detectTracebackIntent, buildTracebackContext } from '../../relation-traceback.js'

const DAY = 86400000

/**
 * 按用例的数据前置写库（调用前请自行 resetStorage）
 * @param {object} caze
 * @param {number} [now]
 * @returns {Object<string, object>} 人名 → 落库后的关系对象
 */
export function seedTracebackFixture(caze, now = Date.now()) {
  const created = {}
  const relations = Array.isArray(caze && caze.relations) ? caze.relations : []
  relations.forEach(r => {
    const rel = createRelation({ name: r.name, role: r.role || '朋友' })
    created[r.name] = rel
    const list = Array.isArray(r.interactions) ? r.interactions : []
    list.forEach(i => {
      logInteraction({
        relation_id: rel.id,
        relation_name: rel.name,
        scene: i.scene || '日常',
        content: i.content || '',
        result: i.result || '',
        emotion: i.emotion || '',
        date: now - (Number(i.daysAgo) || 0) * DAY
      })
    })
  })
  return created
}

/**
 * 从回溯上下文里取出关联到的人物名（可能多段，按出现顺序）
 * @param {string} ctx
 * @returns {string[]}
 */
export function extractTracebackPersons(ctx) {
  const text = String(ctx || '')
  const names = []
  const re = /关系回溯（([^，]+)，/g
  let m
  while ((m = re.exec(text)) !== null) {
    m[1].split('、').map(s => s.trim()).filter(Boolean).forEach(n => names.push(n))
  }
  return names
}

/**
 * 跑一条用例：播种前置 → 观测意图与注入
 *
 * 注意（评估模型的正确性）：生产环境有两道门，缺一不可——
 *   第一道 detectTracebackIntent（消息是不是在问关系变化）
 *   第二道 buildTracebackContext 内部的人物门（有没有提到已收录的人）
 * 只有两道都过，回溯上下文才会真的进 prompt。因此本函数把
 * `contextBuilt`（人物门结果）与 `injected`（生产实际行为 = 两道门都过）分开记录，
 * 否则会把"能构建"误判成"已注入"。
 *
 * @param {object} caze
 * @param {{ now?: number }} [opts]
 */
export function runTracebackCase(caze, opts = {}) {
  const now = opts.now || Date.now()
  seedTracebackFixture(caze, now)
  const intent = detectTracebackIntent(caze.message)
  const ctx = buildTracebackContext(caze.message, { now })
  const contextBuilt = !!ctx
  return {
    intent,
    contextBuilt,
    injected: intent && contextBuilt, // 生产实际：chat-helpers 里先判意图再构建
    ctx,
    persons: extractTracebackPersons(ctx)
  }
}

/**
 * 把「用例期望」与「实际观测」比对成一行可统计的记录
 * @param {object} caze
 * @param {{ intent:boolean, injected:boolean, ctx:string, persons:string[] }} obs
 */
export function analyzeTracebackCase(caze, obs) {
  const exp = (caze && caze.expect) || {}
  const wantInjection = exp.injection === true
  const forbidInjection = exp.injection === false
  const optional = exp.injection === 'optional'

  const safety = []
  ;(exp.contains || []).forEach(s => safety.push({ kind: 'contains', text: s, ok: String(obs.ctx).includes(s) }))
  ;(exp.notContains || []).forEach(s => safety.push({ kind: 'notContains', text: s, ok: !String(obs.ctx).includes(s) }))

  const persons = obs.injected && Array.isArray(obs.persons) ? obs.persons : []
  // 期望人物：persons（有序列表，用于多人场景）优先；否则 person（单人）
  const expectPersons = Array.isArray(exp.persons) ? exp.persons : (exp.person ? [exp.person] : null)
  const personsExact = (wantInjection && expectPersons && obs.injected)
    ? (persons.length === expectPersons.length && persons.every((p, i) => p === expectPersons[i]))
    : null
  return {
    id: caze.id,
    category: caze.category,
    message: caze.message,
    expectInjection: exp.injection === true ? 'inject' : (exp.injection === false ? 'forbid' : 'optional'),
    expectPerson: expectPersons ? expectPersons.join('、') : null,
    intent: !!obs.intent,
    contextBuilt: !!obs.contextBuilt,
    injected: !!obs.injected,
    // 被第一道门（意图）拦下：上下文能建，但消息不是在问关系变化 → 生产不注入
    blockedByIntent: !!obs.contextBuilt && !obs.intent,
    // 被第二道门（人物）拦下：意图命中，但没有人名指向/人物未收录/归属不属用户 → 生产不注入
    blockedByPerson: !!obs.intent && !obs.contextBuilt,
    // 两道门都没经过：消息既不是在问关系变化，也没有合格人物（如历史事实查询）
    neitherGate: !obs.contextBuilt && !obs.intent,
    // 召回：只看「必须注入」的用例
    recallHit: wantInjection ? !!obs.injected : null,
    miss: wantInjection ? !obs.injected : false,
    // 误触发：只看「必须不注入」的用例（注入层）
    falseInjection: forbidInjection ? !!obs.injected : null,
    // 历史询问这类「两种都行」的用例单独统计
    optionalHit: optional ? !!obs.injected : null,
    person: persons[0] || null,
    persons,
    // 人物匹配：只在「确实注入了」的用例上统计（漏触发属召回问题）；
    // 多人场景要求**有序完全一致**（顺序 = 消息中出现顺序，确定性）
    personOk: (wantInjection && expectPersons && obs.injected) ? personsExact : null,
    multiPerson: exp.multiPerson
      // 没注入的多人类用例不算「静默选一人」（那是漏触发，计在召回里）
      ? (!obs.injected ? 'not_injected' : (persons.length > 1 ? 'multi' : 'silent_single'))
      : null,
    safety,
    safetyOk: safety.every(s => s.ok)
  }
}

/**
 * 汇总四类指标
 * @param {Array} rows analyzeTracebackCase 的结果
 */
export function summarizeTracebackMetrics(rows) {
  const list = Array.isArray(rows) ? rows : []
  const need = list.filter(r => r.recallHit !== null)
  const forbid = list.filter(r => r.falseInjection !== null)
  const optional = list.filter(r => r.optionalHit !== null)
  const personCases = list.filter(r => r.personOk !== null)
  const multi = list.filter(r => r.multiPerson !== null)
  const safetyCases = list.filter(r => r.safety.length > 0)

  const ratio = (num, den) => (den ? num / den : 1)
  return {
    total: list.length,
    needInjection: need.length,
    recall: ratio(need.filter(r => r.recallHit).length, need.length),
    missedIds: need.filter(r => r.miss).map(r => r.id),
    forbidInjection: forbid.length,
    falseInjectionRate: ratio(forbid.filter(r => r.falseInjection).length, forbid.length),
    falseInjectionIds: forbid.filter(r => r.falseInjection).map(r => r.id),
    // 两道门各自拦下了谁 —— 说明「收紧正则」与「收紧人物门」各自的作用面
    blockedByIntentIds: list.filter(r => r.blockedByIntent).map(r => r.id),
    blockedByPersonIds: list.filter(r => r.blockedByPerson).map(r => r.id),
    neitherGateIds: list.filter(r => r.neitherGate).map(r => r.id),
    optionalCount: optional.length,
    optionalHit: optional.filter(r => r.optionalHit).length,
    personCases: personCases.length,
    personAccuracy: ratio(personCases.filter(r => r.personOk).length, personCases.length),
    personWrongIds: personCases.filter(r => !r.personOk).map(r => `${r.id}→${r.persons && r.persons.length ? r.persons.join('、') : 'none'}`),
    multiCases: multi.length,
    multiSilentPickIds: multi.filter(r => r.multiPerson === 'silent_single').map(r => r.id),
    safetyCases: safetyCases.length,
    safetyOk: safetyCases.every(r => r.safetyOk),
    safetyFailIds: safetyCases.filter(r => !r.safetyOk).map(r => r.id)
  }
}

/** 一行指标（评估报告与调试日志共用同一份口径） */
export function formatMetricLine(m, name) {
  const pct = (v) => `${Math.round(v * 1000) / 10}%`
  const map = {
    recall: `召回率：${pct(m.recall)}（${m.needInjection - m.missedIds.length}/${m.needInjection}）· 漏触发 ${m.missedIds.join(',') || '无'}`,
    falseInjection: `注入层误触发率：${pct(m.falseInjectionRate)}（${m.falseInjectionIds.length}/${m.forbidInjection}）· 命中者 ${m.falseInjectionIds.join(',') || '无'}`,
    person: `人物匹配准确率：${pct(m.personAccuracy)}（${m.personCases - m.personWrongIds.length}/${m.personCases}）· 错配 ${m.personWrongIds.join(',') || '无'}`,
    safety: `行为安全性：${m.safetyOk ? '全部通过' : '存在失败'}（${m.safetyCases} 项断言）· 失败 ${m.safetyFailIds.join(',') || '无'}`,
    multi: `多人场景：${m.multiCases} 例，静默只选一人 ${m.multiSilentPickIds.length} 例（${m.multiSilentPickIds.join(',') || '无'}）`,
    optional: `历史询问（可注入可不注入）：${m.optionalHit}/${m.optionalCount} 例注入了回溯`,
    blocked: `被第一道门（意图）拦下：${m.blockedByIntentIds.join(',') || '无'}；被第二道门（人物/归属/合格性）拦下：${m.blockedByPersonIds.join(',') || '无'}；两道门都未经过：${m.neitherGateIds.join(',') || '无'}`
  }
  return map[name] || ''
}

/** 生成评估报告的 Markdown 正文（可复现：跑同一语料即得同一份正文） */
export function buildTracebackReport(rows) {
  const m = summarizeTracebackMetrics(rows)
  const head = [
    '# 关系回溯触发范围评估',
    '',
    '> 由 `npx vitest run tests/relation-traceback-trigger.test.js` 产出（语料 `utils/ai/eval/traceback-corpus.js`）。',
    '> 纯本地确定性评估，不调模型、不联网。',
    '',
    '## 指标',
    '',
    '- ' + formatMetricLine(m, 'recall'),
    '- ' + formatMetricLine(m, 'falseInjection'),
    '- ' + formatMetricLine(m, 'person'),
    '- ' + formatMetricLine(m, 'safety'),
    '- ' + formatMetricLine(m, 'multi'),
    '- ' + formatMetricLine(m, 'optional'),
    '- ' + formatMetricLine(m, 'blocked'),
    '',
    '## 逐例结果',
    '',
    '| id | 类别 | 消息 | 意图 | 注入 | 人物 | 期望 |',
    '| --- | --- | --- | --- | --- | --- | --- |'
  ]
  const body = rows.map(r => {
    const expText = r.expectInjection === 'inject' ? '注入' : (r.expectInjection === 'forbid' ? '不注入' : '可选')
    const bad = r.recallHit === false || r.falseInjection === true || r.personOk === false || r.multiPerson === 'silent_single'
    const who = (r.persons && r.persons.length) ? r.persons.join('、') : '-'
    return `| ${r.id} | ${r.category} | ${r.message} | ${r.intent ? 'Y' : 'N'} | ${r.injected ? 'Y' : 'N'} | ${who} | ${expText}${r.expectPerson ? '·' + r.expectPerson : ''} · ${bad ? '不符' : '符合'} |`
  })
  return head.concat(body).join('\n')
}
