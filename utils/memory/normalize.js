/**
 * memory/normalize.js — 记忆文本归一化（3.5.14 从 utils/memory.js 拆出）
 *
 * 纯函数、无依赖：去重（addMemory）与治理（findDuplicateGroups）共用一套口径。
 */

/** 归一化记忆文本：去空白/标点、全半角统一、小写、去「我今天/我想/我打算」等前缀 */
export function normalizeMemoryText(content) {
  if (content == null) return ''
  let s = String(content).trim()
  if (!s) return ''
  // 全半角统一（含全角字母数字与标点）
  s = s.replace(/[\uFF01-\uFF5E]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
  s = s.toLowerCase()
  // 去空白与 ASCII 标点
  s = s.replace(/[\s!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]+/g, '')
  // 去中文标点（。、，「」『』…— 等）
  s = s.replace(/[\u3000-\u303F\u2018\u2019\u201C\u201D\u2026\u2014\u2013\u00B7]/g, '')
  // 去「我今天想/我今天/我想/我打算/打算/准备/我要/我会」前缀
  s = s.replace(/^(?:我今天想|我今天|今天我想|我想|我打算|打算|我准备|准备|我要|我会|我)/, '')
  return s.trim()
}
