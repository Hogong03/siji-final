<script setup>
/**
 * Agent 管理页 - 列表页（3.0）
 *
 * 思迹助手（唯一内置）+ Agent 模板（点击创建）+ 我的 Agent
 * 添加/编辑操作跳转至 agent_add.vue 子页面
 */

import { useAppStore } from '@/store/index.js'
import AgentAvatar from '@/components/common/AgentAvatar.vue'
import SijiIcon from '@/components/common/SijiIcon.vue'
import { PRESET_TEMPLATES } from '@/utils/agent-templates.js'

const store = useAppStore()

/* ---- 操作 ---- */
function goAdd() {
  uni.navigateTo({ url: '/pages/settings/sub/agent_add?mode=create' })
}

function goAddFromTemplate(tpl) {
  uni.navigateTo({ url: `/pages/settings/sub/agent_add?mode=create&tpl=${encodeURIComponent(tpl.name)}` })
}

function goEdit(agent) {
  if (agent.builtin) return
  uni.navigateTo({ url: `/pages/settings/sub/agent_add?mode=edit&id=${agent.id}` })
}

function goView(agent) {
  uni.navigateTo({ url: `/pages/settings/sub/agent_add?mode=view&id=${agent.id}` })
}

function handleDelete(agent) {
  uni.showModal({
    title: '删除 Agent',
    content: `确定删除「${agent.name}」吗?`,
    success(res) {
      if (res.confirm) {
        store.deleteAgent(agent.id)
        uni.showToast({ title: '已删除', icon: 'none' })
      }
    }
  })
}

function handleActivate(agent) {
  store.setActiveAgent(agent.id)
  uni.showToast({ title: `已切换至 ${agent.name}`, icon: 'none' })
}
</script>

<template>  <view class="agent-page">
    <scroll-view class="agent-scroll" scroll-y>
      <!-- 思迹助手（唯一内置，固定） -->
      <view class="section-header">
        <text class="section-label">思迹助手</text>
      </view>
      <view
        v-for="agent in store.agents.filter(a => a.builtin)" :key="agent.id"
        class="agent-card"
        :class="{ active: store.activeAgentId === agent.id }"
        @tap="handleActivate(agent)"
      >
        <AgentAvatar :name="agent.name" :icon="agent.icon" :size="72" />
        <view class="agent-info">
          <text class="agent-name">{{ agent.name }}</text>
          <text class="agent-desc">{{ agent.description || '暂无描述' }}</text>
        </view>
        <view v-if="store.activeAgentId === agent.id" class="agent-badge">
          <text class="badge-dot">●</text>
          <text class="badge-text">使用中</text>
        </view>
        <view v-else class="agent-meta" @tap.stop>
          <view class="agent-tag"><text class="tag-text">默认</text></view>
          <text class="action-btn" @tap="goView(agent)">详情</text>
        </view>
      </view>

      <!-- Agent 模板：点击创建 -->
      <view class="section-label tpl-label">Agent 模板（点击创建）</view>
      <view class="template-grid">
        <view
          v-for="tpl in PRESET_TEMPLATES" :key="tpl.name"
          class="template-card"
          @tap="goAddFromTemplate(tpl)"
        >
          <AgentAvatar :name="tpl.name" :icon="tpl.icon" :size="72" />
          <text class="template-name">{{ tpl.name }}</text>
          <text class="template-desc">{{ tpl.description }}</text>
        </view>
      </view>

      <!-- 我的 Agent -->
      <view class="section-header my-header">
        <text class="section-label">我的 Agent</text>
        <text class="section-add-btn" @tap="goAdd">＋ 从空白创建</text>
      </view>
      <view v-if="!store.customAgents.length" class="tips-card empty-tips">
        <text class="tips-text">还没有自定义 Agent：点上方模板创建，或直接对思迹助手说「帮我创建一个 XX Agent」。</text>
      </view>
      <view
        v-for="agent in store.customAgents" :key="agent.id"
        class="agent-card"
        :class="{ active: store.activeAgentId === agent.id }"
        @tap="handleActivate(agent)"
        @longpress="goEdit(agent)"
      >
        <AgentAvatar :name="agent.name" :icon="agent.icon" :size="72" />
        <view class="agent-info">
          <text class="agent-name">{{ agent.name }}</text>
          <text class="agent-desc">{{ agent.description || '暂无描述' }}</text>
        </view>
        <view v-if="store.activeAgentId === agent.id" class="agent-badge">
          <text class="badge-dot">●</text>
          <text class="badge-text">使用中</text>
        </view>
        <view v-else class="agent-actions" @tap.stop>
          <text class="action-btn" @tap="goEdit(agent)">编辑</text>
          <text class="action-btn delete" @tap="handleDelete(agent)">删除</text>
        </view>
      </view>

      <!-- 说明 -->
      <view class="tips-card">
        <view class="tips-title"><SijiIcon name="tip" size="sm" class="tips-icon" /><text>关于 Agent</text></view>
        <text class="tips-text">• 模板创建的 Agent 是自定义助手，可随时编辑或删除</text>
        <text class="tips-text">• 系统提示词决定 Agent 的性格和行为</text>
        <text class="tips-text">• 所有 Agent 共用全局 AI 厂商和模型配置</text>
        <text class="tips-text">• 长按自定义 Agent 可快捷编辑</text>
      </view>

      <view class="scroll-bottom-spacer" />
    </scroll-view>
  </view></template>

<style scoped lang="scss">
@import './agent.scss';
</style>
