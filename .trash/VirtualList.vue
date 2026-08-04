<script setup>
/**
 * VirtualList.vue — 通用虚拟列表组件
 *
 * 使用 scroll-view 实现虚拟滚动，仅渲染可视区域 + buffer 内的项目。
 * 适用于大数据量列表场景（如账单列表、日记列表）。
 *
 * Props:
 *   items        — 数据源数组
 *   itemHeight   — 预估单项高度（rpx）
 *   buffer       — 可视区外预渲染项数，默认 3
 *   keyField     — 用作 v-for key 的字段名，默认 'client_id'
 *
 * Slots:
 *   default slot — 接收 { item, index }，渲染单个列表项
 *
 * 注意：仅适用于固定/近似高度的列表项；不实现动态高度测量
 */
import { ref, computed, onMounted, nextTick, watch } from 'vue'

const props = defineProps({
  items:          { type: Array, required: true },
  itemHeight:     { type: Number, required: true },  // rpx
  buffer:         { type: Number, default: 3 },
  keyField:       { type: String, default: 'client_id' }
})

const emit = defineEmits(['scroll', 'scrolltolower'])

// ==================== 容器尺寸 ====================
const containerHeight = ref(0)   // px
const scrollTop = ref(0)

// rpx → px 转换比例
const rpxRatio = ref(1)

onMounted(() => {
  const sysInfo = uni.getSystemInfoSync()
  rpxRatio.value = sysInfo.screenWidth / 750

  // 延迟获取容器高度（确保 DOM 已渲染）
  nextTick(() => {
    setTimeout(() => {
      const query = uni.createSelectorQuery()
      query.select('#virtual-scroll').boundingClientRect()
      query.exec((res) => {
        if (res && res[0]) {
          containerHeight.value = res[0].height
        }
      })
    }, 100)
  })
})

// 单项实际高度（px）
const actualItemHeight = computed(() => {
  return props.itemHeight * rpxRatio.value
})

// 总高度
const totalHeight = computed(() => {
  return props.items.length * actualItemHeight.value
})

// ==================== 可视范围计算 ====================
const visibleStart = computed(() => {
  if (containerHeight.value <= 0 || actualItemHeight.value <= 0) return 0
  return Math.floor(scrollTop.value / actualItemHeight.value)
})

const visibleEnd = computed(() => {
  if (containerHeight.value <= 0 || actualItemHeight.value <= 0) return Math.min(10, props.items.length)
  return Math.ceil((scrollTop.value + containerHeight.value) / actualItemHeight.value)
})

const sliceStart = computed(() => Math.max(0, visibleStart.value - props.buffer))
const sliceEnd = computed(() => Math.min(props.items.length, visibleEnd.value + props.buffer))

const visibleItems = computed(() => {
  return props.items.slice(sliceStart.value, sliceEnd.value)
})

// 顶部填充高度（px）
const paddingTop = computed(() => {
  return sliceStart.value * actualItemHeight.value
})

// 底部填充高度（px）
const paddingBottom = computed(() => {
  return (props.items.length - sliceEnd.value) * actualItemHeight.value
})

// ==================== 事件处理 ====================
function onScroll(e) {
  scrollTop.value = e.detail.scrollTop
  emit('scroll', e)
}

function onScrollToLower(e) {
  emit('scrolltolower', e)
}

// ==================== 暴露方法 ====================
function scrollToIndex(index) {
  const target = Math.max(0, Math.min(index, props.items.length - 1)) * actualItemHeight.value
  // 触发父组件更新 scroll-top prop
  return target
}

defineExpose({ scrollToIndex, containerHeight, actualItemHeight })
</script>

<template>
  <scroll-view
    id="virtual-scroll"
    class="virtual-scroll"
    scroll-y
    :scroll-with-animation="false"
    @scroll="onScroll"
    @scrolltolower="onScrollToLower"
  >
    <view class="virtual-container" :style="{ height: totalHeight + 'px' }">
      <view class="virtual-list" :style="{ paddingTop: paddingTop + 'px', paddingBottom: paddingBottom + 'px' }">
        <view
          v-for="(item, i) in visibleItems"
          :key="item[keyField] || (sliceStart + i)"
          class="virtual-item"
          :style="{ minHeight: itemHeight + 'rpx' }"
        >
          <slot :item="item" :index="sliceStart + i" />
        </view>
      </view>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.virtual-scroll {
  height: 100%;
  width: 100%;
}

.virtual-container {
  position: relative;
  width: 100%;
}

.virtual-list {
  width: 100%;
}

.virtual-item {
  width: 100%;
  box-sizing: border-box;
}
</style>
