<script setup>
/**
 * 计划模板管理页
 *
 * 功能：
 *  ① 预置模板浏览 ② 一键从模板创建计划
 *  ③ AI 定制模板 ④ 自定义创建空白模板 ⑤ 模板编辑/删除
 *  ⑥ 搜索 ⑦ 分类筛选
 */

import SijiIcon from '@/components/common/SijiIcon.vue'
import TemplateCard from './components/TemplateCard.vue'
import TemplateForm from './components/TemplateForm.vue'
import { ref, computed, onMounted } from 'vue'
import { getPlanTemplates, savePlanTemplate, deletePlanTemplate } from '@/utils/storage.js'
import { useAppStore } from '@/store/index.js'
import { generateEntityId } from '@/utils/uuid.js'
import { useTemplateAI } from './composables/useTemplateAI.js'

const store = useAppStore()
const templates = ref([])
const showAI = ref(false)
const showCustom = ref(false)
const editingTemplate = ref(null)
const searchKeyword = ref('')
const activeCategory = ref('all')

const { aiInput, aiLoading, aiPreview, generateAI, saveAIPreview } = useTemplateAI(store)

const categories = [
  { label: '全部', value: 'all' },
  { label: '生活', value: 'life' },
  { label: '工作', value: 'work' },
  { label: '学习', value: 'study' },
  { label: '健康', value: 'health' },
  { label: '自定义', value: 'custom' }
]

onMounted(() => { loadTemplates() })

function loadTemplates() {
  templates.value = getPlanTemplates()
}

const filteredTemplates = computed(() => {
  let list = templates.value
  if (activeCategory.value !== 'all') {
    list = list.filter(t => (t.category || 'custom') === activeCategory.value)
  }
  if (searchKeyword.value.trim()) {
    const kw = searchKeyword.value.trim().toLowerCase()
    list = list.filter(t =>
      (t.name || '').toLowerCase().includes(kw) ||
      (t.description || '').toLowerCase().includes(kw)
    )
  }
  return list
})

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

function saveAIGenerated() {
  const tpl = saveAIPreview()
  if (tpl) loadTemplates()
  showAI.value = false
}

function saveCustom(data) {
  const isEdit = !!editingTemplate.value
  const tpl = {
    client_id: isEdit ? editingTemplate.value.client_id : generateEntityId('tpl'),
    name: data.name,
    icon: data.icon,
    color: data.color,
    description: data.description,
    category: 'custom',
    plan_data: {
      priority: data.priority,
      subtasks: data.subtasks.map(s => ({ title: s }))
    },
    created_at: isEdit ? editingTemplate.value.created_at : Date.now(),
    updated_at: Date.now(),
    is_deleted: 0
  }
  savePlanTemplate(tpl)
  loadTemplates()
  showCustom.value = false
  editingTemplate.value = null
  uni.showToast({ title: isEdit ? '模板已更新' : '模板已保存', icon: 'success' })
}

function editTemplate(tpl) {
  editingTemplate.value = tpl
  showCustom.value = true
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

function closeCustomForm() {
  showCustom.value = false
  editingTemplate.value = null
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
      <view class="top-btn" @tap="showCustom = true; editingTemplate = null">
        <SijiIcon name="edit" size="md" class="tb-icon" />
        <text class="tb-text">自定义模板</text>
      </view>
    </view>

    <!-- 搜索 + 分类 -->
    <view class="filter-bar">
      <view class="search-box">
        <SijiIcon name="search" size="sm" class="search-icon" />
        <input v-model="searchKeyword" class="search-input" placeholder="搜索模板..." :placeholder-style="'color: #A1A1AA'" />
        <text v-if="searchKeyword" class="search-clear" @tap="searchKeyword = ''">✕</text>
      </view>
      <scroll-view class="cat-scroll" scroll-x :show-scrollbar="false">
        <view class="cat-row">
          <view
            v-for="cat in categories" :key="cat.value"
            class="cat-item"
            :class="{ active: activeCategory === cat.value }"
            @tap="activeCategory = cat.value"
          >{{ cat.label }}</view>
        </view>
      </scroll-view>
    </view>

    <!-- 模板列表 -->
    <scroll-view class="tpl-scroll" scroll-y>
      <view class="section-title">模板库（{{ filteredTemplates.length }}）</view>

      <view v-if="filteredTemplates.length === 0" class="empty">
        <SijiIcon name="plan" size="xl" class="empty-icon" />
        <text class="empty-text">{{ searchKeyword || activeCategory !== 'all' ? '没有匹配的模板' : '还没有模板，试试 AI 定制吧' }}</text>
      </view>

      <view v-else class="tpl-grid">
        <TemplateCard
          v-for="tpl in filteredTemplates" :key="tpl.client_id"
          :template="tpl"
          @use="useTemplate"
          @edit="editTemplate"
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
            <view class="gen-btn" :class="{ loading: aiLoading }" @tap="!aiLoading && generateAI()">
              <template v-if="aiLoading">AI 思考中...</template>
              <template v-else><SijiIcon name="sparkle" size="sm" /> 生成模板</template>
            </view>
          </view>
        </view>

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
            <view class="pa-btn confirm" @tap="saveAIGenerated">保存模板</view>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 自定义模板弹窗（组件） -->
    <TemplateForm
      :visible="showCustom"
      :isEdit="!!editingTemplate"
      :editData="editingTemplate"
      @close="closeCustomForm"
      @save="saveCustom"
    />
  </view>
</template>

<style scoped lang="scss">
@import './templates.scss';
</style>
