/**
 * useTheme — 响应式深色模式检测（薄壳）
 *
 * 4.8.0 起唯一事实源是 utils/theme.js（三态：system/light/dark，手动切换由设置页触发）。
 * 本 composable 只做转出，保持 { isDark } 导出签名 —— 15 处消费方（图表配色、
 * 原生 switch/slider 动态绑定、4.7.1 的标签圆点/头像等 JS 注入色）零改动。
 *
 * 历史教训（保留）：早期在引导页无条件调用 uni.onThemeChange，在不支持的平台直接
 * 抛错导致白屏崩溃。所有平台调用必须能力探测 + try/catch —— 该原则已由 theme.js
 * 全量贯彻，本壳不再直接碰平台 API。
 */
import { isDark as themeIsDark } from '@/utils/theme.js'

export function useTheme() {
  return { isDark: themeIsDark }
}
