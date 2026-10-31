/**
 * energy-state.js — 最近一次能量判定的进程内缓存（M3）
 *
 * 为什么要这个：能量是「按消息」算的（energyScan(message, history)），
 * 而建议面板是「进应用时」开的 —— 那时还没有新消息。
 * 把最近一次的判定存下来，面板就能用同一份口径决定「低能量少说两句」。
 *
 * 只存内存、不落盘：重启后回到 medium，宁可多说一句也不误判低落。
 */

const LEVELS = ['very_low', 'low', 'medium', 'high']
let _level = 'medium'

export function setLastEnergy(level) {
  if (LEVELS.includes(level)) _level = level
}

export function getLastEnergy() {
  return _level
}

export function resetEnergyState() {
  _level = 'medium'
}
