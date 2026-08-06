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

    <!-- 历史演练记录（默认折叠） -->
    <view v-if="simulations.length > 0" class="history-section">
      <view class="history-header" @tap="historyExpanded = !historyExpanded">
        <text class="section-title">历史演练 · {{ simulations.length }}</text>
        <text class="history-toggle">{{ historyExpanded ? '收起' : '展开' }}</text>
      </view>
      <template v-if="historyExpanded">
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
      </template>
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
const historyExpanded = ref(false)
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
    confirmColor: '#DC2626',
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

<style scoped lang="scss">
@import './simulation.scss';
</style>