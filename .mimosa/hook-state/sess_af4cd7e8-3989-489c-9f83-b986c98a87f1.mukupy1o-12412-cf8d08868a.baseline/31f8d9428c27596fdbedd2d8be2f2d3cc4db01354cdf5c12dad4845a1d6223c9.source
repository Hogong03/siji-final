/**
 * UUID 生成工具
 * 用于生成设备ID、对话ID等客户端唯一标识
 */

/** 生成设备/客户端唯一ID，持久化到 Storage */
export function generateClientId() {
  const ts = Date.now().toString(36)
  const rnd = Math.random().toString(36).substring(2, 10)
  return `${ts}-${rnd}`
}

/** 生成对话ID */
export function generateConversationId() {
  const ts = Date.now().toString(36)
  const rnd = Math.random().toString(36).substring(2, 8)
  return `conv_${ts}_${rnd}`
}

/** 生成实体ID (日记/账单/计划) */
export function generateEntityId(prefix) {
  const ts = Date.now().toString(36)
  const rnd = Math.random().toString(36).substring(2, 8)
  return `${prefix}_${ts}_${rnd}`
}
