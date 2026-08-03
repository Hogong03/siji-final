<script setup>
/**
 * 免责声明页 — 首次启动必须同意才能进入
 * 纯黑白极简风格，与整体设计语言一致
 */
import { ref } from 'vue'
import { getDisclaimerAccepted, setDisclaimerAccepted } from '@/utils/disclaimer.js'
import { hasPin } from '@/utils/pin.js'
import { safeNavigateBack } from '@/utils/nav-helper.js'

const agreed = ref(false)
const isFirstLaunch = !getDisclaimerAccepted()

function handleAgree() {
  agreed.value = true
  setDisclaimerAccepted()
  // 跳转逻辑与 splash 一致
  const target = hasPin() ? '/pages/lock/index' : '/pages/chat/index'
  uni.reLaunch({ url: target })
}

function handleDecline() {
  // 提示后退出 App（H5 回到上一页，App 退出）
  uni.showModal({
    title: '温馨提示',
    content: '思迹需要您同意免责声明才能使用。\n\n不同意将无法使用本应用。',
    confirmText: '同意并继续',
    cancelText: '退出应用',
    success(res) {
      if (res.confirm) {
        handleAgree()
      } else {
        // #ifdef APP-PLUS
        plus.runtime.quit()
        // #endif
        // #ifdef H5
        if (window.history.length > 1) {
          window.history.back()
        } else {
          document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-size:16px;color:var(--text-secondary);font-family:sans-serif;">感谢关注 · 思迹</div>'
        }
        // #endif
      }
    }
  })
}
</script>

<template>
  <view class="disclaimer-wrap">
    <!-- 顶部品牌 -->
    <view class="disclaimer-header">
      <text class="disclaimer-brand">思迹</text>
      <text class="disclaimer-brand-sub">SIJI</text>
    </view>

    <!-- 声明正文 -->
    <scroll-view class="disclaimer-body" scroll-y enhanced show-scrollbar="false">
      <text class="disclaimer-title">用户协议与免责声明</text>
      <text class="disclaimer-date">最后更新：2026 年 7 月 14 日</text>

      <view class="disclaimer-section">
        <text class="disclaimer-section-title">一、关于思迹</text>
        <text class="disclaimer-text">思迹（Siji）是一款纯本地 AI 对话式生活助手应用，提供记录、账单管理、计划追踪等功能。所有数据默认存储在您的设备本地，不上传至任何服务器。</text>
      </view>

      <view class="disclaimer-section">
        <text class="disclaimer-section-title">二、AI 服务说明</text>
        <text class="disclaimer-text">思迹调用第三方 AI 大模型接口（如 DeepSeek、通义千问、智谱 GLM、Moonshot 等）来处理您的自然语言输入。AI 生成的内容仅供参考，不构成任何专业建议（包括但不限于医疗、法律、财务建议）。</text>
      </view>

      <view class="disclaimer-section">
        <text class="disclaimer-section-title">三、数据隐私</text>
        <text class="disclaimer-text">1. 您的记录、账单、计划等个人数据仅存储在您设备的本地存储中，思迹不会主动上传或收集这些数据。</text>
        <text class="disclaimer-text">2. 与 AI 的对话会通过加密通道发送至您选择的第三方 AI 服务商，对话内容受该服务商的隐私政策约束。请勿在对话中透露高度敏感的个人信息（如身份证号、银行卡密码等）。</text>
        <text class="disclaimer-text">3. 如您使用可选的数据同步/备份功能，数据传输遵循相应的安全协议。建议定期本地备份重要数据。</text>
      </view>

      <view class="disclaimer-section">
        <text class="disclaimer-section-title">四、免责条款</text>
        <text class="disclaimer-text">1. 思迹不对 AI 生成内容的准确性、完整性或可靠性做任何明示或默示的保证。</text>
        <text class="disclaimer-text">2. 因 AI 服务不可用、网络故障、设备故障等导致的任何数据丢失或间接损失，思迹开发团队不承担责任。</text>
        <text class="disclaimer-text">3. 用户因使用思迹而产生的一切决策（包括但不限于财务决策、健康管理、人际关系等），其后果由用户自行承担。</text>
        <text class="disclaimer-text">4. 如您使用第三方 AI 服务的 API Key，您应自行遵守该服务商的使用条款和限制。</text>
      </view>

      <view class="disclaimer-section">
        <text class="disclaimer-section-title">五、错误信息收集</text>
        <text class="disclaimer-text">应用在运行过程中遇到错误时，会自动收集错误信息（包括错误类型、堆栈、设备型号、系统版本、应用版本）并暂存在您的设备本地。这些信息不包含任何个人隐私数据（如记录内容、账单记录、API Key 等）。如您启用数据同步功能，错误信息会在网络恢复后批量上传至思迹服务器用于问题排查。您可在设置中随时清除本地错误记录。</text>
      </view>

      <view class="disclaimer-section">
        <text class="disclaimer-section-title">六、知识产权</text>
        <text class="disclaimer-text">思迹采用 MIT 开源协议，源代码可在 GitHub 获取。应用名称、标志及界面设计归开发团队所有。</text>
      </view>

      <view class="disclaimer-section">
        <text class="disclaimer-section-title">七、协议变更</text>
        <text class="disclaimer-text">本声明可能不时更新。重大变更将通过应用内通知方式告知。继续使用即视为接受更新后的条款。</text>
      </view>

      <view class="disclaimer-spacer" />
    </scroll-view>

    <!-- 底部操作 -->
    <view class="disclaimer-footer">
      <view class="disclaimer-footer-inner">
        <template v-if="isFirstLaunch">
          <view class="disclaimer-btn disclaimer-btn-primary" @tap="handleAgree">
            <text>同意并继续</text>
          </view>
          <view class="disclaimer-btn disclaimer-btn-secondary" @tap="handleDecline">
            <text>不同意</text>
          </view>
        </template>
        <template v-else>
          <view class="disclaimer-btn disclaimer-btn-primary" @tap="safeNavigateBack()">
            <text>返回</text>
          </view>
        </template>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.disclaimer-wrap {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-page, var(--bg-card));
  overflow: scroll;
}

/* 顶部品牌 */
.disclaimer-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48rpx 0 0;
  gap: 6rpx;
}
.disclaimer-brand {
  font-size: 52rpx;
  font-weight: 700;
  color: var(--text-strong, var(--color-ai));
  letter-spacing: 6rpx;
}
.disclaimer-brand-sub {
  font-size: 18rpx;
  font-weight: 500;
  color: var(--text-hint, var(--text-tertiary));
  letter-spacing: 10rpx;
  text-transform: uppercase;
}

/* 正文区域 */
.disclaimer-body {
  flex: 1;
  padding: 32rpx 40rpx 0;
  overflow-x: hidden;
  box-sizing: border-box;
}
.disclaimer-title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: var(--text-strong, var(--color-ai));
  margin-bottom: 8rpx;
}
.disclaimer-date {
  display: block;
  font-size: 22rpx;
  color: var(--text-hint, var(--text-tertiary));
  margin-bottom: 32rpx;
}

.disclaimer-section {
  margin-bottom: 28rpx;
}
.disclaimer-section-title {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: var(--text-primary, var(--bg-input));
  margin-bottom: 12rpx;
}
.disclaimer-text {
  display: block;
  font-size: 24rpx;
  color: var(--text-secondary, var(--text-secondary));
  line-height: 1.7;
  margin-bottom: 8rpx;
  word-wrap: break-word;
  word-break: break-word;
  white-space: normal;
  overflow-wrap: anywhere;
}

.disclaimer-spacer {
  height: 32rpx;
}

/* 底部操作 */
.disclaimer-footer {
  padding: 20rpx 40rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid var(--border-light, var(--border-color));
  background: var(--bg-page, var(--bg-card));
}
.disclaimer-footer-inner {
  display: flex;
  gap: 16rpx;
}

.disclaimer-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 88rpx;
  border-radius: 16rpx;
  font-size: 28rpx;
  font-weight: 500;
  transition: opacity 0.15s;
  &:active {
    opacity: 0.7;
  }
}
.disclaimer-btn-primary {
  background: var(--text-strong, var(--color-ai));
  color: var(--bg-card);
}
.disclaimer-btn-secondary {
  background: var(--bg-card, var(--bg-input));
  color: var(--text-secondary, var(--text-secondary));
}
</style>
