<script setup>
/**
 * TemplateCard - 单个模板卡片展示组件
 *
 * Props:
 *   template    - 模板对象 { name, icon, color, description, plan_data: { subtasks } }
 *   showActions - 是否显示操作按钮（默认 true）
 *
 * Emits:
 *   use    - 用户点击「使用」
 *   delete - 用户点击「删除」
 */

defineProps({
  template: { type: Object, required: true },
  showActions: { type: Boolean, default: true }
})

defineEmits(['use', 'delete'])
</script>

<template>
  <view class="tpl-card">
    <view class="tpl-header" :style="{ background: template.color || '#000000' }">
      <text class="tpl-icon">{{ template.icon || '📋' }}</text>
      <text class="tpl-name">{{ template.name }}</text>
    </view>
    <view class="tpl-body">
      <text class="tpl-desc" v-if="template.description">{{ template.description }}</text>
      <view class="tpl-subtasks">
        <view v-for="(s, i) in (template.plan_data?.subtasks || [])" :key="i" class="st-item">
          <text class="st-bullet">·</text>
          <text class="st-title">{{ s.title || s }}</text>
        </view>
      </view>
    </view>
    <view v-if="showActions" class="tpl-footer">
      <view class="tpl-use" @tap="$emit('use', template)">使用</view>
      <view class="tpl-del" @tap="$emit('delete', template)">删除</view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
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
</style>
