<script setup>
/**
 * AI 效果自检（3.7.0）
 *
 * 干什么：把历史真实反馈固化成 22 条语料，逐条真实请求一遍模型，
 * 看它「选了什么工具、顺序对不对」，算出通过率 —— 改提示词第一次有数字可对照。
 *
 * 安全边界（3.7.1）：
 *  - 干跑只拦写操作与联网工具（web_search / read_url）：写不落库、不联网
 *  - 查询类（query_plan / query_bill / get_profile 等只读）照常真跑 —— 模型必须看到你的真实数据，
 *    否则拿不到计划 client_id，只能照着占位文本瞎答（3.7.0 首跑 7 条失败里有一半出在这）
 *  - 默认设置下写操作还要过确认闸门，自检不可能污染真实数据
 *  - 语料里没有隐私内容（都是历史反馈里的原话）
 *
 * 代价：会真实调用你配置的模型，22 条约 22 次请求。
 */
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useAppStore } from '@/store/index.js'
import { runAgentLoop } from '@/utils/ai/agent-loop.js'
import { EVAL_CASES } from '@/utils/ai/eval/cases.js'
import { runCases, summarizeResults, formatFailureReport, mergeExecutedTools, CASE_STATUS } from '@/utils/ai/eval/runner.js'

const store = useAppStore()

const rows = ref([])
const running = ref(false)
const progress = ref({ done: 0, total: EVAL_CASES.length })
const stopRef = { stopped: false }
const expandedId = ref('')
const copied = ref(false)

const hasKey = computed(() => !!store.providerKeys[store.aiProvider])
const modelText = computed(() => `${store.currentProviderName || ''} · ${store.modelName || store.aiModel || ''}`)
const summary = computed(() => summarizeResults(rows.value))
const hasResult = computed(() => rows.value.length > 0)
const failuresText = computed(() => formatFailureReport(rows.value))

/** id → 用例（列表展开时要展示期望） */
const CASE_MAP = {}
EVAL_CASES.forEach(c => { CASE_MAP[c.id] = c })
function findCase(id) { return CASE_MAP[id] || null }

/** 期望摘要：把用例断言翻成一行中文，列表里直接对照实际工具序列 */
function expectText(caze) {
  const e = (caze && caze.expect) || {}
  const parts = []
  if (e.tools && e.tools.length) parts.push('必须：' + e.tools.join('、'))
  if (e.toolsAny && e.toolsAny.length) parts.push('至少一个：' + e.toolsAny.join('或'))
  if (e.forbid && e.forbid.length) parts.push('不许：' + e.forbid.join('、'))
  if (e.order && e.order.length) parts.push(e.order.map(p => `${p[0]} 先于 ${p[1]}`).join('、'))
  if (e.args) parts.push('参数校验：' + Object.keys(e.args).join('、'))
  if (e.confirm === true) parts.push('必须走确认闸门')
  return parts.join('；') || '（无断言）'
}

function gotText(row) {
  const chain = row.gotTools && row.gotTools.length ? row.gotTools.join(' → ') : '（没调工具）'
  const n = (row.jsonTools && row.jsonTools.length) || 0
  return n > 0 ? `${chain}　·　其中 ${n} 步走 JSON 兜底` : chain
}

/** 跑一条：真请求 + 干跑；温度 0 让同一批语料可比 */
function makeRunner() {
  return async (message) => {
    const cfg = {
      provider: store.aiProvider,
      model: store.aiModel,
      apiKey: store.providerKeys[store.aiProvider] || '',
      temperature: 0,
      dryRun: true
    }
    // store 传真的：查询类在干跑下照常执行（只读），写操作在 agent-loop 里被替换成占位
    const result = await runAgentLoop(store, message, 'eval', cfg, [])
    return {
      toolCalls: mergeExecutedTools(result),
      reply: result.reply || '',
      confirm: (result.execResults || []).some(r => r && r.confirm)
    }
  }
}

async function startEval() {
  if (running.value) return
  if (!hasKey.value) {
    uni.showToast({ title: '先到 AI 配置里填 Key', icon: 'none' })
    return
  }
  running.value = true
  rows.value = []
  expandedId.value = ''
  stopRef.stopped = false
  progress.value = { done: 0, total: EVAL_CASES.length }
  try {
    const out = await runCases(makeRunner(), EVAL_CASES, {
      stopRef: stopRef,
      onProgress: (done, total, row) => {
        progress.value = { done, total }
        rows.value = rows.value.concat([row])
      }
    })
    const stopped = stopRef.stopped && out.length < EVAL_CASES.length
    const sum = summarizeResults(out)
    uni.showToast({
      title: stopped ? `已停止（${out.length} 条）` : `通过 ${sum.pass}/${sum.total}·${sum.rate}%`,
      icon: 'none',
      duration: 2500
    })
  } catch (e) {
    uni.showToast({ title: '跑批失败：' + ((e && e.message) || e), icon: 'none' })
  } finally {
    running.value = false
  }
}

function stopEval() {
  stopRef.stopped = true
  uni.showToast({ title: '当前这条跑完就停', icon: 'none' })
}

function toggleRow(row) {
  expandedId.value = expandedId.value === row.id ? '' : row.id
}

function copyFailures() {
  const text = failuresText.value
  if (!text) return
  uni.setClipboardData({
    data: text,
    success: () => {
      copied.value = true
      uni.showToast({ title: '已复制，粘贴给开发者即可', icon: 'success' })
      setTimeout(() => { copied.value = false }, 2000)
    },
    fail: () => uni.showToast({ title: '复制失败，请重试', icon: 'none' })
  })
}

function statusMark(row) {
  if (row.status === CASE_STATUS.PASS) return '✓'
  if (row.status === CASE_STATUS.FALLBACK) return '~'
  return row.status === CASE_STATUS.ERROR ? '!' : '×'
}

onShow(() => { copied.value = false })
</script>

<template>
  <view class="ai-eval-page">
    <view class="intro">
      <text class="intro-text">把历史反馈里的真实语料跑一遍，看 AI 选了什么工具、顺序对不对。干跑：写操作不落库、不联网，查询类照常读你的真实数据。会真实调用你配置的模型（{{ progress.total }} 条约 {{ progress.total }} 次请求）。</text>
      <text class="intro-note">✓ 通过　~ 靠前端兜底（模型没调工具，结果仍会落库）　× 未通过　! 请求出错</text>
    </view>

    <view class="env-row">
      <text class="env-label">当前模型</text>
      <text class="env-value">{{ modelText || '未配置' }}</text>
    </view>
    <view v-if="!hasKey" class="warn-row">
      <text class="warn-text">没填 API Key，先去「设置 → AI 配置」填好再回来跑</text>
    </view>

    <!-- 操作区 -->
    <view class="action-row">
      <view
        class="btn btn-primary"
        :class="{ disabled: running || !hasKey }"
        @tap="startEval"
      >
        <text class="btn-text">{{ running ? '正在跑…' : (hasResult ? '重新跑一遍' : '开始自检') }}</text>
      </view>
      <view v-if="running" class="btn btn-plain" @tap="stopEval">
        <text class="btn-text">停止</text>
      </view>
      <view v-if="hasResult && !running" class="btn btn-plain" @tap="copyFailures">
        <text class="btn-text">{{ copied ? '已复制' : '复制失败明细' }}</text>
      </view>
    </view>

    <!-- 进度 -->
    <view v-if="running" class="progress-wrap">
      <view class="progress-track">
        <view class="progress-fill" :style="{ width: (progress.total ? Math.round(progress.done / progress.total * 100) : 0) + '%' }" />
      </view>
      <text class="progress-text">已跑 {{ progress.done }}/{{ progress.total }}</text>
    </view>

    <!-- 汇总 -->
    <view v-if="hasResult" class="summary">
      <text class="summary-rate">{{ summary.rate }}%</text>
      <text class="summary-meta">通过 {{ summary.pass }}/{{ summary.total }}<text v-if="summary.fail > 0"> · 未过 {{ summary.fail }}</text><text v-if="summary.fallback > 0"> · 靠兜底 {{ summary.fallback }}</text><text v-if="summary.error > 0"> · 出错 {{ summary.error }}</text> · 用时 {{ Math.round(summary.ms / 1000) }}s</text>
    </view>

    <!-- 结果列表 -->
    <view v-if="hasResult" class="list">
      <view v-for="row in rows" :key="row.id" class="row" @tap="toggleRow(row)">
        <view class="row-head">
          <text class="row-mark" :class="{ ok: row.status === CASE_STATUS.PASS, err: row.status === CASE_STATUS.ERROR, soft: row.status === CASE_STATUS.FALLBACK }">{{ statusMark(row) }}</text>
          <view class="row-body">
            <text class="row-title">{{ row.title }}</text>
            <text class="row-tools">实际：{{ gotText(row) }}</text>
          </view>
          <text class="row-arrow">{{ expandedId === row.id ? '▴' : '▾' }}</text>
        </view>
        <view v-if="expandedId === row.id" class="row-detail">
          <text class="detail-line">原话：{{ row.message }}</text>
          <view class="detail-block">
            <text class="detail-label">期望</text>
            <text class="detail-value">{{ expectText(findCase(row.id)) }}</text>
          </view>
          <view v-if="row.failures && row.failures.length" class="detail-block">
            <text class="detail-label">未通过原因</text>
            <text class="detail-value detail-fail">{{ row.failures.join('；') }}</text>
          </view>
          <view v-if="row.reply" class="detail-block">
            <text class="detail-label">AI 回复节选</text>
            <text class="detail-value">{{ row.reply.replace(/\s+/g, ' ').slice(0, 160) }}</text>
          </view>
        </view>
      </view>
    </view>

    <view v-if="!hasResult && !running" class="empty">
      <text class="empty-text">还没跑过。点上面的「开始自检」，22 条约 2-4 分钟。</text>
    </view>

    <view style="height: 80rpx" />
  </view>
</template>

<style lang="scss" scoped>
@import './ai-eval.scss';
</style>