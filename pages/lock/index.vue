<script setup>
/**
 * PIN 锁屏页 — APP 启动时如已设置 PIN 则显示
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { verifyPin, isLocked, getLockRemain, hasPin } from '@/utils/pin.js'
import { useAppStore } from '@/store/index.js'

const store = useAppStore()
const pinInput = ref('')
const errorMsg = ref('')
const locked = ref(false)
const lockRemain = ref(0)
const needPin = ref(false)

let timer = null

onMounted(() => {
  checkPin()
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

function checkPin() {
  if (!hasPin()) {
    // 未设置 PIN，直接进首页
    uni.switchTab({ url: '/pages/chat/index' })
    return
  }

  if (isLocked()) {
    locked.value = true
    lockRemain.value = getLockRemain()
    startLockTimer()
  }

  needPin.value = true
}

function startLockTimer() {
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    lockRemain.value = getLockRemain()
    if (lockRemain.value <= 0) {
      locked.value = false
      if (timer) clearInterval(timer)
    }
  }, 1000)
}

/** 输入数字 */
function pressKey(num) {
  if (locked.value) return
  if (pinInput.value.length >= 6) return
  pinInput.value += num

  // 输满 4 位自动验证
  if (pinInput.value.length === 4) {
    setTimeout(() => verify(), 100)
  }
}

/** 删除 */
function deleteKey() {
  pinInput.value = pinInput.value.slice(0, -1)
  errorMsg.value = ''
}

/** 验证 PIN */
function verify() {
  const result = verifyPin(pinInput.value)

  if (result.success) {
    // 验证通过，进入首页
    uni.switchTab({ url: '/pages/chat/index' })
    return
  }

  if (result.locked) {
    locked.value = true
    lockRemain.value = result.remain
    startLockTimer()
    errorMsg.value = `错误次数过多，请等待 ${result.remain} 秒`
  } else {
    errorMsg.value = `PIN 错误，还剩 ${result.attemptsLeft} 次机会`
  }

  pinInput.value = ''
}

const dots = computed(() => {
  const arr = []
  for (let i = 0; i < 4; i++) {
    arr.push(i < pinInput.value.length)
  }
  return arr
})
</script>

<template>
  <view class="lock-page" v-if="needPin">
    <view class="lock-container">
      <SijiIcon name="lock" size="xl" class="lock-icon" />
      <text class="lock-title">思迹</text>
      <text class="lock-subtitle">请输入密码</text>

      <!-- PIN 点 -->
      <view class="pin-dots">
        <view
          v-for="(filled, i) in dots" :key="i"
          class="pin-dot"
          :class="{ filled }"
        />
      </view>

      <!-- 错误提示 -->
      <text class="error-msg" v-if="errorMsg">{{ errorMsg }}</text>

      <!-- 锁定提示 -->
      <view class="lock-timer" v-if="locked">
        <text class="timer-text">⏳ {{ lockRemain }}s 后重试</text>
      </view>

      <!-- 数字键盘 -->
      <view class="keypad" v-if="!locked">
        <view
          v-for="n in 9" :key="n"
          class="key"
          @tap="pressKey(String(n))"
        >
          <text class="key-text">{{ n }}</text>
        </view>
        <view class="key empty" />
        <view class="key" @tap="pressKey('0')">
          <text class="key-text">0</text>
        </view>
        <view class="key" @tap="deleteKey">
          <text class="key-text">⌫</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.lock-page {
  height: 100vh;
  background: #000000;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

/* 背景光晕 */
.lock-page::before {
  content: '';
  position: absolute;
  width: 600rpx;
  height: 600rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.05);
  top: -200rpx;
  right: -200rpx;
}

.lock-page::after {
  content: '';
  position: absolute;
  width: 400rpx;
  height: 400rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.03);
  bottom: -100rpx;
  left: -100rpx;
}

.lock-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 400rpx;
  position: relative;
  z-index: 1;
}

.lock-icon {
  font-size: 80rpx;
  margin-bottom: $spacing-md;
}

.lock-title {
  font-size: $font-xxl;
  font-weight: 800;
  color: #FFFFFF;
  margin-bottom: 8rpx;
  letter-spacing: 4rpx;
}

.lock-subtitle {
  font-size: $font-sm;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: $spacing-lg;
}

.pin-dots {
  display: flex;
  gap: $spacing-md;
  margin-bottom: $spacing-sm;
}

.pin-dot {
  width: 24rpx;
  height: 24rpx;
  border-radius: 50%;
  border: 4rpx solid rgba(255, 255, 255, 0.4);
  transition: all 0.2s;

  &.filled {
    background: #FFFFFF;
    border-color: #FFFFFF;
    box-shadow: none;
  }
}

.error-msg {
  font-size: $font-xs;
  color: #FEE2E2;
  margin-bottom: $spacing-sm;
  min-height: 32rpx;
}

.lock-timer {
  margin-bottom: $spacing-sm;
  .timer-text { font-size: $font-sm; color: rgba(255, 255, 255, 0.8); }
}

.keypad {
  display: flex;
  flex-wrap: wrap;
  width: 480rpx;
  max-width: 100%;
  margin-top: $spacing-md;
  box-sizing: border-box;
}

.key {
  width: calc(33.33% - 16rpx);
  max-width: calc(33.33% - 16rpx);
  height: 100rpx;
  margin: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border: 1rpx solid rgba(255, 255, 255, 0.08);
  border-radius: $radius-md;
  transition: all 0.15s;
  box-sizing: border-box;
  overflow: hidden;

  &:active {
    background: rgba(255, 255, 255, 0.25);
    transform: scale(0.95);
  }

  &.empty { background: transparent; border: none; }

  .key-text {
    font-size: $font-xl;
    font-weight: 600;
    color: #FFFFFF;
  }
}
</style>
