<script setup>
/**
 * SocialQuotaBar — 本周社交额度条（3.5.14）
 *
 * 自己定每周几次社交，用掉几次自己看得见。未设置时不显示额度、不催不评。
 * 刷新方式：父页 onShow 里 revision +1（避免依赖组件生命周期在 App 端的不一致）。
 */
import { ref, watch } from 'vue'
import { buildSocialQuota, getWeeklyQuota, setWeeklyQuota } from '@/utils/social-quota.js'

const props = defineProps({
  revision: { type: Number, default: 0 }
})

const data = ref({ quota: 0, used: 0, remaining: 0, reached: false, line: '' })
const showForm = ref(false)
const inputValue = ref('')

function refresh() {
  data.value = buildSocialQuota({})
}

function openForm() {
  inputValue.value = String(getWeeklyQuota() || '')
  showForm.value = true
}

function save() {
  setWeeklyQuota(inputValue.value)
  showForm.value = false
  refresh()
  uni.showToast({ title: '已更新', icon: 'none' })
}

watch(() => props.revision, refresh)
refresh()
</script>

<template>
  <view class="quota-bar">
    <view class="quota-row">
      <text class="quota-text">{{ data.line || '要不要给社交定个每周次数？' }}</text>
      <text class="quota-btn" @tap="openForm">{{ data.quota > 0 ? '调整' : '设定' }}</text>
    </view>

    <view v-if="showForm" class="quota-mask" @tap="showForm = false">
      <view class="quota-modal" @tap.stop>
        <text class="quota-modal-title">每周社交次数</text>
        <text class="quota-modal-hint">自己定。回一条消息、说几句话都算一次；填 0 就不再显示。</text>
        <input v-model="inputValue" class="quota-input" type="number" placeholder="0 - 30" />
        <view class="quota-actions">
          <button class="quota-action" @tap="showForm = false">取消</button>
          <button class="quota-action primary" @tap="save">保存</button>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.quota-bar {
  padding: $spacing-sm $spacing-lg;
}

.quota-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-sm $spacing-md;
  background: #F4F4F5;
  border-radius: $radius-md;
}

.quota-text {
  flex: 1;
  font-size: $font-sm;
  color: #52525B;
  line-height: 1.5;
}

.quota-btn {
  margin-left: $spacing-sm;
  font-size: $font-sm;
  color: #18181B;
  font-weight: 600;
}

.quota-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.quota-modal {
  width: 560rpx;
  padding: $spacing-lg;
  background: #FFFFFF;
  border-radius: $radius-lg;
}

.quota-modal-title {
  font-size: $font-lg;
  font-weight: 600;
  color: #18181B;
}

.quota-modal-hint {
  display: block;
  margin-top: $spacing-xs;
  font-size: $font-xs;
  color: #A1A1AA;
  line-height: 1.5;
}

.quota-input {
  margin-top: $spacing-md;
  height: 80rpx;
  padding: 0 $spacing-md;
  background: #F4F4F5;
  border-radius: $radius-sm;
  font-size: $font-md;
  color: #18181B;
}

.quota-actions {
  display: flex;
  flex-direction: row;
  margin-top: $spacing-lg;
}

.quota-action {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  font-size: $font-md;
  background: #F4F4F5;
  color: #18181B;
  border-radius: $radius-md;
  margin: 0 $spacing-xs;
}

.quota-action.primary {
  background: #000000;
  color: #FFFFFF;
}

@media (prefers-color-scheme: dark) {
  .quota-row {
    background: #27272A;
  }

  .quota-text {
    color: #D4D4D8;
  }

  .quota-btn {
    color: #FAFAFA;
  }

  .quota-modal {
    background: #18181B;
  }

  .quota-modal-title {
    color: #FAFAFA;
  }

  .quota-input {
    background: #27272A;
    color: #FAFAFA;
  }

  .quota-action {
    background: #27272A;
    color: #FAFAFA;
  }

  .quota-action.primary {
    background: #FAFAFA;
    color: #18181B;
  }
}
</style>
