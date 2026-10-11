/**
 * tools/glimmer.js - GLIMMER 微光本 tool schemas（3.4 M2；4.24.0 成果引擎升级）
 * 两种入口：还行的小事（moment）与 今日成果（win）——只收集，不追问、不评价、不加工
 */
export const GLIMMER_TOOLS = [
  {
    name: 'create_glimmer',
    description: '收进微光本/成果本（每日一条同日覆盖）：① 用户主动分享今天一件「还行的小事」（散步/晒太阳/按时吃饭/早睡等，语气不低落）→ kind=moment；② 用户报告今日成果（"今天完成了 X / 看懂了 X / 写完了 X / 搞定了 X"，或回答晚间"记一条成果"的问询）→ kind=win。只用于积极内容，不用于烦恼/负面；只收集原话要点，不评价不追问。',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: '内容（沿用用户原话要点，可精简，不要加工成夸奖）' },
        kind: { type: 'string', enum: ['win', 'moment'], description: 'win=今日成果（完成/看懂/写完了什么），moment=还行的小事（默认）。用户在报成果时必须用 win' },
        date: { type: 'string', description: '日期 YYYY-MM-DD，默认今天' }
      },
      required: ['content']
    }
  },
  {
    name: 'query_glimmers',
    description: '查看微光本：用户问「我的微光/收着的小事/看看微光本/我的成果记录」时调用。',
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'integer', description: '近 N 天，默认 30，最大 365' }
      }
    }
  }
]
