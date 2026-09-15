/**
 * call-utils.js — 工具调用外围工具（3.5.11 从 agent-loop.js 拆出）
 *
 * 负责：tool_result 截断上限表、工具参数解析、参数解析失败的结果构造。
 * agent-loop.js 只做循环控制，不关心这些细节。
 */
import { TOOL_LABELS } from './index.js'

/** 按工具类型动态截断 tool_result（防 token 爆炸但保留关键数据） */
const TOOL_RESULT_TRUNCATE_MAP = {
  query_stat: 800,       // 统计数据精简
  query_bill: 1500,      // 账单列表
  query_diary: 2000,     // 记录内容较长
  query_plan: 1500,      // 计划列表
  query_combined: 2500,  // 跨类型查询需要更多空间
  query_relation: 1200,  // 人物关系 JSON
  query_decision: 1500,  // 决策日志
  query_conversations: 1500, // 会话检索摘录（3.2 M3）
  get_profile: 1000,     // 用户画像
  summarize_diaries: 2000, // 总结报告
  read_url: 8000,        // 读网址：正文本身就长，上限即抓取上限（3.6.0）
  default: 2000
}
export function getTruncateLimit(toolName) {
  return TOOL_RESULT_TRUNCATE_MAP[toolName] || TOOL_RESULT_TRUNCATE_MAP.default
}

/**
 * 解析工具参数 — 失败不静默吞掉（3.5.11）
 * 空字符串视为无参工具（get_profile 等合法）；非法 JSON / 非对象 → 回传错误让模型重发。
 * @returns {{ok:boolean, args?:Object, reason?:string}}
 */
export function parseToolArgs(raw) {
  const text = String(raw == null ? '' : raw).trim()
  if (!text) return { ok: true, args: {} }
  try {
    const val = JSON.parse(text)
    if (!val || typeof val !== 'object' || Array.isArray(val)) return { ok: false, reason: '不是 JSON 对象' }
    return { ok: true, args: val }
  } catch {
    return { ok: false, reason: '不是合法 JSON' }
  }
}

/** 参数解析失败时的工具结果 — 让模型看到失败原因并重试 */
export function argErrorResult(name, reason) {
  const label = TOOL_LABELS[name] || name
  return {
    ok: false,
    text: `${label} 的调用参数${reason || '不可用'}，本次未执行。请按该工具的 schema 重新调用并给出完整 JSON 参数。`,
    detail: null
  }
}
