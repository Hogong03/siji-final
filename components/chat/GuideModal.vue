<script setup>
/**
 * AI 使用说明 Modal
 */
import SijiIcon from '@/components/common/SijiIcon.vue'

defineProps({ show: Boolean })
const emit = defineEmits(['close'])

function goToFullHelp() { emit('close'); uni.navigateTo({ url: '/pages/settings/sub/about' }) }
</script>

<template>
  <view v-if="show" class="modal-mask" @tap="$emit('close')">
    <view class="modal-container" @tap.stop>
      <view class="modal-header">
        <text class="modal-title">使用说明</text>
        <view class="modal-close" @tap="$emit('close')"><SijiIcon name="close" size="md" /></view>
      </view>
      <scroll-view class="modal-body" scroll-y>
        <view class="guide-section">
          <text class="guide-section-title">说话示例</text>
        </view>
        <view class="guide-item">
          <text class="gi-tag bill">记账</text>
          <text class="gi-text">"午饭花了35" → 自动记账</text>
        </view>
        <view class="guide-item">
          <text class="gi-tag diary">记录</text>
          <text class="gi-text">"今天心情不错" → 自动写记录</text>
        </view>
        <view class="guide-item">
          <text class="gi-tag plan">计划</text>
          <text class="gi-text">"下周完成报告" → 自动建计划</text>
        </view>
        <view class="guide-item">
          <text class="gi-tag multi">复合</text>
          <text class="gi-text">"买咖啡15,顺便定健身计划" → 同时执行</text>
        </view>
        <view class="guide-item">
          <text class="gi-tag query">查询</text>
          <text class="gi-text">"这个月花了多少" → 查账单</text>
        </view>
        <view class="guide-item">
          <text class="gi-tag undo">撤销</text>
          <text class="gi-text">"撤销刚才的操作" → 回退</text>
        </view>
        <view class="guide-section">
          <text class="guide-section-title">小贴士</text>
        </view>
        <view class="guide-tip">
          <text>· 快捷短语点击追加文本,不会覆盖已输入内容</text>
        </view>
        <view class="guide-tip">
          <text>· 点击记账/记录/计划按钮插入标签,可多次插入</text>
        </view>
        <view class="guide-tip">
          <text>· 金额 ≥ 500 元需确认,防误操作</text>
        </view>
        <view class="guide-tip">
          <text>· 执行结果可编辑,点击「查看 →」跳转详情</text>
        </view>
        <view class="guide-more" @tap="goToFullHelp">
          <text>查看完整使用说明 ›</text>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.modal-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: maskFadeIn 0.2s ease both;
}
.modal-container {
  width: 86%;
  max-width: 640rpx;
  max-height: 72vh;
  background: #FFFFFF;
  border-radius: 16rpx;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  animation: modalSlideIn 0.3s cubic-bezier(0.34, 1.2, 0.64, 1) both;
}
@keyframes modalSlideIn {
  from { opacity: 0; transform: translateY(40rpx) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes maskFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 32rpx;
  border-bottom: 1rpx solid #E4E4E7;
  flex-shrink: 0;
  box-sizing: border-box;
  .modal-title {
    font-size: 32rpx;
    font-weight: 700;
    color: #000000;
    flex: 1;
    min-width: 0;
  }
  .modal-close {
    padding: 0 8rpx;
    flex-shrink: 0;
  }
}
.modal-body {
  padding: 24rpx 32rpx;
  flex: 1;
  overflow-y: auto;
  box-sizing: border-box;
}
.guide-section {
  margin-top: 16rpx;
  margin-bottom: 4rpx;
  .guide-section-title {
    font-size: 22rpx;
    font-weight: 700;
    color: #71717A;
    text-transform: uppercase;
    letter-spacing: 1rpx;
  }
  &:first-child { margin-top: 0; }
}
.guide-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 8rpx 0;
  border-bottom: 1rpx solid #E4E4E7;
  &:last-of-type { border-bottom: none; }
  .gi-tag {
    flex-shrink: 0;
    font-size: 20rpx;
    font-weight: 600;
    padding: 4rpx 14rpx;
    border-radius: 4rpx;
    min-width: 56rpx;
    text-align: center;
    &.bill { background: #E4E4E7; color: #F59E0B; }
    &.diary { background: #E4E4E7; color: #D97706; }
    &.plan { background: #E4E4E7; color: #10B981; }
    &.multi { background: #E4E4E7; color: #18181B; }
    &.query { background: #E4E4E7; color: #3B82F6; }
    &.undo { background: #E4E4E7; color: #EF4444; }
  }
  .gi-text {
    flex: 1;
    font-size: 22rpx;
    color: #3F3F46;
    line-height: 1.6;
  }
}
.guide-tip {
  padding: 6rpx 0;
  text {
    font-size: 22rpx;
    color: #71717A;
    line-height: 1.7;
  }
}
.guide-more {
  margin-top: 16rpx;
  padding: 8rpx 16rpx;
  text-align: center;
  border-radius: 8rpx;
  background: #E4E4E7;
  text {
    font-size: 22rpx;
    color: #000000;
    font-weight: 600;
  }
}
</style>
