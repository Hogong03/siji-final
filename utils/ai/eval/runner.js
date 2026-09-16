/**
 * runner.js — AI 效果自检的判定与编排（3.7.0）
 *
 * 只做两件事：判断「这一轮的期望达成了没有」，以及按顺序跑完语料。
 * 不碰 store、不发请求 —— 模型调用由调用方以 runner 函数注入
 * （页面里是真请求，测试里是 cfg._mockResponder），这样判定逻辑可以被单测钉死。
 *
 * 干跑模式在 utils/ai/agent-loop.js 的 cfg.dryRun：只记录「要调什么工具」，不落任何数据。
 */

/** 用例结果状态 */
export const CASE_STATUS = {
  PASS: 'pass',
  FAIL: 'fail',
  ERROR: 'error',
  SKIP: 'skip'
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
export async function runCase(runner, caze) {
  const startedAt = Date.now()
  try {
    const res = (await runner(caze.message, caze)) || {}
    const judged = judgeCase(caze, res)
    return {
      id: caze.id,
      title: caze.title,
      message: caze.message,
      status: judged.pass ? CASE_STATUS.PASS : CASE_STATUS.FAIL,
      failures: judged.failures,
      gotTools: judged.gotTools,
      reply: res.reply || '',
      ms: Date.now() - startedAt
    }
  } catch (e) {
    return {
      id: caze.id,
      title: caze.title,
      message: caze.message,
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
  const rows = []
  for (let i = 0; i < list.length; i++) {
    if (stopRef && stopRef.stopped) break
    const row = await runCase(runner, list[i])
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
  const error = list.filter((r) => r.status === CASE_STATUS.ERROR).length
  const total = list.length
  return {
    total,
    pass,
    fail,
    error,
    rate: total > 0 ? Math.round((pass / total) * 100) : 0,
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
    `- 通过：${sum.pass}/${sum.total}（${sum.rate}%）`,
    `- 未通过：${sum.fail}，请求出错：${sum.error}`,
    ''
  ]
  if (bad.length === 0) {
    lines.push('（全部通过）')
    return lines.join('\n')
  }
  bad.forEach((r) => {
    lines.push(`## ${r.title}（${r.id}）`)
    lines.push(`- 原话：${r.message}`)
    lines.push(`- 实际工具：${r.gotTools.length ? r.gotTools.join(' → ') : '（没调工具）'}`)
    lines.push(`- 未通过原因：${(r.failures || []).join('；')}`)
    if (r.reply) lines.push(`- 回复节选：${String(r.reply).replace(/\s+/g, ' ').slice(0, 120)}`)
    lines.push('')
  })
  return lines.join('\n')
}