/**
 * fallback.js - 前端兜底 action 提取
 *
 * 从 useChatEngine.js 拆出
 * 当 AI 声称已操作但未返回有效 action 时，从用户消息中正则提取操作意图
 *
 * 检测顺序：关系图谱 → 画像 → 记账 → 记录（优先级从高到低）
 * 关系图谱优先于画像：避免"女朋友"中的"女"误匹配 profileKeywords
 */

import { OP_CLAIM_RE_FALLBACK, RELATION_KEYWORDS_RE, RELATION_TYPES } from './constants.js'

/** 前端兜底提取 */
export function extractFallbackAction(userMessage, aiReply) {
  const reply = aiReply || ''

  // === 关系图谱 ===
  if (RELATION_KEYWORDS_RE.test(userMessage) && OP_CLAIM_RE_FALLBACK.test(reply)) {
    let nameMatch = userMessage.match(/(?:叫|名字是|名叫|叫做)\s*([\u4e00-\u9fa5]{2,4})/)
    if (!nameMatch) {
      // 先去掉动词前缀（记住/记一下/帮我记/记录一下），再做后续匹配
      const stripped = userMessage.replace(/^(?:记住|记一下|帮我记|记录一下?)\s*/, '')
      if (stripped !== userMessage) {
        // 去掉前缀后用"是"分割提取人名
        nameMatch = stripped.match(/([\u4e00-\u9fa5]{2,4})(?:是我的|是(?:我的)?)/)
        if (!nameMatch) {
          // 无"是"时直接取前 2-4 个中文字符
          nameMatch = stripped.match(/^([\u4e00-\u9fa5]{2,4})/)
        }
      } else {
        // 无前缀："汪澄是我女朋友" / "张三是我同事"
        nameMatch = userMessage.match(/([\u4e00-\u9fa5]{2,4})(?:是我的|是(?:我的)?)/)
      }
    }
    const name = nameMatch ? nameMatch[1] : ''
    let relationType = '朋友'
    for (const [re, label] of RELATION_TYPES) {
      if (re.test(userMessage)) { relationType = label; break }
    }
    if (name) {
      // 提取逗号后的补充信息（如“叫阿伟，产品经理”）作为关系备注
      const tailMatch = userMessage.match(/[，,]\s*([\u4e00-\u9fa5A-Za-z0-9]{2,12})/)
      const context = tailMatch ? tailMatch[1] : ''
      return {
        type: 'create_relation',
        payload: { name, role: relationType, context, tags: [], notes: '', interactions: [] },
        needConfirm: false
      }
    }
  }

  // === 画像更新 — 仅在用户明确告知个人信息时触发 ===
  const profileExplicit = /(?:记一下|帮我记|更新|我的)(?:名字|叫|姓名|性别|生日|出生|职业|工作|在哪|住在|城市|爱好|喜欢|喜欢吃|不吃|过敏|预算|作息|睡觉|MBTI|血型|星座)/
  const profileRecordCmd = /(?:帮我|给我|麻烦你?|麻烦)?(?:记录|记)一下/
  if (profileExplicit.test(userMessage) && (OP_CLAIM_RE_FALLBACK.test(reply) || profileRecordCmd.test(userMessage))) {
    const updates = []
    let m = userMessage.match(/我(?:叫|名字(?:是|叫)?|姓名(?:是)?)\s*([\u4e00-\u9fa5a-zA-Z]{2,10})/)
    if (m) updates.push({ card: 'basic', field: 'nickname', value: m[1] })
    if (/我是?(?:个|名)?(?:女生|女孩|女的|女)/.test(userMessage) || userMessage.includes('我是女')) {
      updates.push({ card: 'basic', field: 'gender', value: '女' })
    } else if (/我是?(?:个|名)?(?:男生|男孩|男的|男)/.test(userMessage) || userMessage.includes('我是男')) {
      updates.push({ card: 'basic', field: 'gender', value: '男' })
    }
    m = userMessage.match(/生日(?:是)?(\d{4})年?(\d{1,2})月?(\d{1,2})日?/)
    if (m) updates.push({ card: 'basic', field: 'birthday', value: `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}` })
    m = userMessage.match(/我(?:是|做|干)(?:一名|一个)?([\u4e00-\u9fa5]{2,8})(?:的|工作|职业)/)
    if (m) updates.push({ card: 'basic', field: 'occupation', value: m[1] })
    m = userMessage.match(/我(?:是|在)(?:一名|一个)?(?:程序员|设计师|老师|医生|学生|工程师|产品经理|运营|销售|会计|律师|护士|厨师|司机|摄影师|作家|画家|音乐家)/)
    if (m) {
      const occ = userMessage.match(/(?:程序员|设计师|老师|医生|学生|工程师|产品经理|运营|销售|会计|律师|护士|厨师|司机|摄影师|作家|画家|音乐家)/)[0]
      updates.push({ card: 'basic', field: 'occupation', value: occ })
    }
    m = userMessage.match(/我(?:在|住在|位于|来自)([\u4e00-\u9fa5]{2,6})(?:市|省|区|县)?/)
    if (m) updates.push({ card: 'basic', field: 'location', value: m[1] })
    m = userMessage.match(/(?:我(?:的)?爱好|我(?:喜欢|爱))[是为式]?\s*[·、,，]?\s*([\u4e00-\u9fa5a-zA-Z0-9]{1,10})/)
    if (m) {
      let hobby = m[1].replace(/(?:麻烦)?(?:帮我|帮)?(?:记录|记|写)一下.*$/, '').trim()
      // 重复粘贴容错：爱好后再次出现"我的爱好/爱好是" → 只取第一段
      const repeatIdx = hobby.search(/(?:我的)?爱好[是为式]/)
      if (repeatIdx > 0) hobby = hobby.slice(0, repeatIdx).trim()
      if (hobby) updates.push({ card: 'lifestyle', field: 'hobbies', value: hobby })
    }
    m = userMessage.match(/我(?:喜欢吃|爱吃|喜欢吃|不|不吃)([\u4e00-\u9fa5]{1,8})/)
    if (m) {
      const isNeg = /不吃|不爱/.test(userMessage)
      if (!isNeg) updates.push({ card: 'lifestyle', field: 'dietary', value: m[1] })
    }
    m = userMessage.match(/(?:MBTI|mbti)(?:是)?\s*([A-Z]{4})/)
    if (m) updates.push({ card: 'custom_ai', cardTitle: '更多信息', field: 'MBTI', value: m[1] })
    m = userMessage.match(/我是\s*([A-Z]{4})/)
    if (m && ['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'].includes(m[1])) {
      updates.push({ card: 'custom_ai', cardTitle: '更多信息', field: 'MBTI', value: m[1] })
    }
    m = userMessage.match(/(?:星座是|我是)(白羊座|金牛座|双子座|巨蟹座|狮子座|处女座|天秤座|天蝎座|射手座|摩羯座|水瓶座|双鱼座)/)
    if (m) updates.push({ card: 'custom_ai', cardTitle: '更多信息', field: '星座', value: m[1] })
    m = userMessage.match(/血型(?:是)?(A|B|AB|O)型?/)
    if (m) updates.push({ card: 'custom_ai', cardTitle: '更多信息', field: '血型', value: m[1] + '型' })
    m = userMessage.match(/(?:预算|月预算|每月预算)(?:是|大概|大约)?(\d{2,6})/)
    if (m) updates.push({ card: 'lifestyle', field: 'budget', value: Number(m[1]) })
    m = userMessage.match(/(?:睡觉|休息|作息)(?:时间)?(?:是|大概|大约)?(\d{1,2})[点::](\d{0,2})/)
    if (m) updates.push({ card: 'lifestyle', field: 'sleepTime', value: m[2] ? `${m[1]}:${m[2]}` : `${m[1]}:00` })
    if (updates.length > 0) {
      return { type: 'smart_update_profile', payload: { updates, suggestions: [] }, needConfirm: false }
    }
  }

  // === 记账 ===
  const billKeywords = /花了|消费|买了|付了|收入|收到|转了|开销/
  if (billKeywords.test(userMessage) && /记/.test(reply)) {
    let m = userMessage.match(/(\d+(?:\.\d+)?)\s*[元块]/) || userMessage.match(/(\d+(?:\.\d+)?)$/)
    if (m) {
      const isIncome = /收入|收到|转了/.test(userMessage)
      return { type: 'create_bill', payload: { type: isIncome ? 'income' : 'expense', amount: parseFloat(m[1]), category: '其他', note: '' }, needConfirm: false }
    }
  }

  // === 记录 ===
  const recordCommand = /(?:帮我|给我|麻烦你?|麻烦)?(?:记录|写|记)(?:一篇|一个|一下|下)?(?:日记|记录|笔记|随记|想法)/
  if (/记录|日记|心情|今天|笔记/.test(userMessage) && (OP_CLAIM_RE_FALLBACK.test(reply) || recordCommand.test(userMessage))) {
    // 剔除指令前缀取真实内容；纯指令（无实质内容）不建记录，防止空正文垃圾
    const cleaned = userMessage
      .replace(/^(?:帮我|给我|麻烦你?|麻烦)?(?:记录|写|记)(?:一篇|一个|一下|下)?(?:日记|记录|笔记|随记|想法)?/, '')
      .replace(/^[,，。、;；:：\s]+/, '')
      .trim()
    if (!cleaned) return null
    const title = cleaned.length <= 20 ? cleaned : cleaned.substring(0, 20) + '…'
    return {
      type: 'create_diary',
      payload: { title, content: userMessage, tags: [] },
      needConfirm: false
    }
  }

  return null
}
