<script setup>
/**
 * 筛选栏：类型筛选 + 分类标签 + 搜索框
 */
defineProps({
  filterType:     { type: Number, default: -1 },
  filterCategory: { type: String, default: '' },
  searchText:     { type: String, default: '' },
  currentCategories: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:filterType', 'update:filterCategory', 'searchInput', 'clearSearch'])

function onTypeChange(type) {
  emit('update:filterType', type)
}

function onCatChange(key) {
  emit('update:filterCategory', key)
}

function onSearchInput(e) {
  emit('searchInput', e.detail?.value || '')
}
</script>

<template>
  <view class="filter-section">
    <!-- 类型筛选 -->
    <view class="type-filter">
      <view class="type-btn" :class="{ active: filterType === -1 }" @tap="onTypeChange(-1)">全部</view>
      <view class="type-btn" :class="{ active: filterType === 0 }" @tap="onTypeChange(0)">支出</view>
      <view class="type-btn" :class="{ active: filterType === 1 }" @tap="onTypeChange(1)">收入</view>
    </view>

    <!-- 分类标签横滑 -->
    <scroll-view class="cat-scroll" scroll-x v-if="currentCategories.length > 0">
      <view class="cat-list">
        <view
          class="cat-tag" :class="{ active: filterCategory === '' }"
          @tap="onCatChange('')"
        >全部</view>
        <view
          v-for="cat in currentCategories" :key="cat.key"
          class="cat-tag" :class="{ active: filterCategory === cat.key }"
          @tap="onCatChange(cat.key)"
        >
          {{ cat.icon }} {{ cat.key }}
        </view>
      </view>
    </scroll-view>

    <!-- 搜索框 -->
    <view class="search-box">
      <text class="search-icon-text">🔍</text>
      <input
        class="search-input"
        type="text"
        placeholder="搜索备注、分类..."
        :value="searchText"
        @input="onSearchInput"
      />
      <text v-if="searchText" class="search-clear" @tap="$emit('clearSearch')">✕</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.filter-section {
  padding: 0 $spacing-md;
  margin-bottom: $spacing-xs;
}

.type-filter {
  display: flex;
  gap: $spacing-xs;
  margin-bottom: $spacing-xs;

  .type-btn {
    flex: 1;
    text-align: center;
    padding: 10rpx 0;
    border-radius: $radius-sm;
    font-size: $font-xs;
    background: $bg-card;
    color: $text-secondary;

    &.active {
      background: var(--color-ai);
      color: var(--text-on-ai);
      font-weight: 600;
    }
  }
}

.cat-scroll {
  margin-bottom: $spacing-xs;
}

.cat-list {
  display: flex;
  gap: $spacing-xs;
  padding: 2rpx 0;
}

.cat-tag {
  flex-shrink: 0;
  padding: 6rpx 18rpx;
  border-radius: 32rpx;
  font-size: 20rpx;
  background: $bg-card;
  color: $text-secondary;
  white-space: nowrap;

  &.active {
    background: var(--color-ai);
    color: var(--text-on-ai);
  }
}

.search-box {
  display: flex;
  align-items: center;
  background: $bg-card;
  border-radius: $radius-round;
  padding: 8rpx $spacing-md;
  margin-bottom: $spacing-xs;

  .search-icon-text {
    font-size: $font-sm;
    margin-right: $spacing-xs;
  }

  .search-input {
    flex: 1;
    font-size: $font-sm;
    color: $text-primary;
  }

  .search-clear {
    font-size: $font-sm;
    color: $text-hint;
    padding: 0 8rpx;
  }
}
</style>
