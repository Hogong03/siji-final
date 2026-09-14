/**
 * 计划打卡 + 本月打卡日历（3.5.6：从 pages/plan/detail.vue 抽出）
 *
 * detail.vue 早就超了 300 行红线，这一整块（状态 / 动作 / 口径）独立出来：
 * 页面只负责把计划对象喂进来（syncFromPlan）与渲染模板。
 * 不依赖组件实例（不用生命周期、不用 inject），可以直接在 node 环境跑测试。
 *
 * 口径：热度 = utils/plan-heatmap.js countsOf（打卡 + 完成日志）；
 *      连续 = utils/checkin-feedback.js（weekly 看周，其余看天）
 */
import { ref, computed } from 'vue'
import {
  getPlanList, logPlanCheckIn, removePlanCheckIn,
  getPlanCheckInStats, getPlanCheckInRecords
} from '@/utils/storage.js'
import { buildPlanIndex, backfillTargetOf, isBackfillable } from '@/utils/plan-recur.js'
import { monthGrid, monthTotals, shiftMonth, canGoNext, countsOf } from '@/utils/plan-heatmap.js'
import { checkinFeedback, streakOfPlanRecord, streakKindOf } from '@/utils/checkin-feedback.js'
import { invalidatePromptCache } from '@/utils/ai/prompt-builder.js'

function pad(n) { return String(n).padStart(2, '0') }

export function usePlanCheckin({ isNew, planId, selfRecurType, selfRecurCount, isFrozen }) {
  const checkinStats = ref({ days: 0, lastDate: '', todayDone: false, streak: 0, weeklyDone: 0 })
  const checkinRecords = ref([])
  const selfCheckins = ref([])
  const backfillDate = ref('') // 3.5.4：漏了昨天才给补，空表示不给补
  const showCheckinInput = ref(false)
  const checkinNote = ref('')

  // ===== 本月打卡日历（3.5.5） =====
  const calYear = ref(new Date().getFullYear())
  const calMonth = ref(new Date().getMonth())
  const calSelected = ref('')
  const calCounts = computed(() => countsOf(currentPlan()))
  /** 不能翻到未来月份（未来的打卡不存在） */
  const calCanNext = computed(() => canGoNext(calYear.value, calMonth.value))
  const calWeeks = computed(() => monthGrid(calYear.value, calMonth.value, calCounts.value))
  const calTotals = computed(() => monthTotals(calYear.value, calMonth.value, calCounts.value))
  const showCalendar = computed(() => !isNew.value && !isFrozen.value && (!!selfRecurType.value || selfCheckins.value.length > 0))
  const calDayText = computed(() => {
    const date = calSelected.value
    if (!date) return ''
    const times = calCounts.value[date] || 0
    const rec = (selfCheckins.value || []).find(c => c && c.date === date)
    const head = date.slice(5) + ' · ' + (times > 0 ? times + ' 次' : '没有记录')
    return rec && rec.note ? head + ' · ' + rec.note : head
  })
  /** 本月可补记的日子（日历里带小点；盲试长按是上一版最大的体验坑） */
  const calBackfillMap = computed(() => {
    const map = {}
    const plan = currentPlan()
    if (!plan || !selfRecurType.value || isFrozen.value) return map
    const byId = buildPlanIndex(getPlanList())
    const now = Date.now()
    const days = new Date(calYear.value, calMonth.value + 1, 0).getDate()
    for (let day = 1; day <= days; day++) {
      const date = calYear.value + '-' + pad(calMonth.value + 1) + '-' + pad(day)
      if (isBackfillable(plan, byId, date, now)) map[date] = true
    }
    return map
  })

  /** 当前计划记录（每次现取，避免拿到打卡前的旧对象） */
  function currentPlan() {
    if (isNew.value || !planId.value) return null
    const list = getPlanList()
    return list.find(p => p.client_id === planId.value) || null
  }

  /** 计划被刷新后同步打卡区（loadPlan / onShow 调用） */
  function syncFromPlan(plan, plans) {
    if (!plan) return
    checkinStats.value = getPlanCheckInStats(plan)
    checkinRecords.value = getPlanCheckInRecords(plan, 5)
    selfCheckins.value = Array.isArray(plan.checkins) ? plan.checkins : []
    backfillDate.value = backfillTargetOf(plan, buildPlanIndex(plans || getPlanList()), Date.now())
  }

  /** 翻月（detail 的日历可以往前翻，看得到过去的坚持） */
  function shiftCalendar(delta) {
    const s = shiftMonth(calYear.value, calMonth.value, delta)
    if (delta > 0 && !calCanNext.value) return
    calYear.value = s.year
    calMonth.value = s.month
    calSelected.value = ''
  }

  /** 跨月后回到页面：把日历拨回当前月（App 常驻内存跨月场景） */
  function refreshCalendarMonth(nowTs = Date.now()) {
    const d = new Date(nowTs)
    if (d.getFullYear() === calYear.value && d.getMonth() === calMonth.value) return
    calYear.value = d.getFullYear()
    calMonth.value = d.getMonth()
    calSelected.value = ''
  }

  /** 打卡写入后的统一回写（同时失效 AI 提示缓存，别让 AI 看见旧打卡） */
  function reloadCheckins(rec) {
    checkinStats.value = getPlanCheckInStats(rec)
    checkinRecords.value = getPlanCheckInRecords(rec, 5)
    selfCheckins.value = Array.isArray(rec.checkins) ? rec.checkins : []
    backfillDate.value = backfillTargetOf(rec, buildPlanIndex(getPlanList()), Date.now())
    invalidatePromptCache()
  }

  /** 该计划当前连续天数 / 达标周数（打卡前取 before 用） */
  function planStreak(clientId) {
    const plan = getPlanList().find(p => p.client_id === clientId)
    return streakOfPlanRecord(plan)
  }

  /** 打卡后按循环类型给回执（跨过里程碑才说一句） */
  function feedbackAfter(rec, beforeStreak, fallback) {
    checkinFeedback(streakOfPlanRecord(rec), beforeStreak, fallback, streakKindOf(rec))
  }

  /** 打卡摘要文案（累计 / 连续 / 本周进度 / 最近） */
  function checkinSummaryText() {
    const parts = []
    if (checkinStats.value.days > 0) parts.push('累计 ' + checkinStats.value.days + ' 天')
    if (selfRecurType.value === 'weekly') {
      const weeks = streakOfPlanRecord(currentPlan())
      if (weeks >= 2) parts.push('连续 ' + weeks + ' 周达标')
      parts.push('本周 ' + (checkinStats.value.weeklyDone || 0) + '/' + selfRecurCount.value)
    } else if (checkinStats.value.streak >= 2) {
      parts.push('连续 ' + checkinStats.value.streak + ' 天')
    }
    if (checkinStats.value.days > 0 && checkinStats.value.lastDate) {
      parts.push('最近 ' + checkinStats.value.lastDate.slice(5))
    }
    return parts.length > 0 ? parts.join(' · ') : '允许空着，做了再记'
  }

  function toggleCheckinInput() {
    if (isNew.value || !planId.value || isFrozen.value) return
    showCheckinInput.value = !showCheckinInput.value
    if (showCheckinInput.value) {
      const todayRec = checkinRecords.value.find(r => r.isToday)
      checkinNote.value = todayRec ? todayRec.note : ''
    }
  }

  /** 今天做了（带可选描述） */
  function submitCheckIn() {
    if (isNew.value || !planId.value) return
    const before = planStreak(planId.value)
    const rec = logPlanCheckIn(planId.value, checkinNote.value)
    if (!rec) {
      uni.showToast({ title: '当前状态暂不能打卡', icon: 'none' })
      return
    }
    reloadCheckins(rec)
    showCheckinInput.value = false
    feedbackAfter(rec, before, checkinNote.value ? '已记录' : '已打卡')
  }

  /** 补记昨天（漏了才出现，点一次即落库） */
  function submitBackfill() {
    const date = backfillDate.value
    if (!date || isNew.value || !planId.value) return
    const before = planStreak(planId.value)
    const rec = logPlanCheckIn(planId.value, '', date)
    if (!rec) {
      uni.showToast({ title: '当前状态暂不能打卡', icon: 'none' })
      return
    }
    reloadCheckins(rec)
    feedbackAfter(rec, before, '已补记 ' + date.slice(5))
  }

  /** 撤销某天打卡（3.5.6：补记必须可撤，否则误触就是永久脏数据） */
  function removeCheckin(date) {
    if (!date || isNew.value || !planId.value) return
    uni.showModal({
      title: '撤销 ' + date.slice(5) + ' 的打卡？',
      content: '这天会变回没打卡，累计与连续一起回退。',
      confirmText: '撤销',
      cancelText: '保留',
      success: (res) => {
        if (!res.confirm) return
        const rec = removePlanCheckIn(planId.value, date)
        if (!rec) {
          uni.showToast({ title: '这天本来就没打卡', icon: 'none' })
          return
        }
        reloadCheckins(rec)
        uni.showToast({ title: '已撤销 ' + date.slice(5), icon: 'none' })
      }
    })
  }

  function toggleCalDay(date) {
    if (!date) return
    calSelected.value = calSelected.value === date ? '' : date
  }

  /** 日历长按补记某天（窗口内、未打卡的历史日才给补） */
  function onCalBackfill(date) {
    if (!date || isNew.value || !planId.value) return
    const plan = currentPlan()
    if (!plan || !selfRecurType.value || !isBackfillable(plan, buildPlanIndex(getPlanList()), date)) {
      uni.showToast({ title: '这天补不了（窗口外或已打卡）', icon: 'none' })
      return
    }
    uni.showModal({
      title: '补记 ' + date.slice(5),
      content: '这天没打卡，补记一次？',
      confirmText: '补记',
      cancelText: '算了',
      success: (res) => {
        if (!res.confirm) return
        const before = planStreak(planId.value)
        const rec = logPlanCheckIn(planId.value, '', date)
        if (!rec) {
          uni.showToast({ title: '当前状态暂不能打卡', icon: 'none' })
          return
        }
        reloadCheckins(rec)
        calSelected.value = date
        feedbackAfter(rec, before, '已补记 ' + date.slice(5))
      }
    })
  }

  return {
    checkinStats, checkinRecords, selfCheckins,
    backfillDate, showCheckinInput, checkinNote,
    calYear, calMonth, calSelected, calCounts, calWeeks, calTotals, calCanNext, shiftCalendar, calDayText, calBackfillMap, showCalendar,
    syncFromPlan, refreshCalendarMonth, reloadCheckins, planStreak, feedbackAfter,
    checkinSummaryText, toggleCheckinInput, submitCheckIn, submitBackfill, removeCheckin,
    toggleCalDay, onCalBackfill
  }
}
