<script setup>
/**
 * 首次使用引导 — 多步骤 Onboarding 向导
 *
 * 流程：欢迎 → 配置 API Key → 功能使用引导 → 完成
 * 首次使用（siji_onboarding_done 未置位）在聊天页 onMounted 触发
 */
import { ref, computed, watch } from 'vue'
import { useAppStore } from '@/store/index.js'
import SijiIcon from '@/components/common/SijiIcon.vue'

const props = defineProps({ show: Boolean })
const emit = defineEmits(['finish'])

const store = useAppStore()

// 步骤：0=欢迎 1=API Key 2=功能引导 3=完成
const step = ref(0)
const totalSteps = 4

// 每次打开重置到第一步
watch(() => props.show, (v) => { if (v) step.value = 0 })

const hasKey = computed(() => !!store.providerKeys[store.aiProvider])

function next() {
  if (step.value < totalSteps - 1) step.value++
  else finish()
}

function prev() {
  if (step.value > 0) step.value--
}

function skip() {
  finish()
}

function finish() {
  try { uni.setStorageSync('siji_onboarding_done', '1') } catch {}
  emit('finish')
}

function goConfigAi() {
  uni.navigateTo({ url: '/pages/settings/sub/ai' })
}

const steps = [
  {
    icon: '✨',
    title: '欢迎使用思迹',
    desc: '一个能听懂你说话的 AI 生活助手。\n记账、写记录、做计划、管理关系——\n跟它说话，它帮你做。',
    tip: '所有数据只存在你手机本地，不上传。'
  },
  {
    icon: '🔑',
    title: '配置 AI 服务',
    desc: '思迹需要调用 AI 大模型来理解你的话。\n只需一次配置，即可开始使用。',
    tip: '需要准备一个 DeepSeek / 通义千问 / 智谱 等服务的 API Key（可从对应官网免费或低价获取）。'
  },
  {
    icon: '💬',
    title: '怎么跟它说话',
    desc: '用日常口语就行，它会自动识别并执行：',
    tip: '支持一次性说多件事，例如：\n"买咖啡 15，顺便把今天的记录写了"'
  },
  {
    icon: '🎉',
    title: '准备好了',
    desc: '你现在就可以开始聊天了。\n有任何问题，随时点右上角「?」查看帮助。',
    tip: '配置过程中遇到问题，可以在设置页随时修改。'
  }
]

const featureExamples = [
  { tag: '记账', color: '#F59E0B', text: '"午饭花了 35" → 自动记账' },
  { tag: '记录', color: '#D97706', text: '"今天心情不错" → 自动写记录' },
  { tag: '计划', color: '#10B981', text: '"下周完成报告" → 自动建计划' },
  { tag: '查询', color: '#3B82F6', text: '"这个月花了多少" → 查账单' },
  { tag: '撤销', color: '#EF4444', text: '"撤销刚才的操作" → 回退' },
]
</script>

<template>
  <view v-if="show" class="onb-mask">
    <view class="onb-card">
      <!-- 头部 -->
      <view class="onb-header">
        <view class="onb-dots">
          <view
            v-for="i in totalSteps" :key="i"
            class="onb-dot" :class="{ active: i - 1 <= step }"
          />
        </view>
        <text class="onb-skip" @tap="skip">跳过</text>
      </view>

      <!-- 步骤 0：欢迎 -->
      <view v-if="step === 0" class="onb-body onb-center">
        <view class="onb-icon"><text class="onb-icon-text">{{ steps[0].icon }}</text></view>
        <text class="onb-title">{{ steps[0].title }}</text>
        <text class="onb-desc">{{ steps[0].desc }}</text>
        <view class="onb-tip">
          <SijiIcon name="info" size="sm" color="#71717A" />
          <text class="onb-tip-text">{{ steps[0].tip }}</text>
        </view>
      </view>

      <!-- 步骤 1：配置 API Key -->
      <view v-else-if="step === 1" class="onb-body">
        <view class="onb-icon onb-icon-sm"><text class="onb-icon-text">{{ steps[1].icon }}</text></view>
        <text class="onb-title">{{ steps[1].title }}</text>
        <text class="onb-desc">{{ steps[1].desc }}</text>

        <!-- 配置状态 -->
        <view class="key-status" :class="hasKey ? 'ok' : 'none'">
          <view class="key-dot" :class="hasKey ? 'ok' : 'none'" />
          <text class="key-status-text">{{ hasKey ? '已配置 · 可以开始使用' : '尚未配置 API Key' }}</text>
        </view>

        <view class="onb-tip">
          <SijiIcon name="info" size="sm" color="#71717A" />
          <text class="onb-tip-text">{{ steps[1].tip }}</text>
        </view>

        <view v-if="!hasKey" class="key-actions">
          <view class="onb-btn onb-btn-primary" @tap="goConfigAi">
            <text>去配置 API Key</text>
          </view>
          <view class="onb-btn onb-btn-ghost" @tap="next">
            <text>我已经配置好了</text>
          </view>
        </view>
      </view>

      <!-- 步骤 2：功能引导 -->
      <view v-else-if="step === 2" class="onb-body">
        <view class="onb-icon onb-icon-sm"><text class="onb-icon-text">{{ steps[2].icon }}</text></view>
        <text class="onb-title">{{ steps[2].title }}</text>
        <text class="onb-desc">{{ steps[2].desc }}</text>

        <view class="feature-list">
          <view v-for="(f, idx) in featureExamples" :key="idx" class="feature-item">
            <text class="feature-tag" :style="{ color: f.color, borderColor: f.color }">{{ f.tag }}</text>
            <text class="feature-text">{{ f.text }}</text>
          </view>
        </view>

        <view class="onb-tip">
          <SijiIcon name="info" size="sm" color="#71717A" />
          <text class="onb-tip-text">{{ steps[2].tip }}</text>
        </view>
      </view>

      <!-- 步骤 3：完成 -->
      <view v-else class="onb-body onb-center">
        <view class="onb-icon"><text class="onb-icon-text">{{ steps[3].icon }}</text></view>
        <text class="onb-title">{{ steps[3].title }}</text>
        <text class="onb-desc">{{ steps[3].desc }}</text>
        <view class="onb-tip">
          <SijiIcon name="info" size="sm" color="#71717A" />
          <text class="onb-tip-text">{{ steps[3].tip }}</text>
        </view>
      </view>

      <!-- 底部操作 -->
      <view class="onb-footer">
        <view v-if="step > 0" class="onb-btn onb-btn-ghost" @tap="prev">
          <text>上一步</text>
        </view>
        <view class="onb-btn onb-btn-primary" @tap="next">
          <text>{{ step === totalSteps - 1 ? '开始使用' : '下一步' }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.onb-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx;
  box-sizing: border-box;
  animation: onbFadeIn 0.25s ease both;
}
@keyframes onbFadeIn {
  from { opacity: 0; } to { opacity: 1; }
}

.onb-card {
  width: 100%;
  max-width: 660rpx;
  max-height: 84vh;
  background: #FFFFFF;
  border-radius: 24rpx;
  padding: 32rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  animation: onbSlideIn 0.32s cubic-bezier(0.34, 1.2, 0.64, 1) both;
}
@keyframes onbSlideIn {
  from { opacity: 0; transform: translateY(40rpx) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

/* 深色模式：纯 @media 硬编码覆盖（fixed 组件不依赖 CSS 变量） */

.onb-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
  flex-shrink: 0;
}
.onb-dots {
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.onb-dot {
  width: 16rpx;
  height: 6rpx;
  border-radius: 3rpx;
  background: #E4E4E7;
  transition: all 0.3s ease;
  &.active {
    width: 32rpx;
    background: #18181B;
  }
}
.onb-skip {
  font-size: 24rpx;
  color: #A1A1AA;
  padding: 4rpx 8rpx;
}

.onb-body {
  flex: 1;
  overflow-y: auto;
  box-sizing: border-box;
}
.onb-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  justify-content: center;
}
.onb-icon {
  width: 120rpx;
  height: 120rpx;
  border-radius: 28rpx;
  background: #F4F4F5;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 16rpx auto 24rpx;
  &.onb-icon-sm {
    width: 88rpx;
    height: 88rpx;
    margin: 0 0 20rpx;
  }
}
.onb-icon-text { font-size: 56rpx; }
.onb-icon-sm .onb-icon-text { font-size: 44rpx; }

.onb-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #18181B;
  margin-bottom: 12rpx;
}
.onb-desc {
  font-size: 26rpx;
  color: #3F3F46;
  line-height: 1.7;
  margin-bottom: 20rpx;
  white-space: pre-line;
}

.onb-tip {
  display: flex;
  align-items: flex-start;
  gap: 8rpx;
  background: #F4F4F5;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 20rpx;
}
.onb-tip-text {
  font-size: 22rpx;
  color: #71717A;
  line-height: 1.6;
  flex: 1;
  white-space: pre-line;
}

/* API Key 状态 */
.key-status {
  display: flex;
  align-items: center;
  gap: 12rpx;
  background: #F4F4F5;
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 20rpx;
  &.ok { background: rgba(16, 185, 129, 0.08); }
}
.key-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  flex-shrink: 0;
  &.ok { background: #10B981; }
  &.none { background: #F59E0B; }
}
.key-status-text { font-size: 24rpx; color: #3F3F46; font-weight: 500; }
.key-actions { display: flex; flex-direction: column; gap: 12rpx; }

/* 功能示例 */
.feature-list { display: flex; flex-direction: column; gap: 12rpx; margin-bottom: 20rpx; }
.feature-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  background: #F4F4F5;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
}
.feature-tag {
  flex-shrink: 0;
  font-size: 20rpx;
  font-weight: 600;
  padding: 4rpx 14rpx;
  border-radius: 6rpx;
  border: 1rpx solid;
}
.feature-text { font-size: 22rpx; color: #3F3F46; line-height: 1.5; }

/* 按钮 */
.onb-footer {
  display: flex;
  gap: 12rpx;
  margin-top: 24rpx;
  flex-shrink: 0;
}
.onb-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 88rpx;
  border-radius: 16rpx;
  font-size: 28rpx;
  font-weight: 600;
  transition: opacity 0.15s;
  &:active { opacity: 0.7; }
}
.onb-btn-primary {
  background: #18181B;
  color: #FFFFFF;
}
.onb-btn-ghost {
  background: #F4F4F5;
  color: #3F3F46;
}

/* 深色模式覆盖 */
@media (prefers-color-scheme: dark) {
  .onb-card { background: #18181B; }
  .onb-title { color: #FAFAFA; }
  .onb-desc { color: #F4F4F5; }
  .onb-tip { background: #27272A; }
  .onb-tip-text { color: #A1A1AA; }
  .onb-skip { color: #71717A; }
  .feature-item { background: #27272A; }
  .feature-text { color: #F4F4F5; }
  .key-status { background: #27272A; }
  .key-status-text { color: #F4F4F5; }
  .key-status.ok { background: rgba(16, 185, 129, 0.15); }
  .onb-dot { background: #3F3F46; }
  .onb-dot.active { background: #FAFAFA; }
  .onb-icon { background: #27272A; }
  .onb-btn-primary { background: #FAFAFA; color: #18181B; }
  .onb-btn-ghost { background: #27272A; color: #F4F4F5; }
}
</style>
