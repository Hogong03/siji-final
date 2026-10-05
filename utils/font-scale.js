/**
 * font-scale.js — 全局字号档位（4.13.0）
 *
 * 需求：阅读型内容（对话气泡 / 简报卡 / 记录阅读页正文）支持字号切换。
 * uni-app 的 rpx 是编译期单位，无法全局缩放 —— 所以走「响应式比例 + 内联字号」：
 * 关键阅读面用 fontRpx(基准值) 产出内联 font-size，设置页切换后全 App 即时生效。
 *
 * 设计约束（延续 4.12.x 的跨端教训）：
 *   - 比例状态是模块级响应式单例（与 theme.js 的 isDark 同款），组件直接消费
 *   - 只缩放「阅读正文」一类内容字号；图标、按钮、导航等 UI 字号保持稳定，
 *     避免 UI 骨架随字号抖动（这正是 DESIGN_SYSTEM.md「UI 退让」的延伸）
 *
 * 存储：siji_font_scale（'small' | 'normal' | 'large' | 'xlarge'，缺省 normal）
 */
import { ref } from 'vue'

const KEY = 'siji_font_scale'

/** 档位表（设置页渲染 + 比例换算共用） */
export const FONT_SCALES = [
  { id: 'small', label: '小', ratio: 0.9 },
  { id: 'normal', label: '标准', ratio: 1 },
  { id: 'large', label: '大', ratio: 1.15 },
  { id: 'xlarge', label: '特大', ratio: 1.3 }
]

/** 当前比例（响应式单例：组件的 computed 直接依赖它实现即时生效） */
export const fontScale = ref(1)

function readStoredId() {
  try {
    const v = uni.getStorageSync(KEY)
    if (FONT_SCALES.some(s => s.id === v)) return v
  } catch (e) { /* 读不到按标准 */ }
  return 'normal'
}

function ratioOf(id) {
  const hit = FONT_SCALES.find(s => s.id === id)
  return hit ? hit.ratio : 1
}

/** 初始化（App.vue onLaunch 调一次；重复调用安全） */
export function initFontScale() {
  fontScale.value = ratioOf(readStoredId())
}

/** 当前档位 id（设置页高亮用） */
export function getFontScaleId() {
  return readStoredId()
}

/** 切换档位（设置页调），立即生效并落盘 */
export function setFontScaleId(id) {
  if (!FONT_SCALES.some(s => s.id === id)) return
  try { uni.setStorageSync(KEY, id) } catch (e) { /* 落盘失败本次会话仍生效 */ }
  fontScale.value = ratioOf(id)
}

/**
 * 按当前比例产出内联字号（关键阅读面用）
 * @param {number} baseRpx 标准档的基准字号（rpx）
 * @returns {string} 如 '32rpx'（标准档 28 → 32）
 */
export function fontRpx(baseRpx) {
  return Math.round(Number(baseRpx) * fontScale.value) + 'rpx'
}
