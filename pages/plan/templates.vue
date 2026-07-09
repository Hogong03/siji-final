<script setup>
/**
 * 计划模板管理页
 *
 * 功能：
 *  ① 预置模板浏览
 *  ② 一键从模板创建计划
 *  ③ AI 定制模板（描述需求 → AI 拆解子任务 → 保存为模板）
 *  ④ 自定义创建空白模板
 *  ⑤ 模板编辑/删除
 */

import SijiIcon from '@/components/common/SijiIcon.vue'
import { ref, computed, onMounted } from 'vue'
import { getPlanTemplates, savePlanTemplate, deletePlanTemplate } from '@/utils/storage.js'
import { useAppStore } from '@/store/index.js'
import { chatRequest } from '@/utils/api.js'
import { generateEntityId } from '@/utils/uuid.js'

const store = useAppStore()
const templates = ref([])
const showAI = ref(false)
const showCustom = ref(false)
const aiInput = ref('')
const aiLoading = ref(false)
const aiPreview = ref(null)

// 自定义模板表单
const customForm = ref({
  name: '',
  icon: '📋',
  color: '#000000',
  description: '',
  priority: 2,
  subtasks: ['']
})

const iconOptions = ['📋', '🏃', '📚', '✈️', '🎓', '🌅', '💼', '💰', '🏠', '🎮', '✨', '🎯']
const colorOptions = ['#000000', '#10B981', '#E8A838', '#D35D5D', '#F5A623', '#3F3F46']
const priorityOptions = [
  { label: '普通', value: 0, color: '#999' },
  { label: '重要', value: 1, color: '#E8A838' },
  { label: '紧急', value: 2, color: '#D35D5D' }
]

onMounted(() => { loadTemplates() })

function loadTemplates() {
  templates.value = getPlanTemplates()
}

/** 从模板创建计划 */
function useTemplate(tpl) {
  uni.showModal({
    title: '使用模板',
    content: `从「${tpl.name}」创建计划？`,
    success(res) {
      if (res.confirm) {
        const plan = store.createPlanFromTemplate(tpl)
        uni.showToast({ title: '计划已创建', icon: 'success' })
        setTimeout(() => {
          uni.redirectTo({ url: `/pages/plan/detail?clientId=${plan.client_id}` })
        }, 800)
      }
    }
  })
}

/** AI 生成模板 */
async function generateAI() {
  if (!aiInput.value.trim()) {
    uni.showToast({ title: '请描述你想要的计划模板', icon: 'none' })
    return
  }

  if (!store.hasApiKey) {
    uni.showToast({ title: '请先在设置页配置 API Key', icon: 'none' })
    return
  }

  aiLoading.value = true
  aiPreview.value = null

  try {
    const prompt = `你是计划模板生成器。用户想创建一个计划模板，请根据描述智能拆解为3-8个可执行的子任务。

用户描述：${aiInput.value}

请返回 JSON：
{
  "name": "模板名称（≤12字）",
  "icon": "合适的emoji图标",
  "color": "十六进制颜色（如 #000000）",
  "description": "模板描述（≤40字）",
  "priority": 1-3（1高2中3低）,
  "subtasks": [{ "title": "子任务1" }, { "title": "子任务2" }]
}

注意：子任务要具体、可执行、有逻辑顺序。只返回 JSON，不要其他内容。`

    const result = await chatRequest(prompt, null, '', store.aiConfig.apiKey)
    const raw = result.reply || ''
    let parsed
    try { parsed = JSON.parse(raw) } catch {
      // 尝试提取 JSON
      const m = raw.match(/\{[\s\S]*\}/)
      if (m) parsed = JSON.parse(m[0])
      else throw new Error('AI 返回格式错误')
    }

    aiPreview.value = {
      name: parsed.name || '自定义模板',
      icon: parsed.icon || '📋',
      color: parsed.color || '#000000',
      description: parsed.description || '',
      priority: typeof parsed.priority === 'number' ? parsed.priority : 2,
      subtasks: Array.isArray(parsed.subtasks) ? parsed.subtasks.map(s => ({
        title: typeof s === 'string' ? s : (s.title || '')
      })) : []
    }
  } catch (e) {
    uni.showToast({ title: e.message || 'AI 生成失败', icon: 'none' })
  } finally {
    aiLoading.value = false
  }
}

/** 保存 AI 预览为模板 */
function saveAIPreview() {
  if (!aiPreview.value) return
  const tpl = {
    client_id: generateEntityId('tpl'),
    name: aiPreview.value.name,
    icon: aiPreview.value.icon,
    color: aiPreview.value.color,
    description: aiPreview.value.description,
    plan_data: {
      priority: aiPreview.value.priority,
      subtasks: aiPreview.value.subtasks
    },
    created_at: Date.now(),
    updated_at: Date.now(),
    is_deleted: 0
  }
  savePlanTemplate(tpl)
  loadTemplates()
  aiPreview.value = null
  aiInput.value = ''
  showAI.value = false
  uni.showToast({ title: '模板已保存', icon: 'success' })
}

/** 保存自定义模板 */
function saveCustom() {
  if (!customForm.value.name.trim()) {
    uni.showToast({ title: '请输入模板名称', icon: 'none' })
    return
  }
  const subtasks = customForm.value.subtasks
    .map(s => s.trim())
    .filter(s => s)
    .map(s => ({ title: s }))

  if (subtasks.length === 0) {
    uni.showToast({ title: '至少添加一个子任务', icon: 'none' })
    return
  }

  const tpl = {
    client_id: generateEntityId('tpl'),
    name: customForm.value.name.trim(),
    icon: customForm.value.icon,
    color: customForm.value.color,
    description: customForm.value.description.trim(),
    plan_data: {
      priority: customForm.value.priority,
      subtasks
    },
    created_at: Date.now(),
    updated_at: Date.now(),
    is_deleted: 0
  }
  savePlanTemplate(tpl)
  loadTemplates()
  showCustom.value = false
  // 重置表单
  customForm.value = { name: '', icon: '📋', color: '#000000', description: '', priority: 2, subtasks: [''] }
  uni.showToast({ title: '模板已保存', icon: 'success' })
}

/** 删除模板 */
function removeTemplate(tpl) {
  uni.showModal({
    title: '删除模板',
    content: `确定删除「${tpl.name}」？`,
    success(res) {
      if (res.confirm) {
        deletePlanTemplate(tpl.client_id)
        loadTemplates()
        uni.showToast({ title: '已删除', icon: 'success' })
      }
    }
  })
}

function addSubtask() {
  customForm.value.subtasks.push('')
}

function removeSubtask(idx) {
  if (customForm.value.subtasks.length > 1) {
    customForm.value.subtasks.splice(idx, 1)
  }
}
</script>

<template>
  <view class="tpl-page">
    <!-- 顶部操作 -->
    <view class="top-bar">
      <view class="top-btn ai-btn" @tap="showAI = true">
        <SijiIcon name="ai" size="md" class="tb-icon" />
        <text class="tb-text">AI 定制模板</text>
      </view>
      <view class="top-btn" @tap="showCustom = true">
        <SijiIcon name="edit" size="md" class="tb-icon" />
        <text class="tb-text">自定义模板</text>
      </view>
    </view>

    <!-- 模板列表 -->
    <scroll-view class="tpl-scroll" scroll-y>
      <view class="section-title">模板库（{{ templates.length }}）</view>

      <view v-if="templates.length === 0" class="empty">
        <SijiIcon name="plan" size="xl" class="empty-icon" />
        <text class="empty-text">还没有模板，试试 AI 定制吧</text>
      </view>

      <view v-else class="tpl-grid">
        <view
          v-for="tpl in templates" :key="tpl.client_id"
          class="tpl-card"
        >
          <view class="tpl-header" :style="{ background: tpl.color || '#000000' }">
            <text class="tpl-icon">{{ tpl.icon || '📋' }}</text>
            <text class="tpl-name">{{ tpl.name }}</text>
          </view>
          <view class="tpl-body">
            <text class="tpl-desc" v-if="tpl.description">{{ tpl.description }}</text>
            <view class="tpl-subtasks">
              <view v-for="(s, i) in (tpl.plan_data?.subtasks || [])" :key="i" class="st-item">
                <text class="st-bullet">·</text>
                <text class="st-title">{{ s.title || s }}</text>
              </view>
            </view>
          </view>
          <view class="tpl-footer">
            <view class="tpl-use" @tap="useTemplate(tpl)">使用</view>
            <view class="tpl-del" @tap="removeTemplate(tpl)">删除</view>
          </view>
        </view>
      </view>

      <view style="height: 120rpx" />
    </scroll-view>

    <!-- AI 定制弹窗 -->
    <view v-if="showAI" class="modal-mask" @tap="showAI = false">
      <view class="modal-content ai-modal" @tap.stop>
        <view class="modal-header">
          <view class="modal-title"><SijiIcon name="ai" size="sm" /><text>AI 定制模板</text></view>
          <text class="modal-close" @tap="showAI = false">✕</text>
        </view>

        <view v-if="!aiPreview" class="ai-input-section">
          <textarea
            v-model="aiInput"
            class="ai-textarea"
            placeholder="描述你想要的计划模板，例如：&#10;「一个月减脂5斤的训练和饮食计划」&#10;「准备跳槽换工作的两周计划」"
            :maxlength="500"
            :auto-height="true"
          />
          <view class="ai-examples">
            <text class="ex-label">试试这些：</text>
            <view class="ex-tags">
              <text class="ex-tag" @tap="aiInput = '一个月减脂5斤的训练和饮食计划'">减脂计划</text>
              <text class="ex-tag" @tap="aiInput = '准备跳槽换工作的两周计划'">跳槽准备</text>
              <text class="ex-tag" @tap="aiInput = '学习Python数据分析的30天计划'">学Python</text>
            </view>
          </view>
          <view class="ai-btn-row">
            <view
              class="gen-btn"
              :class="{ loading: aiLoading }"
              @tap="!aiLoading && generateAI()"
            >
              <template v-if="aiLoading">AI 思考中...</template> <template v-else><SijiIcon name="sparkle" size="sm" /> 生成模板</template>
            </view>
          </view>
        </view>

        <!-- AI 预览 -->
        <scroll-view v-else class="ai-preview" scroll-y>
          <view class="preview-card" :style="{ borderColor: aiPreview.color }">
            <view class="preview-header" :style="{ background: aiPreview.color }">
              <text class="preview-icon">{{ aiPreview.icon }}</text>
              <text class="preview-name">{{ aiPreview.name }}</text>
            </view>
            <text class="preview-desc" v-if="aiPreview.description">{{ aiPreview.description }}</text>
            <view class="preview-subtasks">
              <text class="ps-label">子任务（{{ aiPreview.subtasks.length }}）</text>
              <view v-for="(s, i) in aiPreview.subtasks" :key="i" class="ps-item">
                <text class="ps-num">{{ i + 1 }}</text>
                <text class="ps-title">{{ s.title }}</text>
              </view>
            </view>
          </view>
          <view class="preview-actions">
            <view class="pa-btn discard" @tap="aiPreview = null">重新生成</view>
            <view class="pa-btn confirm" @tap="saveAIPreview">保存模板</view>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 自定义模板弹窗 -->
    <view v-if="showCustom" class="modal-mask" @tap="showCustom = false">
      <view class="modal-content" @tap.stop>
        <view class="modal-header">
          <view class="modal-title"><SijiIcon name="edit" size="sm" /><text>自定义模板</text></view>
          <text class="modal-close" @tap="showCustom = false">✕</text>
        </view>

        <scroll-view class="custom-scroll" scroll-y>
          <!-- 名称 -->
          <view class="form-section">
            <text class="form-label">模板名称</text>
            <input v-model="customForm.name" class="form-input" placeholder="如：晨间惯例" maxlength="12" />
          </view>

          <!-- 图标 -->
          <view class="form-section">
            <text class="form-label">图标</text>
            <view class="icon-row">
              <view
                v-for="icon in iconOptions" :key="icon"
                class="icon-pick"
                :class="{ active: customForm.icon === icon }"
                @tap="customForm.icon = icon"
              >{{ icon }}</view>
            </view>
          </view>

          <!-- 颜色 -->
          <view class="form-section">
            <text class="form-label">颜色</text>
            <view class="color-row">
              <view
                v-for="c in colorOptions" :key="c"
                class="color-pick"
                :class="{ active: customForm.color === c }"
                :style="{ background: c }"
                @tap="customForm.color = c"
              />
            </view>
          </view>

          <!-- 描述 -->
          <view class="form-section">
            <text class="form-label">描述</text>
            <input v-model="customForm.description" class="form-input" placeholder="模板简介" maxlength="40" />
          </view>

          <!-- 优先级 -->
          <view class="form-section">
            <text class="form-label">默认优先级</text>
            <view class="prio-row">
              <view
                v-for="p in priorityOptions" :key="p.value"
                class="prio-pick"
                :class="{ active: customForm.priority === p.value }"
                :style="customForm.priority === p.value ? { background: p.color, color: '#fff' } : { borderColor: p.color, color: p.color }"
                @tap="customForm.priority = p.value"
              >{{ p.label }}</view>
            </view>
          </view>

          <!-- 子任务 -->
          <view class="form-section">
            <text class="form-label">子任务</text>
            <view
              v-for="(s, i) in customForm.subtasks" :key="i"
              class="subtask-input-row"
            >
              <text class="si-num">{{ i + 1 }}</text>
              <input
                v-model="customForm.subtasks[i]"
                class="si-input"
                :placeholder="`子任务 ${i + 1}`"
                maxlength="30"
              />
              <text
                v-if="customForm.subtasks.length > 1"
                class="si-del"
                @tap="removeSubtask(i)"
              >✕</text>
            </view>
            <view class="add-subtask" @tap="addSubtask">+ 添加子任务</view>
          </view>

          <view style="height: 120rpx" />
        </scroll-view>

        <view class="modal-footer">
          <view class="mf-btn save" @tap="saveCustom">保存模板</view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.tpl-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: $bg-page;
}

/* 顶部操作 */
.top-bar {
  display: flex;
  gap: $spacing-sm;
  padding: $spacing-md;
}

.top-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 20rpx 0;
  background: $bg-card;
  border-radius: $radius-md;
  box-shadow: $shadow-sm;
}

.ai-btn {
  background: var(--color-ai);
}

.ai-btn .tb-text { color: var(--text-on-ai); }

.tb-icon { font-size: 32rpx; }
.tb-text { font-size: $font-sm; font-weight: 600; color: $text-primary; }

/* 列表 */
.tpl-scroll {
  flex: 1;
  padding: 0 $spacing-md;
}

.section-title {
  font-size: $font-md;
  font-weight: 700;
  color: $text-primary;
  margin-bottom: $spacing-md;
  margin-top: $spacing-sm;
}

.empty {
  text-align: center;
  padding: 80rpx 0;
}

.empty-icon { font-size: 80rpx; display: block; }
.empty-text { font-size: $font-sm; color: $text-secondary; margin-top: $spacing-sm; display: block; }

.tpl-grid {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.tpl-card {
  background: $bg-card;
  border-radius: $radius-lg;
  overflow: hidden;
  box-shadow: $shadow-sm;
}

.tpl-header {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-md;
}

.tpl-icon { font-size: 40rpx; }
.tpl-name { font-size: $font-lg; font-weight: 700; color: var(--text-on-ai); }

.tpl-body {
  padding: $spacing-md;
}

.tpl-desc {
  font-size: $font-sm;
  color: $text-secondary;
  margin-bottom: $spacing-sm;
  display: block;
}

.tpl-subtasks {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.st-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.st-bullet { color: $accent; font-weight: 700; }
.st-title { font-size: $font-sm; color: $text-primary; }

.tpl-footer {
  display: flex;
  border-top: 1rpx solid rgba(0, 0, 0, 0.05);
}

.tpl-use, .tpl-del {
  flex: 1;
  text-align: center;
  padding: 20rpx 0;
  font-size: $font-sm;
  font-weight: 600;
}

.tpl-use { color: $accent; }
.tpl-del { color: $danger; border-left: 1rpx solid rgba(0, 0, 0, 0.05); }

/* 弹窗通用 */
.modal-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}

.modal-content {
  width: 100%;
  max-height: 85vh;
  background: $bg-card;
  border-radius: 32rpx 32rpx 0 0;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-md;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.05);
}

.modal-title { font-size: $font-lg; font-weight: 700; }
.modal-close { font-size: 32rpx; color: $text-hint; padding: 8rpx; }

/* AI 输入 */
.ai-input-section { padding: $spacing-md; }

.ai-textarea {
  width: 100%;
  min-height: 160rpx;
  padding: $spacing-md;
  background: $bg-input;
  border-radius: $radius-md;
  font-size: $font-md;
  line-height: 1.6;
}

.ai-examples { margin-top: $spacing-md; }

.ex-label { font-size: $font-xs; color: $text-secondary; }

.ex-tags {
  display: flex;
  gap: $spacing-xs;
  margin-top: $spacing-xs;
  flex-wrap: wrap;
}

.ex-tag {
  font-size: $font-xs;
  color: $accent;
  padding: 6rpx 20rpx;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 20rpx;
}

.ai-btn-row { margin-top: $spacing-md; }

.gen-btn {
  text-align: center;
  padding: 24rpx 0;
  background: var(--color-ai);
  color: var(--text-on-ai);
  border-radius: $radius-md;
  font-size: $font-md;
  font-weight: 600;

  &.loading { opacity: 0.6; }
}

/* AI 预览 */
.ai-preview {
  max-height: 60vh;
  padding: $spacing-md;
}

.preview-card {
  border: 2rpx solid;
  border-radius: $radius-lg;
  overflow: hidden;
}

.preview-header {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-md;
}

.preview-icon { font-size: 40rpx; }
.preview-name { font-size: $font-lg; font-weight: 700; color: var(--text-on-ai); }

.preview-desc {
  font-size: $font-sm;
  color: $text-secondary;
  padding: $spacing-md;
  display: block;
}

.preview-subtasks {
  padding: 0 $spacing-md $spacing-md;
}

.ps-label { font-size: $font-xs; color: $text-secondary; margin-bottom: $spacing-sm; display: block; }

.ps-item {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: 8rpx 0;
}

.ps-num {
  width: 36rpx; height: 36rpx;
  border-radius: 50%;
  background: $bg-input;
  font-size: $font-xs;
  color: $text-secondary;
  text-align: center;
  line-height: 36rpx;
  flex-shrink: 0;
}

.ps-title { font-size: $font-sm; color: $text-primary; }

.preview-actions {
  display: flex;
  gap: $spacing-md;
  margin-top: $spacing-md;
}

.pa-btn {
  flex: 1;
  text-align: center;
  padding: 24rpx 0;
  border-radius: $radius-md;
  font-size: $font-md;
  font-weight: 600;
}

.pa-btn.discard { background: $bg-input; color: $text-secondary; }
.pa-btn.confirm { background: $accent; color: var(--text-on-ai); }

/* 自定义表单 */
.custom-scroll {
  flex: 1;
  padding: $spacing-md;
  max-height: 60vh;
}

.form-section { margin-bottom: $spacing-md; }

.form-label {
  font-size: $font-sm;
  color: $text-secondary;
  margin-bottom: $spacing-sm;
  display: block;
}

.form-input {
  font-size: $font-md;
  padding: 16rpx $spacing-sm;
  background: $bg-input;
  border-radius: $radius-sm;
  width: 100%;
}

.icon-row {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
}

.icon-pick {
  width: 64rpx; height: 64rpx;
  text-align: center;
  line-height: 64rpx;
  font-size: 32rpx;
  border-radius: $radius-sm;
  background: $bg-input;

  &.active { background: $accent; }
}

.color-row {
  display: flex;
  gap: $spacing-sm;
}

.color-pick {
  width: 56rpx; height: 56rpx;
  border-radius: 50%;
  border: 4rpx solid transparent;

  &.active { border-color: $text-primary; }
}

.prio-row {
  display: flex;
  gap: $spacing-sm;
}

.prio-pick {
  flex: 1;
  text-align: center;
  padding: 12rpx 0;
  border-radius: $radius-sm;
  font-size: $font-sm;
  border: 2rpx solid;
  transition: all $transition-fast;
}

.subtask-input-row {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  margin-bottom: $spacing-sm;
}

.si-num {
  width: 36rpx; height: 36rpx;
  border-radius: 50%;
  background: $bg-input;
  font-size: $font-xs;
  color: $text-secondary;
  text-align: center;
  line-height: 36rpx;
  flex-shrink: 0;
}

.si-input {
  flex: 1;
  font-size: $font-sm;
  padding: 12rpx $spacing-sm;
  background: $bg-input;
  border-radius: $radius-sm;
}

.si-del { font-size: 24rpx; color: $danger; padding: 8rpx; }

.add-subtask {
  font-size: $font-sm;
  color: $accent;
  padding: 12rpx 0;
  text-align: center;
  border: 2rpx dashed rgba(0, 0, 0, 0.1);
  border-radius: $radius-sm;
}

.modal-footer {
  padding: $spacing-md;
  border-top: 1rpx solid rgba(0, 0, 0, 0.05);
}

.mf-btn.save {
  text-align: center;
  padding: 24rpx 0;
  background: $accent;
  color: var(--text-on-ai);
  border-radius: $radius-md;
  font-size: $font-md;
  font-weight: 600;
}
</style>
