<script setup>
/**
 * 计划详情 / 新建页
 * 路由: /pages/plan/detail?id=new | ?clientId=xxx
 *
 * 子任务管理 → composables/usePlanSubtasks.js
 * 标签管理 → composables/usePlanTags.js
 * 日期工具 → utils/datetime.js
 */
import { onBackPress, onLoad, onShow } from '@dcloudio/uni-app'
import SijiIcon from '@/components/common/SijiIcon.vue'
import PlanTimeSection from '@/components/plan/PlanTimeSection.vue'
import PlanReminderSection from '@/components/plan/PlanReminderSection.vue'
import PlanChildPlans from '@/components/plan/PlanChildPlans.vue'
import PlanSubtasksSection from '@/components/plan/PlanSubtasksSection.vue'
import PlanTagPicker from '@/components/plan/PlanTagPicker.vue'
import { ref, computed, watch } from 'vue'

import { getPlanList, savePlan, deletePlan, getChildPlans } from '@/utils/storage.js'
import { generateEntityId } from '@/utils/uuid.js'
import { useAppStore } from '@/store/index.js'
import { getPlanReminder, setPlanReminder, removePlanReminder } from '@/utils/reminder.js'
import { parseDateTime, combineDateTime } from '@/utils/datetime.js'
import { usePlanSubtasks } from '@/composables/usePlanSubtasks.js'
import { usePlanTags } from '@/composables/usePlanTags.js'
import { usePlanAI } from './composables/usePlanAI.js'
import { usePlanPhases } from './composables/usePlanPhases.js'
import { safeNavigateBack } from '@/utils/nav-helper.js'

const store = useAppStore()

const isNew = ref(true)
const planId = ref('')
const originalCreatedAt = ref(null)
const saved = ref(false)

const form = ref({
  title: '',
  description: '',
  priority: 0,
  status: 0,
  tags: [],
  due_date: '',
  due_time: '',
  estimated_time: '',
  estimated_time_value: '',
  start_time: '',
  end_time: '',
  parent_id: '',
  subtasks: [],
  phases: [],
  childPlans: [],
  ai_breakdown: '',
  ai_advice: ''
})

// 提醒设置
const reminderEnabled = ref(false)
const reminderAdvanceMin = ref(30)
const reminderAdvanceOptions = [
  { label: '5 分钟', value: 5 },
  { label: '15 分钟', value: 15 },
  { label: '30 分钟', value: 30 },
  { label: '1 小时', value: 60 },
  { label: '3 小时', value: 180 },
  { label: '1 天', value: 1440 },
  { label: '3 天', value: 4320 }
]
const reminderCustomDate = ref('')
const reminderCustomTimeValue = ref('')

// 重复提醒
const repeatType = ref('none') // none / daily / weekly / weekdays
const repeatOptions = [
  { label: '不重复', value: 'none' },
  { label: '每天', value: 'daily' },
  { label: '每周', value: 'weekly' },
  { label: '工作日', value: 'weekdays' }
]

const priorityOptions = [
  { label: '普通', value: 0, color: '#999' },
  { label: '重要', value: 1, color: '#E8A838' },
  { label: '紧急', value: 2, color: '#D35D5D' }
]
const priorityColors = ['#999', '#E8A838', '#D35D5D']

const statusOptions = [
  { label: '待开始', value: 0 },
  { label: '进行中', value: 1 },
  { label: '已完成', value: 2 }
]
const statusMap = ['待开始', '进行中', '已完成']

// 子任务管理
const { aiLoading, subtaskProgress, toggleSubtask, addSubtask, removeSubtask, aiBreakdown } = usePlanSubtasks(form, store)

// 子任务全部完成时自动将状态改为已完成
watch(() => subtaskProgress.value, (prog) => {
  if (prog.total > 0 && prog.done === prog.total && form.value.status !== 2) {
    form.value.status = 2
    uni.showToast({ title: '所有子任务已完成', icon: 'none' })
  } else if (prog.total > 0 && prog.done < prog.total && form.value.status === 2) {
    form.value.status = 1
  }
}, { deep: true })

// 标签管理
const { showTagPicker, openTagPicker, toggleTag, handleAddTag, removeTagFromPlan, tagColor } = usePlanTags(form)

// AI 增强
const {
  aiScheduling, aiReview, aiNextStep,
  aiScheduleResult, aiReviewResult, aiNextStepResult,
  generateSchedule, generateReview, generateNextStep
} = usePlanAI(form, store)

// 阶段化计划
const {
  phaseAILoading, phaseProgress,
  addPhase, removePhase,
  addPhaseSubtask, removePhaseSubtask,
  addMilestone, removeMilestone,
  togglePhaseCollapse, aiPhaseBreakdown
} = usePlanPhases(form, store)

// 父计划信息
const parentPlan = computed(() => {
  if (!form.value.parent_id) return null
  const plans = getPlanList()
  return plans.find(p => p.client_id === form.value.parent_id) || null
})

onLoad((query) => {
  if (query && query.clientId) {
    isNew.value = false
    planId.value = query.clientId
    loadPlan()
  } else if (query && query.id === 'new' && query.parentId) {
    isNew.value = true
    form.value.parent_id = query.parentId
  }
})
onShow(() => {
  if (!isNew.value) loadPlan()
})

onBackPress(() => {
  if (saved.value) return false
  if (form.value.title || form.value.description) {
    uni.showModal({
      title: '放弃编辑？', content: '当前内容未保存',
      confirmText: '放弃', cancelText: '继续编辑',
      success: (res) => {
        if (!res.confirm) return
        saved.value = true
        safeNavigateBack({ fallback: '/pages/functions/index' })
      }
    })
    return true
  }
  return false
})

function loadPlan() {
  const plans = getPlanList()
  const item = plans.find(p => p.client_id === planId.value)
  if (item) {
    originalCreatedAt.value = item.created_at || null
    const dueParts = parseDateTime(item.due_date || item.deadline || '')
    const estParts = parseDateTime(item.estimated_time || '')
    form.value = {
      title: item.title || '',
      description: item.description || '',
      priority: item.priority ?? 0,
      status: item.status ?? 0,
      tags: Array.isArray(item.tags) ? item.tags : [],
      due_date: dueParts.date,
      due_time: dueParts.time,
      estimated_time: estParts.date,
      estimated_time_value: estParts.time,
      start_time: item.start_time || '',
      end_time: item.end_time || '',
      parent_id: item.parent_id || '',
      subtasks: Array.isArray(item.subtasks) ? item.subtasks : [],
      phases: Array.isArray(item.phases) ? item.phases.map((ph, i) => ({
        ...ph,
        id: ph.id || i + 1,
        _collapsed: ph._collapsed !== undefined ? ph._collapsed : true
      })) : [],
      childPlans: getChildPlans(planId.value),
      ai_breakdown: item.ai_breakdown || '',
      ai_advice: item.ai_advice || ''
    }
    const rem = getPlanReminder(planId.value)
    if (rem) {
      reminderEnabled.value = rem.enabled !== false
      reminderAdvanceMin.value = rem.advanceMin ?? 30
      repeatType.value = rem.repeatType || 'none'
      if (rem.customTime) {
        const parts = parseDateTime(rem.customTime)
        reminderCustomDate.value = parts.date
        reminderCustomTimeValue.value = parts.time ? parts.time.substring(0, 5) : ''
      }
    }
  }
}

async function handleSave() {
  if (!form.value.title.trim()) {
    uni.showToast({ title: '请输入计划标题', icon: 'none' })
    return
  }

  const plan = {
    client_id: isNew.value ? generateEntityId('plan') : planId.value,
    title: form.value.title.trim(),
    description: form.value.description.trim(),
    priority: form.value.priority,
    status: form.value.status,
    tags: [...form.value.tags],
    due_date: combineDateTime(form.value.due_date, form.value.due_time),
    deadline: combineDateTime(form.value.due_date, form.value.due_time),
    estimated_time: combineDateTime(form.value.estimated_time, form.value.estimated_time_value),
    start_time: form.value.start_time || combineDateTime(form.value.estimated_time, form.value.estimated_time_value),
    end_time: form.value.end_time || combineDateTime(form.value.due_date, form.value.due_time),
    parent_id: form.value.parent_id || '',
    subtasks: form.value.subtasks.map((s, i) => ({
      id: s.id || i + 1,
      title: s.title || (typeof s === 'string' ? s : ''),
      done: s.done || false
    })),
    phases: (form.value.phases || []).map((ph, i) => ({
      id: ph.id || i + 1,
      title: ph.title || `第${i + 1}阶段`,
      description: ph.description || '',
      start_date: ph.start_date || '',
      end_date: ph.end_date || '',
      milestones: (ph.milestones || []).filter(m => m),
      subtasks: (ph.subtasks || []).map((s, j) => ({
        id: s.id || j + 1,
        title: s.title || '',
        done: s.done || false
      }))
    })),
    ai_breakdown: form.value.ai_breakdown,
    ai_advice: form.value.ai_advice,
    created_at: isNew.value ? Date.now() : (originalCreatedAt.value || Date.now()),
    updated_at: Date.now(),
    is_deleted: 0
  }

  savePlan(plan)

  if (reminderEnabled.value && (form.value.due_date || reminderCustomDate.value)) {
    const customTime = reminderCustomDate.value
      ? combineDateTime(reminderCustomDate.value, reminderCustomTimeValue.value ? reminderCustomTimeValue.value + ':00' : '')
      : ''
    setPlanReminder(plan.client_id, {
      enabled: true,
      advanceMin: reminderAdvanceMin.value,
      customTime,
      repeatType: repeatType.value
    })
  } else {
    removePlanReminder(plan.client_id)
  }

  saved.value = true
  uni.showToast({ title: '已保存', icon: 'success' })
  setTimeout(() => {
    safeNavigateBack({ fallback: '/pages/functions/index' })
  }, 800)
}

function handleDelete() {
  uni.showModal({
    title: '删除计划',
    content: '确定要删除这个计划吗？',
    success(res) {
      if (res.confirm) {
        deletePlan(planId.value)
        uni.showToast({ title: '已删除', icon: 'success' })
        setTimeout(() => {
          safeNavigateBack({ fallback: '/pages/functions/index' })
        }, 800)
      }
    }
  })
}

function goAddChildPlan() {
  uni.navigateTo({ url: `/pages/plan/detail?id=new&parentId=${planId.value}` })
}

function goChildPlan(clientId) {
  uni.navigateTo({ url: `/pages/plan/detail?clientId=${clientId}` })
}

function goParentPlan() {
  if (form.value.parent_id) {
    uni.navigateTo({ url: `/pages/plan/detail?clientId=${form.value.parent_id}` })
  }
}
</script>

<template>
  <view class="detail-page">
    <scroll-view class="detail-scroll" scroll-y>
      <!-- 父计划关联 -->
      <view v-if="parentPlan" class="section parent-section" @tap="goParentPlan">
        <view class="parent-link">
          <text class="parent-label">↳ 属于</text>
          <text class="parent-title">{{ parentPlan.title }}</text>
          <text class="parent-arrow">›</text>
        </view>
      </view>

      <!-- 优先级 -->
      <view class="section">
        <text class="section-label">优先级</text>
        <view class="priority-row">
          <view
            v-for="p in priorityOptions" :key="p.value"
            class="priority-item"
            :class="{ active: form.priority === p.value }"
            :style="form.priority === p.value ? { background: p.color, color: '#fff' } : { borderColor: p.color, color: p.color }"
            @tap="form.priority = p.value"
          >
            {{ p.label }}
          </view>
        </view>
      </view>

      <!-- 状态 -->
      <view class="section">
        <text class="section-label">状态</text>
        <view class="status-row">
          <view
            v-for="s in statusOptions" :key="s.value"
            class="status-item"
            :class="{ active: form.status === s.value }"
            @tap="form.status = s.value"
          >
            {{ s.label }}
          </view>
        </view>
      </view>

      <!-- 标题 -->
      <view class="section">
        <text class="section-label">标题</text>
        <input
          v-model="form.title"
          class="input-field"
          placeholder="计划名称..."
          maxlength="100"
        />
      </view>

      <!-- 描述 -->
      <view class="section">
        <text class="section-label">描述</text>
        <textarea
          v-model="form.description"
          class="textarea-field"
          placeholder="详细描述你的计划..."
          :maxlength="2000"
          :auto-height="true"
        />
      </view>

      <!-- 标签 -->
      <view class="section">
        <text class="section-label">标签</text>
        <view class="tag-chips">
          <view
            v-for="t in form.tags" :key="t"
            class="tag-chip"
            :style="{ background: tagColor(t) + '1a', color: tagColor(t), borderColor: tagColor(t) }"
            @tap="removeTagFromPlan(t)"
          >
            <text class="tc-label">{{ t }}</text>
            <text class="tc-close">✕</text>
          </view>
          <view class="tag-add-btn" @tap="openTagPicker">
            <text>+ 添加标签</text>
          </view>
        </view>
      </view>

      <!-- 预计时间 & 截止日期 -->
      <PlanTimeSection
        v-model:estimated-date="form.estimated_time"
        v-model:estimated-time="form.estimated_time_value"
        v-model:due-date="form.due_date"
        v-model:due-time="form.due_time"
      />

      <!-- 提醒设置 -->
      <PlanReminderSection
        v-model:enabled="reminderEnabled"
        v-model:advance-min="reminderAdvanceMin"
        v-model:custom-date="reminderCustomDate"
        v-model:custom-time-value="reminderCustomTimeValue"
        :due-date="form.due_date"
        :advance-options="reminderAdvanceOptions"
      />

      <!-- 重复提醒 -->
      <view v-if="reminderEnabled" class="section">
        <text class="section-label">重复</text>
        <view class="repeat-row">
          <view
            v-for="opt in repeatOptions" :key="opt.value"
            class="repeat-item"
            :class="{ active: repeatType === opt.value }"
            @tap="repeatType = opt.value"
          >
            {{ opt.label }}
          </view>
        </view>
      </view>

      <!-- 子计划（嵌套计划） -->
      <PlanChildPlans
        v-if="!isNew"
        :child-plans="form.childPlans"
        :priority-colors="priorityColors"
        :status-map="statusMap"
        @go-child-plan="goChildPlan"
        @add-child-plan="goAddChildPlan"
      />

      <!-- 阶段化计划 -->
      <view v-if="form.phases && form.phases.length > 0" class="section phases-section">
        <view class="phases-header">
          <text class="section-label">阶段计划（{{ form.phases.length }}阶段）</text>
          <text class="phases-progress">{{ phaseProgress.pct }}%</text>
        </view>

        <view v-for="(phase, pi) in form.phases" :key="phase.id" class="phase-block">
          <view class="phase-header" @tap="togglePhaseCollapse(pi)">
            <text class="phase-num">{{ pi + 1 }}</text>
            <view class="phase-info">
              <text class="phase-title">{{ phase.title || '未命名阶段' }}</text>
              <text v-if="phase.start_date || phase.end_date" class="phase-date">{{ phase.start_date }} ~ {{ phase.end_date }}</text>
            </view>
            <text class="phase-pct">{{ phaseProgress.phases[pi]?.pct ?? 0 }}%</text>
            <text class="phase-toggle">{{ phase._collapsed ? '▸' : '▾' }}</text>
          </view>

          <view v-if="!phase._collapsed" class="phase-body">
            <input v-model="phase.title" class="phase-input" placeholder="阶段名称" />
            <input v-model="phase.description" class="phase-input" placeholder="阶段描述（可选）" />

            <view class="phase-dates">
              <picker mode="date" :value="phase.start_date" @change="phase.start_date = $event.detail.value">
                <text class="date-picker-text">{{ phase.start_date || '开始日期' }}</text>
              </picker>
              <text class="date-sep">~</text>
              <picker mode="date" :value="phase.end_date" @change="phase.end_date = $event.detail.value">
                <text class="date-picker-text">{{ phase.end_date || '结束日期' }}</text>
              </picker>
            </view>

            <view v-if="phase.milestones.length > 0" class="milestones">
              <text class="ms-label">里程碑</text>
              <view v-for="(ms, mi) in phase.milestones" :key="mi" class="ms-item">
                <text class="ms-bullet">◆</text>
                <input v-model="phase.milestones[mi]" class="ms-input" placeholder="里程碑描述" />
                <text class="ms-remove" @tap="removeMilestone(pi, mi)">✕</text>
              </view>
            </view>
            <view class="ms-add" @tap="addMilestone(pi)">
              <text>+ 里程碑</text>
            </view>

            <view class="phase-subtasks">
              <view v-for="(st, si) in phase.subtasks" :key="si" class="phase-st-item">
                <view class="st-check" :class="{ done: st.done }" @tap="st.done = !st.done">
                  <text v-if="st.done">✓</text>
                </view>
                <input v-model="st.title" class="st-input" placeholder="子任务..." />
                <text class="st-remove" @tap="removePhaseSubtask(pi, si)">✕</text>
              </view>
              <view class="st-add" @tap="addPhaseSubtask(pi)">
                <text>+ 添加子任务</text>
              </view>
            </view>

            <view class="phase-remove" @tap="removePhase(pi)">
              <text>删除此阶段</text>
            </view>
          </view>
        </view>

        <view class="phase-add-btn" @tap="addPhase">
          <text>+ 添加阶段</text>
        </view>
      </view>

      <!-- AI 阶段化拆解（无阶段时显示） -->
      <view v-if="!form.phases || form.phases.length === 0" class="section">
        <view class="ai-phase-btn" :class="{ loading: phaseAILoading }" @tap="aiPhaseBreakdown()">
          <SijiIcon name="sparkle" size="sm" />
          <text>{{ phaseAILoading ? 'AI 拆解中...' : 'AI 阶段化拆解' }}</text>
        </view>
        <text class="phase-hint">适用于长周期复杂目标，AI 会按时间拆分阶段并分配子任务和里程碑</text>
      </view>

      <!-- 子任务（无阶段时显示，互斥） -->
      <PlanSubtasksSection
        v-if="!form.phases || form.phases.length === 0"
        :subtasks="form.subtasks"
        :ai-loading="aiLoading"
        :subtask-progress="subtaskProgress"
        :ai-breakdown-text="form.ai_breakdown"
        @toggle-subtask="toggleSubtask"
        @remove-subtask="removeSubtask"
        @add-subtask="addSubtask"
        @ai-breakdown="aiBreakdown"
      />

      <!-- AI 增强工具栏 -->
      <view class="section ai-tools-section">
        <text class="section-label">AI 工具</text>
        <view class="ai-tools-row">
          <view class="ai-tool-btn" @tap="generateSchedule" :class="{ loading: aiScheduling }">
            <SijiIcon name="calendar" size="sm" />
            <text>{{ aiScheduling ? '排期中...' : '智能排期' }}</text>
          </view>
          <view v-if="form.status === 2" class="ai-tool-btn" @tap="generateReview" :class="{ loading: aiReview }">
            <SijiIcon name="stats" size="sm" />
            <text>{{ aiReview ? '复盘中...' : '进度复盘' }}</text>
          </view>
          <view v-if="form.status === 1" class="ai-tool-btn" @tap="generateNextStep" :class="{ loading: aiNextStep }">
            <SijiIcon name="tip" size="sm" />
            <text>{{ aiNextStep ? '思考中...' : '下一步建议' }}</text>
          </view>
        </view>
        <!-- AI 结果展示 -->
        <view v-if="aiScheduleResult" class="ai-result">
          <text class="ai-result-title">排期建议</text>
          <text class="ai-result-text">{{ aiScheduleResult }}</text>
        </view>
        <view v-if="aiReviewResult" class="ai-result">
          <text class="ai-result-title">复盘报告</text>
          <text class="ai-result-text">{{ aiReviewResult }}</text>
        </view>
        <view v-if="aiNextStepResult" class="ai-result">
          <text class="ai-result-title">下一步建议</text>
          <text class="ai-result-text">{{ aiNextStepResult }}</text>
        </view>
      </view>

      <!-- 原有 AI 建议 -->
      <view v-if="form.ai_advice" class="section ai-section">
        <view class="section-label"><SijiIcon name="tip" size="sm" class="section-icon" /><text>AI 建议</text></view>
        <text class="ai-text">{{ form.ai_advice }}</text>
      </view>
    </scroll-view>

    <!-- 标签选择弹窗 -->
    <PlanTagPicker
      v-model:visible="showTagPicker"
      :selected-tags="form.tags"
      @toggle-tag="toggleTag"
      @add-tag="handleAddTag"
      @remove-tag="removeTagFromPlan"
    />

    <!-- 底部操作栏 -->
    <view class="bottom-bar safe-area-bottom">
      <view v-if="!isNew" class="btn-delete" @tap="handleDelete">删除</view>
      <view class="btn-save" @tap="handleSave">保存计划</view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import './detail.scss';
</style>
