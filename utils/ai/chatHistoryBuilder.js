/**
 * chatHistoryBuilder - 聊天历史构建工具
 *
 * 从 useChatEngine.js 抽取，负责将 store.messages 转换为 AI 请求所需的 chatHistory 格式
 * 包含执行结果摘要的拼接逻辑
 */

/**
 * 构建聊天历史(含执行结果摘要)
 * @param {Array} messages - store.messages
 * @returns {Array|null} chatHistory - AI 请求格式的历史消息数组
 */
export function buildChatHistory(messages) {
  let chatHistory = messages
    .filter(m => {
      if (m.role === 'user') return m.content && m.content.trim()
      if (m.role === 'assistant') return !m.loading && (m.aiReply || m.content)
      return false
    })
    .slice(-15)
    .map(m => {
      let content = m.aiReply || m.content

      // 单执行结果摘要
      if (m.role === 'assistant' && m.execResult) {
        content = appendExecResultSummary(content, m.execResult)
      }

      // 多执行结果摘要
      if (m.role === 'assistant' && m.execResults && m.execResults.length > 0) {
        const summaries = m.execResults.map(r => {
          const d = r.detail || r
          if (d.type === 'bill') return `记账${d.billType === 'expense' ? '-' : '+'}¥${d.amount}(ID=${d.id})`
          if (d.type === 'diary') return `记录《${d.title}》(ID=${d.id})`
          if (d.type === 'plan') return `计划《${d.title}》(ID=${d.id})`
          return r.message || ''
        }).filter(Boolean)
        if (summaries.length > 0) content += `\n[执行结果: ${summaries.join(';')}]`
      }

      return { role: m.role, content }
    })

  if (chatHistory.length === 0) chatHistory = null
  return chatHistory
}

/**
 * 拼接单条执行结果摘要到 content
 */
function appendExecResultSummary(content, er) {
  if (er.success && er.detail) {
    const d = er.detail
    if (d.type === 'bill') {
      content += `\n[执行结果: 已记账 ${d.billType === 'expense' ? '-' : '+'}¥${d.amount} ${d.category} ${d.bill_date} ID=${d.id}]`
    } else if (d.type === 'diary') {
      content += `\n[执行结果: 已保存记录《${d.title}》心情:${d.mood} ID=${d.id}]`
    } else if (d.type === 'plan') {
      content += `\n[执行结果: ${er.message} ID=${d.id}]`
    } else if (d.type === 'query_bill' || d.type === 'query_diary' || d.type === 'query_plan' || d.type === 'query_stat') {
      if (d.items && d.items.length > 0) {
        const itemIds = d.items.slice(0, 10).map(item => {
          if (d.type === 'query_bill') return `${item.category}¥${item.amount}(ID=${item.client_id})`
          if (d.type === 'query_diary') return `《${item.title}》(ID=${item.client_id})`
          if (d.type === 'query_plan') return `《${item.title}》(ID=${item.client_id})`
          return ''
        }).filter(Boolean)
        content += `\n[执行结果: ${er.message} 包含: ${itemIds.join(', ')}]`
      } else {
        content += `\n[执行结果: ${er.message}]`
      }
    } else if (d.deleted) {
      content += `\n[执行结果: ${er.message}]`
    } else if (d.updatedFields && d.updatedFields.length > 0) {
      content += `\n[执行结果: ${er.message} ID=${d.id}]`
    }
  } else if (er.success && er.message && er.message !== '无需执行') {
    content += `\n[执行结果: ${er.message}]`
  }
  return content
}
