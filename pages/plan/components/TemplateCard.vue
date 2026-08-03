<script setup>
defineProps({
  template: { type: Object, required: true },
  showActions: { type: Boolean, default: true }
})
defineEmits(['use', 'delete'])
</script>

<template>
  <view class="tpl-card">
    <view class="tpl-header" :style="{ background: template.color || '#18181B' }">
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

<style scoped lang="scss">
.tpl-card {
  background: #FFFFFF;
  border-radius: 12rpx;
  overflow: hidden;
}

.tpl-header {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx 20rpx;
}

.tpl-icon { font-size: 36rpx; }
.tpl-name { font-size: 30rpx; font-weight: 700; color: #FFFFFF; }

.tpl-body {
  padding: 16rpx 20rpx;
}

.tpl-desc {
  font-size: 24rpx;
  color: #71717A;
  margin-bottom: 8rpx;
  display: block;
}

.tpl-subtasks {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.st-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.st-bullet { color: #18181B; font-weight: 700; }
.st-title { font-size: 24rpx; color: #18181B; }

.tpl-footer {
  display: flex;
  border-top: 1rpx solid #E4E4E7;
}

.tpl-use, .tpl-del {
  flex: 1;
  text-align: center;
  padding: 16rpx 0;
  font-size: 26rpx;
  font-weight: 600;
}

.tpl-use { color: #18181B; }
.tpl-del { color: #EF4444; border-left: 1rpx solid #E4E4E7; }

@media (prefers-color-scheme: dark) {
  .tpl-card { background: #27272A; }
  .tpl-name { color: #FFFFFF; }
  .tpl-desc { color: #A1A1AA; }
  .st-bullet { color: #FAFAFA; }
  .st-title { color: #FAFAFA; }
  .tpl-footer { border-top-color: #3F3F46; }
  .tpl-use { color: #FAFAFA; }
  .tpl-del { color: #EF4444; border-left-color: #3F3F46; }
}
</style>
