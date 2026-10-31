/**
 * advice-session.js — 一次建议面板的展示与动作追踪（M3 埋点补丁）
 *
 * 只回答一个问题：这次展示过的方向里，哪些用户点了、哪些没点。
 * 关闭面板时，没点过的才算 ignored；点过「不相关」的算 rejected，不能再算 ignored。
 *
 * 纯函数、不读写存储：页面拿 ignoredIds 去落库，测试可直接断言。
 */

/** 新建一次会话 */
export function newSession() {
  return { shown: [], acted: {} }
}

/** 记录本次展示的方向 id（去重，保持展示顺序） */
export function markShown(session, directions) {
  if (!session) return session
  const list = Array.isArray(directions) ? directions : []
  for (const d of list) {
    if (!d || !d.id) continue
    if (!session.shown.includes(d.id)) session.shown.push(d.id)
  }
  return session
}

/** 记录动作：accepted | rejected */
export function markActed(session, id, kind) {
  if (session && id && (kind === 'accepted' || kind === 'rejected')) session.acted[id] = kind
  return session
}

/** 展示过但没有任何动作的 id（关闭面板时记 ignored） */
export function ignoredIds(session) {
  if (!session) return []
  return session.shown.filter((id) => !session.acted[id])
}

/** 读取某个 id 的动作（测试与调试用） */
export function actedKind(session, id) {
  return (session && session.acted && session.acted[id]) || ''
}
