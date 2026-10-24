/**
 * 聊天欢迎消息生成
 *
 * 根据当前时间与本月账单生成个性化欢迎语。
 *
 * 4.48.0 引导式表达：
 *   - 收尾从「我都能帮忙」改成一句引导（今天想从哪儿开始 + 三个具体入口），
 *     第一句就把选择权递回用户，而不是让他自己想说什么；
 *   - 删掉「还有 N 个未完成计划」「本月只写了 N 篇记录」这类盘点缺口的提示
 *     （PRODUCT_VISION 铁律 8：未完成信息只有用户主动问才出现）。
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

    let msg = `${greeting}，我是思迹。`
    if (tips.length > 0) {
      msg += `\n\n${tips.join('、')}。`
    }
    msg += '\n\n今天想从哪儿开始？说一句就行：记一笔、写两句，或者把卡住的一件事拆成第一步。'
    return msg
  }

  return { getWelcomeMessage }
}
