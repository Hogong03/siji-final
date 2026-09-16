/**
 * runner.js — AI 效果自检的判定与编排（3.7.0）
 *
 * 只做两件事：判断「这一轮的期望达成了没有」，以及按顺序跑完语料。
 * 不碰 store、不发请求 —— 模型调用由调用方以 runner 函数注入
 * （页面里是真请求，测试里是 cfg._mockResponder），这样判定逻辑可以被单测钉死。
 *
 * 干跑模式在 utils/ai/agent-loop.js 的 cfg.dryRun：写操作与联网工具换成占位，查询类照常真跑。
 *
 * 3.7.1：引擎有两条执行路径 —— 原生工具调用（tool_calls，走循环）与老 JSON action（模型只回
 * JSON 时由 response-parser 解析）。用户可感知的结果是「到底落库没有」，所以两条都必须计入工具
 * 序列；3.7.0 首跑只认 tool_calls，把 5 条本来会正常执行的记账 / 记录判成了「没调工具」。
 *
 * 3.7.1 另立一档 fallback：模型既没调工具、也没回 JSON，只口头说「记好了」时，前端 extractFallbackAction
 * 还能从用户原话里正则兜出一条写入 —— 结果会落库，但这不是 AI 会拆解，是兜底在救场。
 * 这一档单独计数（不算通过），因为它正是「AI 拆解能力差」的量化证据。
 *
 * 3.7.2 数据前置：语料里的 {plan} / {billAmount} 由 buildEvalContext 从真实数据取值，
 * 取不到就判 SKIP（不算失败）—— 3.7.1 首跑那 4 条失败就是语料引用了你库里并不存在的计划。
 */
import { extractFallbackAction } from '../fallback.js'
import { OP_CLAIM_RE, OP_CLAIM_RE_FALLBACK } from '../constants.js'

/** 用例结果状态 */
export const CASE_STATUS = {
  PASS: 'pass',
  FAIL: 'fail',
  FALLBACK: 'fallback',
  ERROR: 'error',
  SKIP: 'skip'
}

/** 数据前置的中文说法（缺前置时告诉用户缺什么） */
export const NEED_LABELS = {
  plan: '一条进行中的计划',
  bill: '一笔支出账单'
}

/**
 * 从真实数据里取值，供语料里的占位符使用（3.7.2）
 * @param {Object} data { plans, bills } 由调用方用 query_plan / query_bill 取回
 * @returns {Object} { plan, planId, bill, billAmount, billAmountPlus }
 */
export function buildEvalContext(data = {}) {
  const plans = (Array.isArray(data.plans) ? data.plans : []).filter((p) => p && p.title && p.status !== 2)
  const plan = plans[0] || null
  const bills = (Array.isArray(data.bills) ? data.bills : []).filter((b) => b && b.type === 'expense' && Number(b.amount) > 0)
  const bill = bills[0] || null
  return {
    plan: plan ? String(plan.title) : '',
    planId: plan ? String(plan.client_id || '') : '',
    bill: bill ? String(bill.category || bill.note || '账单') : '',
    // 没有账单时用空串：占位符保持原样，别把「不是 0 是 0」这种废话塞进语料
    billAmount: bill ? Number(bill.amount) : '',
    billAmountPlus: bill ? Number(bill.amount) + 18 : ''
  }
}

/**
 * 解析用例的占位符与数据前置
 * @param {Object} caze
 * @param {Object} ctx buildEvalContext 的返回值
 * @returns {{ ok: boolean, message: string, missing: string[] }}
 */
export function resolveCase(caze, ctx) {
  const needs = (caze && caze.needs) ? String(caze.needs).split(',').map((t) => t.trim()).filter(Boolean) : []
  const data = ctx || {}
  // 缺前置：值为空串 / 0 / null 都算缺（金额为 0 的账单不能拿来改）
  const missing = needs.filter((k) => {
    const v = data[k]
    return v === undefined || v === null || v === ''
  })
  const message = String((caze && caze.message) || '').replace(/\{(\w+)\}/g, (raw, key) => {
    const v = data[key]
    return (v === undefined || v === null || v === '') ? raw : String(v)
  })
  return { ok: missing.length === 0, message, missing }
}

/**
 * 把两条执行路径合并成一条工具序列（3.7.1）
 * @param {Object} result runAgentLoop 的返回值
 * @param {Object} [opts] { isKnownType: (type) => boolean } 过滤模型幻觉出来的动作类型（3.7.2）
 * @returns {Array<{name: string, args: Object, source: 'tool'|'json'}>}
 */
export function mergeExecutedTools(result, opts = {}) {
  const isKnown = typeof opts.isKnownType === 'function' ? opts.isKnownType : null
  const out = []
  const calls = (result && Array.isArray(result.toolCalls)) ? result.toolCalls : []
  calls.forEach((c) => {
    if (c && c.name) out.push({ name: c.name, args: c.args || {}, source: 'tool' })
  })
  const acts = []
  if (result && Array.isArray(result.actions) && result.actions.length > 0) acts.push(...result.actions)
  else if (result && result.action && result.action.type && result.action.type !== 'multi') acts.push(result.action)
  acts.forEach((a) => {
    if (!a || !a.type) return
    if (isKnown && !isKnown(a.type)) return
    out.push({ name: a.type, args: a.payload || {}, source: 'json' })
  })
  return out
}

/** 取出工具名序列（容忍 args 解析失败留下的 null） */
export function toolNamesOf(toolCalls) {
  return (Array.isArray(toolCalls) ? toolCalls : [])
    .map((c) => (c && c.name) || '')
    .filter(Boolean)
}

function indexOfFirst(names, name) {
  return names.indexOf(name)
}

/**
 * 这条失败能不能被前端兜底救回来（模型口头声称 + 原话能正则提取出写入动作）
 * @param {Object} caze
 * @param {Object} res runner 的返回
 * @param {Array<string>} failures
 * @returns {Object|null} 兜底动作 { type, payload }
 */
function detectFallback(caze, res, failures) {
  const expect = (caze && caze.expect) || {}
  const wantsTools = (expect.tools && expect.tools.length > 0) || (expect.toolsAny && expect.toolsAny.length > 0)
  if (!wantsTools) return null
  const missing = failures.some((t) => t.indexOf('缺少工具') === 0 || t.indexOf('这几个工具至少要调一个') === 0)
  if (!missing) return null
  const reply = (res && res.reply) || ''
  // 与 autoExecutor 的闸门保持一致（收窄集 + 基础集）
  if (!OP_CLAIM_RE_FALLBACK.test(reply) && !OP_CLAIM_RE.test(reply)) return null
  try {
    return extractFallbackAction(caze.message, reply)
  } catch (e) {
    return null
  }
}

function checkArgs(expect, ctx, failures) {
  const spec = expect.args
  if (!spec) return
  for (const name of Object.keys(spec)) {
    const pred = spec[name]
    if (typeof pred !== 'function') continue
    const called = ctx.toolCalls.find((c) => c && c.name === name)
    if (!called) {
      failures.push(`没有调用 ${name}，无法校验参数`)
      continue
    }
    let ok = false
    try {
      ok = !!pred(called.args || {}, ctx.toolCalls)
    } catch (e) {
      failures.push(`${name} 参数校验抛错：${e && e.message ? e.message : e}`)
      continue
    }
    if (!ok) failures.push(`${name} 的参数不符合预期：${JSON.stringify(called.args || {})}`)
  }
}

/**
 * 判定一个用例是否通过
 * @param {Object} caze 语料（见 cases.js）
 * @param {Object} ctx { toolCalls, reply, confirm }
 * @returns {{ pass: boolean, failures: string[], gotTools: string[] }}
 */
export function judgeCase(caze, ctx) {
  const failures = []
  const expect = (caze && caze.expect) || {}
  const toolCalls = (ctx && ctx.toolCalls) || []
  const gotTools = toolNamesOf(toolCalls)
  const reply = (ctx && ctx.reply) || ''

  if (!caze || !caze.expect) {
    return { pass: false, failures: ['用例缺少 expect 断言'], gotTools }
  }

  // 必须全部出现
  for (const name of expect.tools || []) {
    if (!gotTools.includes(name)) failures.push(`缺少工具 ${name}`)
  }

  // 至少出现一个
  if (Array.isArray(expect.toolsAny) && expect.toolsAny.length > 0) {
    if (!expect.toolsAny.some((n) => gotTools.includes(n))) {
      failures.push(`这几个工具至少要调一个：${expect.toolsAny.join(' / ')}`)
    }
  }

  // 一个都不许出现
  for (const name of expect.forbid || []) {
    if (gotTools.includes(name)) failures.push(`不该调用 ${name}`)
  }

  // 先查后改：[a, b] 出现 b 时必须先有 a
  for (const pair of expect.order || []) {
    const [before, after] = pair || []
    if (!before || !after) continue
    if (!gotTools.includes(after)) continue
    const iBefore = indexOfFirst(gotTools, before)
    const iAfter = indexOfFirst(gotTools, after)
    if (iBefore < 0) failures.push(`调了 ${after} 但没先 ${before}`)
    else if (iBefore > iAfter) failures.push(`${before} 必须在 ${after} 之前`)
  }

  checkArgs(expect, { toolCalls }, failures)

  if (expect.confirm === true && !(ctx && ctx.confirm)) failures.push('没有走确认闸门')
  if (expect.confirm === false && ctx && ctx.confirm) failures.push('不该走确认闸门')

  for (const s of expect.replyIncludes || []) {
    if (reply.indexOf(s) < 0) failures.push(`回复里缺少「${s}」`)
  }
  for (const s of expect.replyExcludes || []) {
    if (reply.indexOf(s) >= 0) failures.push(`回复里不该出现「${s}」`)
  }

  return { pass: failures.length === 0, failures, gotTools }
}

/**
 * 跑一条用例
 * @param {Function} runner (message, caze) => Promise<{ toolCalls, reply, confirm }>
 * @param {Object} caze
 * @returns {Promise<Object>} 结果行
 */
export async function runCase(runner, caze, ctx) {
  const startedAt = Date.now()
  const resolved = resolveCase(caze, ctx)
  if (!resolved.ok) {
    const need = resolved.missing.map((k) => NEED_LABELS[k] || k).join('、')
    return {
      id: caze.id,
      title: caze.title,
      message: resolved.message,
      status: CASE_STATUS.SKIP,
      failures: [`缺少数据前置：${need}（不算失败，先建一条再跑）`],
      gotTools: [],
      jsonTools: [],
      fallbackType: '',
      reply: '',
      ms: 0
    }
  }
  const caseForRun = Object.assign({}, caze, { message: resolved.message })
  try {
    const res = (await runner(resolved.message, caseForRun)) || {}
    const judged = judgeCase(caseForRun, res)
    const fallbackAction = judged.pass ? null : detectFallback(caseForRun, res, judged.failures)
    const failures = judged.failures.slice()
    if (fallbackAction) failures.push('模型没调工具，靠前端兜底执行（' + fallbackAction.type + '）——结果能落库，但不是 AI 会拆解')
    return {
      id: caze.id,
      title: caze.title,
      message: resolved.message,
      status: judged.pass ? CASE_STATUS.PASS : (fallbackAction ? CASE_STATUS.FALLBACK : CASE_STATUS.FAIL),
      failures: failures,
      gotTools: judged.gotTools,
      jsonTools: ((res.toolCalls || []).filter(t => t && t.source === 'json')).map(t => t.name),
      fallbackType: fallbackAction ? fallbackAction.type : '',
      reply: res.reply || '',
      ms: Date.now() - startedAt
    }
  } catch (e) {
    return {
      id: caze.id,
      title: caze.title,
      message: resolved.message,
      status: CASE_STATUS.ERROR,
      failures: ['请求失败：' + ((e && e.message) || e)],
      gotTools: [],
      reply: '',
      ms: Date.now() - startedAt
    }
  }
}

/**
 * 按顺序跑完整套语料
 * @param {Function} runner
 * @param {Array} cases
 * @param {Object} [opts] { onProgress(done, total, row), stopRef: { stopped: boolean } }
 * @returns {Promise<Array>} 结果行数组（中途停止则只到当前条）
 */
export async function runCases(runner, cases, opts = {}) {
  const list = Array.isArray(cases) ? cases : []
  const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null
  const stopRef = opts.stopRef || null
  const ctx = opts.ctx || null
  const rows = []
  for (let i = 0; i < list.length; i++) {
    if (stopRef && stopRef.stopped) break
    const row = await runCase(runner, list[i], ctx)
    rows.push(row)
    if (onProgress) onProgress(rows.length, list.length, row)
  }
  return rows
}

/**
 * 汇总结果
 * @param {Array} rows
 * @returns {{ total, pass, fail, error, rate, ms }}
 */
export function summarizeResults(rows) {
  const list = Array.isArray(rows) ? rows : []
  const pass = list.filter((r) => r.status === CASE_STATUS.PASS).length
  const fail = list.filter((r) => r.status === CASE_STATUS.FAIL).length
  const fallback = list.filter((r) => r.status === CASE_STATUS.FALLBACK).length
  const error = list.filter((r) => r.status === CASE_STATUS.ERROR).length
  const skip = list.filter((r) => r.status === CASE_STATUS.SKIP).length
  const total = list.length
  // 跳过的（缺数据前置）不进分母：没跑过的用例不该拉低通过率
  const scored = total - skip
  return {
    total,
    pass,
    fail,
    fallback,
    error,
    skip,
    scored,
    rate: scored > 0 ? Math.round((pass / scored) * 100) : 0,
    ms: list.reduce((s, r) => s + (r.ms || 0), 0)
  }
}

/**
 * 失败明细文本（一键复制给开发者）
 * @param {Array} rows
 * @returns {string}
 */
export function formatFailureReport(rows) {
  const list = Array.isArray(rows) ? rows : []
  const bad = list.filter((r) => r.status !== CASE_STATUS.PASS)
  const sum = summarizeResults(list)
  const lines = [
    '# 思迹 AI 效果自检',
    '',
    `- 通过：${sum.pass}/${sum.scored}（${sum.rate}%）${sum.skip > 0 ? `，跳过 ${sum.skip} 条（缺数据前置）` : ''}`,
    `- 未通过：${sum.fail}，靠前端兜底：${sum.fallback}，请求出错：${sum.error}`,
    ''
  ]
  if (bad.length === 0) {
    lines.push('（全部通过）')
    return lines.join('\n')
  }
  bad.forEach((r) => {
    lines.push(`## ${r.title}（${r.id}）`)
    lines.push(`- 原话：${r.message}`)
    const toolsLine = r.gotTools.length ? r.gotTools.join(' → ') : '（没调工具）'
    const jsonNote = (r.jsonTools && r.jsonTools.length) ? `（其中 ${r.jsonTools.length} 步走 JSON 兜底）` : ''
    lines.push(`- 实际工具：${toolsLine}${jsonNote}`)
    lines.push(`- 未通过原因：${(r.failures || []).join('；')}`)
    if (r.reply) lines.push(`- 回复节选：${String(r.reply).replace(/\s+/g, ' ').slice(0, 120)}`)
    lines.push('')
  })
  return lines.join('\n')
}