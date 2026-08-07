/**
 * 流式文本增量解析器
 *
 * 从 useChatEngine.js 拆出 — 避免 streamRetry.js → useChatEngine.js 循环依赖
 *
 * AI 返回的是 JSON 格式 {"reply":"...","action":{...}}
 * 流式传输过程中，chunk 是逐字到达的，直接显示会让用户看到 {"reply":"你好" 这种原始 JSON
 * 本函数从部分 JSON 中增量提取 reply 内容，只显示自然语言部分
 *
 * v2: 改为工厂函数 createStreamParser()，每次流式请求创建独立实例，
 *     避免模块级单例状态在并发/重试场景下错乱。
 *     保留模块级 _streamState 仅供向后兼容（resetStreamParser 仍可调用）。
 */

// 模块级状态（向后兼容，不建议直接使用）
const _streamState = {
  raw: '',
  replyText: '',
  phase: 'searching', // searching | extracting | done
  pos: 0
}

/**
 * 创建独立的流式解析器实例（推荐用法）
 * @returns {{ extract: Function, reset: Function }}
 */
export function createStreamParser() {
  const state = { raw: '', replyText: '', phase: 'searching', pos: 0 }

  function extract(raw) {
    if (!raw) return ''

    const trimmed = raw.trim()
    const jsonStart = trimmed.indexOf('{')
    if (jsonStart === -1) return raw

    let cleaned = trimmed
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    }

    const jsonIdx = cleaned.indexOf('{')
    if (jsonIdx > 0) {
      cleaned = cleaned.slice(jsonIdx)
    }

    // 完整 JSON — 直接解析
    try {
      const parsed = JSON.parse(cleaned)
      state.raw = ''
      return parsed.reply || parsed.message || parsed.content || raw
    } catch { /* 不完整 */ }

    // 增量：相同 raw → 返回缓存
    if (raw === state.raw) return state.replyText

    // 增量：raw 是之前的扩展
    if (raw.startsWith(state.raw) && state.raw.length > 0) {
      state.raw = raw

      if (state.phase === 'searching') {
        const replyIdx = raw.indexOf('"reply"')
        const msgIdx = raw.indexOf('"message"')
        const fieldIdx = replyIdx !== -1 ? replyIdx : msgIdx
        if (fieldIdx === -1) {
          return cleaned.startsWith('{') ? '' : raw
        }
        const afterField = raw.slice(fieldIdx)
        const colonMatch = afterField.match(/"(?:reply|message)"\s*:\s*"/)
        if (!colonMatch) return ''

        state.phase = 'extracting'
        state.pos = fieldIdx + colonMatch[0].length
        state.replyText = ''
      }

      if (state.phase === 'extracting') {
        let i = state.pos
        const len = raw.length
        while (i < len) {
          const ch = raw[i]
          if (ch === '\\' && i + 1 < len) {
            const next = raw[i + 1]
            if (next === 'n') state.replyText += '\n'
            else if (next === '"') state.replyText += '"'
            else if (next === '\\') state.replyText += '\\'
            else if (next === 't') state.replyText += '\t'
            else if (next === 'r') state.replyText += '\r'
            else if (next === 'u' && i + 5 < len) {
              state.replyText += String.fromCharCode(parseInt(raw.slice(i + 2, i + 6), 16))
              i += 4
            } else {
              state.replyText += next
            }
            i += 2
          } else if (ch === '"') {
            state.phase = 'done'
            break
          } else {
            state.replyText += ch
            i++
          }
        }
        state.pos = i
        return state.replyText
      }

      return state.replyText
    }

    // raw 完全变化 — 重置并 fallback 正则
    state.raw = raw
    state.replyText = ''
    state.phase = 'searching'
    state.pos = 0

    const replyMatch = cleaned.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)/)
    if (replyMatch) {
      let text = replyMatch[1]
        .replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
        .replace(/\\t/g, '\t').replace(/\\r/g, '\r')
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      state.replyText = text
      state.phase = 'extracting'
      return text
    }

    const msgMatch = cleaned.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)/)
    if (msgMatch) {
      let text = msgMatch[1]
        .replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
        .replace(/\\t/g, '\t').replace(/\\r/g, '\r')
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      return text
    }

    if (cleaned.startsWith('{')) return ''
    return raw
  }

  function reset() {
    state.raw = ''
    state.replyText = ''
    state.phase = 'searching'
    state.pos = 0
  }

  return { extract, reset }
}

/**
 * 从累积的流式文本中提取 reply 字段（向后兼容 — 使用模块级状态）
 * @deprecated 推荐使用 createStreamParser() 创建独立实例
 * @param {string} raw - 累积的原始流式文本
 * @returns {string} 提取出的自然语言文本
 */
export function extractReplyFromStream(raw) {
  return _extractWithState(_streamState, raw)
}

/** 内部：用指定 state 执行提取逻辑 */
function _extractWithState(state, raw) {
  if (!raw) return ''

  const trimmed = raw.trim()
  const jsonStart = trimmed.indexOf('{')
  if (jsonStart === -1) return raw

  let cleaned = trimmed
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  }

  const jsonIdx = cleaned.indexOf('{')
  if (jsonIdx > 0) {
    cleaned = cleaned.slice(jsonIdx)
  }

  try {
    const parsed = JSON.parse(cleaned)
    state.raw = ''
    return parsed.reply || parsed.message || parsed.content || raw
  } catch { /* 不完整 */ }

  if (raw === state.raw) return state.replyText

  if (raw.startsWith(state.raw) && state.raw.length > 0) {
    state.raw = raw

    if (state.phase === 'searching') {
      const replyIdx = raw.indexOf('"reply"')
      const msgIdx = raw.indexOf('"message"')
      const fieldIdx = replyIdx !== -1 ? replyIdx : msgIdx
      if (fieldIdx === -1) {
        return cleaned.startsWith('{') ? '' : raw
      }
      const afterField = raw.slice(fieldIdx)
      const colonMatch = afterField.match(/"(?:reply|message)"\s*:\s*"/)
      if (!colonMatch) return ''

      state.phase = 'extracting'
      state.pos = fieldIdx + colonMatch[0].length
      state.replyText = ''
    }

    if (state.phase === 'extracting') {
      let i = state.pos
      const len = raw.length
      while (i < len) {
        const ch = raw[i]
        if (ch === '\\' && i + 1 < len) {
          const next = raw[i + 1]
          if (next === 'n') state.replyText += '\n'
          else if (next === '"') state.replyText += '"'
          else if (next === '\\') state.replyText += '\\'
          else if (next === 't') state.replyText += '\t'
          else if (next === 'r') state.replyText += '\r'
          else if (next === 'u' && i + 5 < len) {
            state.replyText += String.fromCharCode(parseInt(raw.slice(i + 2, i + 6), 16))
            i += 4
          } else {
            state.replyText += next
          }
          i += 2
        } else if (ch === '"') {
          state.phase = 'done'
          break
        } else {
          state.replyText += ch
          i++
        }
      }
      state.pos = i
      return state.replyText
    }

    return state.replyText
  }

  state.raw = raw
  state.replyText = ''
  state.phase = 'searching'
  state.pos = 0

  const replyMatch = cleaned.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)/)
  if (replyMatch) {
    let text = replyMatch[1]
      .replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
      .replace(/\\t/g, '\t').replace(/\\r/g, '\r')
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    state.replyText = text
    state.phase = 'extracting'
    return text
  }

  const msgMatch = cleaned.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)/)
  if (msgMatch) {
    let text = msgMatch[1]
      .replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
      .replace(/\\t/g, '\t').replace(/\\r/g, '\r')
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    return text
  }

  if (cleaned.startsWith('{')) return ''
  return raw
}

/** 重置模块级解析器状态 — 每次流式请求开始前调用（向后兼容） */
export function resetStreamParser() {
  _streamState.raw = ''
  _streamState.replyText = ''
  _streamState.phase = 'searching'
  _streamState.pos = 0
}
