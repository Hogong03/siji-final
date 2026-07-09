<script setup>
/**
 * 使用说明子页面
 * 应用功能总览 + 各模块详细说明
 */

import { ref } from 'vue'

const activeSection = ref('chat')

const sections = [
  { id: 'chat', icon: '💬', title: '思迹 AI', desc: '对话即操作' },
  { id: 'diary', icon: '📝', title: '日记', desc: '记录每一天' },
  { id: 'bill', icon: '💰', title: '记账', desc: '收支一目了然' },
  { id: 'plan', icon: '📋', title: '计划', desc: '任务与模板' },
  { id: 'settings', icon: '⚙️', title: '设置', desc: '配置与隐私' }
]

const statusBarHeight = ref(0)
statusBarHeight.value = uni.getSystemInfoSync().statusBarHeight || 0
</script>

<template>
  <view class="help-page">
    <scroll-view class="help-scroll" scroll-y>
      <!-- 侧边导航 -->
      <view class="side-nav">
        <view
          v-for="s in sections" :key="s.id"
          class="nav-tab"
          :class="{ active: activeSection === s.id }"
          @tap="activeSection = s.id"
        >
          <text class="tab-icon">{{ s.icon }}</text>
          <text class="tab-title">{{ s.title }}</text>
          <text class="tab-desc">{{ s.desc }}</text>
        </view>
      </view>

      <!-- ===== 思迹 AI ===== -->
      <view v-if="activeSection === 'chat'" class="content-section">
        <view class="section-hero">
          <text class="hero-icon">💬</text>
          <text class="hero-title">思迹 AI</text>
          <text class="hero-subtitle">跟它说话，它帮你做</text>
        </view>

        <view class="card">
          <text class="card-title">📌 核心理念</text>
          <text class="card-text">不需要打开「记日记」「记账」「建计划」三个页面。直接在对话框里用自然语言说话，AI 会自动识别你的意图并完成操作。</text>
        </view>

        <view class="card">
          <text class="card-title">🗣️ 说话示例</text>
          <view class="example-list">
            <view class="example-item">
              <text class="ex-tag bill">记账</text>
              <text class="ex-text">"午饭花了35"</text>
              <text class="ex-result">→ 自动创建账单</text>
            </view>
            <view class="example-item">
              <text class="ex-tag diary">日记</text>
              <text class="ex-text">"今天心情不错，阳光很好"</text>
              <text class="ex-result">→ 自动写日记</text>
            </view>
            <view class="example-item">
              <text class="ex-tag plan">计划</text>
              <text class="ex-text">"下周三完成项目报告"</text>
              <text class="ex-result">→ 自动建计划</text>
            </view>
            <view class="example-item">
              <text class="ex-tag multi">复合</text>
              <text class="ex-text">"买咖啡15，顺便定健身计划"</text>
              <text class="ex-result">→ 同时记账+建计划</text>
            </view>
            <view class="example-item">
              <text class="ex-tag query">查询</text>
              <text class="ex-text">"这个月花了多少"</text>
              <text class="ex-result">→ 自动查账单</text>
            </view>
            <view class="example-item">
              <text class="ex-tag undo">撤销</text>
              <text class="ex-text">"撤销刚才的操作"</text>
              <text class="ex-result">→ 回退上一步</text>
            </view>
          </view>
        </view>

        <view class="card">
          <text class="card-title">⚡ 快捷短语</text>
          <text class="card-text">输入框上方有 4 个快捷芯片，点击可快速填入常用指令：</text>
          <view class="chip-row">
            <text class="mini-chip">💰 记一笔</text>
            <text class="mini-chip">📝 写日记</text>
            <text class="mini-chip">📋 定计划</text>
            <text class="mini-chip">📊 这个月花了多少？</text>
          </view>
          <text class="card-text">已有文本时点击会追加，不会覆盖你输入的内容。</text>
        </view>

        <view class="card">
          <text class="card-title">🏷️ 标签标记</text>
          <text class="card-text">点击记账/日记/计划/查询按钮可插入标签 chip，多个标签叠加发送，AI 会按标签明确意图执行。标签可单独删除，发送后清空。</text>
        </view>

        <view class="card">
          <text class="card-title">⏸️ 高风险确认</text>
          <text class="card-text">当金额 ≥ 500 元时，AI 会暂停执行并请求你确认，防止误操作大额支出。</text>
        </view>

        <view class="card">
          <text class="card-title">✏️ 结果可编辑</text>
          <text class="card-text">AI 执行操作后，对话气泡中会显示结果卡片，点击「编辑」可修改金额、分类、标题等内容，点击「查看 →」可跳转到详情页。</text>
        </view>

        <view class="card">
          <text class="card-title">🔄 多轮对话</text>
          <text class="card-text">AI 会记住上下文，你可以连续对话：</text>
          <text class="card-text">你："午饭花了35"</text>
          <text class="card-text">AI："已记账 ✅"</text>
          <text class="card-text">你："再记一杯奶茶18"</text>
          <text class="card-text">AI："已记账 ✅"</text>
        </view>

        <view class="card">
          <text class="card-title">🤖 多模型切换</text>
          <text class="card-text">支持 5 个 AI 厂商：DeepSeek、OpenAI、Moonshot、智谱 GLM、通义千问。在「设置 → AI 模型配置」中切换，每个厂商可独立配置 Key。</text>
        </view>
      </view>

      <!-- ===== 日记 ===== -->
      <view v-if="activeSection === 'diary'" class="content-section">
        <view class="section-hero">
          <text class="hero-icon">📝</text>
          <text class="hero-title">日记</text>
          <text class="hero-subtitle">记录每天的点滴</text>
        </view>

        <view class="card">
          <text class="card-title">📌 创建日记</text>
          <text class="card-text">方式一：在思迹对话中说"写日记"或直接描述心情</text>
          <text class="card-text">方式二：功能页 → 日记 → 点 + 号新建</text>
        </view>

        <view class="card">
          <text class="card-title">😊 心情选择</text>
          <text class="card-text">每篇日记可选择心情（开心/平静/难过/兴奋/疲惫/愤怒），用于情绪趋势分析。</text>
        </view>

        <view class="card">
          <text class="card-title">🏷️ 标签管理</text>
          <text class="card-text">为日记添加标签（如"工作""旅行""生活"），方便分类筛选。标签颜色自动分配，支持自定义创建。</text>
        </view>

        <view class="card">
          <text class="card-title">🔍 标签筛选</text>
          <text class="card-text">日记列表页支持按标签筛选，点击标签按钮切换，月份切换时自动重置。</text>
        </view>

        <view class="card">
          <text class="card-title">📖 按月浏览</text>
          <text class="card-text">日记按月份分组显示，左右切换月份查看历史记录。</text>
        </view>
      </view>

      <!-- ===== 记账 ===== -->
      <view v-if="activeSection === 'bill'" class="content-section">
        <view class="section-hero">
          <text class="hero-icon">💰</text>
          <text class="hero-title">记账</text>
          <text class="hero-subtitle">收支清清楚楚</text>
        </view>

        <view class="card">
          <text class="card-title">📌 快速记账</text>
          <text class="card-text">方式一：在思迹对话中直接说金额和用途</text>
          <text class="card-text">方式二：记账页点 + 号，选分类、输金额、保存</text>
          <text class="card-text">方式三：记账页右下角浮动按钮快速记账</text>
        </view>

        <view class="card">
          <text class="card-title">📊 月度预算</text>
          <text class="card-text">在记账页设置月度预算，顶部进度条实时显示本月消费占比，超支时变红提醒。</text>
        </view>

        <view class="card">
          <text class="card-title">🏷️ 分类筛选</text>
          <text class="card-text">横滑标签栏快速筛选某一分类的消费记录。</text>
        </view>

        <view class="card">
          <text class="card-title">🔍 备注搜索</text>
          <text class="card-text">搜索框输入关键词，300ms 防抖自动搜索账单备注。</text>
        </view>

        <view class="card">
          <text class="card-title">📅 日期分组</text>
          <text class="card-text">账单按日期自动分组显示，同一天的消费汇总在一起。</text>
        </view>

        <view class="card">
          <text class="card-title">↔️ 左滑操作</text>
          <text class="card-text">账单列表项左滑可编辑或删除，无需长按。</text>
        </view>

        <view class="card">
          <text class="card-title">⌨️ 数字键盘</text>
          <text class="card-text">记账编辑页使用自定义数字键盘，大按键快速输入金额，支持快捷备注和日期选择。</text>
        </view>
      </view>

      <!-- ===== 计划 ===== -->
      <view v-if="activeSection === 'plan'" class="content-section">
        <view class="section-hero">
          <text class="hero-icon">📋</text>
          <text class="hero-title">计划</text>
          <text class="hero-subtitle">任务管理 + 模板系统</text>
        </view>

        <view class="card">
          <text class="card-title">📌 创建计划</text>
          <text class="card-text">方式一：在思迹对话中描述任务</text>
          <text class="card-text">方式二：计划页点 + 号新建</text>
        </view>

        <view class="card">
          <text class="card-title">🎯 优先级</text>
          <text class="card-text">计划支持 3 级优先级（高/中/低），列表页按优先级堆叠展示。</text>
        </view>

        <view class="card">
          <text class="card-title">☑️ 子任务</text>
          <text class="card-text">计划详情页可添加子任务，勾选完成时有进度条反馈。AI 可帮你自动拆解子任务。</text>
        </view>

        <view class="card">
          <text class="card-title">🏷️ 标签</text>
          <text class="card-text">计划支持标签分类，列表页支持 状态×优先级×标签 三维叠加筛选。</text>
        </view>

        <view class="card">
          <text class="card-title">📊 统计看板</text>
          <text class="card-text">计划统计页展示：完成率四宫格、优先级分布、完成趋势、平均完成速度。</text>
        </view>

        <view class="card">
          <text class="card-title">📋 模板系统</text>
          <text class="card-text">预设 5 套模板（每日复盘/读书计划/健身周计划/学习计划/项目周报），一键应用生成计划。也可自定义创建模板。</text>
          <text class="card-hint">💡 AI 可根据你的描述自动定制模板内容</text>
        </view>

        <view class="card">
          <text class="card-title">⏰ 倒计时</text>
          <text class="card-text">计划详情页显示距截止日期的倒计时，超过会标红提醒。</text>
        </view>
      </view>

      <!-- ===== 设置 ===== -->
      <view v-if="activeSection === 'settings'" class="content-section">
        <view class="section-hero">
          <text class="hero-icon">⚙️</text>
          <text class="hero-title">设置</text>
          <text class="hero-subtitle">配置你的思迹</text>
        </view>

        <view class="card">
          <text class="card-title">🤖 AI 模型配置</text>
          <text class="card-text">支持 DeepSeek、OpenAI、Moonshot、智谱 GLM、通义千问 5 个厂商。每个厂商需独立申请 API Key，Key 仅存储在本地。</text>
          <text class="card-hint">💡 测试连接会消耗少量 Token</text>
        </view>

        <view class="card">
          <text class="card-title">🔄 数据同步与导出</text>
          <text class="card-text">支持 JSON / CSV 格式导出全部数据到本地。同步队列自动管理离线操作，联网后自动同步。</text>
        </view>

        <view class="card">
          <text class="card-title">🎨 外观主题</text>
          <text class="card-text">三种模式：浅色、深色、跟随系统。全局通过 CSS 变量统一管理。</text>
        </view>

        <view class="card">
          <text class="card-title">🔒 应用锁</text>
          <text class="card-text">设置 PIN 码保护隐私，每次打开应用需输入 PIN。</text>
        </view>

        <view class="card">
          <text class="card-title">💌 体验反馈</text>
          <text class="card-text">本地存储的反馈系统，支持 4 类分类（功能建议/Bug反馈/体验感受/功能需求）和 1-5 星评分。</text>
        </view>

        <view class="card">
          <text class="card-title">🔒 隐私说明</text>
          <text class="card-text">• 所有数据存储在本地设备</text>
          <text class="card-text">• API Key 仅本地保存，不上传</text>
          <text class="card-text">• AI 对话内容发送到你所选的厂商服务器</text>
          <text class="card-text">• 无账号体系，无需注册登录</text>
        </view>
      </view>

      <view style="height: 80rpx" />
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.help-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-page);
  overflow: hidden;
}

/* 侧边导航 */
.side-nav {
  display: flex;
  gap: 8rpx;
  padding: $spacing-md;
  overflow-x: auto;
  white-space: nowrap;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar { display: none; }
}

.nav-tab {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $spacing-sm $spacing-md;
  border-radius: $radius-md;
  background: var(--bg-card);
  border: 2rpx solid transparent;
  min-width: 140rpx;
  transition: all $transition-fast;

  &.active {
    border-color: rgba(0, 0, 0, 0.15);
    background: rgba(0, 0, 0, 0.04);
  }

  .tab-icon { font-size: 32rpx; }
  .tab-title {
    font-size: $font-sm;
    font-weight: 600;
    color: var(--text-primary);
    margin-top: 4rpx;
  }
  .tab-desc {
    font-size: 20rpx;
    color: var(--text-hint);
    margin-top: 2rpx;
  }
}

/* 内容区 */
.content-section {
  padding: 0 $spacing-md;
  box-sizing: border-box;
}

/* Hero */
.section-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $spacing-lg $spacing-md;
  margin-bottom: $spacing-md;

  .hero-icon { font-size: 72rpx; }
  .hero-title {
    font-size: $font-xl;
    font-weight: 800;
    color: var(--text-primary);
    margin-top: $spacing-xs;
  }
  .hero-subtitle {
    font-size: $font-sm;
    color: var(--text-secondary);
    margin-top: 4rpx;
  }
}

/* 卡片 */
.card {
  background: var(--bg-card);
  border-radius: $radius-lg;
  padding: $spacing-md;
  margin-bottom: $spacing-sm;
  box-shadow: $shadow-sm;
  box-sizing: border-box;
  overflow: hidden;

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

  .card-hint {
    font-size: $font-xs;
    color: var(--text-hint);
    display: block;
    margin-top: 8rpx;
  }
}

/* 示例列表 */
.example-list {
  margin-top: $spacing-xs;
}

.example-item {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-xs 0;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.03);

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

  .ex-text {
    flex: 1;
    font-size: $font-sm;
    color: var(--text-primary);
  }

  .ex-result {
    font-size: $font-xs;
    color: var(--text-hint);
    flex-shrink: 0;
  }
}

/* 小芯片 */
.chip-row {
  display: flex;
  gap: 8rpx;
  margin: $spacing-xs 0;
  flex-wrap: wrap;
}

.mini-chip {
  font-size: $font-xs;
  padding: 6rpx 16rpx;
  border-radius: 24rpx;
  background: rgba(0, 0, 0, 0.04);
  color: var(--color-ai);
  font-weight: 500;
}
</style>
