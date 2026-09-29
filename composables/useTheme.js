/**
 * useTheme — 响应式深色模式检测
 *
 * 用途：<switch> / <slider> 等原生组件的颜色是 HTML 属性（color / activeColor /
 * backgroundColor / block-color），CSS 媒体查询无法覆盖，需用本 composable 拿到
 * isDark 后在模板里动态绑定颜色。
 *
 * 三端策略：
 * - H5（含 DOM 的环境）：window.matchMedia 读取 + change 监听
 * - App / 小程序：uni.getSystemInfoSync().theme 读取 + uni.onThemeChange 监听
 *
 * 历史教训：早期在引导页无条件调用 uni.onThemeChange，在不支持的平台直接抛错导致
 * 白屏崩溃。本实现所有调用都做能力探测 + try/catch，任何平台不支持时静默退化为
 * 「setup 时一次性读取」，绝不抛错。
 */
import { ref, onUnmounted, getCurrentInstance } from 'vue'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function readDark() {
	// H5 / 含 DOM 的环境
	try {
		if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
			return window.matchMedia(DARK_QUERY).matches === true
		}
	} catch (e) { /* 忽略，退到 uni 分支 */ }
	// App / 小程序
	try {
		if (typeof uni !== 'undefined' && typeof uni.getSystemInfoSync === 'function') {
			return uni.getSystemInfoSync().theme === 'dark'
		}
	} catch (e) { /* 忽略，按浅色处理 */ }
	return false
}

export function useTheme() {
	const isDark = ref(readDark())

	let mql = null
	let mqlHandler = null
	let uniHandler = null

	// 变更监听：能力探测 + try/catch，失败静默，保留 setup 时读到的初值
	try {
		if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
			mql = window.matchMedia(DARK_QUERY)
			mqlHandler = (e) => { isDark.value = !!(e && e.matches) }
			if (typeof mql.addEventListener === 'function') {
				mql.addEventListener('change', mqlHandler)
			} else if (typeof mql.addListener === 'function') {
				mql.addListener(mqlHandler)
			}
		} else if (typeof uni !== 'undefined' && typeof uni.onThemeChange === 'function') {
			uniHandler = (res) => { isDark.value = !!(res && res.theme === 'dark') }
			uni.onThemeChange(uniHandler)
		}
	} catch (e) { /* 忽略监听失败 */ }

	if (getCurrentInstance()) {
		onUnmounted(() => {
			try {
				if (mql && mqlHandler) {
					if (typeof mql.removeEventListener === 'function') {
						mql.removeEventListener('change', mqlHandler)
					} else if (typeof mql.removeListener === 'function') {
						mql.removeListener(mqlHandler)
					}
				}
				if (uniHandler && typeof uni !== 'undefined' && typeof uni.offThemeChange === 'function') {
					uni.offThemeChange(uniHandler)
				}
			} catch (e) { /* 忽略清理失败 */ }
		})
	}

	return { isDark }
}
