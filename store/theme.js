/**
 * 主题 Store — 固定浅色模式（主题切换已废除）
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useThemeStore = defineStore('theme', () => {
  const themeMode = ref('light')     // 固定浅色
  const resolvedTheme = ref('light') // 固定浅色

  // 空函数 — 保留接口避免其他文件调用报错
  function setTheme(mode) {}

  function onThemeChanged(theme) {}

  function restoreFromStorage() {}

  return {
    // state
    themeMode, resolvedTheme,
    // actions
    setTheme, onThemeChanged, restoreFromStorage,
  }
})
