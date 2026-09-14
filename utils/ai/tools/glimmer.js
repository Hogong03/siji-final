/**
 * tools/glimmer.js - GLIMMER 微光本 tool schemas（3.4 M2）
 * 只在用户主动分享「还行的小事」时调用；只收集，不追问、不评价、不加工
 */
export const GLIMMER_TOOLS = [
  {
    name: 'create_glimmer',
    description: '收微光：用户主动分享今天发生的一件「还行的小事」（散步/晒太阳/按时吃饭/早睡/完成一件小事等，语气不低落）时调用，把原话要点收进微光本。每天只留一条，同日覆盖；只用于积极的小事，不用于烦恼/负面内容；回复一句轻轻的确认即可，不评价不追问。',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: '微光内容（沿用用户原话要点，可精简，不要加工成夸奖）' },
        date: { type: 'string', description: '日期 YYYY-MM-DD，默认今天' }
      },
      required: ['content']
    }
  },
  {
    name: 'query_glimmers',
    description: '查看微光本：用户问「我的微光/收着的小事/看看微光本」时调用。',
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'integer', description: '近 N 天，默认 30，最大 365' }
      }
    }
  }
]
