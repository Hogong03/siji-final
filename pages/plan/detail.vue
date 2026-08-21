<script setup>
/**
 * 计划详情 / 新建页
 * 路由: /pages/plan/detail?id=new | ?clientId=xxx
 *
 * 子计划管理 → components/plan/PlanChildPlans.vue
 * 标签管理 → composables/usePlanTags.js
 * 日期工具 → utils/datetime.js
 */
import { onBackPress, onLoad, onShow } from '@dcloudio/uni-app'
import SijiIcon from '@/components/common/SijiIcon.vue'
import PlanTimeSection from '@/components/plan/PlanTimeSection.vue'
import PlanReminderSection from '@/components/plan/PlanReminderSection.vue'
import PlanChildPlans from '@/components/plan/PlanChildPlans.vue'
import PlanTagPicker from '@/components/plan/PlanTagPicker.vue'
import { ref, computed, watch } from 'vue'

import { getPlanList, savePlan, deletePlan, getChildPlans, buildChildrenSpecsFromLegacy, updateIndex } from '@/utils/storage.js'
import { generateEntityId } from '@/utils/uuid.js'
import { useAppStore } from '@/store/index.js'
import { getPlanReminder, setPlanReminder, removePlanReminder } from '@/utils/reminder.js'
import { parseDateTime, combineDateTime } from '@/utils/datetime.js'
import { usePlanTags } from '@/composables/usePlanTags.js'
import { usePlanAI } from './composables/usePlanAI.js'
import { usePlanChildAI } from './composables/usePlanChildAI.js'
import { safeNavigateBack } from '@/utils/nav-helper.js'

const store = useAppStore()

const isNew = ref(true)
const planId = ref('')
const originalCreatedAt = ref(null)
const saved = ref(false)
const migratedLegacy = ref(false)

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
  childPlans: [],
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

// 子计划进度（子计划全部完成时自动将状态改为已完成）
const childProgress = computed(() => {
  const list = form.value.childPlans || []
  if (list.length === 0) return { total: 0, done: 0, pct: 0 }
  const done = list.filter(c => c.status === 2).length
  return { total: list.length, done, pct: Math.round(done / list.length * 100) }
})
watch(() => childProgress.value, (prog) => {
  if (prog.total > 0 && prog.done === prog.total && form.value.status !== 2) {
    form.value.status = 2
    uni.showToast({ title: '所有子计划已完成', icon: 'none' })
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

// AI 子计划拆解
const { aiChildrenLoading, aiBreakdownChildren } = usePlanChildAI(form, store)

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

function buildChildPlanForm(spec, priority) {
  return {
    client_id: generateEntityId('plan'),
    title: spec.title,
    description: spec.description || '',
    priority,
    status: spec.status,
    estimated_time: spec.estimated_time || '',
    due_date: spec.due_date || '',
    deadline: spec.deadline || '',
    parent_id: '',
    childPlans: (spec.children || []).map(g => buildChildPlanForm(g, priority)),
    _subCount: 0
  }
}

function saveChildPlans(children, parentId) {
  (children || []).forEach(ch => {
    const { _subCount, ...child } = ch
    const record = {
      ...child,
      client_id: child.client_id || generateEntityId('plan'),
      parent_id: parentId,
      created_at: child.created_at || Date.now(),
      updated_at: Date.now(),
      subtasks: [],
      phases: [],
      is_deleted: 0
    }
    savePlan(record)
    updateIndex('plan', record)
    if (Array.isArray(child.childPlans) && child.childPlans.length > 0) {
      saveChildPlans(child.childPlans, record.client_id)
    }
  })
}

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
      childPlans: getChildPlans(planId.value),
      ai_advice: item.ai_advice || ''
    }
    // 旧数据迁移：子任务/阶段 → 子计划（新模型统一为子计划，保存时落库）
    if (form.value.childPlans.length === 0) {
      const legacySpecs = buildChildrenSpecsFromLegacy(item)
      if (legacySpecs.length > 0) {
        form.value.childPlans = legacySpecs.map(spec => buildChildPlanForm(spec, item.priority ?? 2))
        migratedLegacy.value = true
      }
    }
    // 子计划补充孙计划数量（仅展示用，保存时剔除）
    form.value.childPlans.forEach(ch => { ch._subCount = getChildPlans(ch.client_id).length })
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
    ai_advice: form.value.ai_advice,
    created_at: isNew.value ? Date.now() : (originalCreatedAt.value || Date.now()),
    updated_at: Date.now(),
    is_deleted: 0
  }
  // 旧数据已迁移为子计划时，清理父计划上的历史子任务/阶段字段
  if (migratedLegacy.value) {
    plan.subtasks = []
    plan.phases = []
  }

  savePlan(plan)
  updateIndex('plan', plan)
  saveChildPlans(form.value.childPlans, plan.client_id)

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
        removePlanReminder(planId.value)
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

      <!-- 子计划（新模型：计划直接包含子计划，点击子计划查看完整情况） -->
      <PlanChildPlans
        :child-plans="form.childPlans"
        :priority-colors="priorityColors"
        :status-map="statusMap"
        :progress="childProgress"
        :ai-loading="aiChildrenLoading"
        :can-add="!isNew"
        @go-child-plan="goChildPlan"
        @add-child-plan="goAddChildPlan"
        @ai-breakdown="aiBreakdownChildren"
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
