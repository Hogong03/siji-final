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
	body {
		background-color: #F4F4F5;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
			'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif;
		font-size: $font-md;
		color: #18181B;
		line-height: 1.6;
		-webkit-font-smoothing: antialiased;
	}

	/* ─── 深色模式：页面底色统一 #18181B ─── */
	@media (prefers-color-scheme: dark) {
		page,
		html,
		body {
			background-color: #18181B;
			color: #F4F4F5;
		}
	}

	/* 滚动条隐藏 */
	::-webkit-scrollbar {
		width: 0;
		height: 0;
	}

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
