<script setup>
/**
 * MarkdownRenderer.vue v2 — 纯 uni-app 兼容的轻量 Markdown 渲染组件
 *
 * 解析逻辑已拆分到 utils/markdown-parser.js
 * 样式已拆分到 MarkdownRenderer.scss
 */
import { computed } from 'vue'
import { parseTokens, parseInline } from '@/utils/markdown-parser.js'

const props = defineProps({
  content: { type: String, required: true }
})

const tokens = computed(() => parseTokens(props.content))

function renderInline(text) {
  return parseInline(text)
}

function onLinkTap(href) {
  if (!href || href === '#') return
  uni.setClipboardData({
    data: href,
    success() {
      uni.showToast({ title: '链接已复制', icon: 'none' })
    }
  })
}
</script>



<template>
  <view class="md-renderer">
    <template v-for="(token, ti) in tokens" :key="ti">
      <!-- 标题 -->
      <text v-if="token.type === 'heading'" :class="'md-h md-h' + token.level">
        {{ token.content }}
      </text>

      <!-- 段落 -->
      <view v-else-if="token.type === 'paragraph'" class="md-p">
        <template v-for="(seg, si) in renderInline(token.content)" :key="si">
          <text v-if="seg.type === 'text'" class="md-text">{{ seg.content }}</text>
          <text v-else-if="seg.type === 'bold'" class="md-bold">{{ seg.content }}</text>
          <text v-else-if="seg.type === 'italic'" class="md-italic">{{ seg.content }}</text>
          <text v-else-if="seg.type === 'strike'" class="md-strike">{{ seg.content }}</text>
          <text v-else-if="seg.type === 'mark'" class="md-mark">{{ seg.content }}</text>
          <text v-else-if="seg.type === 'code'" class="md-inline-code">{{ seg.content }}</text>
          <text v-else-if="seg.type === 'link'" class="md-link" @tap="onLinkTap(seg.href)">{{ seg.content }}</text>
        </template>
      </view>

      <!-- 代码块 -->
      <view v-else-if="token.type === 'code_block'" class="md-code-block">
        <view class="md-code-header">
          <text class="md-code-lang" v-if="token.lang">{{ token.lang }}</text>
          <view class="md-code-dots">
            <view class="md-code-dot" />
            <view class="md-code-dot" />
            <view class="md-code-dot" />
          </view>
        </view>
        <text class="md-code-text">{{ token.content }}</text>
      </view>

      <!-- 引用块 -->
      <view v-else-if="token.type === 'blockquote'" class="md-blockquote">
        <template v-for="(line, li) in token.content.split('\n')" :key="li">
          <view class="md-quote-line">
            <template v-for="(seg, si) in renderInline(line)" :key="si">
              <text v-if="seg.type === 'text'" class="md-quote-text">{{ seg.content }}</text>
              <text v-else-if="seg.type === 'bold'" class="md-quote-text md-bold">{{ seg.content }}</text>
              <text v-else-if="seg.type === 'italic'" class="md-quote-text md-italic">{{ seg.content }}</text>
              <text v-else-if="seg.type === 'code'" class="md-inline-code">{{ seg.content }}</text>
              <text v-else-if="seg.type === 'link'" class="md-link" @tap="onLinkTap(seg.href)">{{ seg.content }}</text>
            </template>
          </view>
        </template>
      </view>

      <!-- 分割线 -->
      <view v-else-if="token.type === 'hr'" class="md-hr" />

      <!-- 表格 -->
      <view v-else-if="token.type === 'table'" class="md-table">
        <view class="md-table-header">
          <text v-for="(h, hi) in token.headers" :key="hi" class="md-th">{{ h }}</text>
        </view>
        <view v-for="(row, ri) in token.rows" :key="ri" class="md-table-row">
          <text v-for="(cell, ci) in row" :key="ci" class="md-td">{{ cell }}</text>
        </view>
      </view>

      <!-- 任务列表 -->
      <view v-else-if="token.type === 'task_list'" class="md-list md-task-list">
        <view v-for="(item, ii) in token.items" :key="ii" class="md-li md-task-li">
          <view class="md-task-checkbox" :class="{ checked: item.checked }">
            <text v-if="item.checked" class="md-task-check">✓</text>
          </view>
          <view class="md-li-content">
            <template v-for="(seg, si) in renderInline(item.content)" :key="si">
              <text v-if="seg.type === 'text'" class="md-text" :class="{ 'md-task-done': item.checked }">{{ seg.content }}</text>
              <text v-else-if="seg.type === 'bold'" class="md-bold" :class="{ 'md-task-done': item.checked }">{{ seg.content }}</text>
              <text v-else-if="seg.type === 'italic'" class="md-italic">{{ seg.content }}</text>
              <text v-else-if="seg.type === 'code'" class="md-inline-code">{{ seg.content }}</text>
              <text v-else-if="seg.type === 'link'" class="md-link" @tap="onLinkTap(seg.href)">{{ seg.content }}</text>
            </template>
          </view>
        </view>
      </view>

      <!-- 无序列表 -->
      <view v-else-if="token.type === 'unordered_list'" class="md-list">
        <view v-for="(item, ii) in token.items" :key="ii" class="md-li">
          <view class="md-li-bullet-wrap">
            <view class="md-li-bullet-dot" />
          </view>
          <view class="md-li-content">
            <template v-for="(seg, si) in renderInline(item)" :key="si">
              <text v-if="seg.type === 'text'" class="md-text">{{ seg.content }}</text>
              <text v-else-if="seg.type === 'bold'" class="md-bold">{{ seg.content }}</text>
              <text v-else-if="seg.type === 'italic'" class="md-italic">{{ seg.content }}</text>
              <text v-else-if="seg.type === 'strike'" class="md-strike">{{ seg.content }}</text>
              <text v-else-if="seg.type === 'mark'" class="md-mark">{{ seg.content }}</text>
              <text v-else-if="seg.type === 'code'" class="md-inline-code">{{ seg.content }}</text>
              <text v-else-if="seg.type === 'link'" class="md-link" @tap="onLinkTap(seg.href)">{{ seg.content }}</text>
            </template>
          </view>
        </view>
      </view>

      <!-- 有序列表 -->
      <view v-else-if="token.type === 'ordered_list'" class="md-list">
        <view v-for="(item, ii) in token.items" :key="ii" class="md-li md-ol-li">
          <view class="md-li-num-wrap">
            <text class="md-li-num-text">{{ item.num }}</text>
          </view>
          <view class="md-li-content">
            <template v-for="(seg, si) in renderInline(item.content)" :key="si">
              <text v-if="seg.type === 'text'" class="md-text">{{ seg.content }}</text>
              <text v-else-if="seg.type === 'bold'" class="md-bold">{{ seg.content }}</text>
              <text v-else-if="seg.type === 'italic'" class="md-italic">{{ seg.content }}</text>
              <text v-else-if="seg.type === 'strike'" class="md-strike">{{ seg.content }}</text>
              <text v-else-if="seg.type === 'mark'" class="md-mark">{{ seg.content }}</text>
              <text v-else-if="seg.type === 'code'" class="md-inline-code">{{ seg.content }}</text>
              <text v-else-if="seg.type === 'link'" class="md-link" @tap="onLinkTap(seg.href)">{{ seg.content }}</text>
            </template>
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
@import './MarkdownRenderer.scss';
</style>
