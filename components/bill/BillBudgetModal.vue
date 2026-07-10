<script setup>
/**
 * 月度预算设置弹窗
 * modelValue → 父组件 v-model 双向绑定 budgetInput
 */
defineProps({
  show:        { type: Boolean, default: false },
  currentMonth: { type: String, default: '' },
  modelValue:  { type: String, default: '' }
})

const emit = defineEmits(['close', 'save', 'update:modelValue'])

function onQuickSet(val) {
  emit('update:modelValue', val)
}
</script>

<template>
  <view class="modal-mask" v-if="show" @tap="$emit('close')">
    <view class="modal-content" @tap.stop>
      <text class="modal-title">设置 {{ currentMonth }} 月预算</text>

      <view class="modal-input-row">
        <text class="modal-prefix">¥</text>
        <input
          class="modal-input"
          type="digit"
          :value="modelValue"
          placeholder="输入预算金额"
          focus
          @input="(e) => emit('update:modelValue', e.detail.value)"
        />
      </view>

      <view class="modal-quick">
        <text class="quick-val" @tap="onQuickSet('1000')">¥1000</text>
        <text class="quick-val" @tap="onQuickSet('2000')">¥2000</text>
        <text class="quick-val" @tap="onQuickSet('3000')">¥3000</text>
        <text class="quick-val" @tap="onQuickSet('5000')">¥5000</text>
      </view>

      <view class="modal-actions">
        <view class="modal-btn cancel" @tap="$emit('close')">取消</view>
        <view class="modal-btn confirm" @tap="$emit('save')">确定</view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-content {
  width: 600rpx;
  background: $bg-card;
  border-radius: $radius-lg;
  padding: $spacing-lg;

  .modal-title {
    font-size: $font-lg;
    font-weight: 700;
    color: $text-primary;
    display: block;
    text-align: center;
    margin-bottom: $spacing-md;
  }
}

.modal-input-row {
  display: flex;
  align-items: center;
  background: $bg-input;
  border-radius: $radius-md;
  padding: $spacing-sm $spacing-md;
  margin-bottom: $spacing-sm;

  .modal-prefix {
    font-size: $font-xl;
    color: $text-secondary;
    margin-right: $spacing-xs;
  }

  .modal-input {
    flex: 1;
    font-size: $font-xl;
    color: $text-primary;
    font-weight: 700;
  }
}

.modal-quick {
  display: flex;
  justify-content: space-between;
  margin-bottom: $spacing-md;

  .quick-val {
    font-size: $font-xs;
    color: $accent;
    padding: 8rpx 20rpx;
    background: rgba(0, 0, 0, 0.04);
    border-radius: $radius-round;
  }
}

.modal-actions {
  display: flex;
  gap: $spacing-sm;

  .modal-btn {
    flex: 1;
    text-align: center;
    padding: 16rpx 0;
    border-radius: $radius-md;
    font-size: $font-md;
    font-weight: 600;

    &.cancel {
      background: $bg-input;
      color: $text-secondary;
    }

    &.confirm {
      background: var(--color-ai);
      color: var(--text-on-ai);
    }
  }
}
</style>
