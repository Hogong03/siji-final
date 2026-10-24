/**
 * vibrate.js — 应用内提醒震动（4.48.2）
 *
 * 背景：notifier 里原来写的是 `uni.vibrate({ type: 'medium' })` —— uni-app 没有这个 API
 * （官方只有 uni.vibrateShort / uni.vibrateLong），每次提醒都在控制台留一条
 * 「vibrate failed: uni.vibrate is not a function」，震动也从来没响过。
 *
 * 三级降级：
 *   1. uni.vibrateShort（App / 微信小程序都支持；type 支持 heavy/medium/light）
 *   2. plus.device.vibrate（uni 接口缺失时的 HTML5+ 原生能力，单位 ms）
 *   3. 都不行 → 静默返回 false（没有震动权限 / 机型不支持不该影响提示与推送）
 *
 * 纯函数 + 可注入依赖，便于单测；调用方只关心「有没有发出震动」。
 */

/**
 * @param {{ uni?: Object, plus?: Object }} [env] 注入测试用环境，缺省读全局
 * @returns {boolean} 是否成功发起一次震动
 */
export function vibrateForReminder(env) {
  const u = env && env.uni !== undefined ? env.uni : (typeof uni !== 'undefined' ? uni : null)
  const p = env && env.plus !== undefined ? env.plus : (typeof plus !== 'undefined' ? plus : null)
  try {
    if (u && typeof u.vibrateShort === 'function') {
      u.vibrateShort({ type: 'medium', fail: () => {} })
      return true
    }
  } catch (e) {
    // 落到 plus 兜底
  }
  try {
    if (p && p.device && typeof p.device.vibrate === 'function') {
      p.device.vibrate(120)
      return true
    }
  } catch (e) {
    return false
  }
  return false
}
