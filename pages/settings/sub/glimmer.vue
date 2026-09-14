<script setup>
/**
 * 微光本（3.4 M2）— 每天一件「还行的小事」
 * AI 在对话里主动替你收着；这里只做回看与删除：不打卡、不连击、不评价
 */
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import SijiIcon from '@/components/common/SijiIcon.vue'
import { getGlimmers, removeGlimmer } from '@/utils/storage.js'

const items = ref([])
const totalText = ref('')

function load() {
  items.value = getGlimmers()
  totalText.value = items.value.length > 0
    ? '共收着 ' + items.value.length + ' 件小事'
    : '微光本是空的，允许空着'
}

function fmtDate(d) {
  if (!d) return ''
  const parts = d.split('-')
  return Number(parts[1]) + '月' + Number(parts[2]) + '日'
}

function removeOne(g) {
  uni.showModal({
    title: '删掉这一天？',
    content: '只删这条微光，不影响其他数据',
    confirmText: '删除',
    cancelText: '留着',
    success(res) {
      if (!res.confirm) return
      removeGlimmer(g.date)
      uni.showToast({ title: '已删除', icon: 'none' })
      load()
    }
  })
}

onShow(load)
</script>

<template>
  <view class="page">
    <view class="head">
      <view class="head-row">
        <SijiIcon name="sun" size="lg" color="#B45309" />
        <text class="head-title">微光本</text>
      </view>
      <text class="head-desc">AI 会在你分享「今天有件还行的小事」时轻轻收进来，只记录、不追问</text>
      <text class="head-total">{{ totalText }}</text>
    </view>

    <scroll-view class="scroll" scroll-y>
      <view v-if="items.length === 0" class="empty">
        <text class="empty-title">这里先空着</text>
        <text class="empty-hint">去和思迹聊聊今天的小事，比如「今天出门晒了会儿太阳」</text>
      </view>

      <view v-else class="list">
        <view v-for="g in items" :key="g.date" class="row">
          <view class="row-head">
            <text class="row-date">{{ fmtDate(g.date) }}</text>
            <view class="row-del" @tap="removeOne(g)">
              <SijiIcon name="trash" size="sm" color="#A1A1AA" />
            </view>
          </view>
          <text class="row-content">{{ g.content }}</text>
        </view>
        <view style="height: 40rpx" />
      </view>
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  height: 100vh;
  background: #F4F4F5;
  display: flex;
  flex-direction: column;
}

.head {
  padding: 24rpx 28rpx 20rpx;
  background: #FFFFFF;
  border-bottom: 1rpx solid #E4E4E7;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.head-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.head-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #18181B;
}

.head-desc {
  font-size: 24rpx;
  color: #71717A;
  line-height: 1.6;
}

.head-total {
  font-size: 22rpx;
  color: #A1A1AA;
}

.scroll {
  flex: 1;
  box-sizing: border-box;
  padding: 20rpx 24rpx;
}

.empty {
  margin-top: 120rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  padding: 0 40rpx;
}

.empty-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #71717A;
}

.empty-hint {
  font-size: 24rpx;
  color: #A1A1AA;
  text-align: center;
  line-height: 1.6;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.row {
  background: #FFFFFF;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.row-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.row-date {
  font-size: 22rpx;
  color: #A1A1AA;
}

.row-del {
  padding: 6rpx 10rpx;
}

.row-content {
  font-size: 28rpx;
  color: #18181B;
  line-height: 1.6;
}

@media (prefers-color-scheme: dark) {
  .page { background: #18181B; }
  .head { background: #27272A; border-bottom-color: #3F3F46; }
  .head-title { color: #FAFAFA; }
  .row { background: #27272A; }
  .row-content { color: #E4E4E7; }
  .head-desc, .row-date, .head-total, .empty-title { color: #A1A1AA; }
  .empty-hint { color: #71717A; }
}
</style>
