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
import { ref, computed } from 'vue'

import { getPlanList, savePlan, deletePlan, getChildPlans } from '@/utils/storage.js'
import { generateEntityId } from '@/utils/uuid.js'
import { useAppStore } from '@/store/index.js'
import { getPlanReminder, setPlanReminder, removePlanReminder } from '@/utils/reminder.js'
import { parseDateTime, combineDateTime } from '@/utils/datetime.js'
import { usePlanSubtasks } from '@/composables/usePlanSubtasks.js'
import { usePlanTags } from '@/composables/usePlanTags.js'
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

// 标签管理
const { showTagPicker, openTagPicker, toggleTag, handleAddTag, removeTagFromPlan, tagColor } = usePlanTags(form)

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
      childPlans: getChildPlans(planId.value),
      ai_breakdown: item.ai_breakdown || '',
      ai_advice: item.ai_advice || ''
    }
    const rem = getPlanReminder(planId.value)
    if (rem) {
      reminderEnabled.value = rem.enabled !== false
      reminderAdvanceMin.value = rem.advanceMin ?? 30
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
      customTime
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
</script>



<template>
  <view class="detail-page">
    <scroll-view class="detail-scroll" scroll-y>
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

      <!-- 子计划（嵌套计划） -->
      <PlanChildPlans
        v-if="!isNew"
        :child-plans="form.childPlans"
        :priority-colors="priorityColors"
        :status-map="statusMap"
        @go-child-plan="goChildPlan"
        @add-child-plan="goAddChildPlan"
      />

      <!-- 子任务 -->
      <PlanSubtasksSection
        :subtasks="form.subtasks"
        :ai-loading="aiLoading"
        :subtask-progress="subtaskProgress"
        :ai-breakdown-text="form.ai_breakdown"
        @toggle-subtask="toggleSubtask"
        @remove-subtask="removeSubtask"
        @add-subtask="addSubtask"
        @ai-breakdown="aiBreakdown"
      />

      <!-- AI 建议 -->
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
