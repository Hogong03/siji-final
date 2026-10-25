/**
 * haptic.js — 统一触感反馈（4.47 灵动性）
 *
 * 只在「改变状态」的动作调用：新建、保存、打卡、tab 切换、删除、移卡、解锁按键等；
 * 普通浏览滑动不调用。三端安全降级：H5 / 不支持的环境静默失败，无成本。
 *
 * 用法：
 *   import { haptic, hapticSuccess, hapticWarning, hapticLight } from '@/utils/haptic.js'
 *   hapticLight()        // 点按 / tab 切换
 *   hapticSuccess()      // 保存 / 打卡成功
 *   hapticWarning()      // 删除 / 错误
 */

/**
 * 统一触感入口
 * @param {'light'|'medium'|'success'|'warning'|'select'} type
 */
export function haptic(type = 'light') {
	try {
		if (typeof uni === 'undefined' || typeof uni.vibrateShort !== 'function') return
		// 微信 / App：light / medium；success / select 归 light，warning 归 medium
		const w = (type === 'medium' || type === 'warning') ? 'medium' : 'light'
		// 旧基础库或部分安卓不支持 type 参数，失败再退化为无参调用
		uni.vibrateShort({
			type: w,
			fail: () => {
				try { uni.vibrateShort({ fail: () => {} }) } catch (e) { /* 忽略 */ }
			}
		})
	} catch (e) { /* 触感失败不影响任何流程 */ }
}

export const hapticLight = () => haptic('light')
export const hapticSelect = () => haptic('select')
export const hapticMedium = () => haptic('medium')
export const hapticSuccess = () => haptic('success')
export const hapticWarning = () => haptic('warning')

export default haptic
