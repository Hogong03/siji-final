/**
 * 聊天欢迎消息生成
 *
 * 根据当前时间、本月账单/计划/记录数据生成个性化欢迎语
 */
export function useWelcomeMessage() {
  function getWelcomeMessage() {
    const now = new Date()
    const hour = now.getHours()
    let greeting = '你好'
    if (hour < 6) greeting = '夜深了'
    else if (hour < 11) greeting = '早上好'
    else if (hour < 14) greeting = '中午好'
    else if (hour < 18) greeting = '下午好'
    else if (hour < 22) greeting = '晚上好'
    else greeting = '夜深了'

    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    let tips = []

    try {
      const bills = JSON.parse(uni.getStorageSync(`bill_${month}`) || '[]').filter(b => b.is_deleted !== 1)
      const expense = bills.filter(b => b.type === 'expense').reduce((s, b) => s + b.amount, 0)
      if (expense > 0) tips.push(`本月已消费 ¥${expense.toFixed(2)}`)
    } catch (e) {}

    try {
      const plans = JSON.parse(uni.getStorageSync('plan_all') || '[]').filter(p => p.is_deleted !== 1 && p.status !== 2)
      if (plans.length > 0) tips.push(`还有 ${plans.length} 个未完成计划`)
    } catch (e) {}

    try {
      const diaries = JSON.parse(uni.getStorageSync(`diary_${month}`) || '[]').filter(d => d.is_deleted !== 1)
      if (diaries.length > 0 && diaries.length < 3) tips.push(`本月写了 ${diaries.length} 篇记录`)
    } catch (e) {}

    let msg = `${greeting}，我是思迹。`
    if (tips.length > 0) {
      msg += `\n\n${tips.join('、')}。`
    }
    msg += '\n\n有什么想聊的，直接说就好。记账、写记录、做计划，我都能帮忙。'
    return msg
  }

  return { getWelcomeMessage }
}
