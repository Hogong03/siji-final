/**
 * tools/chat.js - conversation search tool schema (3.2 M3)
 */
export const CONVERSATION_TOOLS = [
  {
    name: 'query_conversations',
    description: '检索历史会话。用户问「上次/之前/以前说过、提过什么」「是不是说过 XX」「有没有提过 XX」时调用，返回原文摘录与会话标题、时间；可带标签缩小范围。',
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '要检索的关键词或原话片段' },
        tag: { type: 'string', description: '可选：只检索带该标签的会话' }
      },
      required: ['keyword']
    }
  }
]
