<script setup>
/**
 * 品牌开屏页 — App 启动入口
 * 纯白底 + "思迹" 渐入停留 → 淡出 → 跳转主页
 * 总时长约 1.6s
 */
import { onMounted, ref } from 'vue'
import { hasPin } from '@/utils/pin.js'
import { getDisclaimerAccepted } from '@/utils/disclaimer.js'

const phase = ref('in') // in → hold → out → done

onMounted(() => {
  setTimeout(() => { phase.value = 'hold' }, 500)
  setTimeout(() => { phase.value = 'out' }, 1100)
  setTimeout(() => {
    uni.$emit('appReady')
    // 首次启动 → 展示免责声明
    if (!getDisclaimerAccepted()) {
      uni.reLaunch({ url: '/pages/disclaimer/index' })
      return
    }
    const target = hasPin() ? '/pages/lock/index' : '/pages/chat/index'
    uni.reLaunch({ url: target })
  }, 1600)
})
</script>

<template>
  <view class="splash">
    <view class="splash-line" :class="phase" />
    <view class="logo" :class="phase">
      <text class="logo-text">思迹</text>
      <text class="logo-sub">SIJI</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.splash {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #E4E4E7;
  z-index: 9999;
  overflow: hidden;
}

.logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  opacity: 0;
  transform: scale(0.94) translateY(8rpx);
  transition: opacity 0.5s cubic-bezier(0.22, 0.61, 0.36, 1),
              transform 0.5s cubic-bezier(0.22, 0.61, 0.36, 1);
}

.logo.hold {
  opacity: 1;
  transform: scale(1) translateY(0);
  transition: none;
}

.logo.out {
  opacity: 0;
  transform: scale(1.06) translateY(-4rpx);
  transition: opacity 0.5s ease, transform 0.5s ease;
}

.logo-text {
  font-size: 72rpx;
  font-weight: 700;
  color: #3F3F46;
  letter-spacing: 8rpx;
}

.logo-sub {
  font-size: 22rpx;
  font-weight: 500;
  color: #A1A1AA;
  letter-spacing: 12rpx;
  text-transform: uppercase;
}

.splash-line {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 0;
  height: 3rpx;
  background: #3F3F46;
  transform: translateX(-50%);
  border-radius: 2rpx;
  opacity: 0;
}

.splash-line.hold {
  width: 120rpx;
  opacity: 0.15;
  transition: width 0.6s cubic-bezier(0.22, 0.61, 0.36, 1) 0.2s,
              opacity 0.6s ease 0.2s;
}

.splash-line.out {
  width: 200rpx;
  opacity: 0;
  transition: width 0.5s ease, opacity 0.5s ease;
}

@media (prefers-color-scheme: dark) {
  .splash {
    background: #09090B;
  }
  .logo-text {
    color: #FAFAFA;
  }
  .logo-sub {
    color: #52525B;
  }
  .splash-line {
    background: #27272A;
  }
}

</style>
