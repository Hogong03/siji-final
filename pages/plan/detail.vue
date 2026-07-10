<script setup>
/**
 * 计划详情 / 新建页
 * 路由: /pages/plan/detail?id=new | ?clientId=xxx
 *
 * 增强功能：
 *  ① 子任务可勾选完成/取消
 *  ② 子任务进度条
 *  ③ 新增子任务
 *  ④ AI 拆解按钮（请求 AI 拆解当前计划为子任务）
 */
import SijiIcon from '@/components/common/SijiIcon.vue'
import PlanTimeSection from '@/components/plan/PlanTimeSection.vue'
import PlanReminderSection from '@/components/plan/PlanReminderSection.vue'
import PlanChildPlans from '@/components/plan/PlanChildPlans.vue'
import PlanSubtasksSection from '@/components/plan/PlanSubtasksSection.vue'
import PlanTagPicker from '@/components/plan/PlanTagPicker.vue'
import { ref, computed, onMounted } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { getPlanList, savePlan, deletePlan, getTags, getChildPlans } from '@/utils/storage.js'
import { generateEntityId } from '@/utils/uuid.js'
import { enqueue } from '@/utils/sync.js'
import { useAppStore } from '@/store/index.js'
import { chatRequest } from '@/utils/api.js'
import { getPlanReminder, setPlanReminder, removePlanReminder } from '@/utils/reminder.js'

const store = useAppStore()

const isNew = ref(true)
const planId = ref('')
// 保存原始 created_at — 编辑时复用，避免传 undefined 导致字段丢失
const originalCreatedAt = ref(null)

const form = ref({
  title: '',
  description: '',
  priority: 0,
  status: 0,
  tags: [],
  due_date: '',           // 截止日期 (YYYY-MM-DD)
  due_time: '',           // 截止时间 (HH:mm:ss)
  estimated_time: '',     // 预计开始日期 (YYYY-MM-DD)
  estimated_time_value: '', // 预计开始时间 (HH:mm:ss)
  start_time: '',         // 完整开始时间 (YYYY-MM-DD HH:mm:ss)
  end_time: '',           // 完整结束时间 (YYYY-MM-DD HH:mm:ss)
  parent_id: '',          // 父计划ID（嵌套计划）
  subtasks: [],
  childPlans: [],         // 子计划列表
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

// 标签相关
const showTagPicker = ref(false)

function openTagPicker() {
  showTagPicker.value = true
}
function toggleTag(tagName) {
  const idx = form.value.tags.indexOf(tagName)
  if (idx >= 0) form.value.tags.splice(idx, 1)
  else form.value.tags.push(tagName)
}
function handleAddTag(name) {
  if (form.value.tags.includes(name)) return
  form.value.tags.push(name)
}
function removeTagFromPlan(tagName) {
  const idx = form.value.tags.indexOf(tagName)
  if (idx >= 0) form.value.tags.splice(idx, 1)
}

onLoad((query) => {
  if (query && query.clientId) {
    isNew.value = false
    planId.value = query.clientId
    loadPlan()
  } else if (query && query.id === 'new' && query.parentId) {
    // 新建子计划
    isNew.value = true
    form.value.parent_id = query.parentId
  }
})
onShow(() => {
  if (!isNew.value) loadPlan()
})

// 子任务进度
const subtaskProgress = computed(() => {
  const subs = form.value.subtasks
  if (!subs || subs.length === 0) return null
  const done = subs.filter(s => s.done).length
  return { done, total: subs.length, pct: Math.round(done / subs.length * 100) }
})

/** 切换子任务完成状态 */
function toggleSubtask(idx) {
  if (form.value.subtasks[idx]) {
    form.value.subtasks[idx].done = !form.value.subtasks[idx].done
    // 自动保存
    if (!isNew.value) {
      const plan = {
        client_id: planId.value,
        ...form.value,
        updated_at: Date.now()
      }
      savePlan(plan)
    }
    // 全部完成时自动改状态为已完成
    if (subtaskProgress.value && subtaskProgress.value.pct === 100 && form.value.status !== 2) {
      form.value.status = 2
    } else if (subtaskProgress.value && subtaskProgress.value.pct < 100 && form.value.status === 2) {
      form.value.status = 1
    }
  }
}

/** 添加子任务 */
function addSubtask() {
  form.value.subtasks.push({ id: form.value.subtasks.length + 1, title: '', done: false })
}

/** 删除子任务 */
function removeSubtask(idx) {
  form.value.subtasks.splice(idx, 1)
}

/** AI 拆解子任务 */
const aiLoading = ref(false)
async function aiBreakdown() {
  if (!form.value.title.trim()) {
    uni.showToast({ title: '请先输入计划标题', icon: 'none' })
    return
  }
  if (!store.hasApiKey) {
    uni.showToast({ title: '请先配置 API Key', icon: 'none' })
    return
  }

  aiLoading.value = true
  try {
    const prompt = `你是计划拆解助手。请将以下计划拆解为3-8个具体的可执行子任务。

计划标题：${form.value.title}
描述：${form.value.description || '无'}

请返回 JSON：
{ "subtasks": [{ "title": "子任务1" }, { "title": "子任务2" }] }

子任务要具体、可执行、有逻辑顺序。只返回 JSON。`
    const result = await chatRequest(prompt, null, '', store.aiConfig)
    const raw = result.reply || ''
    let parsed
    try { parsed = JSON.parse(raw) }
    catch {
      const m = raw.match(/\{[\s\S]*\}/)
      if (m) parsed = JSON.parse(m[0])
      else throw new Error('AI 返回格式错误')
    }
    if (Array.isArray(parsed.subtasks) && parsed.subtasks.length > 0) {
      form.value.subtasks = parsed.subtasks.map((s, i) => ({
        id: i + 1,
        title: typeof s === 'string' ? s : (s.title || ''),
        done: false
      }))
      form.value.ai_breakdown = parsed.subtasks.map((s, i) => `${i + 1}. ${typeof s === 'string' ? s : s.title}`).join('\n')
      uni.showToast({ title: `已拆解 ${parsed.subtasks.length} 个子任务`, icon: 'success' })
    }
  } catch (e) {
    uni.showToast({ title: e.message || 'AI 拆解失败', icon: 'none' })
  } finally {
    aiLoading.value = false
  }
}

function loadPlan() {
  const plans = getPlanList()
  const item = plans.find(p => p.client_id === planId.value)
  if (item) {
    originalCreatedAt.value = item.created_at || null
    // 解析完整时间到日期+时间分量
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
    // 加载提醒设置
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

/** 解析 "YYYY-MM-DD HH:mm:ss" 为 { date, time } */
function parseDateTime(str) {
  if (!str) return { date: '', time: '' }
  // 已经是纯日期格式
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return { date: str, time: '' }
  // 完整日期时间格式
  const m = str.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(:\d{2})?)?/)
  if (m) return { date: m[1], time: m[2] || '' }
  return { date: str, time: '' }
}

/** 组合日期+时间为完整字符串 */
function combineDateTime(date, time) {
  if (!date) return ''
  if (!time) return date
  // 确保 time 有秒位
  const parts = time.split(':')
  while (parts.length < 3) parts.push('00')
  return `${date} ${parts.join(':')}`
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
    // 精确到秒的时间：组合日期+时间
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

  // 保存提醒设置
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

  enqueue({ type: 'plan', client_id: plan.client_id, action: isNew.value ? 'create' : 'update', data: plan })

  uni.showToast({ title: '已保存', icon: 'success' })
  setTimeout(() => { uni.navigateBack() }, 800)
}

function handleDelete() {
  uni.showModal({
    title: '删除计划',
    content: '确定要删除这个计划吗？',
    success(res) {
      if (res.confirm) {
        deletePlan(planId.value)
        enqueue({ type: 'plan', client_id: planId.value, action: 'delete' })
        uni.showToast({ title: '已删除', icon: 'success' })
        setTimeout(() => { uni.navigateBack() }, 800)
      }
    }
  })
}



/** 跳转到子计划创建页 */
function goAddChildPlan() {
  uni.navigateTo({ url: `/pages/plan/detail?id=new&parentId=${planId.value}` })
}

/** 跳转到子计划详情 */
function goChildPlan(clientId) {
  uni.navigateTo({ url: `/pages/plan/detail?clientId=${clientId}` })
}

// 标签颜色映射
const tagColorCache = {}
function tagColor(name) {
  if (tagColorCache[name]) return tagColorCache[name]
  const registry = getTags('plan')
  const regItem = registry.find(t => t.name === name)
  if (regItem?.color) {
    tagColorCache[name] = regItem.color
    return regItem.color
  }
  tagColorCache[name] = '#000000'
  return '#000000'
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
.detail-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: $bg-page;
}

.detail-scroll {
  flex: 1;
  padding: $spacing-md;
}

/* ─── 表单基础元素（供本页 + 子组件根节点继承）─── */
.section {
  margin-bottom: $spacing-md;
  background: $bg-card;
  border-radius: $radius-md;
  padding: $spacing-md;
  box-shadow: $shadow-sm;
}

.section-label {
  font-size: $font-sm;
  color: $text-secondary;
  margin-bottom: $spacing-sm;
  display: block;
}

.input-field {
  font-size: $font-md;
  padding: $spacing-sm 0;
  border-bottom: 1rpx solid rgba(0,0,0,0.06);
  width: 100%;
}

.textarea-field {
  font-size: $font-md;
  min-height: 200rpx;
  width: 100%;
  line-height: 1.8;
  padding: $spacing-sm 0;
}

/* ─── 优先级 ─── */
.priority-row {
  display: flex;
  gap: $spacing-sm;
}

.priority-item {
  flex: 1;
  text-align: center;
  padding: 12rpx 0;
  border-radius: $radius-sm;
  font-size: $font-sm;
  border: 2rpx solid;
  transition: all $transition-fast;
}

/* ─── 状态 ─── */
.status-row {
  display: flex;
  gap: $spacing-sm;
}

.status-item {
  flex: 1;
  text-align: center;
  padding: 12rpx 0;
  border-radius: $radius-sm;
  font-size: $font-sm;
  background: $bg-input;
  color: $text-secondary;
  transition: all $transition-fast;

  &.active {
    background: var(--color-ai);
    color: var(--text-on-ai);
    font-weight: 600;
    box-shadow: 0 2rpx 8rpx rgba(16, 185, 129, 0.25);
  }
}

/* ─── AI 建议（仍在本页模板中）─── */
.ai-section {
  background: rgba(0, 0, 0, 0.02);
  border: 1rpx solid rgba(0, 0, 0, 0.06);

  .ai-text {
    font-size: $font-sm;
    color: $text-primary;
    line-height: 1.7;
    white-space: pre-wrap;
  }
}

/* ─── 标签 chips（仍在本页模板中）─── */
.tag-chips {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
  align-items: center;
}

.tag-chip {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 6rpx 16rpx;
  border-radius: 24rpx;
  border: 1rpx solid;
  font-size: $font-xs;

  .tc-label { font-weight: 500; }
  .tc-close { font-size: 20rpx; opacity: 0.7; margin-left: 2rpx; }
}

.tag-add-btn {
  padding: 6rpx 20rpx;
  border-radius: 24rpx;
  border: 1rpx dashed var(--text-hint);
  font-size: $font-xs;
  color: var(--text-secondary);
}

/* ─── 底部操作栏 ─── */
.bottom-bar {
  display: flex;
  gap: $spacing-md;
  padding: $spacing-md;
  background: $bg-card;
  border-top: 1rpx solid rgba(0,0,0,0.06);

  .btn-delete {
    flex: 1;
    text-align: center;
    padding: 24rpx 0;
    border-radius: $radius-md;
    background: $bg-input;
    color: $danger;
    font-size: $font-md;
    font-weight: 600;
  }

  .btn-save {
    flex: 2;
    text-align: center;
    padding: 24rpx 0;
    border-radius: $radius-md;
    background: $accent;
    color: var(--text-on-ai);
    font-size: $font-md;
    font-weight: 600;
  }
}
</style>
