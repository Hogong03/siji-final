<script setup>
/**
 * 应用锁 — 设置子页面
 */

import SijiIcon from '@/components/common/SijiIcon.vue'
import { ref, onMounted } from 'vue'
import { hasPin, setPin, removePin, verifyPin } from '@/utils/pin.js'

const enabled = ref(false)
const showDialog = ref(false)
const mode = ref('set')   // set | remove
const step = ref(1)       // 1=输入 2=确认
const input = ref('')
const first = ref('')
const error = ref('')

onMounted(() => {
  enabled.value = hasPin()
})

function toggle() {
  if (enabled.value) {
    mode.value = 'remove'; step.value = 1; input.value = ''; error.value = ''; showDialog.value = true
  } else {
    mode.value = 'set'; step.value = 1; input.value = ''; error.value = ''; showDialog.value = true
  }
}

function pressKey(n) {
  if (input.value.length >= 6) return
  input.value += n; error.value = ''
}
function delKey() { input.value = input.value.slice(0, -1); error.value = '' }

function submit() {
  if (input.value.length < 4) { error.value = '至少 4 位数字'; return }
  if (mode.value === 'remove') {
    if (removePin(input.value)) { enabled.value = false; showDialog.value = false; uni.showToast({ title: '已关闭', icon: 'success' }) }
    else { error.value = 'PIN 错误' }
    return
  }
  if (step.value === 1) {
    first.value = input.value; input.value = ''; step.value = 2; error.value = ''
  } else {
    if (input.value === first.value) {
      setPin(input.value); enabled.value = true; showDialog.value = false
      uni.showToast({ title: 'PIN 已设置', icon: 'success' })
    } else {
      error.value = '两次不一致，请重试'; step.value = 1; input.value = ''; first.value = ''
    }
  }
}
</script>

<template>
  <view class="sub-page">
    <view class="card">
      <text class="card-title">应用锁</text>
      <text class="card-desc">
        {{ enabled ? '已开启，打开应用时需验证 PIN' : '未开启，建议设置以保护隐私' }}
      </text>
      <view class="action-row">
        <view class="status-badge" :class="{ on: enabled }">
          <SijiIcon v-if="enabled" name="lock" size="xs" class="badge-icon" />
          <SijiIcon v-else name="unlock" size="xs" class="badge-icon" />
          <text>{{ enabled ? '已开启' : '未开启' }}</text>
        </view>
        <text class="action-btn" @tap="toggle">{{ enabled ? '关闭应用锁' : '设置 PIN' }}</text>
      </view>
    </view>

    <!-- PIN Dialog -->
    <view class="pin-overlay" v-if="showDialog" @tap.self="showDialog = false">
      <view class="pin-dialog">
        <text class="pin-title">{{ mode === 'set' ? (step === 1 ? '设置密码' : '确认密码') : '验证密码' }}</text>
        <text class="pin-error" v-if="error">{{ error }}</text>
        <text class="pin-sub" v-else>请输入 4-6 位数字密码</text>
        <text class="pin-mask">{{ '•'.repeat(input.length) }}</text>

        <view class="pin-pad">
          <view v-for="n in 9" :key="n" class="pin-key" @tap="pressKey(String(n))"><text>{{ n }}</text></view>
          <view class="pin-key empty" />
          <view class="pin-key" @tap="pressKey('0')"><text>0</text></view>
          <view class="pin-key" @tap="delKey"><text>⌫</text></view>
        </view>

        <view class="pin-actions">
          <text class="pin-cancel" @tap="showDialog = false">取消</text>
          <text class="pin-confirm" @tap="submit">确定</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.sub-page {
  min-height: 100vh;
  background: var(--bg-card-alt);
  padding: $spacing-md;
}

.card {
  background: #FFFFFF;
  border-radius: $radius-lg;
  padding: $spacing-md;
  box-shadow: $shadow-sm;

  .card-title { font-size: $font-lg; font-weight: 700; color: #18181B; display: block; margin-bottom: $spacing-xs; }
  .card-desc { font-size: $font-xs; color: var(--text-hint); display: block; margin-bottom: $spacing-md; }
}

.action-row {
  display: flex; justify-content: space-between; align-items: center;
  .status-badge {
    padding: 8rpx 20rpx; border-radius: 20rpx; font-size: $font-xs; font-weight: 600;
    color: var(--text-hint);
    &.on { color: var(--color-plan); background: var(--color-plan-bg); }
  }
  .action-btn { font-size: $font-sm; color: #18181B; font-weight: 600; }
}

/* PIN Dialog */
.pin-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center; z-index: 999;
}
.pin-dialog {
  background: #FFFFFF; border-radius: $radius-xl;
  padding: $spacing-lg $spacing-md; width: 80%; max-width: 500rpx;
  display: flex; flex-direction: column; align-items: center;
  box-shadow: $shadow-lg;
  box-sizing: border-box;
  overflow: hidden;

  .pin-title { font-size: $font-lg; font-weight: 700; color: #18181B; margin-bottom: 8rpx; }
  .pin-sub { font-size: $font-xs; color: var(--text-hint); margin-bottom: $spacing-md; }
  .pin-error { font-size: $font-xs; color: $danger; margin-bottom: $spacing-md; }
  .pin-mask { font-size: $font-xxl; letter-spacing: 16rpx; color: #18181B; margin-bottom: $spacing-md; }
}
.pin-pad {
  display: flex; flex-wrap: wrap; width: 100%; max-width: 400rpx;
  box-sizing: border-box;
  .pin-key {
    width: calc(33.33% - 12rpx); height: 80rpx; margin: 6rpx;
    display: flex; align-items: center; justify-content: center;
    background: var(--bg-btn-secondary); border-radius: $radius-md;
    font-size: $font-lg; font-weight: 600; color: #18181B;
    box-sizing: border-box;
    &:active { background: rgba(99,102,241,0.15); transform: scale(0.95); }
    &.empty { background: transparent; }
  }
}
.pin-actions {
  display: flex; gap: $spacing-lg; margin-top: $spacing-md;
  .pin-cancel { font-size: $font-sm; color: #71717A; padding: $spacing-xs $spacing-md; }
  .pin-confirm { font-size: $font-sm; color: #18181B; font-weight: 700; padding: $spacing-xs $spacing-md; }
}

</style>

