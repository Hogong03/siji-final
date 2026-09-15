/**
 * 聊天页跳转路由 composable
 *
 * 从 chat/index.vue 拆出 — 处理 ExecResultCard 确认操作的路由跳转
 */

const ROUTE_MAP = {
  create_diary: (detail) => `/pages/diary/detail?clientId=${detail.id || 'new'}&month=${_getMonth(detail.created_at)}`,
  update_diary: (detail) => `/pages/diary/detail?clientId=${detail.id || 'new'}&month=${_getMonth(detail.created_at)}`,
  query_diary: () => '/pages/diary/list',
  summarize_diaries: () => '/pages/diary/list',
  query_combined: () => '/pages/diary/list',
  create_bill: (detail) => `/pages/bill/edit?id=${detail.id || ''}&month=${_getMonth(detail.bill_date)}`,
  update_bill: (detail) => `/pages/bill/edit?id=${detail.id || ''}&month=${_getMonth(detail.bill_date)}`,
  query_bill: () => '/pages/bill/index',
  query_stat: () => '/pages/bill/index',
  create_plan: (detail) => `/pages/plan/detail?clientId=${detail.id || 'new'}`,
  create_plan_phases: (detail) => `/pages/plan/detail?clientId=${detail.id || 'new'}`,
  update_plan: (detail) => `/pages/plan/detail?clientId=${detail.id || 'new'}`,
  open_plan_child: (detail) => `/pages/plan/detail?clientId=${detail.id || detail.client_id || ''}`,
  query_plan: () => '/pages/plan/index',
  smart_update_profile: () => '/pages/settings/sub/profile',
  update_profile: () => '/pages/settings/sub/profile',
  get_profile: () => '/pages/settings/sub/profile',
  create_relation: () => '/pages/settings/sub/relations',
  update_relation: (detail) => `/pages/settings/sub/relation-detail?id=${detail.id || ''}`,
  query_relation: () => '/pages/settings/sub/relations',
  log_interaction: (detail) => `/pages/settings/sub/relation-detail?id=${detail.relation_id || ''}`,
  query_interaction: (detail) => `/pages/settings/sub/relation-detail?id=${detail.relation_id || ''}`,
  create_decision: () => '/pages/settings/sub/decisions',
  update_decision: (detail) => `/pages/settings/sub/decision-detail?id=${detail.id || ''}`,
  query_decision: () => '/pages/settings/sub/decisions',
  create_agent: () => '/pages/settings/sub/agent'
}

/**
 * 这个动作类型有没有可去的页面 —— 执行卡片的「查看 →」据此决定显不显示，
 * 别给一个点了没反应的死按钮（联网搜索 / 读网页就没有对应页面）
 * @param {string} type
 * @returns {boolean}
 */
export function canOpenType(type) {
  return !!type && Object.prototype.hasOwnProperty.call(ROUTE_MAP, type)
}

export function useChatNavigation() {
  function handleConfirmActionCard(card) {
    if (!card) return
    const detail = card.payload || {}
    // multi 类型：取第一个 detail 的类型决定路由（覆盖 create_/update_/log_/query_ 等动作）
    if (card.type === 'multi' && Array.isArray(detail) && detail.length > 0) {
      const firstDetail = detail[0]
      const firstType = firstDetail?.type
      const candidates = firstType
        ? [`create_${firstType}`, `update_${firstType}`, `log_${firstType}`, `query_${firstType}`, `smart_update_${firstType}`]
        : []
      const builder = candidates.map(k => ROUTE_MAP[k]).find(Boolean)
      if (builder) {
        uni.navigateTo({ url: builder(firstDetail) })
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
