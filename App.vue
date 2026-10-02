<script setup>
	import {
		onLaunch,
		onShow,
		onHide
	} from '@dcloudio/uni-app'

	import {
		logger
	} from '@/utils/logger.js'
	import {
		reportError,
		reportRejection,
		flushErrors
	} from '@/utils/error-reporter.js'
	import {
		onErrorCaptured
	} from 'vue'
	import {
		useAppStore
	} from '@/store/index.js'
	import {
		rebuildIndex,
		ensureDefaultTemplates,
		ensureCet6Tips,
		migrateRecordTypes,
		migrateDiaryCategories,
		getPlanList
	} from '@/utils/storage.js'
	import {
		initReminder,
		startReminderChecker,
		checkAllReminders
	} from '@/utils/reminder.js'
	import {
		checkVersionUpdate,
		primeAppVersion
	} from '@/utils/version-check.js'
	import {
		initEnterSummary,
		markLeaveBaseline,
		refreshEnterSummary
	} from '@/composables/useEnterSummary.js'
	import {
		initTheme
	} from '@/utils/theme.js'

	const store = useAppStore()

	// 全局错误捕获 — 防止白屏（onErrorCaptured 来自 vue 而非 uni-app）
	onErrorCaptured((err, instance, info) => {
		console.error('[思迹] Global error:', err?.message || err, info)
		reportError(err, {
			info,
			component: instance?.$options?.name || 'unknown'
		})
		uni.showToast({
			title: '应用遇到一点问题，已自动恢复',
			icon: 'none',
			duration: 2000
		})
		return false // 阻止错误继续传播
	})

	onLaunch(() => {
		logger.log('[思迹] Launch')
		// App 端先读一次真实版本号（基座里 plus.runtime.version 是宿主版本）
		primeAppVersion()
		// 0. 主题初始化（4.8.0）：读 siji_theme_mode → 挂 .theme-dark 类 → 刷 tabBar/导航栏。
		// 放在最前，避免首屏闪浅色；MP 端自动退化（MP 无需类驱动）
		initTheme()
		// 1. 仅恢复关键配置（AI/对话/设备ID）— 延迟非关键初始化到 splash 后
		store.restoreCriticalFromStorage()
		logger.log('[思迹] Critical storage restored, device:', store.deviceId)

		// 2. 非关键配置在 splash 跳转后执行（appReady 事件由 splash 页触发）
		uni.$once('appReady', () => {
			store.restoreNonCriticalFromStorage()
			try {
				ensureDefaultTemplates()
				// 六级技巧记录（3.8.0）：按 client_id 增量补发，用户删掉的不再补
				ensureCet6Tips()
				// 记录模块收敛（4.2.0）：类型 5→3（灵感/闪念并入记录）+ 分类并入标签
				// 幂等：迁移过的记录不会二次改写；失败不影响启动
				try {
					const t = migrateRecordTypes()
					const c = migrateDiaryCategories()
					if (t.changed > 0 || c.changed > 0) {
						logger.log('[思迹] 记录迁移完成：类型 ' + t.changed + ' 条，分类转标签 ' + c.changed + ' 条')
					}
				} catch (e) {
					console.warn('[思迹] 记录迁移失败：', e.message)
				}
				rebuildIndex()
				initReminder(getPlanList)
				startReminderChecker()
				// 3.4.5 / 3.5.12：进入总结（冷启动 + 回前台两条路径，回前台结算见 onShow）
				initEnterSummary()
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
		try {
			checkVersionUpdate()
		} catch (e) {
			logger.warn('[思迹] Version check failed:', e.message)
		}

		// 6. App 端防截屏（隐私保护）
		// #ifdef APP-PLUS
		try {
			plus.screen.lockOrientation('portrait-primary')
			// 防止截屏（仅 Android 支持）
			if (plus.os.name === 'Android') {
				const Activity = plus.android.runtimeMainActivity()
				const win = Activity.getWindow()
				if (win) {
					const FLAG_SECURE = plus.android.importClass('android.view.WindowManager$LayoutParams')
						.FLAG_SECURE
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
		} catch (e) {
			/* ignore */
		}
		// #endif

		// 检查计划提醒（从后台回到前台时立即检查）
		try {
			checkAllReminders()
		} catch (e) {
			/* ignore */
		}

		// 3.5.12：回前台算「你不在时」的增量总结（60s 节流，后台不轮询、不设定时器）
		try {
			refreshEnterSummary()
		} catch (e) {
			/* ignore */
		}
	})

	onHide(() => {
		logger.log('[思迹] Hide')
		// 3.5.12：记下离开时刻，回前台据此算增量总结
		try {
			markLeaveBaseline()
		} catch (e) {
			/* ignore */
		}
		// flush 防抖队列 — 确保后台切换时数据不丢
		store.flushPersist && store.flushPersist()
	})
</script>

<style lang="scss">
	/* ==================== 全局样式 ==================== */

	/* 基础排版：页面底色统一 #F4F4F5（对话/阅读/表单页在各自 scoped 中覆盖为白底） */
	page,
	html,
	body,
	.uni-page-body {
		background-color: #F4F4F5;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
			'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif;
		font-size: $font-md;
		color: #18181B;
		line-height: 1.6;
		-webkit-font-smoothing: antialiased;
	}

	/* ─── 深色模式（4.8.0 双路径：H5/App 类驱动 + MP 系统跟随）─── */
	/* #ifndef MP-WEIXIN */
	html.theme-dark,
	html.theme-dark body,
	html.theme-dark .uni-page-body,
	html.theme-dark uni-page-body {
		background-color: #18181B;
		color: #F4F4F5;
	}
	/* #endif */
	/* #ifdef MP-WEIXIN */
	@media (prefers-color-scheme: dark) {
		page,
		html,
		body {
			background-color: #18181B;
			color: #F4F4F5;
		}
	}
	/* #endif */

	/* 滚动条隐藏 */
	::-webkit-scrollbar {
		width: 0;
		height: 0;
	}

	/* ─── 输入框占位符：统一 Zinc-400，深色提为 Zinc-500 ───
	 * 约 70 个输入框未配置 placeholder-style，深色下走系统默认偏淡。
	 * 本规则在 H5 / App-vue 生效（uni-app 编译产物含 .uni-input-placeholder 等 class）；
	 * 小程序端原生 input 不吃全局 class，继续走系统默认（可见，不处理）。
	 */
	.uni-input-placeholder,
	.uni-textarea-placeholder {
		color: #A1A1AA !important;
	}

	/* #ifndef MP-WEIXIN */
	html.theme-dark .uni-input-placeholder,
	html.theme-dark .uni-textarea-placeholder {
		color: #71717A !important;
	}
	/* #endif */
	/* #ifdef MP-WEIXIN */
	@media (prefers-color-scheme: dark) {
		.uni-input-placeholder,
		.uni-textarea-placeholder {
			color: #71717A !important;
		}
	}
	/* #endif */

	/* ─── H5 tabBar 深色兜底（4.8.1）───
	 * setTabBarStyle 只在 tab 页可调（子页面报 not TabBar page），
	 * H5 的 tabBar 是 DOM（.uni-tabbar），任意页面下都在文档里 —— 直接用 CSS 盖色，
	 * 颜色不依赖 JS API 成败；图标 src 由 theme.js 的 syncH5TabIcons 换。
	 */
	/* #ifndef MP-WEIXIN */
	html.theme-dark .uni-tabbar {
		background-color: #18181B !important;
		border-top-color: #000000 !important;
		box-shadow: none;
	}
	html.theme-dark .uni-tabbar__label {
		color: #A1A1AA !important;
	}
	html.theme-dark .uni-tabbar__item.uni-tabbar__item--active .uni-tabbar__label,
	html.theme-dark .uni-tabbar__item--active .uni-tabbar__label {
		color: #FFFFFF !important;
	}
	/* #endif */

	/* 安全区适配 */
	.safe-area-bottom {
		padding-bottom: constant(safe-area-inset-bottom);
		padding-bottom: env(safe-area-inset-bottom);
	}

	/* ─── 子页面入场动画 ─── */
	@keyframes fadeInUp {
		from {
			opacity: 0;
			transform: translateY(20rpx);
		}

		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.sub-page,
	.agent-page,
	.agent-add-page,
	.ai-page,
	.help-page,
	.memory-page,
	.profile-page,
	.feedback-page,
	.feedback-form-page {
		animation: fadeInUp 0.3s ease both;
	}
</style>
