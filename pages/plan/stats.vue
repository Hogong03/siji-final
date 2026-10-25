<script setup>
/**
 * 计划统计页
 *
 * 功能：
 *  ① 时间范围筛选（全部/本月/近30天）
 *  ② 总览四宫格
 *  ③ 优先级分布（环形图）
 *  ④ 状态分布（环形图）
 *  ⑤ 近30天创建趋势
 *  ⑥ 完成速度分析
 *  ⑦ 子计划完成率
 *  ⑧ 各优先级完成率
 *  ⑨ 标签统计（新增）
 *  ⑩ 过期分析（新增）
 *  ⑪ 活跃度热力图（新增）
 */

import { computed, onMounted } from 'vue'
import SijiChart from '@/components/common/SijiChart.vue'
import CountUp from '@/components/common/CountUp.vue'
import { usePlanStats } from './composables/usePlanStats.js'
import { useTheme } from '@/composables/useTheme.js'
import { seriesColor, seriesColors } from '@/utils/chart-theme.js'
import { hapticLight } from '@/utils/haptic.js'

const { isDark } = useTheme()
// 图表系列色 / 图例 / 进度条统一走 chart-theme：深色下低于 3:1 自动提亮，
// 与 canvas 内 seriesColor 同一套口径（页面层不再各写一份深色映射表）
const trendColors = computed(() => seriesColors(['#18181B', '#A1A1AA'], isDark.value))
const singleBarColor = computed(() => seriesColors(['#18181B'], isDark.value))

function chartColor(c) { return seriesColor(c, isDark.value) }

// 数据源 composable 给的是浅色硬编码，渲染前在页面层归一（图表与图例共用同一份色）
function darkRing(list) {
  return list.map(d => ({ ...d, color: chartColor(d.color) }))
}

const {
  timeRange, overview, priorityDist, statusDist, trendData,
  completionStats, subtaskStats, priorityCompletion,
  tagStats, overdueStats, heatmapData,
  loadPlans
} = usePlanStats()

onMounted(() => { loadPlans() })

function setRange(v) {
  if (timeRange.value === v) return
  timeRange.value = v
  hapticLight()
}

const rangeOptions = [
  { label: '全部', value: 'all' },
  { label: '本月', value: 'month' },
  { label: '近30天', value: '30days' }
]

function heatmapColor(count) {
  if (isDark.value) {
    // 深色：空格不再等于卡片底色（否则整片格子看起来"缺了一块"），最低档也留出网格感
    if (count === 0) return '#3F3F46'
    if (count === 1) return '#52525B'
    if (count <= 2) return '#71717A'
    if (count <= 4) return '#A1A1AA'
    return '#FAFAFA'
  }
  if (count === 0) return '#E4E4E7'
  if (count === 1) return '#F4F4F5'
  if (count <= 2) return '#A1A1AA'
  if (count <= 4) return '#52525B'
  return '#18181B'
}
</script>

<template>
  <view class="stats-page page-enter">
    <scroll-view class="stats-scroll card-list-stagger" scroll-y>
      <!-- 时间范围选择 -->
      <view class="range-bar">
        <view
          v-for="opt in rangeOptions" :key="opt.value"
          class="range-item chip-transition"
          :class="{ active: timeRange === opt.value }"
          @tap="setRange(opt.value)"
        >
          {{ opt.label }}
        </view>
      </view>

      <!-- ① 总览 -->
      <view class="card overview-card">
        <text class="card-title">计划总览</text>
        <view class="overview-grid">
          <view class="og-item">
            <CountUp class="og-num" :value="Number(overview.total) || 0" :decimals="0" />
            <text class="og-label">总计划</text>
          </view>
          <view class="og-item">
            <CountUp class="og-num" :value="Number(overview.active) || 0" :decimals="0" />
            <text class="og-label">进行中</text>
          </view>
          <view class="og-item">
            <CountUp class="og-num" :value="Number(overview.completed) || 0" :decimals="0" />
            <text class="og-label">已完成</text>
          </view>
          <view class="og-item">
            <CountUp class="og-num" :value="Number(overview.rate) || 0" :decimals="0" suffix="%" />
            <text class="og-label">完成率</text>
          </view>
        </view>
      </view>

      <!-- ② 优先级分布 -->
      <view class="card">
        <text class="card-title">优先级分布</text>
        <view class="chart-with-legend">
          <view class="ring-side">
            <SijiChart type="ring" :dark="isDark" :data="darkRing(priorityDist).map(p => ({ value: p.count, color: p.color }))" label="优先级" :height="200" />
          </view>
          <view class="legend-side">
            <view v-for="p in priorityDist" :key="p.label" class="mini-legend">
              <view class="mini-dot" :style="{ background: chartColor(p.color) }" />
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
            <SijiChart type="ring" :dark="isDark" :data="darkRing(statusDist).map(s => ({ value: s.count, color: s.color }))" label="状态" :height="200" />
          </view>
          <view class="legend-side">
            <view v-for="s in statusDist" :key="s.label" class="mini-legend">
              <view class="mini-dot" :style="{ background: chartColor(s.color) }" />
              <text class="mini-label">{{ s.label }}</text>
              <text class="mini-val">{{ s.count }} ({{ s.pct }}%)</text>
            </view>
          </view>
        </view>
      </view>

      <!-- ④ 30天趋势 -->
      <view class="card">
        <text class="card-title">近30天趋势</text>
        <SijiChart type="bar" :dark="isDark" :data="trendData.map(d => ({ label: d.label, values: [d.created, d.done] }))" :group-mode="true" :colors="trendColors" :height="160" />
        <view class="trend-legend">
          <view class="legend-item"><view class="legend-dot created" /><text class="legend-text">新建</text></view>
          <view class="legend-item"><view class="legend-dot done" /><text class="legend-text">完成</text></view>
        </view>
      </view>

      <!-- ⑤ 完成速度 -->
      <view class="card">
        <text class="card-title">完成速度分析</text>
        <view v-if="completionStats.count > 0" class="speed-grid">
          <view class="sp-item"><text class="sp-num">{{ completionStats.avg }}</text><text class="sp-label">平均(天)</text></view>
          <view class="sp-item"><text class="sp-num">{{ completionStats.fastest }}</text><text class="sp-label">最快(天)</text></view>
          <view class="sp-item"><text class="sp-num">{{ completionStats.slowest }}</text><text class="sp-label">最慢(天)</text></view>
          <view class="sp-item"><text class="sp-num">{{ completionStats.count }}</text><text class="sp-label">已完成数</text></view>
        </view>
        <view v-else class="empty-block"><text class="empty-text">暂无已完成的计划</text></view>
      </view>

      <!-- ⑥ 子任务完成率 -->
      <view class="card">
        <text class="card-title">子计划完成率</text>
        <view class="gauge-row">
          <SijiChart type="gauge" :dark="isDark" :value="subtaskStats.rate" label="子计划" :colors="singleBarColor" :height="200" />
          <view class="gauge-info"><text class="ri-text">已完成 {{ subtaskStats.done }} / {{ subtaskStats.total }} 个子计划</text></view>
        </view>
      </view>

      <!-- ⑦ 优先级完成率 -->
      <view class="card">
        <text class="card-title">各优先级完成率</text>
        <view class="pc-list">
          <view v-for="p in priorityCompletion" :key="p.label" class="pc-row">
            <view class="pc-left"><view class="pc-dot" :style="{ background: chartColor(p.color) }" /><text class="pc-label">{{ p.label }}</text></view>
            <view class="pc-bar-wrap"><view class="pc-bar bar-grow" :style="{ width: p.completionRate + '%', background: chartColor(p.color) }" /></view>
            <text class="pc-text">{{ p.done }}/{{ p.total }} ({{ p.completionRate }}%)</text>
          </view>
        </view>
      </view>

      <!-- ⑧ 标签统计（新增） -->
      <view class="card" v-if="tagStats.length > 0">
        <text class="card-title">标签统计</text>
        <view class="tag-stats-list">
          <view v-for="t in tagStats" :key="t.label" class="ts-row">
            <text class="ts-label">{{ t.label }}</text>
            <view class="ts-bar-wrap"><view class="ts-bar bar-grow" :style="{ width: t.rate + '%' }" /></view>
            <text class="ts-text">{{ t.done }}/{{ t.total }} ({{ t.rate }}%)</text>
          </view>
        </view>
      </view>

      <!-- ⑨ 过期分析（新增） -->
      <view class="card" v-if="overdueStats.count > 0">
        <text class="card-title">过期分析</text>
        <view class="overdue-grid">
          <view class="od-item">
            <text class="od-num danger">{{ overdueStats.count }}</text>
            <text class="od-label">过期计划</text>
          </view>
          <view class="od-item">
            <text class="od-num">{{ overdueStats.avgDays }}</text>
            <text class="od-label">平均过期(天)</text>
          </view>
          <view class="od-item">
            <text class="od-num">{{ overdueStats.maxDays }}</text>
            <text class="od-label">最长过期(天)</text>
          </view>
        </view>
      </view>

      <!-- ⑩ 活跃度热力图（新增） -->
      <view class="card">
        <text class="card-title">近30天活跃度</text>
        <view class="heatmap grid-stagger">
          <view v-for="d in heatmapData" :key="d.date" class="hm-cell" :style="{ background: heatmapColor(d.count) }">
            <text class="hm-day" :style="{ color: isDark ? (d.count > 2 ? '#18181B' : '#A1A1AA') : (d.count > 2 ? '#FAFAFA' : '#71717A') }">{{ d.day }}</text>
          </view>
        </view>
        <view class="hm-legend">
          <text class="hm-label">少</text>
          <view v-if="isDark" class="hm-scale" style="background:#3F3F46" />
          <view v-if="isDark" class="hm-scale" style="background:#52525B" />
          <view v-if="isDark" class="hm-scale" style="background:#71717A" />
          <view v-if="isDark" class="hm-scale" style="background:#A1A1AA" />
          <view v-if="isDark" class="hm-scale" style="background:#FAFAFA" />
          <view v-if="!isDark" class="hm-scale" style="background:#E4E4E7" />
          <view v-if="!isDark" class="hm-scale" style="background:#F4F4F5" />
          <view v-if="!isDark" class="hm-scale" style="background:#A1A1AA" />
          <view v-if="!isDark" class="hm-scale" style="background:#52525B" />
          <view v-if="!isDark" class="hm-scale" style="background:#18181B" />
          <text class="hm-label">多</text>
        </view>
      </view>

      <view style="height: 60rpx" />
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
@import './stats.scss';
</style>
