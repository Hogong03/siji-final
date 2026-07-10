<script setup>
/**
 * 关于思迹 — 整合应用介绍 + 使用说明
 */
import { ref } from 'vue'
import SijiIcon from '@/components/common/SijiIcon.vue'

const activeTab = ref('about')

const tabs = [
  { id: 'about', iconName: 'info', label: '关于' },
  { id: 'chat', iconName: 'ai', label: 'AI对话' },
  { id: 'diary', iconName: 'diary', label: '日记' },
  { id: 'bill', iconName: 'bill', label: '记账' },
  { id: 'plan', iconName: 'plan', label: '计划' },
]
</script>

<template>
  <view class="about-page">
    <!-- Tab 导航 -->
    <view class="tab-bar">
      <view
        v-for="t in tabs" :key="t.id"
        class="tab-item" :class="{ active: activeTab === t.id }"
        @tap="activeTab = t.id"
      >
        <SijiIcon :name="t.iconName" size="xs" :color="activeTab === t.id ? 'var(--text-primary)' : 'var(--text-tertiary)'" />
        <text class="tab-label">{{ t.label }}</text>
      </view>
    </view>

    <scroll-view class="about-scroll" scroll-y>
      <!-- ===== 关于思迹 ===== -->
      <view v-if="activeTab === 'about'" class="content-section">
        <view class="hero">
          <text class="hero-name">思迹</text>
          <text class="hero-version">v1.2.0</text>
          <text class="hero-tagline">AI 生活助手 · 对话记录每一天</text>
        </view>

        <view class="card">
          <text class="card-text">
            思迹是一款 AI 个人生活助手，通过自然对话帮你记录生活、管理财务、制定计划。
            所有数据均存储在本地设备，保护你的隐私安全。
          </text>
          <text class="card-text" style="margin-top: 12rpx;">
            无需注册登录，打开即用。对话即操作——跟它说话，它帮你做。
          </text>
        </view>

        <view class="features-grid">
          <view class="feat-item">
            <SijiIcon name="ai" size="lg" color="var(--text-primary)" />
            <text class="feat-label">AI 对话</text>
            <text class="feat-desc">自然语言操作</text>
          </view>
          <view class="feat-item">
            <SijiIcon name="diary" size="lg" color="var(--text-primary)" />
            <text class="feat-label">日记</text>
            <text class="feat-desc">心情与标签</text>
          </view>
          <view class="feat-item">
            <SijiIcon name="bill" size="lg" color="var(--text-primary)" />
            <text class="feat-label">记账</text>
            <text class="feat-desc">预算与分类</text>
          </view>
          <view class="feat-item">
            <SijiIcon name="plan" size="lg" color="var(--text-primary)" />
            <text class="feat-label">计划</text>
            <text class="feat-desc">模板与统计</text>
          </view>
        </view>

        <view class="card">
          <text class="card-title">技术栈</text>
          <text class="card-text">uni-app · Vue 3 · Pinia · SCSS</text>
          <text class="card-text" style="margin-top: 8rpx;">多模型 AI：DeepSeek / OpenAI / Moonshot / 智谱 / 通义</text>
        </view>

        <view class="card feedback-card" @tap="uni.navigateTo({ url: '/pages/settings/sub/feedback' })">
          <view class="fb-row">
            <SijiIcon name="mail" size="md" color="var(--text-primary)" />
            <view class="fb-body">
              <text class="fb-title">体验反馈</text>
              <text class="fb-desc">告诉我们你的想法</text>
            </view>
            <text class="fb-arrow">›</text>
          </view>
        </view>
      </view>

      <!-- ===== AI 对话 ===== -->
      <view v-if="activeTab === 'chat'" class="content-section">
        <view class="section-title">思迹 AI · 对话即操作</view>

        <view class="card">
          <text class="card-title">核心理念</text>
          <text class="card-text">不需要打开「记日记」「记账」「建计划」三个页面。直接在对话框里用自然语言说话，AI 会自动识别你的意图并完成操作。</text>
        </view>

        <view class="card">
          <text class="card-title">说话示例</text>
          <view class="example-item"><text class="ex-tag bill">记账</text><text class="ex-text">"午饭花了35"</text><text class="ex-result">→ 自动创建账单</text></view>
          <view class="example-item"><text class="ex-tag diary">日记</text><text class="ex-text">"今天心情不错"</text><text class="ex-result">→ 自动写日记</text></view>
          <view class="example-item"><text class="ex-tag plan">计划</text><text class="ex-text">"下周三完成报告"</text><text class="ex-result">→ 自动建计划</text></view>
          <view class="example-item"><text class="ex-tag multi">复合</text><text class="ex-text">"咖啡15，顺便定健身计划"</text><text class="ex-result">→ 记账+建计划</text></view>
          <view class="example-item"><text class="ex-tag query">查询</text><text class="ex-text">"这个月花了多少"</text><text class="ex-result">→ 自动查账单</text></view>
          <view class="example-item"><text class="ex-tag undo">撤销</text><text class="ex-text">"撤销刚才的操作"</text><text class="ex-result">→ 回退上一步</text></view>
        </view>

        <view class="card">
          <text class="card-title">特色功能</text>
          <text class="card-text">· 流式输出，实时看到 AI 回复</text>
          <text class="card-text">· 多轮对话，AI 记住上下文</text>
          <text class="card-text">· 高风险确认：金额 ≥ 500 元时暂停确认</text>
          <text class="card-text">· 结果卡片可编辑，点击跳转详情</text>
          <text class="card-text">· 支持 5 个 AI 厂商切换，独立配置 Key</text>
          <text class="card-text">· 发送中可点击 ■ 停止输出</text>
        </view>
      </view>

      <!-- ===== 日记 ===== -->
      <view v-if="activeTab === 'diary'" class="content-section">
        <view class="section-title">日记 · 记录每一天</view>

        <view class="card">
          <text class="card-title">创建方式</text>
          <text class="card-text">· 对话中说"写日记"或直接描述心情 → AI 自动创建</text>
          <text class="card-text">· 功能页 → 日记 → 点 + 号手动新建</text>
        </view>

        <view class="card">
          <text class="card-title">功能亮点</text>
          <text class="card-text">· 心情选择：开心/平静/难过/兴奋/疲惫/愤怒</text>
          <text class="card-text">· 标签管理：自定义标签，颜色自动分配</text>
          <text class="card-text">· 标签筛选：点击标签按钮切换，快速定位</text>
          <text class="card-text">· 按月浏览：左右切换月份查看历史</text>
          <text class="card-text">· AI 润色：让 AI 帮你优化日记内容</text>
        </view>
      </view>

      <!-- ===== 记账 ===== -->
      <view v-if="activeTab === 'bill'" class="content-section">
        <view class="section-title">记账 · 收支清清楚楚</view>

        <view class="card">
          <text class="card-title">记账方式</text>
          <text class="card-text">· 对话中直接说金额和用途 → AI 自动记账</text>
          <text class="card-text">· 记账页点 + 号，选分类输金额保存</text>
          <text class="card-text">· 右下角浮动按钮快速记账</text>
        </view>

        <view class="card">
          <text class="card-title">功能亮点</text>
          <text class="card-text">· 月度预算：进度条实时显示，超支标红</text>
          <text class="card-text">· 分类筛选：横滑标签栏快速切换</text>
          <text class="card-text">· 备注搜索：300ms 防抖自动搜索</text>
          <text class="card-text">· 日期分组：同一天消费汇总显示</text>
          <text class="card-text">· 左滑编辑/删除，无需长按</text>
          <text class="card-text">· 自定义数字键盘快速输入</text>
        </view>
      </view>

      <!-- ===== 计划 ===== -->
      <view v-if="activeTab === 'plan'" class="content-section">
        <view class="section-title">计划 · 任务与模板</view>

        <view class="card">
          <text class="card-title">创建方式</text>
          <text class="card-text">· 对话中描述任务 → AI 自动创建并拆解</text>
          <text class="card-text">· 计划页点 + 号新建</text>
          <text class="card-text">· 模板系统：5 套预设模板一键应用</text>
        </view>

        <view class="card">
          <text class="card-title">功能亮点</text>
          <text class="card-text">· 3 级优先级：高/中/低，列表按优先级堆叠</text>
          <text class="card-text">· 子任务：勾选完成有进度反馈</text>
          <text class="card-text">· 标签：状态 × 优先级 × 标签三维筛选</text>
          <text class="card-text">· 统计看板：完成率、趋势、平均速度</text>
          <text class="card-text">· 截止日期倒计时，超时标红</text>
          <text class="card-text">· 提醒功能：到时间自动通知</text>
        </view>
      </view>

      <view style="height: 60rpx" />
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.about-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-page);
  overflow: hidden;
}

/* Tab 导航 */
.tab-bar {
  display: flex;
  gap: 4rpx;
  padding: $spacing-sm $spacing-md;
  background: var(--bg-page);
  border-bottom: 1rpx solid var(--border-color);
  overflow-x: auto;
  flex-shrink: 0;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar { display: none; }
}

.tab-item {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 12rpx 20rpx;
  border-radius: $radius-md;
  border: 1rpx solid transparent;
  transition: all $transition-fast;

  &.active {
    background: var(--bg-card);
    border-color: var(--border-color);
  }

  .tab-label {
    font-size: $font-xs;
    font-weight: 600;
    color: var(--text-tertiary);
  }

  &.active .tab-label {
    color: var(--text-primary);
  }
}

/* 内容区 */
.about-scroll {
  flex: 1;
  overflow: hidden;
}

.content-section {
  padding: $spacing-md;
  box-sizing: border-box;
}

/* Hero */
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $spacing-xl $spacing-md;
  margin-bottom: $spacing-md;

  .hero-name {
    font-size: 56rpx;
    font-weight: 800;
    color: var(--text-primary);
    letter-spacing: 8rpx;
  }
  .hero-version {
    font-size: $font-xs;
    color: var(--text-hint);
    background: var(--bg-input);
    padding: 4rpx 16rpx;
    border-radius: 20rpx;
    margin-top: 8rpx;
  }
  .hero-tagline {
    font-size: $font-sm;
    color: var(--text-secondary);
    margin-top: 12rpx;
  }
}

/* 功能网格 */
.features-grid {
  display: flex;
  gap: $spacing-xs;
  margin-bottom: $spacing-md;
}

.feat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
  padding: $spacing-sm;
  background: var(--bg-card);
  border-radius: $radius-md;
  border: 1rpx solid var(--border-color);
  box-sizing: border-box;

  .feat-label {
    font-size: $font-sm;
    font-weight: 600;
    color: var(--text-primary);
  }
  .feat-desc {
    font-size: 20rpx;
    color: var(--text-hint);
  }
}

/* 段落标题 */
.section-title {
  display: block;
  font-size: $font-lg;
  font-weight: 800;
  color: var(--text-primary);
  padding: $spacing-sm 0 $spacing-md;
  text-align: center;
}

/* 卡片 */
.card {
  background: var(--bg-card);
  border-radius: $radius-md;
  padding: $spacing-md;
  margin-bottom: $spacing-sm;
  border: 1rpx solid var(--border-color);
  box-sizing: border-box;

  .card-title {
    font-size: $font-md;
    font-weight: 700;
    color: var(--text-primary);
    display: block;
    margin-bottom: $spacing-xs;
  }
  .card-text {
    font-size: $font-sm;
    color: var(--text-secondary);
    line-height: 1.8;
    display: block;
  }
}

/* 示例 */
.example-item {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-xs 0;
  border-bottom: 1rpx solid rgba(0,0,0,0.03);

  &:last-child { border-bottom: none; }

  .ex-tag {
    flex-shrink: 0;
    font-size: 20rpx;
    font-weight: 600;
    padding: 4rpx 12rpx;
    border-radius: 20rpx;
    min-width: 64rpx;
    text-align: center;

    &.bill { background: rgba(245, 158, 11, 0.12); color: var(--color-bill); }
    &.diary { background: rgba(252, 211, 77, 0.15); color: var(--color-warning); }
    &.plan { background: rgba(16, 185, 129, 0.12); color: var(--color-plan); }
    &.multi { background: rgba(0, 0, 0, 0.06); color: var(--color-ai); }
    &.query { background: rgba(14, 165, 233, 0.12); color: var(--color-info); }
    &.undo { background: rgba(239, 68, 68, 0.12); color: var(--color-danger); }
  }

  .ex-text { flex: 1; font-size: $font-sm; color: var(--text-primary); }
  .ex-result { font-size: $font-xs; color: var(--text-hint); flex-shrink: 0; }
}

/* 反馈卡片 */
.feedback-card {
  padding: $spacing-sm $spacing-md;
  cursor: pointer;

  &:active { background: var(--bg-input); }
}

.fb-row {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
}

.fb-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.fb-title {
  font-size: $font-md;
  font-weight: 600;
  color: var(--text-primary);
}

.fb-desc {
  font-size: $font-xs;
  color: var(--text-hint);
}

.fb-arrow {
  font-size: $font-lg;
  color: var(--text-hint);
  font-weight: 300;
  flex-shrink: 0;
}
</style>
