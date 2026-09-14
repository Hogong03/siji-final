/**
 * useEnterSummary — 冷启动「进入总结」（3.4.5，方案 B：仅冷启动触发）
 *
 * App.vue 的 appReady 里调用一次 initEnterSummary()：
 *   - 首次升级静默武装：没有基线时间时写入当前时间，不弹历史数据
 *   - 之后每次冷启动：统计基线以来的计划完成/打卡 + 新增记录
 *   - 有内容才挂起 pending；点「查看详情/知道了」后推进基线，同批事件不再重复弹
 * 前台恢复（后台切回）不在此计算，只展示仍挂起的卡片。
 */
import { ref } from 'vue'
import { getPlanList } from '@/utils/storage.js'
import { getDiaryList } from '@/utils/storage/diary.js'
import { buildEnterSummary } from '@/utils/enter-summary.js'

/** 基线存储 key：上次确认总结的时间（ms） */
const STORAGE_KEY = 'siji_enter_summary_at'

const pending = ref(null)

function loadBaseline() {
  try {
    const v = uni.getStorageSync(STORAGE_KEY)
    return Number(v) || 0
  } catch (e) {
    return 0
  }
}

/** 应用冷启动时调用一次（App.vue appReady） */
export function initEnterSummary() {
  try {
    const baseline = loadBaseline()
    const now = Date.now()
    if (!baseline) {
      // 首次升级：静默武装基线，避免把存量老数据一次性全部弹出来
      uni.setStorageSync(STORAGE_KEY, now)
      pending.value = null
      return
    }
    const summary = buildEnterSummary({
      plans: getPlanList(),
      since: baseline,
      now,
      diaryReader: getDiaryList
    })
    if (summary.eventsTotal > 0 || summary.diaryCount > 0) {
      pending.value = summary
    } else {
      // 没有可总结内容：推进基线，避免下次重复扫描空窗口
      pending.value = null
      uni.setStorageSync(STORAGE_KEY, now)
    }
  } catch (e) {
    pending.value = null
  }
}

/** 用户点击「查看详情 / 知道了」后调用：清卡并推进基线 */
export function dismissEnterSummary() {
  pending.value = null
  try {
    uni.setStorageSync(STORAGE_KEY, Date.now())
  } catch (e) {
    /* 存储失败不影响本次会话 */
  }
}

/** 页面接入：返回模块级单例状态 */
export function useEnterSummary() {
  return { pending, dismiss: dismissEnterSummary }
}
