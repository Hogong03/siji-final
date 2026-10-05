<script setup>
/**
 * 设置页 v3 - 精简版
 *
 * 只保留设置类功能，非设置功能移至功能页
 */
import SijiIcon from '@/components/common/SijiIcon.vue'
import AgentAvatar from '@/components/common/AgentAvatar.vue'
import { onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { useAppStore } from '@/store/index.js'
import { AI_PROVIDERS } from '@/utils/api.js'
import { hasPin } from '@/utils/pin.js'
import { getVersion } from '@/utils/version-check.js'
import { getThemeMode, setThemeMode, normalizeMode } from '@/utils/theme.js'
import { FONT_SCALES, getFontScaleId, setFontScaleId } from '@/utils/font-scale.js'

const store = useAppStore()

// ─── 厂商图标映射 ───
const PROVIDER_ICONS = {
  deepseek: 'ds',
  openai: 'oa',
  moonshot: 'ms',
  zhipu: 'zg',
  qwen: 'qw'
}

const currentProvider = computed(() => AI_PROVIDERS[store.aiProvider] || AI_PROVIDERS.deepseek)
const currentModel = computed(() => currentProvider.value.models?.find(m => m.id === store.aiModel))
const hasKey = computed(() => !!store.providerKeys[store.aiProvider])
const pinStatus = computed(() => hasPin() ? '已开启' : '未开启')
const appVersion = computed(() => 'v' + getVersion())

// ─── 外观主题三选（4.8.0，MP-WEIXIN 隐藏；4.10.4 改自定义底部弹层）───
const themeLabel = { system: '跟随系统', light: '浅色', dark: '深色' }
const themeModeName = ref(themeLabel[getThemeMode()] || '跟随系统')
const themeMode = ref(getThemeMode())
const showThemeSheet = ref(false)
const currentFontScaleId = ref(getFontScaleId())
const themeOptions = [
  { id: 'system', label: '跟随系统', icon: 'monitor', desc: '随设备深浅自动切换' },
  { id: 'light', label: '浅色', icon: 'sun', desc: '' },
  { id: 'dark', label: '深色', icon: 'moon', desc: '' }
]

/** 打开自定义弹层（原生 ActionSheet 不随主题变色且无图标，弃用） */
function chooseFontScale(id) {
  setFontScaleId(id)
  currentFontScaleId.value = id
}
function pickTheme() {
  showThemeSheet.value = true
}

function chooseTheme(id) {
  const next = normalizeMode(id)
  setThemeMode(next)
  themeMode.value = next
  themeModeName.value = themeLabel[next]
  showThemeSheet.value = false
}

// ─── AI 写操作自动执行开关（3.0：默认关 = AI 写入前需确认）───
const autoWrite = ref(false)
function loadAutoWrite() {
  try { autoWrite.value = uni.getStorageSync('siji_auto_write') === '1' } catch (e) { autoWrite.value = false }
}
function toggleAutoWrite(e) {
  const on = !!(e && e.detail && e.detail.value)
  autoWrite.value = on
  try { uni.setStorageSync('siji_auto_write', on ? '1' : '0') } catch (err) { /* 忽略写入失败 */ }
}
loadAutoWrite()

const modelAbbr = computed(() => {
  const p = store.aiProvider
  if (p === 'deepseek') return 'DS'
  if (p === 'openai') return 'GPT'
  if (p === 'zhipu') return 'GLM'
  if (p === 'qwen') return 'Qwen'
  if (p === 'moonshot') return 'Kimi'
  return ''
})

// ─── 导航 ───
function go(target) {
  const m = {
    ai: '/pages/settings/sub/ai',
    agent: '/pages/settings/sub/agent',
    data: '/pages/settings/sub/data',
    privacy: '/pages/settings/sub/privacy',
    feedback: '/pages/settings/sub/feedback-list',
    devFeedback: '/pages/settings/sub/dev-feedback',
    aiEval: '/pages/settings/sub/ai-eval',
    about: '/pages/settings/sub/about',
    version: '/pages/settings/sub/version-history',
  }
  uni.navigateTo({ url: m[target] })
}
</script>

<template>
  <view class="page">
    <scroll-view class="scroll" scroll-y>

      <!-- ===== AI 配置 ===== -->
      <text class="sec-title">AI 配置</text>
      <view class="card card-ai-section slide-in-left-stagger">
        <view class="row ai-row card-press" @tap="go('ai')">
          <image
            :src="`/static/icons/provider-${PROVIDER_ICONS[store.aiProvider] || 'ds'}-v2.png`"
            mode="aspectFit"
            class="row-provider-logo"
          />
          <view class="row-body">
            <text class="row-label">AI 模型</text>
            <text class="row-desc">{{ currentProvider.name }} · {{ currentModel?.name || store.aiModel }}</text>
          </view>
          <view class="row-right">
            <view class="dot" :class="hasKey ? 'ok' : 'warn'" />
            <text class="row-value">{{ hasKey ? modelAbbr + ' · 已配置' : '未配置' }}</text>
            <text class="row-arrow">›</text>
          </view>
        </view>
      </view>
      <view class="card slide-in-left-stagger">
        <view class="row card-press" @tap="go('agent')">
          <AgentAvatar :name="store.activeAgent.name" :icon="store.activeAgent.icon" :size="64" />
          <view class="row-body">
            <text class="row-label">Agent 与模板</text>
            <text class="row-desc">{{ store.activeAgent.name }}{{ store.agents.length > 1 ? ' · 共' + store.agents.length + '个' : '' }}</text>
          </view>
          <text class="row-arrow">›</text>
        </view>
      </view>
      <view class="card slide-in-left-stagger">
        <view class="row">
          <view class="row-body">
            <text class="row-label">AI 自动执行写操作</text>
            <text class="row-desc">关闭时 AI 写入记录/账单/计划/画像前先出确认卡，点确认才落库</text>
          </view>
          <switch :checked="autoWrite" color="#000000" @change="toggleAutoWrite" />
        </view>
      </view>

      <!-- ===== 外观（4.8.0，MP-WEIXIN 无类驱动能力隐藏）===== -->
      <!-- #ifndef MP-WEIXIN -->
      <view class="card slide-in-left-stagger">
        <view class="row card-press" @tap="pickTheme">
          <SijiIcon name="moon" size="lg" class="row-icon" />
          <view class="row-body">
            <text class="row-label">外观</text>
            <text class="row-desc">深色模式下手动切换，不再强制跟随系统</text>
          </view>
          <text class="row-value">{{ themeModeName }}</text>
          <text class="row-arrow">›</text>
        </view>
      </view>
      <!-- #endif -->

      <!-- ===== 数据与安全 ===== -->
      <text class="sec-title">数据与安全</text>
      <view class="card slide-in-left-stagger">
        <view class="row card-press" @tap="go('data')">
          <SijiIcon name="download" size="lg" class="row-icon" />
          <view class="row-body"><text class="row-label">数据管理</text></view>
          <text class="row-arrow">›</text>
        </view>
        <view class="row card-press" @tap="go('privacy')">
          <SijiIcon name="lock" size="lg" class="row-icon" />
          <view class="row-body"><text class="row-label">应用锁</text></view>
          <text class="row-value">{{ pinStatus }}</text>
          <text class="row-arrow">›</text>
        </view>
      </view>

      <!-- ===== 关于 ===== -->
      <text class="sec-title">关于</text>
      <view class="card slide-in-left-stagger">
        <view class="row card-press" @tap="go('about')">
          <SijiIcon name="info" size="lg" class="row-icon" />
          <view class="row-body"><text class="row-label">关于思迹</text></view>
          <text class="row-value">{{ appVersion }}</text>
          <text class="row-arrow">›</text>
        </view>
        <view class="row card-press" @tap="go('version')">
          <SijiIcon name="info" size="lg" class="row-icon" />
          <view class="row-body"><text class="row-label">版本历史</text></view>
          <text class="row-arrow">›</text>
        </view>
        <view class="row card-press" @tap="go('feedback')">
          <SijiIcon name="mail" size="lg" class="row-icon" />
          <view class="row-body"><text class="row-label">体验反馈</text></view>
          <text class="row-arrow">›</text>
        </view>
        <view class="row card-press" @tap="go('devFeedback')">
          <SijiIcon name="bug" size="lg" class="row-icon" />
          <view class="row-body"><text class="row-label">开发者反馈</text></view>
          <text class="row-arrow">›</text>
        </view>
        <view class="row card-press" @tap="go('aiEval')">
          <SijiIcon name="stats" size="lg" class="row-icon" />
          <view class="row-body"><text class="row-label">AI 效果自检</text></view>
          <text class="row-arrow">›</text>
        </view>
      </view>

      <view style="height: 80rpx" />
    </scroll-view>

    <!-- 外观三选：自定义底部弹层（4.10.4）—— 原生 ActionSheet 不随主题变色且无图标 -->
    <view v-if="showThemeSheet" class="theme-sheet-mask" @tap="showThemeSheet = false">
      <view class="theme-sheet" @tap.stop>
        <view class="theme-sheet-head">
          <text class="theme-sheet-title">外观</text>
        </view>
        <view
          v-for="opt in themeOptions"
          :key="opt.id"
          class="theme-sheet-row"
          :class="{ active: themeMode === opt.id }"
          @tap="chooseTheme(opt.id)"
        >
          <SijiIcon :name="opt.icon" size="lg" class="theme-sheet-icon" />
          <text class="theme-sheet-label">{{ opt.label }}</text>
          <SijiIcon v-if="themeMode === opt.id" name="check" size="md" class="theme-sheet-check" />
        </view>
        <!-- 字号档位（4.13.0）：作用于对话气泡/简报卡/记录阅读页正文等阅读面 -->
        <view class="font-size-block">
          <text class="font-size-label">字号</text>
          <view class="font-size-opts">
            <view
              v-for="fs in FONT_SCALES"
              :key="fs.id"
              class="font-size-opt"
              :class="{ active: currentFontScaleId === fs.id }"
              @tap="chooseFontScale(fs.id)"
            >
              <text class="font-size-opt-text" :style="{ fontSize: Math.round(24 * fs.ratio) + 'rpx' }">{{ fs.label }}</text>
            </view>
          </view>
        </view>
        <view class="theme-sheet-cancel" @tap="showThemeSheet = false">
          <text class="theme-sheet-cancel-text">取消</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page { height: 100vh; background: #FAFAFA; }
.scroll { height: 100%; padding: $spacing-md; box-sizing: border-box; }

/* ─── Section 标题 ─── */
.sec-title {
  display: flex;
  align-items: center;
  gap: 12rpx;
  font-size: 28rpx;
  font-weight: 700;
  color: #18181B;
  letter-spacing: 1rpx;
  margin: 0 0 16rpx 4rpx;
  padding-left: 16rpx;
  border-left: 4rpx solid #18181B;
  &:first-child { margin-top: 0; padding-top: 0; }
}

/* ─── 统一卡片 ─── */
.card {
  background: #FFFFFF;
  border-radius: 24rpx;
  overflow: hidden;
  border: 1rpx solid #E4E4E7;
  margin-bottom: $spacing-lg;
}

/* ─── 统一行 ─── */
.row {
  display: flex;
  align-items: center;
  padding: 28rpx $spacing-md;
  border-bottom: 1rpx solid #F4F4F5;
  gap: $spacing-sm;
  box-sizing: border-box;
  &:last-child { border-bottom: none; }
  &:active { background: #F4F4F5; }
}

.ai-row { padding-top: 32rpx; padding-bottom: 32rpx; }

/* AI 配置区顶部黑条 */
.card-ai-section {
  border-top: 3rpx solid #000000;
}

/* 厂商 logo 替代 SijiIcon */
.row-provider-logo {
  width: 40rpx;
  height: 40rpx;
  border-radius: 10rpx;
  flex-shrink: 0;
}

.row-icon { flex-shrink: 0; }

.row-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4rpx; }
.row-label { font-size: $font-md; font-weight: 600; color: #18181B; 
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row-desc { font-size: $font-xs; color: #A1A1AA;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.row-right { display: flex; align-items: center; gap: 6rpx; flex-shrink: 0; }
.row-value { font-size: $font-xs; color: #A1A1AA; flex-shrink: 0; max-width: 40%;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row-arrow { font-size: $font-lg; color: #A1A1AA; font-weight: 300; flex-shrink: 0; }

.dot { width: 16rpx; height: 16rpx; border-radius: 50%; flex-shrink: 0;
  &.ok { background: #059669; box-shadow: none; }
  &.warn { background: #F59E0B; box-shadow: none; }
}

/* ─── 深色模式 ─── */
/* #ifndef MP-WEIXIN */
html.theme-dark {
  .page { background: #18181B; }
  .sec-title { color: #FAFAFA; border-left-color: #FAFAFA; }
  .card { background: #27272A; border-color: #3F3F46; }
  .row { border-bottom-color: #3F3F46; &:active { background: #3F3F46; } }
  .card-ai-section { border-top-color: #FFFFFF; }
  /* 厂商 logo 品牌色不反色，深色垫白底托（4.12.3，与 ai.scss 同规矩） */
  .row-provider-logo { background: #FFFFFF; }
  .row-label { color: #FAFAFA; }
  .row-desc, .row-value, .row-arrow { color: #A1A1AA; }
  .dot.ok { background: #10B981; }
  .dot.warn { background: #F59E0B; }
  /* 外观弹层（4.10.4） */
  .font-size-block { border-top-color: #3F3F46; }
  .font-size-label { color: #A1A1AA; }
  .font-size-opt { background: #27272A; border-color: #3F3F46; }
  .font-size-opt-text { color: #E4E4E7; }
  .font-size-opt.active {
    background: #FAFAFA;
    border-color: #FAFAFA;
    .font-size-opt-text { color: #18181B; }
  }
  .theme-sheet { background: #27272A; }
  .theme-sheet-title { color: #FAFAFA; }
  .theme-sheet-row { border-bottom-color: #3F3F46; &:active { background: #3F3F46; } }
  .theme-sheet-label { color: #FAFAFA; }
  .theme-sheet-row.active .theme-sheet-label { color: #FAFAFA; font-weight: 700; }
  .theme-sheet-icon { opacity: 1; }
.theme-sheet-cancel { border-top-color: #3F3F46; }
  .theme-sheet-cancel-text { color: #A1A1AA; }
}
/* #endif */

.font-size-block {
padding: 20rpx 24rpx 8rpx;
border-top: 1rpx solid #E4E4E7;
}
.font-size-label {
font-size: 24rpx;
color: #71717A;
}
.font-size-opts {
display: flex;
gap: 12rpx;
margin-top: 12rpx;
}
.font-size-opt {
flex: 1;
display: flex;
align-items: center;
justify-content: center;
padding: 14rpx 0;
background: #F4F4F5;
border: 2rpx solid #E4E4E7;
border-radius: 12rpx;
&.active {
background: #000000;
border-color: #000000;
.font-size-opt-text { color: #FFFFFF; }
}
}
.font-size-opt-text {
font-size: 24rpx;
color: #18181B;
}
/* #ifdef MP-WEIXIN */
@media (prefers-color-scheme: dark) {
  .page { background: #18181B; }
  .sec-title { color: #FAFAFA; border-left-color: #FAFAFA; }
  .card { background: #27272A; border-color: #3F3F46; }
  .row { border-bottom-color: #3F3F46; &:active { background: #3F3F46; } }
  .card-ai-section { border-top-color: #FFFFFF; }
  .row-label { color: #FAFAFA; }
  .row-desc, .row-value, .row-arrow { color: #A1A1AA; }
  .dot.ok { background: #10B981; }
  .dot.warn { background: #F59E0B; }
}
/* #endif */

/* ─── 外观弹层（4.10.4 自定义底部弹层，替代原生 ActionSheet）─── */
.theme-sheet-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 1000;
  animation: sheetMaskIn 0.2s ease both;
}
@keyframes sheetMaskIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.theme-sheet {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  background: #FFFFFF;
  border-radius: 24rpx 24rpx 0 0;
  padding: 24rpx 24rpx calc(24rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  z-index: 1001;
  animation: sheetUp 0.25s cubic-bezier(0.4, 0, 0.2, 1) both;
}
@keyframes sheetUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.theme-sheet-head {
  padding: 8rpx 8rpx 16rpx;
}
.theme-sheet-title {
  font-size: $font-sm;
  color: #71717A;
}
.theme-sheet-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 26rpx 12rpx;
  border-bottom: 1rpx solid #F4F4F5;

  &:last-of-type { border-bottom: none; }
  &:active { background: #F4F4F5; }
}
.theme-sheet-icon { opacity: 0.75; }
.theme-sheet-row.active .theme-sheet-icon { opacity: 1; }
.theme-sheet-label {
  flex: 1;
  font-size: $font-md;
  color: #18181B;
}
.theme-sheet-row.active .theme-sheet-label {
  font-weight: 700;
}
.theme-sheet-check { color: #18181B; }
.theme-sheet-cancel {
  margin-top: 12rpx;
  padding: 22rpx 0;
  border-top: 1rpx solid #F4F4F5;
  text-align: center;
}
.theme-sheet-cancel-text {
  font-size: $font-md;
  color: #71717A;
}
</style>
