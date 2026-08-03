/**
 * 流式文本增量解析器
 *
 * 从 useChatEngine.js 拆出 — 避免 streamRetry.js → useChatEngine.js 循环依赖
 *
 * AI 返回的是 JSON 格式 {"reply":"...","action":{...}}
 * 流式传输过程中，chunk 是逐字到达的，直接显示会让用户看到 {"reply":"你好" 这种原始 JSON
 * 本函数从部分 JSON 中增量提取 reply 内容，只显示自然语言部分
 */

// 模块级状态
const _streamState = {
  raw: '',
  replyText: '',
  phase: 'searching', // searching | extracting | done
  pos: 0
}

/**
 * 从累积的流式文本中提取 reply 字段
 * @param {string} raw - 累积的原始流式文本
 * @returns {string} 提取出的自然语言文本
 */
export function extractReplyFromStream(raw) {
  if (!raw) return ''
  
  const trimmed = raw.trim()
  
  // 即使不以 { 开头，也尝试查找其中的 JSON 对象
  // AI 有时在 JSON 前面输出一段思考文本
  const jsonStart = trimmed.indexOf('{')
  if (jsonStart === -1) return raw  // 完全没有 JSON 结构
  
  let cleaned = trimmed
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  }
  
  // 如果 JSON 前面有文本前缀，截取 JSON 部分
  const jsonIdx = cleaned.indexOf('{')
  if (jsonIdx > 0) {
    cleaned = cleaned.slice(jsonIdx)
  }
  
  // 完整 JSON — 直接解析
  try {
    const parsed = JSON.parse(cleaned)
    _streamState.raw = ''
    return parsed.reply || parsed.message || parsed.content || raw
  } catch { /* 不完整 */ }
  
  // 增量：相同 raw → 返回缓存
  if (raw === _streamState.raw) return _streamState.replyText
  
  // 增量：raw 是之前的扩展
  if (raw.startsWith(_streamState.raw) && _streamState.raw.length > 0) {
    _streamState.raw = raw
    
    if (_streamState.phase === 'searching') {
      const replyIdx = raw.indexOf('"reply"')
      const msgIdx = raw.indexOf('"message"')
      const fieldIdx = replyIdx !== -1 ? replyIdx : msgIdx
      if (fieldIdx === -1) {
        return cleaned.startsWith('{') ? '' : raw
      }
      const afterField = raw.slice(fieldIdx)
      const colonMatch = afterField.match(/"(?:reply|message)"\s*:\s*"/)
      if (!colonMatch) return ''
      
      _streamState.phase = 'extracting'
      _streamState.pos = fieldIdx + colonMatch[0].length
      _streamState.replyText = ''
    }
    
    if (_streamState.phase === 'extracting') {
      let i = _streamState.pos
      const len = raw.length
      while (i < len) {
        const ch = raw[i]
        if (ch === '\\' && i + 1 < len) {
          const next = raw[i + 1]
          if (next === 'n') _streamState.replyText += '\n'
          else if (next === '"') _streamState.replyText += '"'
          else if (next === '\\') _streamState.replyText += '\\'
          else if (next === 't') _streamState.replyText += '\t'
          else if (next === 'r') _streamState.replyText += '\r'
          else if (next === 'u' && i + 5 < len) {
            _streamState.replyText += String.fromCharCode(parseInt(raw.slice(i + 2, i + 6), 16))
            i += 4
          } else {
            _streamState.replyText += next
          }
          i += 2
        } else if (ch === '"') {
          _streamState.phase = 'done'
          break
        } else {
          _streamState.replyText += ch
          i++
        }
      }
      _streamState.pos = i
      return _streamState.replyText
    }
    
    return _streamState.replyText
  }
  
  // raw 完全变化 — 重置并 fallback 正则
  _streamState.raw = raw
  _streamState.replyText = ''
  _streamState.phase = 'searching'
  _streamState.pos = 0
  
  const replyMatch = cleaned.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)/)
  if (replyMatch) {
    let text = replyMatch[1]
      .replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
      .replace(/\\t/g, '\t').replace(/\\r/g, '\r')
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    _streamState.replyText = text
    _streamState.phase = 'extracting'
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

/** 重置增量解析器状态 — 每次流式请求开始前调用 */
export function resetStreamParser() {
  _streamState.raw = ''
  _streamState.replyText = ''
  _streamState.phase = 'searching'
  _streamState.pos = 0
}
