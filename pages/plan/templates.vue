<script setup>
/**
 * 计划模板管理页
 *
 * 功能：
 *  ① 预置模板浏览 ② 一键从模板创建计划
 *  ③ AI 定制模板 ④ 自定义创建空白模板 ⑤ 模板编辑/删除
 *
 * UI 组件：TemplateCard（卡片）, TemplateForm（自定义表单）
 */

import SijiIcon from '@/components/common/SijiIcon.vue'
import TemplateCard from './components/TemplateCard.vue'
import TemplateForm from './components/TemplateForm.vue'
import { ref, onMounted } from 'vue'
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

onMounted(() => { loadTemplates() })

function loadTemplates() {
  templates.value = getPlanTemplates()
}

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
  "color": "十六进制颜色（如 #18181B）",
  "description": "模板描述（≤40字）",
  "priority": 1-3（1高2中3低）,
  "subtasks": [{ "title": "子任务1" }, { "title": "子任务2" }]
}

注意：子任务要具体、可执行、有逻辑顺序。只返回 JSON，不要其他内容。`

    const result = await chatRequest(prompt, null, '', store.aiConfig.apiKey)
    const raw = result.reply || ''
    let parsed
    try { parsed = JSON.parse(raw) } catch {
      const m = raw.match(/\{[\s\S]*\}/)
      if (m) parsed = JSON.parse(m[0])
      else throw new Error('AI 返回格式错误')
    }
    aiPreview.value = {
      name: parsed.name || '自定义模板',
      icon: parsed.icon || '📋',
      color: parsed.color || '#18181B',
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

/** 从 TemplateForm 的 save 事件保存模板 */
function saveCustom(data) {
  const tpl = {
    client_id: generateEntityId('tpl'),
    name: data.name,
    icon: data.icon,
    color: data.color,
    description: data.description,
    plan_data: {
      priority: data.priority,
      subtasks: data.subtasks.map(s => ({ title: s }))
    },
    created_at: Date.now(),
    updated_at: Date.now(),
    is_deleted: 0
  }
  savePlanTemplate(tpl)
  loadTemplates()
  showCustom.value = false
  uni.showToast({ title: '模板已保存', icon: 'success' })
}

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
        <TemplateCard
          v-for="tpl in templates" :key="tpl.client_id"
          :template="tpl"
          @use="useTemplate"
          @delete="removeTemplate"
        />
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
              <template v-if="aiLoading">AI 思考中...</template>
              <template v-else><SijiIcon name="sparkle" size="sm" /> 生成模板</template>
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

    <!-- 自定义模板弹窗（组件） -->
    <TemplateForm
      :visible="showCustom"
      @close="showCustom = false"
      @save="saveCustom"
    />
  </view>
</template>

<style scoped lang="scss">
@import './templates.scss';
</style>