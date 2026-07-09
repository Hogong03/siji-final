<script setup>
/**
 * 计划统计页
 *
 * 功能：
 *  ① 总览四宫格（总数/进行中/已完成/完成率）
 *  ② 优先级分布（饼图替代 — 环形进度）
 *  ③ 状态分布
 *  ④ 近30天创建趋势
 *  ⑤ 完成速度分析（平均完成天数）
 *  ⑥ 子任务完成率
 *  ⑦ 分类排行（按描述关键词聚类）
 */

import { ref, computed, onMounted } from 'vue'
import { getPlanList } from '@/utils/storage.js'
import SijiChart from '@/components/common/SijiChart.vue'

const plans = ref([])

onMounted(() => { loadPlans() })

function loadPlans() {
  plans.value = getPlanList()
}

// 总览
const overview = computed(() => {
  const all = plans.value
  const total = all.length
  const active = all.filter(p => p.status === 1).length
  const completed = all.filter(p => p.status === 2).length
  const pending = all.filter(p => p.status === 0).length
  const rate = total > 0 ? Math.round(completed / total * 100) : 0
  return { total, active, completed, pending, rate }
})

// 优先级分布
const priorityDist = computed(() => {
  const all = plans.value
  const high = all.filter(p => p.priority === 2).length
  const mid = all.filter(p => p.priority === 1).length
  const low = all.filter(p => p.priority === 0).length
  const total = high + mid + low
  return [
    { label: '紧急', count: high, color: '#D35D5D', pct: total > 0 ? Math.round(high / total * 100) : 0 },
    { label: '重要', count: mid, color: '#E8A838', pct: total > 0 ? Math.round(mid / total * 100) : 0 },
    { label: '普通', count: low, color: '#999', pct: total > 0 ? Math.round(low / total * 100) : 0 }
  ]
})

// 状态分布
const statusDist = computed(() => {
  const all = plans.value
  const active = all.filter(p => p.status === 1).length
  const completed = all.filter(p => p.status === 2).length
  const pending = all.filter(p => p.status === 0).length
  const total = active + completed + pending
  return [
    { label: '进行中', count: active, color: '#000000', pct: total > 0 ? Math.round(active / total * 100) : 0 },
    { label: '已完成', count: completed, color: '#10B981', pct: total > 0 ? Math.round(completed / total * 100) : 0 },
    { label: '待开始', count: pending, color: '#999', pct: total > 0 ? Math.round(pending / total * 100) : 0 }
  ]
})

// 近30天创建趋势
const trendData = computed(() => {
  const now = new Date()
  const days = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    const startTs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    const endTs = startTs + 86400000
    const created = plans.value.filter(p => p.created_at >= startTs && p.created_at < endTs).length
    const done = plans.value.filter(p => {
      if (p.status !== 2) return false
      const updated = p.updated_at || 0
      return updated >= startTs && updated < endTs
    }).length
    const label = `${d.getMonth() + 1}/${d.getDate()}`
    days.push({ label, created, done, dateStr: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })
  }
  return days
})

// 趋势最大值已移除（Canvas 图表自动计算）

// 完成速度
const completionStats = computed(() => {
  const done = plans.value.filter(p => p.status === 2 && p.created_at && p.updated_at)
  if (done.length === 0) return { avg: 0, fastest: 0, slowest: 0, count: 0 }
  const days = done.map(p => Math.ceil((p.updated_at - p.created_at) / 86400000))
  const avg = Math.round(days.reduce((s, d) => s + d, 0) / days.length)
  const fastest = Math.min(...days)
  const slowest = Math.max(...days)
  return { avg, fastest, slowest, count: done.length }
})

// 子任务统计
const subtaskStats = computed(() => {
  let total = 0, done = 0
  plans.value.forEach(p => {
    if (Array.isArray(p.subtasks)) {
      total += p.subtasks.length
      done += p.subtasks.filter(s => s.done).length
    }
  })
  return { total, done, rate: total > 0 ? Math.round(done / total * 100) : 0 }
})

// 优先级完成率
const priorityCompletion = computed(() => {
  return priorityDist.value.map(p => {
    const items = plans.value.filter(pl => {
      const plP = pl.priority || 0
      const targetP = p.label === '紧急' ? 2 : p.label === '重要' ? 1 : 0
      return plP === targetP
    })
    const done = items.filter(pl => pl.status === 2).length
    return { ...p, total: items.length, done, completionRate: items.length > 0 ? Math.round(done / items.length * 100) : 0 }
  })
})
</script>

<template>
  <view class="stats-page">
    <scroll-view class="stats-scroll" scroll-y>
      <!-- ① 总览 -->
      <view class="card gradient-card">
        <text class="card-title white">计划总览</text>
        <view class="overview-grid">
          <view class="og-item">
            <text class="og-num">{{ overview.total }}</text>
            <text class="og-label">总计划</text>
          </view>
          <view class="og-item">
            <text class="og-num">{{ overview.active }}</text>
            <text class="og-label">进行中</text>
          </view>
          <view class="og-item">
            <text class="og-num">{{ overview.completed }}</text>
            <text class="og-label">已完成</text>
          </view>
          <view class="og-item">
            <text class="og-num">{{ overview.rate }}%</text>
            <text class="og-label">完成率</text>
          </view>
        </view>
      </view>

      <!-- ② 优先级分布 -->
      <view class="card">
        <text class="card-title">优先级分布</text>
        <view class="chart-with-legend">
          <view class="ring-side">
            <SijiChart
              type="ring"
              :data="priorityDist.map(p => ({ value: p.count, color: p.color }))"
              label="优先级"
              :height="200"
            />
          </view>
          <view class="legend-side">
            <view v-for="p in priorityDist" :key="p.label" class="mini-legend">
              <view class="mini-dot" :style="{ background: p.color }" />
              <text class="mini-label">{{ p.label }}</text>
              <text class="mini-val">{{ p.count }} ({{ p.pct }}%)</text>
            </view>
          </view>
        </view>
      </view>

      <!-- ③ 状态分布 -->
      <view class="card">
        <text class="card-title">状态分布</text>
        <view class="chart-with-legend">
          <view class="ring-side">
            <SijiChart
              type="ring"
              :data="statusDist.map(s => ({ value: s.count, color: s.color }))"
              label="状态"
              :height="200"
            />
          </view>
          <view class="legend-side">
            <view v-for="s in statusDist" :key="s.label" class="mini-legend">
              <view class="mini-dot" :style="{ background: s.color }" />
              <text class="mini-label">{{ s.label }}</text>
              <text class="mini-val">{{ s.count }} ({{ s.pct }}%)</text>
            </view>
          </view>
        </view>
      </view>

      <!-- ④ 30天趋势 -->
      <view class="card">
        <text class="card-title">近30天趋势</text>
        <SijiChart
          type="bar"
          :data="trendData.map(d => ({ label: d.label, values: [d.created, d.done] }))"
          :group-mode="true"
          :colors="['#000000', '#10B981']"
          :height="160"
        />
        <view class="trend-legend">
          <view class="legend-item"><view class="legend-dot created" /><text class="legend-text">新建</text></view>
          <view class="legend-item"><view class="legend-dot done" /><text class="legend-text">完成</text></view>
        </view>
      </view>

      <!-- ⑤ 完成速度 -->
      <view class="card">
        <text class="card-title">完成速度分析</text>
        <view v-if="completionStats.count > 0" class="speed-grid">
          <view class="sp-item">
            <text class="sp-num">{{ completionStats.avg }}</text>
            <text class="sp-label">平均(天)</text>
          </view>
          <view class="sp-item">
            <text class="sp-num">{{ completionStats.fastest }}</text>
            <text class="sp-label">最快(天)</text>
          </view>
          <view class="sp-item">
            <text class="sp-num">{{ completionStats.slowest }}</text>
            <text class="sp-label">最慢(天)</text>
          </view>
          <view class="sp-item">
            <text class="sp-num">{{ completionStats.count }}</text>
            <text class="sp-label">已完成数</text>
          </view>
        </view>
        <view v-else class="empty-block">
          <text class="empty-text">暂无已完成的计划</text>
        </view>
      </view>

      <!-- ⑥ 子任务完成率 -->
      <view class="card">
        <text class="card-title">子任务完成率</text>
        <view class="gauge-row">
          <SijiChart
            type="gauge"
            :value="subtaskStats.rate"
            label="子任务"
            :colors="['#000000']"
            :height="200"
          />
          <view class="gauge-info">
            <text class="ri-text">已完成 {{ subtaskStats.done }} / {{ subtaskStats.total }} 个子任务</text>
          </view>
        </view>
      </view>

      <!-- ⑦ 优先级完成率 -->
      <view class="card">
        <text class="card-title">各优先级完成率</text>
        <view class="pc-list">
          <view v-for="p in priorityCompletion" :key="p.label" class="pc-row">
            <view class="pc-left">
              <view class="pc-dot" :style="{ background: p.color }" />
              <text class="pc-label">{{ p.label }}</text>
            </view>
            <view class="pc-bar-wrap">
              <view class="pc-bar" :style="{ width: p.completionRate + '%', background: p.color }" />
            </view>
            <text class="pc-text">{{ p.done }}/{{ p.total }} ({{ p.completionRate }}%)</text>
          </view>
        </view>
      </view>

      <view style="height: 60rpx" />
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.stats-page {
  height: 100vh;
  background: $bg-page;
}

.stats-scroll {
  height: 100vh;
  padding: $spacing-md;
}

.card {
  background: $bg-card;
  border-radius: $radius-lg;
  padding: $spacing-md;
  margin-bottom: $spacing-md;
  box-shadow: $shadow-sm;
}

.card-title {
  font-size: $font-md;
  font-weight: 700;
  color: $text-primary;
  margin-bottom: $spacing-md;
  display: block;

  &.white { color: var(--text-on-ai); }
}

.gradient-card {
  background: var(--color-ai);
  color: var(--text-on-ai);
  box-shadow: 0 4rpx 20rpx rgba(16, 185, 129, 0.2);
}

/* 总览 */
.overview-grid {
  display: flex;
  justify-content: space-between;
}

.og-item { text-align: center; flex: 1; }

.og-num {
  font-size: 48rpx;
  font-weight: 800;
  display: block;
  color: var(--text-on-ai);
}

.og-label {
  font-size: $font-xs;
  opacity: 0.8;
  color: var(--text-on-ai);
}

/* 图表+图例并排 */
.chart-with-legend {
  display: flex;
  gap: $spacing-md;
  align-items: center;
}

.ring-side {
  flex-shrink: 0;
  width: 200rpx;
}

.legend-side {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.mini-legend {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.mini-dot { width: 14rpx; height: 14rpx; border-radius: 50%; }
.mini-label { font-size: $font-sm; color: $text-primary; min-width: 60rpx; }
.mini-val { font-size: $font-xs; color: $text-secondary; }

/* 仪表盘行 */
.gauge-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-sm;
}

.gauge-info {
  text-align: center;
}

/* 分布（保留用于优先级完成率） */
.dist-list { display: flex; flex-direction: column; gap: $spacing-sm; }

.dist-row {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
}

.dist-left {
  display: flex;
  align-items: center;
  gap: 8rpx;
  width: 100rpx;
}

.dist-dot { width: 16rpx; height: 16rpx; border-radius: 50%; }
.dist-label { font-size: $font-sm; color: $text-primary; }

.dist-bar-wrap {
  flex: 1;
  height: 16rpx;
  background: $bg-input;
  border-radius: 8rpx;
  overflow: hidden;
}

.dist-bar { height: 100%; border-radius: 8rpx; transition: width 0.3s; }

.dist-count { font-size: $font-xs; color: $text-secondary; min-width: 120rpx; text-align: right; }

/* 趋势图（已改用 Canvas） */
.trend-chart { display: none; }
.trend-bars { display: none; }
.trend-col { display: none; }
.trend-bar { display: none; }
.trend-labels { display: none; }
.trend-l { display: none; }

.trend-legend {
  display: flex;
  gap: $spacing-md;
  justify-content: center;
  margin-top: $spacing-sm;
}

.legend-item { display: flex; align-items: center; gap: 6rpx; }

.legend-dot {
  width: 16rpx; height: 16rpx; border-radius: 4rpx;

  &.created { background: var(--color-ai); }
  &.done { background: var(--color-plan); }
}

.legend-text { font-size: $font-xs; color: $text-secondary; }

/* 完成速度 */
.speed-grid {
  display: flex;
  justify-content: space-between;
}

.sp-item { text-align: center; flex: 1; }

.sp-num {
  font-size: 40rpx;
  font-weight: 800;
  color: var(--color-ai);
  display: block;
}

.sp-label { font-size: $font-xs; color: $text-secondary; }

.empty-block { padding: 40rpx 0; text-align: center; }
.empty-text { font-size: $font-sm; color: $text-hint; }

/* 子任务环形（已改用 Canvas gauge） */
.subtask-ring { display: none; }
.ring-wrap { display: none; }
.ring-outer { display: none; }
.ring-fill { display: none; }
.ring-inner { display: none; }
.ring-num { display: none; }
.ring-info { display: none; }
.ri-text { font-size: $font-sm; color: $text-secondary; }

/* 优先级完成率 */
.pc-list { display: flex; flex-direction: column; gap: $spacing-sm; }

.pc-row {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
}

.pc-left {
  display: flex;
  align-items: center;
  gap: 8rpx;
  width: 100rpx;
}

.pc-dot { width: 16rpx; height: 16rpx; border-radius: 50%; }
.pc-label { font-size: $font-sm; color: $text-primary; }

.pc-bar-wrap {
  flex: 1;
  height: 16rpx;
  background: $bg-input;
  border-radius: 8rpx;
  overflow: hidden;
}

.pc-bar { height: 100%; border-radius: 8rpx; transition: width 0.3s; }

.pc-text { font-size: $font-xs; color: $text-secondary; min-width: 140rpx; text-align: right; }
</style>
