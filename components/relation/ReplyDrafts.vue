<script setup>
/**
 * ReplyDrafts — 回一条（3.5.14）
 *
 * 三条「可以延后，但不会消失」的草稿，点一下复制；也可以把要求复制去对话让思迹起草。
 * 不写检讨、不催「你应该多联系」——只给一条能发出去的句子。
 */
import { ref, computed } from 'vue'
import { buildReplyDrafts, buildReplyPrompt } from '@/utils/social-quota.js'

const props = defineProps({
  relation: { type: Object, default: () => ({}) }
})

const opened = ref(false)

const drafts = computed(() => buildReplyDrafts({
  name: props.relation.name || '',
  role: props.relation.role || '',
  scene: props.relation.context || ''
}))

function copyText(text, tip) {
  uni.setClipboardData({
    data: text,
    success: () => uni.showToast({ title: tip, icon: 'none' })
  })
}

function askAi() {
  const prompt = buildReplyPrompt({
    name: props.relation.name || '',
    role: props.relation.role || '',
    scene: props.relation.context || ''
  })
  uni.setClipboardData({
    data: prompt,
    success: () => {
      uni.$emit('prefill-input', prompt)
      uni.switchTab({ url: '/pages/chat/index' })
    }
  })
}
</script>

<template>
  <view class="drafts">
    <view class="drafts-header">
      <text class="drafts-title">回一条</text>
      <text class="drafts-toggle" @tap="opened = !opened">{{ opened ? '收起' : '帮我起一句' }}</text>
    </view>

    <view v-if="opened" class="drafts-body">
      <view v-for="item in drafts" :key="item.id" class="draft-item">
        <view class="draft-top">
          <text class="draft-label">{{ item.label }}</text>
          <text class="draft-copy" @tap="copyText(item.text, '已复制')">复制</text>
        </view>
        <text class="draft-text">{{ item.text }}</text>
      </view>
      <text class="drafts-ai" @tap="askAi">换一条更贴合的：让思迹起草</text>
      <text class="drafts-hint">草稿只负责让你不用现在回，也不会让这件事消失。</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.drafts {
  margin-top: $spacing-lg;
  padding: $spacing-md;
  background: #F4F4F5;
  border-radius: $radius-md;
}

.drafts-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.drafts-title {
  font-size: $font-md;
  font-weight: 600;
  color: #18181B;
}

.drafts-toggle {
  font-size: $font-sm;
  color: #18181B;
  font-weight: 600;
}

.drafts-body {
  margin-top: $spacing-md;
}

.draft-item {
  padding: $spacing-sm $spacing-md;
  background: #FFFFFF;
  border-radius: $radius-sm;
  margin-bottom: $spacing-sm;
}

.draft-top {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.draft-label {
  font-size: $font-xs;
  color: #A1A1AA;
}

.draft-copy {
  font-size: $font-xs;
  color: #18181B;
  font-weight: 600;
}

.draft-text {
  display: block;
  margin-top: $spacing-xs;
  font-size: $font-sm;
  color: #3F3F46;
  line-height: 1.6;
}

.drafts-ai {
  display: block;
  margin-top: $spacing-sm;
  font-size: $font-sm;
  color: #18181B;
  font-weight: 600;
}

.drafts-hint {
  display: block;
  margin-top: $spacing-xs;
  font-size: $font-xs;
  color: #A1A1AA;
  line-height: 1.5;
}

@media (prefers-color-scheme: dark) {
  .drafts {
    background: #27272A;
  }

  .drafts-title,
  .drafts-toggle,
  .draft-copy,
  .drafts-ai {
    color: #FAFAFA;
  }

  .draft-item {
    background: #18181B;
  }

  .draft-text {
    color: #D4D4D8;
  }
}
</style>
