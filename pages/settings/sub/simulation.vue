<template>
  <view class="page">
    <view class="header">
      <text class="header-title">情景模拟</text>
      <text class="header-desc">选择场景模式，AI 将扮演对应角色与你推演</text>
    </view>

    <!-- 三种模式卡片 -->
    <view class="mode-list">
      <view
        v-for="m in modes"
        :key="m.id"
        class="mode-card"
        :class="{ active: selectedMode === m.id }"
        @tap="selectMode(m.id)"
      >
        <view class="mode-card-left">
          <SijiIcon :name="m.iconName" size="lg" />
          <view class="mode-card-info">
            <text class="mode-title">{{ m.title }}</text>
            <text class="mode-desc">{{ m.desc }}</text>
            <view class="mode-meta">
              <text class="agent-label">由「{{ m.agentName }}」引导</text>
              <text v-if="modeStats[m.id] > 0" class="mode-count">· {{ modeStats[m.id] }} 次演练</text>
            </view>
          </view>
        </view>
        <view class="mode-radio" :class="{ on: selectedMode === m.id }" />
      </view>
    </view>

    <!-- 选中模式的配置表单 -->
    <view v-if="selectedMode" class="config-section">
      <text class="section-title">{{ currentMode.title }} · 场景设置</text>

      <!-- 关系人物选择（社交/关系处理模式） -->
      <view v-if="currentMode.needsRelation" class="form-item">
        <text class="form-label">对方</text>
        <view v-if="relations.length > 0" class="relation-picker">
          <view
            v-for="(r, i) in relations"
            :key="r.id"
            class="relation-chip"
            :class="{ on: relationIdx === i }"
            @tap="selectRelation(i)"
          >{{ r.name }}</view>
        </view>
        <input v-model="form.relation_name" class="form-input" placeholder="或直接输入姓名" />
      </view>

      <view class="form-item">
        <text class="form-label">场景描述</text>
        <textarea
          v-model="form.scene"
          class="form-textarea"
          :placeholder="currentMode.scenePlaceholder"
          :maxlength="200"
        />
      </view>

      <view class="form-item">
        <text class="form-label">{{ selectedMode === 'planning' ? '规划目标' : '演练目标' }}</text>
        <input v-model="form.goal" class="form-input" :placeholder="currentMode.goalPlaceholder" />
      </view>

      <view class="btn-start" :class="{ disabled: !canStart }" @tap="startSimulation">
        <text class="btn-text">开始演练</text>
      </view>
    </view>

    <!-- 历史演练记录 -->
    <view v-if="simulations.length > 0" class="history-section">
      <view class="history-header">
        <text class="section-title">历史演练</text>
        <text class="history-count">{{ simulations.length }}</text>
      </view>
      <view class="filter-tabs">
        <text
          v-for="t in filterTabs"
          :key="t.id"
          class="filter-tab"
          :class="{ on: activeFilter === t.id }"
          @tap="activeFilter = t.id"
        >{{ t.label }} {{ t.count }}</text>
      </view>
      <view v-for="sim in filteredSims" :key="sim.id" class="sim-card">
        <view class="sim-top" @tap="resumeSim(sim)">
          <view class="sim-left">
            <text class="sim-mode-tag">{{ getModeTitle(sim.mode) }}</text>
            <text class="sim-name">{{ sim.relation_name }}</text>
          </view>
          <view class="sim-status-wrap">
            <text v-if="sim.status === 'completed'" class="sim-status completed">已完成</text>
            <text v-else class="sim-status active">可继续</text>
            <SijiIcon name="chevron-right" size="sm" class="sim-arrow" />
          </view>
        </view>
        <text class="sim-scene" @tap="resumeSim(sim)">{{ sim.scene }}</text>
        <text v-if="sim.goal" class="sim-goal" @tap="resumeSim(sim)">目标：{{ sim.goal }}</text>
        <view class="sim-bottom">
          <text class="sim-time">{{ formatTime(sim.created_at) }}</text>
          <view class="sim-bottom-right">
            <text v-if="sim.status === 'completed' && sim.report" class="sim-report-btn" @tap="expandReport(sim)">{{ expandedId === sim.id ? '收起报告' : '查看复盘' }}</text>
            <text class="sim-delete-btn" @tap="deleteSim(sim)">删除</text>
          </view>
        </view>
        <view v-if="expandedId === sim.id && sim.report" class="sim-report" @tap="expandReport(sim)">
          <text class="sim-report-text">{{ sim.report }}</text>
        </view>
      </view>
      <view v-if="filteredSims.length === 0" class="empty-hint">
        <text>该分类暂无演练记录</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { getAllRelations } from '@/utils/relations.js'
import { getAllSimulations, createSimulation, deleteSimulation, SIM_MODES } from '@/utils/simulation.js'
import SijiIcon from '@/components/common/SijiIcon.vue'

const modes = ref([
  { ...SIM_MODES.social },
  { ...SIM_MODES.planning },
  { ...SIM_MODES.relationship }
])
const selectedMode = ref('')
const relations = ref([])
const simulations = ref([])
const relationIdx = ref(-1)
const activeFilter = ref('all')
const expandedId = ref('')
const form = ref({
  relation_id: '',
  relation_name: '',
  scene: '',
  goal: ''
})

const currentMode = computed(() => {
  const m = modes.value.find(x => x.id === selectedMode.value)
  return m || modes.value[0]
})

const canStart = computed(() => {
  if (!selectedMode.value) return false
  if (currentMode.value.needsRelation && !form.value.relation_name.trim()) return false
  return form.value.scene.trim().length > 0
})

const modeStats = computed(() => {
  const stats = { social: 0, planning: 0, relationship: 0 }
  simulations.value.forEach(s => {
    const m = s.mode || 'social'
    if (stats[m] !== undefined) stats[m]++
  })
  return stats
})

const filterTabs = computed(() => {
  return [
    { id: 'all', label: '全部', count: simulations.value.length },
    { id: 'social', label: '社交', count: modeStats.value.social },
    { id: 'planning', label: '规划', count: modeStats.value.planning },
    { id: 'relationship', label: '关系', count: modeStats.value.relationship }
  ]
})

const filteredSims = computed(() => {
  if (activeFilter.value === 'all') return simulations.value
  return simulations.value.filter(s => (s.mode || 'social') === activeFilter.value)
})

onLoad((options) => {
  if (options && options.mode && SIM_MODES[options.mode]) {
    selectedMode.value = options.mode
  }
  if (options && options.relation_id) {
    form.value.relation_id = options.relation_id
    form.value.relation_name = options.name ? decodeURIComponent(options.name) : ''
  }
  loadData()
})

onShow(() => {
  loadData()
})

function loadData() {
  relations.value = getAllRelations()
  simulations.value = getAllSimulations()
  if (form.value.relation_id) {
    const idx = relations.value.findIndex(r => r.id === form.value.relation_id)
    if (idx >= 0) {
      relationIdx.value = idx
      form.value.relation_name = relations.value[idx].name
    }
  }
}

function selectMode(modeId) {
  selectedMode.value = modeId
  if (!SIM_MODES[modeId].needsRelation) {
    form.value.relation_id = ''
    form.value.relation_name = ''
    relationIdx.value = -1
  }
}

function selectRelation(i) {
  relationIdx.value = i
  const r = relations.value[i]
  form.value.relation_id = r.id
  form.value.relation_name = r.name
}

function getModeTitle(mode) {
  return (SIM_MODES[mode || 'social'] || {}).title || '社交沙盘'
}

function formatTime(ts) {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function startSimulation() {
  if (!canStart.value) {
    uni.showToast({ title: '请填写场景和人物', icon: 'none' })
    return
  }
  const sim = createSimulation({
    mode: selectedMode.value,
    relationId: form.value.relation_id,
    relationName: form.value.relation_name.trim(),
    scene: form.value.scene.trim(),
    goal: form.value.goal.trim()
  })
  const simParams = {
    simulation: sim.id,
    mode: selectedMode.value,
    name: sim.relation_name,
    scene: sim.scene,
    relation_id: form.value.relation_id || '',
    goal: form.value.goal.trim() || ''
  }
  uni.$emit('init-simulation', simParams)
  uni.switchTab({ url: '/pages/chat/index' })
}

function resumeSim(sim) {
  if (sim.status === 'active') {
    const simParams = {
      simulation: sim.id,
      mode: sim.mode || 'social',
      name: sim.relation_name,
      scene: sim.scene,
      relation_id: sim.relation_id || '',
      goal: sim.goal || '',
      resume: true
    }
    uni.$emit('init-simulation', simParams)
    uni.switchTab({ url: '/pages/chat/index' })
  } else {
    expandReport(sim)
  }
}

function expandReport(sim) {
  if (expandedId.value === sim.id) {
    expandedId.value = ''
  } else {
    expandedId.value = sim.id
  }
}

function deleteSim(sim) {
  uni.showModal({
    title: '确认删除',
    content: `确定删除「${sim.relation_name}」的演练记录？关联的对话内容也将一并删除。`,
    confirmColor: '#EF4444',
    success: (res) => {
      if (res.confirm) {
        deleteSimulation(sim.id)
        uni.showToast({ title: '已删除', icon: 'none' })
        simulations.value = getAllSimulations()
        if (expandedId.value === sim.id) {
          expandedId.value = ''
        }
      }
    }
  })
}
</script>

<style scoped>
.page { min-height: 100vh; background: var(--bg-page, #F4F4F5); padding: 24rpx; box-sizing: border-box; }

.header { padding: 32rpx 0 24rpx; }
.header-title { font-size: 40rpx; font-weight: 700; color: var(--text-primary, #18181B); display: block; }
.header-desc { font-size: 26rpx; color: var(--text-secondary, #71717A); margin-top: 12rpx; display: block; }

/* 模式列表 */
.mode-list { display: flex; flex-direction: column; gap: 16rpx; margin-bottom: 24rpx; }
.mode-card {
  display: flex; align-items: center; justify-content: space-between;
  background: var(--bg-card, #FFFFFF); border-radius: 20rpx; padding: 28rpx 24rpx;
  border: 2rpx solid transparent;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
.mode-card.active { border-color: var(--accent, #000000); }
.mode-card-left { display: flex; align-items: center; gap: 20rpx; flex: 1; min-width: 0; }
.mode-card-info { flex: 1; min-width: 0; }
.mode-title { font-size: 30rpx; font-weight: 700; color: var(--text-primary, #18181B); display: block; }
.mode-desc { font-size: 24rpx; color: var(--text-secondary, #71717A); margin-top: 6rpx; display: block; }
.mode-meta { display: flex; align-items: center; gap: 8rpx; margin-top: 10rpx; }
.agent-label { font-size: 22rpx; color: var(--text-tertiary, #A1A1AA); }
.mode-count { font-size: 22rpx; color: var(--text-tertiary, #A1A1AA); }

.mode-radio {
  width: 36rpx; height: 36rpx; border-radius: 50%;
  border: 4rpx solid var(--border-color, #E4E4E7);
  flex-shrink: 0;
}
.mode-radio.on {
  border-color: var(--accent, #000000);
  background: var(--accent, #000000);
  position: relative;
}
.mode-radio.on::after {
  content: ''; position: absolute;
  left: 50%; top: 50%; transform: translate(-50%, -50%);
  width: 14rpx; height: 14rpx; border-radius: 50%;
  background: var(--bg-card, #FFFFFF);
}

/* 配置表单 */
.config-section {
  background: var(--bg-card, #FFFFFF); border-radius: 20rpx; padding: 28rpx;
  margin-bottom: 24rpx; box-sizing: border-box;
}
.section-title { font-size: 28rpx; font-weight: 600; color: var(--text-primary, #18181B); display: block; margin-bottom: 20rpx; }

.form-item { margin-bottom: 24rpx; }
.form-label { font-size: 26rpx; color: var(--text-secondary, #71717A); display: block; margin-bottom: 10rpx; }
.form-input {
  width: 100%; height: 80rpx; padding: 0 24rpx;
  background: var(--bg-input, #F4F4F5); border-radius: 14rpx;
  font-size: 28rpx; color: var(--text-primary, #18181B); line-height: 80rpx;
  box-sizing: border-box;
}
.form-textarea {
  width: 100%; min-height: 120rpx; padding: 16rpx 24rpx;
  background: var(--bg-input, #F4F4F5); border-radius: 14rpx;
  font-size: 28rpx; color: var(--text-primary, #18181B);
  box-sizing: border-box;
}

/* 关系人物 chip 选择 */
.relation-picker {
  display: flex; flex-wrap: wrap; gap: 12rpx; margin-bottom: 12rpx;
}
.relation-chip {
  font-size: 26rpx; padding: 10rpx 24rpx; border-radius: 20rpx;
  background: var(--bg-input, #F4F4F5); color: var(--text-secondary, #71717A);
  border: 2rpx solid transparent;
}
.relation-chip.on {
  background: var(--accent, #000000); color: var(--bg-card, #FFFFFF);
}

/* 开始按钮 */
.btn-start {
  width: 100%; height: 96rpx; border-radius: 16rpx;
  background: var(--accent, #000000); display: flex; align-items: center; justify-content: center;
  margin-top: 20rpx;
}
.btn-start.disabled { opacity: 0.3; }
.btn-text { font-size: 32rpx; font-weight: 600; color: var(--bg-card, #FFFFFF); }

/* 历史 */
.history-section { margin-top: 8rpx; }
.history-header { display: flex; align-items: center; gap: 12rpx; margin-bottom: 16rpx; }
.history-count { font-size: 24rpx; color: var(--text-tertiary, #A1A1AA); }

.filter-tabs { display: flex; gap: 12rpx; margin-bottom: 16rpx; flex-wrap: wrap; }
.filter-tab {
  font-size: 24rpx; padding: 8rpx 20rpx; border-radius: 12rpx;
  background: var(--bg-input, #F4F4F5); color: var(--text-secondary, #71717A);
}
.filter-tab.on { background: var(--accent, #000000); color: var(--bg-card, #FFFFFF); }

.sim-card {
  background: var(--bg-card, #FFFFFF); border-radius: 16rpx; padding: 24rpx;
  margin-bottom: 12rpx;
}
.sim-top { display: flex; justify-content: space-between; align-items: center; }
.sim-left { display: flex; flex-direction: column; gap: 4rpx; }
.sim-mode-tag { font-size: 22rpx; color: var(--text-tertiary, #A1A1AA); }
.sim-name { font-size: 30rpx; font-weight: 600; color: var(--text-primary, #18181B); }
.sim-status-wrap { display: flex; align-items: center; gap: 8rpx; }
.sim-status { font-size: 22rpx; padding: 4rpx 16rpx; border-radius: 8rpx; }
.sim-status.completed { background: var(--bg-input, #F4F4F5); color: var(--text-secondary, #71717A); }
.sim-status.active { background: var(--accent, #000000); color: var(--bg-card, #FFFFFF); }
.sim-arrow { opacity: 0.4; }
.sim-scene { font-size: 26rpx; color: var(--text-primary, #18181B); margin-top: 10rpx; display: block; }
.sim-goal { font-size: 24rpx; color: var(--text-secondary, #71717A); margin-top: 4rpx; display: block; }
.sim-bottom { display: flex; align-items: center; justify-content: space-between; margin-top: 8rpx; }
.sim-time { font-size: 22rpx; color: var(--text-tertiary, #A1A1AA); }
.sim-bottom-right { display: flex; align-items: center; gap: 24rpx; }
.sim-report-btn { font-size: 24rpx; color: var(--accent, #000000); font-weight: 500; }
.sim-delete-btn { font-size: 22rpx; color: #EF4444; }
.sim-report {
  margin-top: 12rpx; padding: 20rpx; background: var(--bg-input, #F4F4F5);
  border-radius: 12rpx; border-left: 6rpx solid var(--accent, #000000);
}
.sim-report-text { font-size: 26rpx; color: var(--text-primary, #18181B); line-height: 1.6; white-space: pre-wrap; word-break: break-all; }
.empty-hint { padding: 40rpx 0; text-align: center; }
.empty-hint text { font-size: 26rpx; color: var(--text-tertiary, #A1A1AA); }
</style>
