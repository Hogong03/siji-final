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
import { ref, computed, onMounted } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { getPlanList, savePlan, deletePlan, getUsedTags, addCustomTag, getTags, getChildPlans } from '@/utils/storage.js'
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
const availableTags = ref([])
const showTagPicker = ref(false)
const newTagInput = ref('')
const allUsedTags = ref([])

function openTagPicker() {
  allUsedTags.value = getUsedTags('plan')
  showTagPicker.value = true
}
function toggleTag(tagName) {
  const idx = form.value.tags.indexOf(tagName)
  if (idx >= 0) form.value.tags.splice(idx, 1)
  else form.value.tags.push(tagName)
}
function isTagSelected(tagName) {
  return form.value.tags.includes(tagName)
}
function addNewTag() {
  const name = newTagInput.value.trim()
  if (!name) return
  if (form.value.tags.includes(name)) {
    uni.showToast({ title: '标签已存在', icon: 'none' })
    return
  }
  form.value.tags.push(name)
  const newTag = addCustomTag('plan', name)
  // 刷新可选标签列表
  allUsedTags.value = getUsedTags('plan')
  // 清除颜色缓存
  delete tagColorCache[name]
  newTagInput.value = ''
  uni.showToast({ title: '标签已创建', icon: 'success' })
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

function quickSetDue(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  form.value.due_date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function quickSetEst(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  form.value.estimated_time = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function onDueDateChange(e) {
  form.value.due_date = e.detail.value
}

function onDueTimeChange(e) {
  // uni picker mode=time 返回 HH:mm，补上秒
  form.value.due_time = e.detail.value ? e.detail.value + ':00' : ''
}

function onEstDateChange(e) {
  form.value.estimated_time = e.detail.value
}

function onEstTimeChange(e) {
  form.value.estimated_time_value = e.detail.value ? e.detail.value + ':00' : ''
}

/** 快捷设置：现在 */
function quickSetEstNow() {
  const d = new Date()
  form.value.estimated_time = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  form.value.estimated_time_value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`
}

/** 快捷设置：今天结束 (23:59:59) */
function quickSetDueEndOfDay() {
  const d = new Date()
  form.value.due_date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  form.value.due_time = '23:59:59'
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
  // 先从已用标签中找
  const used = allUsedTags.value.find(t => t.name === name)
  if (used?.color) {
    tagColorCache[name] = used.color
    return used.color
  }
  // 再从注册表找
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

      <!-- 预计时间 -->
      <view class="section">
        <text class="section-label">预计开始时间</text>
        <view class="date-row">
          <picker mode="date" :value="form.estimated_time" @change="onEstDateChange">
            <input
              v-model="form.estimated_time"
              class="input-field"
              type="text"
              placeholder="选择日期（可选）"
              disabled
            />
          </picker>
          <picker mode="time" :value="form.estimated_time_value" :end="'23:59:59'" @change="onEstTimeChange">
            <input
              v-model="form.estimated_time_value"
              class="input-field time-picker"
              type="text"
              placeholder="选择时间（可选）"
              disabled
            />
          </picker>
        </view>
        <view class="quick-dates">
          <text class="qd-btn" @tap="quickSetEst(0)">今天</text>
          <text class="qd-btn" @tap="quickSetEst(1)">明天</text>
          <text class="qd-btn" @tap="quickSetEst(3)">3天后</text>
          <text class="qd-btn" @tap="quickSetEstNow">现在</text>
        </view>
      </view>

      <!-- 截止日期 -->
      <view class="section">
        <text class="section-label">截止时间</text>
        <view class="date-row">
          <picker mode="date" :value="form.due_date" @change="onDueDateChange">
            <input
              v-model="form.due_date"
              class="input-field"
              type="text"
              placeholder="选择截止日期（可选）"
              disabled
            />
          </picker>
          <picker mode="time" :value="form.due_time" :end="'23:59:59'" @change="onDueTimeChange">
            <input
              v-model="form.due_time"
              class="input-field time-picker"
              type="text"
              placeholder="选择时间（可选）"
              disabled
            />
          </picker>
        </view>
        <view class="quick-dates">
          <text class="qd-btn" @tap="quickSetDue(3)">3天后</text>
          <text class="qd-btn" @tap="quickSetDue(7)">一周后</text>
          <text class="qd-btn" @tap="quickSetDue(30)">一月后</text>
          <text class="qd-btn" @tap="quickSetDueEndOfDay">今天结束</text>
        </view>
      </view>

      <!-- 提醒设置 -->
      <view class="section">
        <view class="reminder-header">
          <text class="section-label">提醒</text>
          <switch :checked="reminderEnabled" @change="reminderEnabled = $event.detail.value" color="#000000" />
        </view>
        <template v-if="reminderEnabled">
          <view class="reminder-options">
            <text class="reminder-desc">基于截止时间提前提醒</text>
            <view class="reminder-chips">
              <view
                v-for="opt in reminderAdvanceOptions" :key="opt.value"
                class="reminder-chip"
                :class="{ active: reminderAdvanceMin === opt.value && !reminderCustomDate }"
                @tap="reminderAdvanceMin = opt.value; reminderCustomDate = ''; reminderCustomTimeValue = ''"
              >
                {{ opt.label }}
              </view>
            </view>
            <view class="reminder-custom">
              <text class="reminder-custom-label">或指定提醒时间</text>
              <view class="date-row">
                <picker mode="date" :value="reminderCustomDate" @change="reminderCustomDate = $event.detail.value">
                  <input
                    v-model="reminderCustomDate"
                    class="input-field"
                    type="text"
                    placeholder="选择日期"
                    disabled
                  />
                </picker>
                <picker mode="time" :value="reminderCustomTimeValue" @change="reminderCustomTimeValue = $event.detail.value">
                  <input
                    v-model="reminderCustomTimeValue"
                    class="input-field time-picker"
                    type="text"
                    placeholder="选择时间"
                    disabled
                  />
                </picker>
              </view>
              <view v-if="reminderCustomDate" class="quick-dates">
                <text class="qd-btn" @tap="reminderCustomDate = ''; reminderCustomTimeValue = ''">取消自定义</text>
              </view>
            </view>
            <text v-if="!form.due_date && !reminderCustomDate" class="reminder-hint">请先设置截止时间或自定义提醒时间</text>
          </view>
        </template>
      </view>

      <!-- 子计划（嵌套计划） -->
      <view v-if="!isNew" class="section">
        <view class="subtask-header">
          <text class="section-label">子计划</text>
          <view class="add-subplan-btn" @tap="goAddChildPlan">
            <text>+ 添加子计划</text>
          </view>
        </view>
        <view v-if="form.childPlans.length === 0" class="empty-subplan">
          <text class="empty-subplan-text">暂无子计划。你可以为这个计划创建嵌套的子计划，实现更精细的管理。</text>
        </view>
        <view v-else class="child-plan-list">
          <view
            v-for="child in form.childPlans" :key="child.client_id"
            class="child-plan-card"
            @tap="goChildPlan(child.client_id)"
          >
            <view class="cp-top">
              <view class="cp-dot" :style="{ background: priorityColors[child.priority] || '#999' }" />
              <text class="cp-title">{{ child.title }}</text>
              <text class="cp-status" :class="'cp-status-' + child.status">{{ statusMap[child.status] }}</text>
            </view>
            <view v-if="child.due_date" class="cp-due">
              <text class="cp-due-text">截止: {{ child.due_date }}</text>
            </view>
            <view v-if="child.subtasks && child.subtasks.length > 0" class="cp-sub">
              <text class="cp-sub-text">{{ child.subtasks.filter(s => s.done).length }}/{{ child.subtasks.length }} 子任务</text>
            </view>
          </view>
        </view>
      </view>

      <!-- AI 拆解 -->
      <view v-if="form.ai_breakdown" class="section ai-section">
        <view class="section-label"><SijiIcon name="sparkle" size="sm" class="section-icon" /><text>AI 拆解</text></view>
        <text class="ai-text">{{ form.ai_breakdown }}</text>
      </view>

      <!-- 子任务 -->
      <view class="section">
        <view class="subtask-header">
          <text class="section-label">子任务</text>
          <view
            class="ai-breakdown-btn"
            :class="{ loading: aiLoading }"
            @tap="!aiLoading && aiBreakdown()"
          >
            <SijiIcon name="sparkle" size="sm" class="ab-icon" />
            <text class="ab-text">{{ aiLoading ? '拆解中...' : 'AI拆解' }}</text>
          </view>
        </view>

        <!-- 进度条 -->
        <view v-if="subtaskProgress" class="subtask-progress">
          <view class="sp-bar">
            <view class="sp-fill" :style="{ width: subtaskProgress.pct + '%' }" />
          </view>
          <text class="sp-text">{{ subtaskProgress.done }}/{{ subtaskProgress.total }} ({{ subtaskProgress.pct }}%)</text>
        </view>

        <!-- 子任务列表 -->
        <view class="subtask-list">
          <view
            v-for="(s, i) in form.subtasks" :key="i"
            class="subtask-item"
            :class="{ done: s.done }"
          >
            <view class="si-check" @tap="toggleSubtask(i)">
              <text class="si-check-icon">{{ s.done ? '✓' : '○' }}</text>
            </view>
            <input
              v-model="s.title"
              class="si-input"
              placeholder="子任务内容"
              maxlength="50"
            />
            <text class="si-del" @tap="removeSubtask(i)">✕</text>
          </view>
          <view class="add-subtask" @tap="addSubtask">+ 添加子任务</view>
        </view>
      </view>

      <!-- AI 建议 -->
      <view v-if="form.ai_advice" class="section ai-section">
        <view class="section-label"><SijiIcon name="tip" size="sm" class="section-icon" /><text>AI 建议</text></view>
        <text class="ai-text">{{ form.ai_advice }}</text>
      </view>
    </scroll-view>

    <!-- 标签选择弹窗 -->
    <view class="tag-picker-overlay" v-if="showTagPicker" @tap.self="showTagPicker = false">
      <view class="tag-picker">
        <text class="tp-title">选择标签</text>

        <!-- 当前计划标签 -->
        <view class="tp-current" v-if="form.tags.length > 0">
          <view
            v-for="t in form.tags" :key="t"
            class="tag-chip"
            :style="{ background: tagColor(t) + '1a', color: tagColor(t), borderColor: tagColor(t) }"
            @tap="removeTagFromPlan(t)"
          >
            <text class="tc-label">{{ t }}</text>
            <text class="tc-close">✕</text>
          </view>
        </view>

        <!-- 可选标签 -->
        <view class="tp-list">
          <view
            v-for="t in allUsedTags" :key="t.name"
            class="tp-item"
            :class="{ selected: isTagSelected(t.name) }"
            @tap="toggleTag(t.name)"
          >
            <text class="tp-dot" :style="{ background: t.color }">{{ isTagSelected(t.name) ? '✓' : '' }}</text>
            <text class="tp-name">{{ t.name }}</text>
            <text class="tp-count">{{ t.count }}</text>
          </view>
          <view class="tp-empty" v-if="allUsedTags.length === 0">
            <text>暂无标签，输入下方创建</text>
          </view>
        </view>

        <!-- 新建标签 -->
        <view class="tp-input-row">
          <input
            v-model="newTagInput"
            class="tp-input"
            placeholder="输入新标签名..."
            maxlength="20"
            @confirm="addNewTag"
          />
          <text class="tp-add" @tap="addNewTag">创建</text>
        </view>

        <view class="tp-done" @tap="showTagPicker = false">完成</view>
      </view>
    </view>

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

/* 优先级 */
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

/* 状态 */
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

/* 截止日期 */
.date-row {
  .quick-dates {
    display: flex;
    gap: $spacing-sm;
    margin-top: $spacing-sm;

    .qd-btn {
      font-size: $font-xs;
      color: $accent;
      padding: 6rpx 20rpx;
      background: rgba(0, 0, 0, 0.04);
      border-radius: 20rpx;
    }
  }
}

/* AI 区域 */
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

/* 子任务 */
.subtask-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-sm;
}

.ai-breakdown-btn {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 6rpx 20rpx;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 20rpx;

  &.loading { opacity: 0.6; }

  .ab-icon { font-size: 24rpx; }
  .ab-text { font-size: $font-xs; color: $accent; }
}

.subtask-progress {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  margin-bottom: $spacing-md;
}

.sp-bar {
  flex: 1;
  height: 10rpx;
  background: $bg-input;
  border-radius: 5rpx;
  overflow: hidden;
}

.sp-fill {
  height: 100%;
  background: var(--color-ai);
  border-radius: 5rpx;
  transition: width 0.3s;
}

.sp-text {
  font-size: $font-xs;
  color: $text-secondary;
  font-weight: 600;
  min-width: 120rpx;
  text-align: right;
}

.subtask-list { display: flex; flex-direction: column; gap: $spacing-xs; }

.subtask-item {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: 12rpx 0;

  &.done {
    .si-check-icon { color: var(--color-plan); font-weight: 700; }
    .si-input { text-decoration: line-through; color: $text-hint; }
  }
}

.si-check {
  width: 48rpx; height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.si-check-icon {
  font-size: 36rpx;
  color: $text-hint;
}

.si-input {
  flex: 1;
  font-size: $font-sm;
  padding: 8rpx 0;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.04);
}

.si-del {
  font-size: 24rpx;
  color: $danger;
  padding: 8rpx;
  flex-shrink: 0;
}

.add-subtask {
  font-size: $font-sm;
  color: $accent;
  padding: 12rpx 0;
  text-align: center;
  border: 2rpx dashed rgba(0, 0, 0, 0.1);
  border-radius: $radius-sm;
  margin-top: $spacing-xs;
}

/* 时间选择器 */
.time-picker {
  width: 200rpx !important;
  text-align: center;
  font-size: $font-sm !important;
}

/* 子计划区域 */
.add-subplan-btn {
  padding: 6rpx 20rpx;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 20rpx;
  font-size: $font-xs;
  color: $accent;
}

.empty-subplan {
  padding: $spacing-md 0;
  text-align: center;
}

.empty-subplan-text {
  font-size: $font-xs;
  color: $text-hint;
  line-height: 1.6;
}

.child-plan-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.child-plan-card {
  padding: $spacing-sm $spacing-md;
  background: rgba(0, 0, 0, 0.02);
  border-radius: $radius-sm;
  border-left: 4rpx solid $accent;
  transition: all $transition-fast;

  &:active { transform: scale(0.98); }
}

.cp-top {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.cp-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  flex-shrink: 0;
}

.cp-title {
  flex: 1;
  font-size: $font-sm;
  font-weight: 600;
  color: $text-primary;
}

.cp-status {
  font-size: 20rpx;
  padding: 2rpx 12rpx;
  border-radius: 16rpx;
  font-weight: 600;

  &.cp-status-0 { background: rgba(0,0,0,0.05); color: $text-secondary; }
  &.cp-status-1 { background: rgba(0,0,0,0.06); color: $text-primary; }
  &.cp-status-2 { background: rgba(16, 185, 129, 0.1); color: var(--color-plan); }
}

.cp-due, .cp-sub {
  margin-top: 4rpx;
  padding-left: 20rpx;
}

.cp-due-text, .cp-sub-text {
  font-size: 20rpx;
  color: $text-hint;
}

/* 底部 */
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

/* ===== 标签系统 ===== */
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

/* 标签选择弹窗 */
.tag-picker-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 999;
}

.tag-picker {
  width: 100%;
  max-height: 70vh;
  background: var(--bg-card);
  border-radius: $radius-xl $radius-xl 0 0;
  padding: $spacing-md;
  display: flex;
  flex-direction: column;
  box-shadow: $shadow-lg;
}

.tp-title {
  font-size: $font-lg;
  font-weight: 700;
  color: var(--text-primary);
  text-align: center;
  margin-bottom: $spacing-md;
}

.tp-current {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
  margin-bottom: $spacing-md;
  padding-bottom: $spacing-md;
  border-bottom: 1rpx solid rgba(0,0,0,0.06);
}

.tp-list {
  flex: 1;
  overflow-y: auto;
  max-height: 400rpx;
}

.tp-item {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: 18rpx $spacing-sm;
  border-radius: $radius-md;
  margin-bottom: 6rpx;
  transition: all $transition-fast;

  &.selected { background: rgba(0, 0, 0, 0.04); }

  .tp-dot {
    width: 36rpx; height: 36rpx;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 18rpx; color: var(--text-on-ai);
    font-weight: 700;
    flex-shrink: 0;
  }

  .tp-name { flex: 1; font-size: $font-sm; color: var(--text-primary); font-weight: 500; }
  .tp-count { font-size: $font-xs; color: var(--text-hint); }
}

.tp-empty {
  text-align: center;
  padding: $spacing-lg;
  font-size: $font-sm;
  color: var(--text-hint);
}

.tp-input-row {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  margin-top: $spacing-md;
  padding: 0 $spacing-sm;
  padding-top: $spacing-md;
  border-top: 1rpx solid rgba(0,0,0,0.06);

  .tp-input {
    flex: 1;
    height: 72rpx;
    padding: 0 $spacing-md;
    background: var(--bg-input);
    border-radius: $radius-md;
    font-size: $font-sm;
  }

  .tp-add {
    font-size: $font-sm;
    color: var(--color-ai);
    font-weight: 700;
    padding: 0 $spacing-sm;
    flex-shrink: 0;
  }
}

.tp-done {
  margin-top: $spacing-md;
  padding: 24rpx 0;
  text-align: center;
  background: var(--color-ai);
  border-radius: $radius-md;
  color: var(--text-on-ai);
  font-size: $font-md;
  font-weight: 700;
}

/* ─── 提醒设置 ─── */
.reminder-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.reminder-options {
  margin-top: $spacing-sm;
}
.reminder-desc {
  font-size: $font-sm;
  color: var(--text-secondary);
  margin-bottom: $spacing-xs;
  display: block;
}
.reminder-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.reminder-chip {
  padding: 12rpx 28rpx;
  border-radius: $radius-sm;
  border: 1rpx solid var(--border-color);
  font-size: $font-sm;
  color: var(--text-secondary);
  background: var(--bg-card);
  transition: all 0.2s;
}
.reminder-chip.active {
  background: var(--color-ai);
  color: var(--text-on-ai);
  border-color: var(--color-ai);
}
.reminder-custom {
  margin-top: $spacing-md;
  padding-top: $spacing-md;
  border-top: 1rpx solid var(--border-color);
}
.reminder-custom-label {
  font-size: $font-sm;
  color: var(--text-secondary);
  display: block;
  margin-bottom: $spacing-xs;
}
.reminder-hint {
  font-size: $font-xs;
  color: var(--text-hint);
  margin-top: $spacing-xs;
  display: block;
}
</style>
