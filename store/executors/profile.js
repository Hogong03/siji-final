import { getProfile, saveProfile, clearProfile, setProfileEnabled, smartUpdateProfile, clearCardField } from '@/utils/profile.js'

/**
 * Profile 相关 executor 工厂函数
 * @param {{ undoStack, cidCache, generateEntityId }} ctx 上下文
 */
export function createProfileExecutors(ctx) {
  // ==================== Profile 操作 ====================

  function execUpdateProfile(p) {
    // v2 兼容：将旧的扁平 payload 转为 smart_update_profile 格式
    const current = getProfile()
    // AI 驱动模式下，用户主动告知信息即视为同意开启，自动启用
    if (!current.enabled) {
      current.enabled = true
    }

    const updates = []
    const createCard = []

    // 基本信息字段 → basic 卡片
    const basicFields = ['nickname', 'gender', 'birthday', 'occupation', 'location', 'bio']
    for (const key of basicFields) {
      if (p[key] != null && p[key] !== '') {
        updates.push({ card: 'basic', field: key, value: p[key] })
      }
    }

    // 生活方式字段 → lifestyle 卡片
    const lifestyleFields = ['budget', 'sleepTime']
    for (const key of lifestyleFields) {
      if (p[key] != null && p[key] !== '') {
        updates.push({ card: 'lifestyle', field: key, value: p[key] })
      }
    }
    if (Array.isArray(p.hobbies) && p.hobbies.length > 0) {
      updates.push({ card: 'lifestyle', field: 'hobbies', value: p.hobbies })
    }
    if (Array.isArray(p.dietary) && p.dietary.length > 0) {
      updates.push({ card: 'lifestyle', field: 'dietary', value: p.dietary })
    }

    // custom 字段 → 自动创建卡片
    if (Array.isArray(p.custom) && p.custom.length > 0) {
      const validCustom = p.custom.filter(c => c.label && c.value)
      if (validCustom.length > 0) {
        createCard.push({ id: 'custom_ai', title: '更多信息', icon: 'sparkle' })
        for (const c of validCustom) {
          updates.push({ card: 'custom_ai', field: c.label, value: c.value })
        }
      }
    }

    if (updates.length === 0) {
      return { success: true, message: '没有新信息需要更新', detail: { type: 'profile', skipped: true } }
    }

    return smartUpdateProfile({ updates, createCard })
  }

  /** 智能更新 profile — AI 驱动的结构化操作 */
  function execSmartUpdateProfile(p) {
    return smartUpdateProfile(p)
  }

  function execGetProfile(p) {
    const profile = getProfile()
    const parts = []
    for (const card of profile.cards) {
      const fieldLines = []
      for (const [key, val] of Object.entries(card.fields)) {
        if (val == null || val === '') continue
        if (Array.isArray(val)) {
          if (val.length === 0) continue
          fieldLines.push(`${key}: ${val.join('、')}`)
        } else {
          fieldLines.push(`${key}: ${val}`)
        }
      }
      if (fieldLines.length > 0) {
        parts.push(`[${card.title}] ${fieldLines.join('；')}`)
      }
    }

    const enabled = profile.enabled ? '已开启' : '未开启'
    return {
      success: true,
      message: parts.length > 0 ? `当前个人信息（${enabled}）：\n${parts.join('\n')}` : `个人信息为空（${enabled}）`,
      detail: { type: 'profile', profile, fields: parts }
    }
  }

  function execClearProfile(p) {
    const current = getProfile()
    if (!current.enabled) {
      return { success: false, message: '个人信息功能未开启。', detail: { type: 'profile', notEnabled: true } }
    }
    if (p.card && p.field) {
      // 清空指定卡片的指定字段
      clearCardField(p.card, p.field)
      return { success: true, message: `已清空「${p.field}」`, detail: { type: 'profile', clearedField: p.field } }
    }
    if (p.card) {
      // 清空整张卡片（固定卡片只清空字段，不删除）
      const profile = getProfile()
      const card = profile.cards.find(c => c.id === p.card)
      if (card) {
        for (const key of Object.keys(card.fields)) {
          card.fields[key] = Array.isArray(card.fields[key]) ? [] : ''
        }
        saveProfile(profile)
      }
      return { success: true, message: `已清空「${card?.title || p.card}」`, detail: { type: 'profile', clearedCard: p.card } }
    }
    clearProfile()
    return { success: true, message: '已清空所有个人信息', detail: { type: 'profile', cleared: true } }
  }

  function execToggleProfile(p) {
    const enabled = !!p.enabled
    setProfileEnabled(enabled)
    return {
      success: true,
      message: enabled ? '已开启个人信息功能' : '已关闭个人信息功能',
      detail: { type: 'profile', enabled }
    }
  }

  return { execUpdateProfile, execSmartUpdateProfile, execGetProfile, execClearProfile, execToggleProfile }
}
