/**
 * 聊天页跳转路由 composable
 *
 * 从 chat/index.vue 拆出 — 处理 ExecResultCard 确认操作的路由跳转
 */

const ROUTE_MAP = {
  create_diary: (detail) => `/pages/diary/detail?clientId=${detail.id || 'new'}&month=${_getMonth(detail.created_at)}`,
  create_bill: (detail) => `/pages/bill/edit?id=${detail.id || ''}&month=${_getMonth(detail.bill_date)}`,
  create_plan: (detail) => `/pages/plan/detail?clientId=${detail.id || 'new'}`,
  update_bill: (detail) => `/pages/bill/edit?id=${detail.id || ''}&month=${_getMonth(detail.bill_date)}`,
  update_diary: (detail) => `/pages/diary/detail?clientId=${detail.id || 'new'}&month=${_getMonth(detail.created_at)}`,
  update_plan: (detail) => `/pages/plan/detail?clientId=${detail.id || 'new'}`,
  query_diary: () => '/pages/diary/list',
  query_bill: () => '/pages/bill/index',
  query_plan: () => '/pages/plan/index',
  query_stat: () => '/pages/bill/index'
}

export function useChatNavigation() {
  function handleConfirmActionCard(card) {
    if (!card) return
    const detail = card.payload || {}
    // multi 类型：取第一个 detail 的类型决定路由
    if (card.type === 'multi' && Array.isArray(detail) && detail.length > 0) {
      const firstDetail = detail[0]
      const firstType = Object.keys(ROUTE_MAP).find(k =>
        firstDetail?.type && (k === `create_${firstDetail.type}` || k === `update_${firstDetail.type}`)
      )
      if (firstType) {
        uni.navigateTo({ url: ROUTE_MAP[firstType](firstDetail) })
      }
      return
    }
    const builder = ROUTE_MAP[card.type]
    if (builder) {
      const url = builder(detail)
      uni.navigateTo({ url })
    }
  }

  return { handleConfirmActionCard }
}

function _getMonth(dateStr) {
  if (!dateStr) {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
