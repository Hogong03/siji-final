<script setup>
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'

import { logger } from '@/utils/logger.js'
import { onErrorCaptured } from 'vue'
import { useAppStore } from '@/store/index.js'
import { trySync } from '@/utils/sync.js'
import { post, isOnline } from '@/utils/api.js'
import { rebuildIndex, ensureDefaultTemplates, getPlanList } from '@/utils/storage.js'
import { initReminder, startReminderChecker, checkAllReminders } from '@/utils/reminder.js'

const store = useAppStore()

// 全局错误捕获 — 防止白屏（onErrorCaptured 来自 vue 而非 uni-app）
onErrorCaptured((err, instance, info) => {
  console.error('[思迹] Global error:', err?.message || err, info)
  uni.showToast({
    title: '应用遇到一点问题，已自动恢复',
    icon: 'none',
    duration: 2000
  })
  return false // 阻止错误继续传播
})

onLaunch(() => {
  logger.log('[思迹] Launch')
    // 1. 仅恢复关键配置（AI/主题/对话）— 非关键延迟加载
  store.restoreCriticalFromStorage()
  logger.log('[思迹] Critical storage restored, device:', store.deviceId)

  // 2. 非关键配置延迟加载（首屏渲染后）
  // 使用 setTimeout(0) 让出主线程，在下一个事件循环执行
  setTimeout(() => {
    store.restoreNonCriticalFromStorage()
    // 3. 构建搜索索引 + 默认模板（紧跟非关键加载之后）
    setTimeout(() => {
      try {
        ensureDefaultTemplates()
        rebuildIndex()
        // 初始化提醒模块
        initReminder(getPlanList)
        startReminderChecker()
      } catch (e) {
        console.warn('[思迹] Init failed:', e.message)
      }
    }, 0)
  }, 0)

  // 4. 网络状态监听
  uni.onNetworkStatusChange(res => {
    store.setOnline(res.isConnected)
  })

  // 5. App 端防截屏（隐私保护）
  // #ifdef APP-PLUS
  try {
    plus.screen.lockOrientation('portrait-primary')
    // 防止截屏（仅 Android 支持）
    if (plus.os.name === 'Android') {
      const Activity = plus.android.runtimeMainActivity()
      const FLAG_SECURE = plus.android.importClass('android.view.WindowManager$LayoutParams').FLAG_SECURE
      Activity.getWindow().setFlags(FLAG_SECURE, FLAG_SECURE)
      logger.log('[思迹] Anti-screenshot enabled (Android)')
    }
  } catch (e) {
    logger.warn('[思迹] Anti-screenshot failed:', e.message)
  }
  // #endif
})

onShow(async () => {
  logger.log('[思迹] Show')
    // 刷新同步队列状态
  store.refreshSyncState()

  // H5 端提前请求通知权限
  // #ifdef H5
  try {
    if (window.Notification && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  } catch (e) { /* ignore */ }
  // #endif

  // 检查计划提醒（从后台回到前台时立即检查）
  try {
    // initReminder 可能在 onLaunch 的延迟回调中尚未执行，安全跳过
    checkAllReminders()
  } catch (e) { /* ignore */ }

  // 有网时尝试后台同步
  const online = await isOnline()
  store.setOnline(online)
  if (online && store.syncQueueLength > 0) {
    logger.log('[思迹] Auto sync, queue:', store.syncQueueLength)
    const result = await trySync(post)
    if (result.synced > 0) {
      store.refreshSyncState()
    }
  }
})

onHide(() => {
  logger.log('[思迹] Hide')
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
  --bg-page: #FAFAFA;
  --bg-card: #FFFFFF;
  --bg-card-alt: #F8F8F8;
  --bg-input: #F4F4F5;
  --bg-subtle: #FAFAFA;
  --bg-muted: #F4F4F5;
  --text-primary: #18181B;
  --text-secondary: #71717A;
  --text-tertiary: #A1A1AA;
  --text-hint: #A1A1AA;
  --text-strong: #3F3F46;
  --text-mid: #52525B;
  --text-on-ai: #FFFFFF;
  --color-ai: #000000;
  --color-plan: #10B981;
  --color-bill: #F59E0B;
  --color-diary: #FCD34D;
  --color-danger: #EF4444;
  --color-info: #0EA5E9;
  --color-warning: #D97706;
  --color-danger-light: #FEE2E2;
  --color-danger-bg: #FEF2F2;
  --color-plan-light: #D1FAE5;
  --color-plan-bg: #ECFDF5;
  --color-bill-light: #FEF3C7;
  --color-bill-bg: #FFFBEB;
  --color-warn-bg: #FEF3C7;
  --color-amber: #F59E0B;
  --color-red: #EF4444;
  --color-red-light: #FEE2E2;
  --color-pink: #EC4899;
  --border-color: #E4E4E7;
  --border-strong: #D4D4D8;
  --glass-bg: #FFFFFF;
  --glass-border: 1rpx solid #E4E4E7;
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
