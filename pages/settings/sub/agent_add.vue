<script setup>
/**
 * Agent 添加/编辑页 - 独立子页面
 *
 * URL 参数: mode=create | mode=edit&id=xxx | mode=create&tpl=xxx
 */

import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useAppStore } from '@/store/index.js'
import { safeNavigateBack } from '@/utils/nav-helper.js'
import { SKILL_REGISTRY } from '@/utils/ai/skills.js'
import { PRESET_TEMPLATES } from '@/utils/agent-templates.js'

const store = useAppStore()

/* ---- 状态 ---- */

const editMode = ref('create')
const viewMode = ref(false)
const editForm = ref({
  id: '',
  name: '',
  avatar: '🤖',
  icon: '/static/icons/agent-custom.png',
  description: '',
  systemPrompt: '',
  skills: ['memory']
})

/* ---- 预设头像图标 ---- */
const ICON_OPTIONS = [
  { id: 'agent-siji', label: '助手' },
  { id: 'agent-workplace', label: '职场' },
  { id: 'agent-relationship', label: '情感' },
  { id: 'agent-career', label: '求职' },
  { id: 'agent-psychologist', label: '心理' },
  { id: 'agent-fitness', label: '健身' },
  { id: 'agent-finance', label: '财务' },
  { id: 'agent-study', label: '学习' },
  { id: 'agent-minimal', label: '极简' },
  { id: 'agent-custom', label: '自定义' },
]


/* ---- 初始化 ---- */
onLoad((options) => {
  if ((options.mode === 'edit' || options.mode === 'view') && options.id) {
    const agent = store.agents.find(a => a.id === options.id)
    if (agent) {
      viewMode.value = options.mode === 'view'
      editMode.value = viewMode.value ? 'view' : 'edit'
      editForm.value = {
        id: agent.id,
        name: agent.name,
        avatar: agent.avatar,
        icon: agent.icon || '',
        description: agent.description,
        systemPrompt: agent.systemPrompt,
        skills: agent.skills || ['memory']
      }
      uni.setNavigationBarTitle({ title: viewMode.value ? 'Agent 详情' : '编辑 Agent' })
    } else {
      uni.showToast({ title: 'Agent 不存在', icon: 'none' })
      setTimeout(() => safeNavigateBack(), 500)
    }
  } else if (options.tpl) {
    const tpl = PRESET_TEMPLATES.find(t => t.name === decodeURIComponent(options.tpl))
    if (tpl) {
      editForm.value = {
        id: '', name: tpl.name, avatar: tpl.avatar,
        icon: tpl.icon || '',
        description: tpl.description, systemPrompt: tpl.systemPrompt,
        skills: tpl.skills || ['memory']
      }
    }
    uni.setNavigationBarTitle({ title: '创建 Agent' })
  } else {
    uni.setNavigationBarTitle({ title: '创建 Agent' })
  }
})

/* ---- 操作 ---- */
function skillById(id) {
  return SKILL_REGISTRY.find(x => x.id === id)
}

function toggleSkill(id) {
  const idx = editForm.value.skills.indexOf(id)
  if (idx >= 0) {
    editForm.value.skills.splice(idx, 1)
  } else {
    editForm.value.skills.push(id)
  }
}

function saveAgent() {
  if (!editForm.value.name.trim()) {
    uni.showToast({ title: '请输入名称', icon: 'none' })
    return
  }
  const data = {
    name: editForm.value.name.trim(),
    avatar: editForm.value.avatar,
    icon: editForm.value.icon || '/static/icons/agent-custom.png',
    description: editForm.value.description.trim(),
    systemPrompt: editForm.value.systemPrompt.trim(),
    skills: editForm.value.skills
  }
  if (editMode.value === 'create') {
    const agent = store.createAgent(data)
    store.setActiveAgent(agent.id)
    uni.showToast({ title: '已创建', icon: 'success' })
  } else {
    store.updateAgent(editForm.value.id, data)
    uni.showToast({ title: '已保存', icon: 'success' })
  }
  setTimeout(() => safeNavigateBack(), 500)
}
</script>

<template>
  <view class="agent-add-page">
    <scroll-view class="form-scroll" scroll-y>
      <view class="edit-form">
        <!-- 页面引导 -->
        <view class="form-intro">
          <text class="intro-title">{{ viewMode ? 'Agent 详情' : (editMode === 'edit' ? '编辑 Agent' : '创建新 Agent') }}</text>
          <text class="intro-sub">选择头像、设置名称,编写系统提示词定义 Agent 人设</text>
        </view>

        <!-- 头像选择 -->
        <view class="form-section">
          <text class="form-label">头像</text>
          <view v-if="!viewMode" class="avatar-grid">
            <view
              v-for="opt in ICON_OPTIONS" :key="opt.id"
              class="avatar-option"
              :class="{ active: editForm.icon === `/static/icons/${opt.id}.png` }"
              @tap="editForm.icon = `/static/icons/${opt.id}.png`"
            >
              <image :src="`/static/icons/${opt.id}.png`" mode="aspectFill" class="avatar-option-img" />
              <text class="avatar-option-label">{{ opt.label }}</text>
            </view>
          </view>
          <view v-else class="view-avatar">
            <image v-if="editForm.icon" :src="editForm.icon" mode="aspectFill" class="view-avatar-img" />
            <text v-else class="view-avatar-emoji">{{ editForm.avatar }}</text>
          </view>
        </view>

        <!-- 名称 -->
        <view class="form-section">
          <text class="form-label">名称</text>
          <input
            v-if="!viewMode"
            v-model="editForm.name"
            class="form-input"
            placeholder="给 Agent 取个名字"
            maxlength="20"
          />
          <text v-else class="view-value">{{ editForm.name }}</text>
        </view>

        <!-- 描述 -->
        <view class="form-section">
          <text class="form-label">描述</text>
          <text class="form-hint">简短介绍这个 Agent 的角色定位,在列表中展示</text>
          <textarea
            v-if="!viewMode"
            v-model="editForm.description"
            class="form-textarea form-textarea-sm"
            placeholder="一句话介绍这个 Agent"
            maxlength="100"
            :auto-height="true"
          />
          <text v-if="!viewMode" class="char-count">{{ editForm.description.length }}/100</text>
          <text v-else class="view-value">{{ editForm.description || '暂无描述' }}</text>
        </view>

        <!-- 技能选择 -->
        <view class="form-section">
          <text class="form-label">技能</text>
          <text class="form-hint">选择 Agent 具备的能力，选中后对应的工具和行为规则会注入系统提示词</text>
          <view v-if="!viewMode" class="skill-grid">
            <view
              v-for="skill in SKILL_REGISTRY" :key="skill.id"
              class="skill-option"
              :class="{ active: editForm.skills.includes(skill.id) }"
              @tap="toggleSkill(skill.id)"
            >
              <text class="skill-icon">{{ skill.icon }}</text>
              <text class="skill-name">{{ skill.name }}</text>
              <text class="skill-desc">{{ skill.description }}</text>
            </view>
          </view>
          <view v-else class="view-skills">
            <view v-for="sid in editForm.skills" :key="sid" class="view-skill-chip">
              <text class="view-skill-icon">{{ skillById(sid)?.icon || '' }}</text>
              <text class="view-skill-name">{{ skillById(sid)?.name || sid }}</text>
            </view>
          </view>
        </view>

        <!-- 系统提示词 -->
        <view class="form-section">
          <text class="form-label">系统提示词(人设)</text>
          <text class="form-hint">定义 Agent 的性格、语气和行为规则。留空则使用思迹默认助手人设。</text>
          <textarea
            v-if="!viewMode"
            v-model="editForm.systemPrompt"
            class="form-textarea"
            placeholder="例如:你是一位温暖的心理咨询师,善于倾听和共情..."
            maxlength="3000"
            :auto-height="true"
          />
          <text v-if="!viewMode" class="char-count">{{ editForm.systemPrompt.length }}/3000</text>
          <view v-else class="view-prompt">{{ editForm.systemPrompt || '使用思迹默认人设' }}</view>
        </view>

      </view>
      <!-- 底部占位,防止最后一项被操作栏遮挡 -->
      <view class="scroll-bottom-placeholder" />
    </scroll-view>

    <!-- 固定底部操作栏 -->
    <view class="form-actions-bar">
      <view class="form-actions">
        <button v-if="viewMode" class="btn-cancel" @tap="safeNavigateBack()">返回</button>
        <template v-else>
          <button class="btn-cancel" @tap="safeNavigateBack()">取消</button>
          <button class="btn-save" @tap="saveAgent">保存</button>
        </template>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import './agent_add.scss';
</style>