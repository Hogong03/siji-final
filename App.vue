<script setup>
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'

import { logger } from '@/utils/logger.js'
import { reportError, reportRejection, flushErrors } from '@/utils/error-reporter.js'
import { onErrorCaptured } from 'vue'
import { useAppStore } from '@/store/index.js'
import { rebuildIndex, ensureDefaultTemplates, getPlanList } from '@/utils/storage.js'
import { initReminder, startReminderChecker, checkAllReminders } from '@/utils/reminder.js'
import { checkVersionUpdate } from '@/utils/version-check.js'

const store = useAppStore()

// 全局错误捕获 — 防止白屏（onErrorCaptured 来自 vue 而非 uni-app）
onErrorCaptured((err, instance, info) => {
  console.error('[思迹] Global error:', err?.message || err, info)
  reportError(err, { info, component: instance?.$options?.name || 'unknown' })
  uni.showToast({
    title: '应用遇到一点问题，已自动恢复',
    icon: 'none',
    duration: 2000
  })
  return false // 阻止错误继续传播
})

onLaunch(() => {
  logger.log('[思迹] Launch')
  // 1. 仅恢复关键配置（AI/对话/设备ID）— 延迟非关键初始化到 splash 后
  store.restoreCriticalFromStorage()
  logger.log('[思迹] Critical storage restored, device:', store.deviceId)

  // 2. 非关键配置在 splash 跳转后执行（appReady 事件由 splash 页触发）
  uni.$once('appReady', () => {
    store.restoreNonCriticalFromStorage()
    try {
      ensureDefaultTemplates()
      rebuildIndex()
      initReminder(getPlanList)
      startReminderChecker()
    } catch (e) {
      console.warn('[思迹] Init failed:', e.message)
    }
  })

  // 3. 网络状态监听
  uni.onNetworkStatusChange(res => {
    store.setOnline(res.isConnected)
    if (res.isConnected) {
      // 网络恢复时尝试上报错误
      flushErrors()
    }
  })

  // 4. 全局 Promise rejection 捕获
  if (typeof uni.onUnhandledRejection === 'function') {
    uni.onUnhandledRejection(res => {
      reportRejection(res.reason)
    })
  }

  // 5. 版本更新检查
  try { checkVersionUpdate() } catch (e) { logger.warn('[思迹] Version check failed:', e.message) }

  // 6. App 端防截屏（隐私保护）
  // #ifdef APP-PLUS
  try {
    plus.screen.lockOrientation('portrait-primary')
    // 防止截屏（仅 Android 支持）
    if (plus.os.name === 'Android') {
      const Activity = plus.android.runtimeMainActivity()
      const win = Activity.getWindow()
      if (win) {
        const FLAG_SECURE = plus.android.importClass('android.view.WindowManager$LayoutParams').FLAG_SECURE
        if (typeof win.addFlags === 'function') {
          win.addFlags(FLAG_SECURE)
        } else if (typeof win.setFlags === 'function') {
          win.setFlags(FLAG_SECURE, FLAG_SECURE)
        }
        logger.log('[思迹] Anti-screenshot enabled (Android)')
      }
    }
  } catch (e) {
    logger.warn('[思迹] Anti-screenshot failed:', e.message)
  }
  // #endif
})

onShow(() => {
  logger.log('[思迹] Show')
  // H5 端提前请求通知权限
  // #ifdef H5
  try {
    if (window.Notification && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  } catch (e) { /* ignore */ }
  // #endif

  // 检查计划提醒（从后台回到前台时立即检查）
  try { checkAllReminders() } catch (e) { /* ignore */ }
})

onHide(() => {
  logger.log('[思迹] Hide')
  // flush 防抖队列 — 确保后台切换时数据不丢
  store.flushPersist && store.flushPersist()
})
</script>

<style lang="scss">
/* ==================== 全局样式 ==================== */

/* CSS 变量 — 动态主题切换 */
/* 注意：App 端 page 元素可能无法直接通过 [data-theme] 属性选择器命中 */
/* 因此同时使用 page、html、body 以及 [data-theme] 多重选择器确保覆盖 */
page,
html,
body {
  /* 浅色模式（默认） */
  --bg-page: $bg-page;
  --bg-card: $bg-card;
  --bg-card-alt: #E4E4E7;
  --bg-input: $bg-input;
  --bg-btn-secondary: $bg-btn-secondary;
  --bg-subtle: #E4E4E7;
  --bg-muted: #D4D4D8;
  --text-primary: $text-primary;
  --text-secondary: $text-secondary;
  --text-tertiary: $text-hint;
  --text-hint: $text-hint;
  --text-strong: $ai-primary-light;
  --text-mid: #52525B;
  --text-on-ai: $bg-card;
  --color-ai: $ai-primary;
  --color-plan: $success;
  --color-bill: $warning;
  --color-diary: $color-diary;
  --color-danger: $danger;
  --color-info: $info;
  --color-warning: #D97706;
  --color-danger-light: #FEE2E2;
  --color-danger-bg: #FEF2F2;
  --color-plan-light: #D1FAE5;
  --color-plan-bg: #ECFDF5;
  --color-bill-light: #FEF3C7;
  --color-bill-bg: #FFFBEB;
  --color-warn-bg: #FEF3C7;
  --color-amber: $warning;
  --color-red: $danger;
  --color-red-light: #FEE2E2;
  --color-pink: #EC4899;
  --color-info-light: #DBEAFE;
  --color-info-text: #1E40AF;
  --color-plan-text: #065F46;
  --color-bill-text: #92400E;
  --color-danger-text: #991B1B;
  --color-review-bg: #FEFCE8;
  --border-color: $glass-border-color;
  --border-strong: $border-color;
  --glass-bg: $bg-card;
  --glass-border: 1rpx solid $glass-border-color;
  --shadow-color: rgba(0, 0, 0, 0.06);

  background-color: var(--bg-page);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
    'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif;
  font-size: $font-md;
  color: var(--text-primary);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  transition: background-color 0.3s ease, color 0.3s ease;
}

/* ─── 深色模式覆盖 ─── */
@media (prefers-color-scheme: dark) {
  page, html, body {
    --bg-page: #09090B;
    --bg-card: $text-primary;
    --bg-card-alt: #27272A;
    --bg-input: #27272A;
    --bg-btn-secondary: #3F3F46;
    --bg-subtle: #1F1F23;
    --bg-muted: #2A2A2E;
    --text-primary: $bg-page;
    --text-secondary: $text-hint;
    --text-tertiary: $text-secondary;
    --text-hint: #52525B;
    --text-strong: $bg-card;
    --text-mid: $border-color;
    --text-on-ai: $bg-card;
    --color-ai: $ai-primary;
    --color-plan: $success;
    --color-bill: $warning;
    --color-diary: $color-diary;
    --color-danger: $danger;
    --color-info: $info;
    --color-warning: #D97706;
    --color-pink: #EC4899;
    --color-info-light: rgba(59, 130, 246, 0.15);
    --color-info-text: #93C5FD;
    --color-plan-text: #6EE7B7;
    --color-bill-text: #FCD34D;
    --color-danger-text: #FCA5A5;
    --color-review-bg: rgba(254, 240, 138, 0.08);
    --color-danger-light: rgba(239, 68, 68, 0.15);
    --color-danger-bg: rgba(239, 68, 68, 0.08);
    --color-plan-light: rgba(16, 185, 129, 0.15);
    --color-plan-bg: rgba(16, 185, 129, 0.08);
    --color-bill-light: rgba(245, 158, 11, 0.15);
    --color-bill-bg: rgba(245, 158, 11, 0.08);
    --color-warn-bg: rgba(245, 158, 11, 0.08);
    --color-amber: $warning;
    --color-red: $danger;
    --color-red-light: rgba(239, 68, 68, 0.15);
    --border-color: #27272A;
    --border-strong: $ai-primary-light;
    --glass-bg: $text-primary;
    --glass-border: 1rpx solid #27272A;
    --shadow-color: rgba(0, 0, 0, 0.3);
  }
}


/* 滚动条隐藏 */
::-webkit-scrollbar { width: 0; height: 0; }

/* ─── 全局点击反馈 ─── */
.tap-feedback {
  transition: background-color 0.15s ease, opacity 0.15s ease, transform 0.15s ease;
}
.tap-feedback:active {
  opacity: 0.85;
}

/* ─── 子页面入场动画 ─── */
.sub-page, .agent-page, .agent-add-page, .ai-page, .help-page, .memory-page, .profile-page, .feedback-page, .feedback-form-page {
  animation: fadeInUp 0.3s ease both;
}

/* 安全区适配 */
.safe-area-bottom {
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
}

/* ─── 卡片（极简） ─── */
.glass-card {
  background: var(--bg-card);
  border: 1rpx solid var(--border-color);
  border-radius: $radius-md;
}

/* ─── 渐入动画 ─── */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20rpx); }
  to { opacity: 1; transform: translateY(0); }
}
.fade-in-up { animation: fadeInUp 0.4s ease both; }

/* 通用工具类 */
.text-primary { color: var(--text-primary); }
.text-secondary { color: var(--text-secondary); }
.text-hint { color: var(--text-hint); }
.text-success { color: $success; }
.text-warning { color: $warning; }
.text-danger { color: $danger; }
.text-ai { color: var(--color-ai); }
.text-center { text-align: center; }
.font-xs { font-size: $font-xs; }
.font-sm { font-size: $font-sm; }
.font-md { font-size: $font-md; }
.font-lg { font-size: $font-lg; }
.font-xl { font-size: $font-xl; }
.font-xxl { font-size: $font-xxl; }
.mt-xs { margin-top: $spacing-xs; }
.mt-sm { margin-top: $spacing-sm; }
.mt-md { margin-top: $spacing-md; }
.mt-lg { margin-top: $spacing-lg; }
.mb-sm { margin-bottom: $spacing-sm; }
.mb-md { margin-bottom: $spacing-md; }
</style>
