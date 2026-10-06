/**
 * profile-autocapture.js — 自报姓名的确定性兜底捕捉（TC-004，纯函数可单测）
 *
 * 背景：用户说「我叫测试员」，模型当轮只口头答应、没调 smart_update_profile，
 * 画像里没有 → 几轮后问「我叫什么」答不上。纯提示词不可靠，这里给确定性兜底：
 * 从用户消息里提取高置信度自报姓名，供 useChatEngine 在 AI 回复落定后静默补落库。
 *
 * 原则：宁可漏捉不可错存 —— 只认三种句式，命中疑问/助词一律拒绝。
 * 不 import 任何东西，不碰 store / uni。
 */

/**
 * 自报姓名句式：我的名字(叫|是)X / 我叫X / 叫我X
 * X 限定为中文/字母/数字/间隔号（少数民族姓名），2~8 位；标点、空格、句尾自然截断。
 * 注：「测试员」是 TC-004 回归语料，必须可捕捉，故「测试」前缀排除带 (?!员) 例外。
 */
const SELF_NAME_RE = /(?:我的名字(?:叫|是)|我叫|叫我)\s*([\u4e00-\u9fa5A-Za-z0-9·]{2,8})/

/** 明显非名字：以占位符开头（abc/xxx/某某/测试，测试员除外），不区分大小写 */
const NAME_JUNK_PREFIX_RE = /^(?:abc|xxx|某某|测试(?!员))/i

/** 疑问词/语气助词：真实姓名不含这些字符 */
const NAME_PARTICLE_RE = /怎么|什么|[了吗呢啊]/

/**
 * 从用户消息提取自报姓名
 * @param {string} text 用户消息原文
 * @returns {string} 命中返回姓名，未命中返回 ''
 */
export function extractSelfName(text) {
  if (typeof text !== 'string' || !text) return ''
  const m = text.match(SELF_NAME_RE)
  if (!m) return ''
  const name = m[1]
  if (NAME_JUNK_PREFIX_RE.test(name)) return ''
  if (NAME_PARTICLE_RE.test(name)) return ''
  return name
}

/**
 * 是否应该兜底捕捉：命中自报姓名，且整句不带疑问语气（？/?）
 * 自报句里带问号（如「我叫测试员？」）视为疑问，不捕捉。
 * @param {string} text 用户消息原文
 * @returns {boolean}
 */
export function shouldAutoCapture(text) {
  if (typeof text !== 'string' || !text) return false
  if (/[?？]/.test(text)) return false
  return extractSelfName(text) !== ''
}
