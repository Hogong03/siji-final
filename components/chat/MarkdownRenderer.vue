<script setup>
/**
 * MarkdownRenderer.vue — 纯 uni-app 兼容的轻量 Markdown 渲染组件
 *
 * 支持的语法：
 *   - 标题 # ## ###
 *   - 粗体 **text**、斜体 *text*
 *   - 无序列表 - item、有序列表 1. item
 *   - 代码块 ``` ... ```
 *   - 行内代码 `code`
 *   - 链接 [text](url)
 *   - 换行和段落
 */
import { computed } from 'vue'

const props = defineProps({
  content: { type: String, required: true }
})

// ==================== Token 解析 ====================

/**
 * 将 Markdown 文本解析为 Token 数组
 * 每个 Token 代表一个块级元素（标题/段落/代码块/列表项/空行）
 */
function parseTokens(text) {
  if (!text) return []
  const lines = text.split('\n')
  const tokens = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // 空行 → 跳过，用于段落分隔
    if (line.trim() === '') {
      i++
      continue
    }

    // 代码块 ```...```
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim()
      const codeLines = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++ // 跳过结束 ```
      tokens.push({ type: 'code_block', lang, content: codeLines.join('\n') })
      continue
    }

    // 标题 # ## ###
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      tokens.push({ type: 'heading', level: headingMatch[1].length, content: headingMatch[2] })
      i++
      continue
    }

    // 无序列表 - item 或 * item
    const ulMatch = line.match(/^[\-\*]\s+(.+)$/)
    if (ulMatch) {
      const items = []
      while (i < lines.length) {
        const m = lines[i].match(/^[\-\*]\s+(.+)$/)
        if (!m) break
        items.push(m[1])
        i++
      }
      tokens.push({ type: 'unordered_list', items })
      continue
    }

    // 有序列表 1. item
    const olMatch = line.match(/^\d+\.\s+(.+)$/)
    if (olMatch) {
      const items = []
      while (i < lines.length) {
        const m = lines[i].match(/^\d+\.\s+(.+)$/)
        if (!m) break
        items.push(m[1])
        i++
      }
      tokens.push({ type: 'ordered_list', items })
      continue
    }

    // 普通段落 → 收集连续的非空行
    const paraLines = []
    while (i < lines.length && lines[i].trim() !== '') {
      // 检查是否遇到特殊块
      const cur = lines[i]
      if (
        cur.trim().startsWith('```') ||
        cur.match(/^(#{1,3})\s+/) ||
        cur.match(/^[\-\*]\s+/) ||
        cur.match(/^\d+\.\s+/)
      ) {
        break
      }
      paraLines.push(cur)
      i++
    }
    if (paraLines.length > 0) {
      tokens.push({ type: 'paragraph', content: paraLines.join('\n') })
    }
  }
  return tokens
}

// ==================== 行内解析 ====================

/**
 * 解析行内格式，返回 segments 数组
 * 每个 segment: { type: 'text'|'bold'|'italic'|'code'|'link', content, href? }
 */
function parseInline(text) {
  if (!text) return []
  const segments = []
  let remaining = text

  while (remaining.length > 0) {
    // 行内代码 `code`
    const codeMatch = remaining.match(/`([^`]+)`/)
    // 粗体 **text**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
    // 斜体 *text* (需排除 ** 干扰)
    const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/)
    // 链接 [text](url)
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/)
    // 图片 ![alt](url) — 处理为不可见，避免意外渲染
    const imgMatch = remaining.match(/!\[([^\]]*)\]\(([^)]+)\)/)

    // 找最早出现的匹配
    const candidates = []
    if (codeMatch) candidates.push({ idx: codeMatch.index, len: codeMatch[0].length, type: 'code', content: codeMatch[1] })
    if (boldMatch) candidates.push({ idx: boldMatch.index, len: boldMatch[0].length, type: 'bold', content: boldMatch[1] })
    if (italicMatch) candidates.push({ idx: italicMatch.index, len: italicMatch[0].length, type: 'italic', content: italicMatch[1] })
    if (linkMatch) candidates.push({ idx: linkMatch.index, len: linkMatch[0].length, type: 'link', content: linkMatch[1], href: linkMatch[2] })
    if (imgMatch) candidates.push({ idx: imgMatch.index, len: imgMatch[0].length, type: 'text', content: '[图片]' })

    if (candidates.length === 0) {
      segments.push({ type: 'text', content: remaining })
      break
    }

    candidates.sort((a, b) => a.idx - b.idx)
    const first = candidates[0]

    // 匹配前的纯文本
    if (first.idx > 0) {
      segments.push({ type: 'text', content: remaining.substring(0, first.idx) })
    }

    segments.push({ type: first.type, content: first.content, href: first.href })
    remaining = remaining.substring(first.idx + first.len)
  }

  return segments
}

// ==================== computed ====================

const tokens = computed(() => parseTokens(props.content))

// ==================== 链接点击 ====================
function onLinkTap(href) {
  if (!href) return
  // #copy 用于复制场景
  if (href === '#') return
  // 尝试在 uni-app 中打开
  // uni.setClipboardData 不支持太多场景，这里简单复制 URL
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
      <text v-if="token.type === 'heading'" :class="'md-h md-h' + token.level" selectable="true">{{ token.content }}</text>

      <!-- 段落 -->
      <view v-else-if="token.type === 'paragraph'" class="md-p">
        <template v-for="(seg, si) in parseInline(token.content)" :key="si">
          <text v-if="seg.type === 'text'" class="md-text">{{ seg.content }}</text>
          <text v-else-if="seg.type === 'bold'" class="md-bold">{{ seg.content }}</text>
          <text v-else-if="seg.type === 'italic'" class="md-italic">{{ seg.content }}</text>
          <text v-else-if="seg.type === 'code'" class="md-inline-code">{{ seg.content }}</text>
          <text v-else-if="seg.type === 'link'" class="md-link" @tap="onLinkTap(seg.href)">{{ seg.content }}</text>
        </template>
      </view>

      <!-- 代码块 -->
      <view v-else-if="token.type === 'code_block'" class="md-code-block">
        <text class="md-code-lang" v-if="token.lang">{{ token.lang }}</text>
        <text class="md-code-text" selectable="true">{{ token.content }}</text>
      </view>

      <!-- 无序列表 -->
      <view v-else-if="token.type === 'unordered_list'" class="md-list">
        <view v-for="(item, ii) in token.items" :key="ii" class="md-li">
          <text class="md-li-bullet">•</text>
          <view class="md-li-content">
            <template v-for="(seg, si) in parseInline(item)" :key="si">
              <text v-if="seg.type === 'text'" class="md-text">{{ seg.content }}</text>
              <text v-else-if="seg.type === 'bold'" class="md-bold">{{ seg.content }}</text>
              <text v-else-if="seg.type === 'italic'" class="md-italic">{{ seg.content }}</text>
              <text v-else-if="seg.type === 'code'" class="md-inline-code">{{ seg.content }}</text>
              <text v-else-if="seg.type === 'link'" class="md-link" @tap="onLinkTap(seg.href)">{{ seg.content }}</text>
            </template>
          </view>
        </view>
      </view>

      <!-- 有序列表 -->
      <view v-else-if="token.type === 'ordered_list'" class="md-list">
        <view v-for="(item, ii) in token.items" :key="ii" class="md-li">
          <text class="md-li-num">{{ ii + 1 }}.</text>
          <view class="md-li-content">
            <template v-for="(seg, si) in parseInline(item)" :key="si">
              <text v-if="seg.type === 'text'" class="md-text">{{ seg.content }}</text>
              <text v-else-if="seg.type === 'bold'" class="md-bold">{{ seg.content }}</text>
              <text v-else-if="seg.type === 'italic'" class="md-italic">{{ seg.content }}</text>
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
.md-renderer {
  width: 100%;
}

/* 标题 */
.md-h1 {
  display: block;
  font-size: 38rpx;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1.3;
  margin: 16rpx 0 10rpx;
}

.md-h2 {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.35;
  margin: 14rpx 0 8rpx;
}

.md-h3 {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.35;
  margin: 12rpx 0 6rpx;
}

/* 段落 */
.md-p {
  margin: 6rpx 0;
  line-height: 1.65;
}

/* 基础文字 */
.md-text {
  font-size: $font-sm;
  color: var(--text-primary);
  line-height: 1.65;
}

/* 粗体 */
.md-bold {
  font-size: $font-sm;
  font-weight: 700;
  color: var(--text-primary);
}

/* 斜体 */
.md-italic {
  font-size: $font-sm;
  font-style: italic;
  color: var(--text-primary);
}

/* 行内代码 */
.md-inline-code {
  font-family: 'Courier New', 'Menlo', monospace;
  font-size: 23rpx;
  background: var(--bg-input);
  color: var(--text-primary);
  padding: 2rpx 8rpx;
  border-radius: 4rpx;
}

/* 链接 */
.md-link {
  color: var(--color-ai);
  text-decoration: underline;
  word-break: break-all;
}

/* 代码块 */
.md-code-block {
  margin: 10rpx 0;
  padding: 14rpx 16rpx;
  background: var(--bg-input);
  border-radius: 8rpx;
  border-left: 4rpx solid var(--color-ai);
  overflow-x: auto;
}

.md-code-lang {
  display: block;
  font-size: 18rpx;
  color: var(--text-hint);
  margin-bottom: 6rpx;
}

.md-code-text {
  font-family: 'Courier New', 'Menlo', monospace;
  font-size: 23rpx;
  color: var(--text-primary);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}

/* 列表 */
.md-list {
  margin: 6rpx 0;
  padding-left: 0;
}

.md-li {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  margin: 3rpx 0;
}

.md-li-bullet {
  flex-shrink: 0;
  width: 32rpx;
  font-size: $font-sm;
  color: var(--text-secondary);
  line-height: 1.65;
}

.md-li-num {
  flex-shrink: 0;
  min-width: 36rpx;
  font-size: $font-sm;
  color: var(--text-secondary);
  line-height: 1.65;
}

.md-li-content {
  flex: 1;
  min-width: 0;
}
</style>
