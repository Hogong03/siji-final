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
		ensureBkdHandbook,
		ensureProfileSeed,
		removeCet6Content,
		migrateRecordTypes,
		migrateDiaryCategories,
		getPlanList,
		runAutoBackup
	} from '@/utils/storage.js'
	import {
		initReminder,
		startReminderChecker,
		checkAllReminders
	} from '@/utils/reminder.js'
	import { registerPlanPushes } from '@/utils/reminder/push-schedule.js'
	import { syncKeepAlive } from '@/utils/keepalive.js'
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
	import { initFontScale } from '@/utils/font-scale.js'

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
		// 字号档位初始化（4.13.0）：阅读面内联字号依赖这个响应式比例
		initFontScale()
		// 1. 仅恢复关键配置（AI/对话/设备ID）— 延迟非关键初始化到 splash 后
		store.restoreCriticalFromStorage()
		logger.log('[思迹] Critical storage restored, device:', store.deviceId)

		// 2. 非关键配置在 splash 跳转后执行（appReady 事件由 splash 页触发）
		uni.$once('appReady', () => {
			store.restoreNonCriticalFromStorage()
			try {
				ensureDefaultTemplates()
				// BKD 项目技术学习手册（4.19.0）：按 client_id 增量补发，用户删掉的不再补
				ensureBkdHandbook()
				// 个人画像内置（4.28.0）：经历/23 岁画像/学习计划/MBTI 四篇 + 「我的画像」画像卡，幂等补发
				try {
					ensureProfileSeed()
				} catch (e) {
					console.warn('[思迹] 个人画像补发失败：', e.message)
				}
				// 六级种子内容下线（4.19.0）：软删记录里的 cet6 种子与「六级备考」计划模板，幂等
				try {
					const c = removeCet6Content()
					if (c.diaryRemoved > 0 || c.tplRemoved > 0) {
						logger.log('[思迹] 六级内容下线：记录 ' + c.diaryRemoved + ' 条，模板 ' + c.tplRemoved + ' 个')
					}
				} catch (e) {
					console.warn('[思迹] 六级内容清理失败：', e.message)
				}
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
				// 4.22.0：不等轮询计时器，启动立即查一次（计划到期进 App 马上见到提醒 message，
				// 而不是等「正在启动」5 秒后才由定时器查）
				try {
					checkAllReminders()
				} catch (e) { /* ignore */ }
				// 4.22.0：本地推送预注册（未来 7 天滚动窗口）—— App 被杀/退后台也能收到系统通知
				try {
					registerPlanPushes()
				} catch (e) { /* ignore */ }
				// 4.35.0：后台常驻（App 端 Android 前台服务，开关在 设置 - 提示与提醒）
				// 插件没打进包时内部静默降级，不会影响启动
				try {
					syncKeepAlive()
				} catch (e) { /* ignore */ }
				// 3.4.5 / 3.5.12：进入总结（冷启动 + 回前台两条路径，回前台结算见 onShow）
				initEnterSummary()
				// 自动本地备份（App 端专属）：开关开（siji_auto_backup 默认开）且距上次超过 24h
				// 时静默备份到 _doc/siji-backup/（保留 3 份），失败不影响启动
				try {
					runAutoBackup().catch((e) => console.warn('[思迹] 自动备份失败:', (e && e.message) || e))
				} catch (e) {
					console.warn('[思迹] 自动备份调度失败:', (e && e.message) || e)
				}
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
		// 4.22.0：回前台重注册本地推送（60s 节流）—— 提醒配置或计划变更后滚动窗口自动对齐
		try {
			registerPlanPushes()
		} catch (e) {
			/* ignore */
		}

		// 4.35.0：回前台校正后台常驻状态（用户在系统里关过通知 / 系统杀过进程时补拉起）
		try {
			syncKeepAlive()
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
	/* 4.47 灵动性：全局接入微动效系统（按压/交错入场/弹层/反馈等）。
	   必须在 App.vue 非 scoped 样式里引入，切勿放进 vite additionalData，
	   否则 .card-list-stagger > * 这类选择器会被 scoped 作用域打断。 */
	@import './common/animation.scss';

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
	/* 4.10.3：浅色镜像 —— 框架 darkmode/内联残留（uni.setTabBarStyle 与 theme.json 跟随）
	   都可能把 tabbar 写成深色，浅色侧用对称 !important 镜像压回，任何来源都翻不了盘 */
	html:not(.theme-dark) .uni-tabbar {
		background-color: #F4F4F5 !important;
		border-top-color: #E4E4E7 !important;
		box-shadow: none;
	}
	html:not(.theme-dark) .uni-tabbar__label {
		color: #71717A !important;
	}
	html:not(.theme-dark) .uni-tabbar__item.uni-tabbar__item--active .uni-tabbar__label,
	html:not(.theme-dark) .uni-tabbar__item--active .uni-tabbar__label {
		color: #18181B !important;
	}
	/* #endif */

	/* 安全区适配 */
	.safe-area-bottom {
		padding-bottom: constant(safe-area-inset-bottom);
		padding-bottom: env(safe-area-inset-bottom);
	}

	/* ─── 子页面入场动画（fadeInUp 关键帧由 common/animation.scss 统一提供） ─── */
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

	/* ─── uni.showModal 全局美化（H5/App-vue）───
	 * 圆角 24rpx、淡入缩放动画、深色适配、黑白按钮
	 */
	/* #ifndef MP-WEIXIN */
	.uni-modal {
		border-radius: 24rpx !important;
		overflow: hidden;
		background: #FFFFFF !important;
		animation: modalPopIn 0.22s cubic-bezier(0.2, 0.8, 0.3, 1) !important;
	}

	.uni-modal-mask {
		background: rgba(0, 0, 0, 0.45) !important;
		animation: maskFadeIn 0.2s ease !important;
	}

	.uni-modal__title {
		font-size: 32rpx !important;
		font-weight: 600 !important;
		color: #18181B !important;
		padding: 36rpx 32rpx 12rpx !important;
	}

	.uni-modal__content {
		font-size: 28rpx !important;
		color: #3F3F46 !important;
		padding: 12rpx 32rpx 28rpx !important;
		line-height: 1.6 !important;
	}

	.uni-modal__btns {
		border-top: 1rpx solid #E4E4E7 !important;
	}

	.uni-modal__btn {
		font-size: 30rpx !important;
		font-weight: 500 !important;
		color: #18181B !important;
	}

	.uni-modal__btn:after {
		border-right: 1rpx solid #E4E4E7 !important;
	}

	/* 深色模式 */
	html.theme-dark .uni-modal {
		background: #27272A !important;
	}
	html.theme-dark .uni-modal__title {
		color: #FAFAFA !important;
	}
	html.theme-dark .uni-modal__content {
		color: #D4D4D8 !important;
	}
	html.theme-dark .uni-modal__btns {
		border-top-color: #3F3F46 !important;
	}
	html.theme-dark .uni-modal__btn {
		color: #FAFAFA !important;
	}
	html.theme-dark .uni-modal__btn:after {
		border-right-color: #3F3F46 !important;
	}

	@keyframes modalPopIn {
		from { opacity: 0; transform: scale(0.92) translateY(10rpx); }
		to { opacity: 1; transform: scale(1) translateY(0); }
	}

	@keyframes maskFadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	/* uni.showActionSheet 美化 */
	.uni-actionsheet {
		border-radius: 24rpx 24rpx 0 0 !important;
		overflow: hidden;
	}

	html.theme-dark .uni-actionsheet {
		background: #27272A !important;
	}
	html.theme-dark .uni-actionsheet__cell {
		color: #FAFAFA !important;
	}

	/* uni.showToast 美化 */
	.uni-toast {
		border-radius: 24rpx !important;
	}
	/* #endif */
</style>
