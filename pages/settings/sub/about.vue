<script setup>
	/**
	 * 关于思迹 — 整合品牌展示 + 使用说明
	 * 合并原 about.vue + help.vue，消除 60%+ 重复内容
	 */
	import {
		ref
	} from 'vue'
	import SijiIcon from '@/components/common/SijiIcon.vue'

	const activeTab = ref('about')

	const tabs = [{
			id: 'about',
			iconName: 'info',
			label: '关于'
		},
		{
			id: 'chat',
			iconName: 'ai',
			label: 'AI对话'
		},
		{
			id: 'assistant',
			iconName: 'brain',
			label: 'AI助手'
		},
		{
			id: 'diary',
			iconName: 'diary',
			label: '记录'
		},
		{
			id: 'bill',
			iconName: 'bill',
			label: '记账'
		},
		{
			id: 'plan',
			iconName: 'plan',
			label: '计划'
		},
	]
</script>

<template>
	<view class="about-page">
		<!-- Tab 导航 -->
		<view class="tab-bar">
			<view v-for="t in tabs" :key="t.id" class="tab-item" :class="{ active: activeTab === t.id }"
				@tap="activeTab = t.id">
				<SijiIcon :name="t.iconName" size="xs"
					:color="activeTab === t.id ? '#18181B' : '#A1A1AA'" />
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

				<view class="card disclaimer-card" @tap="uni.navigateTo({ url: '/pages/disclaimer/index' })">
					<view class="disclaimer-link">
						<SijiIcon name="info" size="sm" color="#71717A" />
						<text class="disclaimer-link-text">用户协议与免责声明</text>
						<SijiIcon name="arrow-right" size="xs" color="#A1A1AA" />
					</view>
				</view>

				<view class="features-grid">
					<view class="feat-item">
						<SijiIcon name="ai" size="lg" color="#18181B" />
						<text class="feat-label">AI 对话</text>
						<text class="feat-desc">自然语言操作</text>
					</view>
					<view class="feat-item">
						<SijiIcon name="diary" size="lg" color="#18181B" />
						<text class="feat-label">记录</text>
						<text class="feat-desc">心情与标签</text>
					</view>
					<view class="feat-item">
						<SijiIcon name="bill" size="lg" color="#18181B" />
						<text class="feat-label">记账</text>
						<text class="feat-desc">预算与分类</text>
					</view>
					<view class="feat-item">
						<SijiIcon name="plan" size="lg" color="#18181B" />
						<text class="feat-label">计划</text>
						<text class="feat-desc">模板与统计</text>
					</view>
				</view>

				<view class="card">
					<text class="card-title">技术栈</text>
					<text class="card-text">uni-app · Vue 3 · Pinia · SCSS</text>
					<text class="card-text" style="margin-top: 8rpx;">多模型 AI：DeepSeek / OpenAI / Moonshot / 智谱 /
						通义</text>
				</view>

				<view class="card">
					<text class="card-title">隐私说明</text>
					<text class="card-text">· 所有数据存储在本地设备</text>
					<text class="card-text">· API Key 仅本地保存，不上传</text>
					<text class="card-text">· AI 对话内容发送到你所选的厂商服务器</text>
					<text class="card-text">· 无账号体系，无需注册登录</text>
				</view>
			</view>

			<!-- ===== AI 对话 ===== -->
			<view v-if="activeTab === 'chat'" class="content-section">
				<view class="section-title">思迹 AI · 对话即操作</view>

				<view class="card">
					<text class="card-title">核心理念</text>
					<text class="card-text">不需要打开「记记录」「记账」「建计划」三个页面。直接在对话框里用自然语言说话，AI 会自动识别你的意图并完成操作。支持发送图片让 AI
						识别内容。</text>
				</view>

				<view class="card">
					<text class="card-title">说话示例</text>
					<view class="example-item"><text class="ex-tag bill">记账</text><text
							class="ex-text">"午饭花了35"</text><text class="ex-result">→ 自动创建账单</text></view>
					<view class="example-item"><text class="ex-tag diary">记录</text><text
							class="ex-text">"今天心情不错"</text><text class="ex-result">→ 自动写记录</text></view>
					<view class="example-item"><text class="ex-tag plan">计划</text><text
							class="ex-text">"下周三完成报告"</text><text class="ex-result">→ 自动建计划</text></view>
					<view class="example-item"><text class="ex-tag multi">复合</text><text
							class="ex-text">"咖啡15，顺便定健身计划"</text><text class="ex-result">→ 记账+建计划</text></view>
					<view class="example-item"><text class="ex-tag query">查询</text><text
							class="ex-text">"这个月花了多少"</text><text class="ex-result">→ 自动查账单</text></view>
					<view class="example-item"><text class="ex-tag undo">撤销</text><text
							class="ex-text">"撤销刚才的操作"</text><text class="ex-result">→ 回退上一步</text></view>
				</view>

				<view class="card">
					<text class="card-title">快捷示例</text>
					<text class="card-text">首次对话时，欢迎消息下方有 3 个快捷示例 Chip，点击快速填入：</text>
					<view class="chip-row">
						<text class="mini-chip">💰 记一笔午餐 ¥25</text>
						<text class="mini-chip">📝 写个记录：今天很开心</text>
						<text class="mini-chip">📋 帮我规划下周工作</text>
					</view>
					<text class="card-text">点击后自动填入输入框，可修改后再发送。</text>
				</view>

				<view class="card">
					<text class="card-title">图片发送</text>
					<text class="card-text">输入框左侧图片按钮支持选择相册图片发送给 AI，AI 可识别图片内容并据此回应。适合拍照记账、截图提问等场景。</text>
				</view>

				<view class="card">
					<text class="card-title">消息重试</text>
					<text class="card-text">AI 响应失败时，底部出现重试栏，提供三个选项：</text>
					<text class="card-text">· 重新发送 — 用当前模型重新请求</text>
					<text class="card-text">· 换模型 — 切换到其他厂商模型重试</text>
					<text class="card-text">· 编辑 — 修改原消息后重新发送</text>
				</view>

				<view class="card">
					<text class="card-title">高风险确认</text>
					<text class="card-text">当金额 ≥ 500 元时，AI 会暂停执行并请求你确认，防止误操作大额支出。</text>
				</view>

				<view class="card">
					<text class="card-title">结果可编辑</text>
					<text class="card-text">AI 执行操作后，对话气泡中会显示结果卡片，点击「编辑」可修改金额、分类、标题等内容，点击「查看 →」可跳转到详情页。</text>
				</view>

				<view class="card">
					<text class="card-title">多轮对话</text>
					<text class="card-text">AI 会记住上下文，你可以连续对话：</text>
					<text class="card-text">你："午饭花了35" → AI："已记账 ✅"</text>
					<text class="card-text">你："再记一杯奶茶18" → AI："已记账 ✅"</text>
				</view>

				<view class="card">
					<text class="card-title">对话管理</text>
					<text class="card-text">左上角菜单按钮可打开对话列表，支持新建对话、切换历史对话、长按重命名/删除。</text>
				</view>

				<view class="card">
					<text class="card-title">Agent 切换</text>
					<text class="card-text">顶部导航栏点击厂商图标可打开统一切换面板，同时切换：</text>
					<text class="card-text">· AI 厂商 — DeepSeek / OpenAI / 智谱 / 通义千问 / Moonshot</text>
					<text class="card-text">· Agent 角色 — 默认助手 / 自定义 Agent</text>
					<text class="card-text">Agent 可自定义名称、性格、角色设定，不同场景用不同 Agent。</text>
				</view>

				<view class="card">
					<text class="card-title">流式输出与停止</text>
					<text class="card-text">AI 回复实时流式显示，发送中可点击 ■ 停止输出。支持 5 个 AI 厂商切换，独立配置 Key。</text>
				</view>
			</view>

			<!-- ===== AI 助手 ===== -->
			<view v-if="activeTab === 'assistant'" class="content-section">
				<view class="section-title">AI 助手 · 让 AI 更懂你</view>

				<view class="card">
					<text class="card-title">个人画像</text>
					<text class="card-text">填写你的基本信息（年龄、职业、兴趣、偏好等），AI 会根据画像提供更个性化的回应和建议。信息仅存储在本地，不上传。</text>
				</view>

				<view class="card">
					<text class="card-title">记忆管理</text>
					<text class="card-text">AI 会在对话中记住你的关键信息（如偏好、习惯、重要事件），可随时查看和管理 AI 记住的内容。支持手动删除不需要的记忆。</text>
				</view>

				<view class="card">
					<text class="card-title">关系图谱</text>
					<text class="card-text">管理你的人际关系网络。添加联系人信息（姓名、关系、备注），AI 在涉及人际关系的话题中可引用这些信息提供更贴切的建议。</text>
				</view>

				<view class="card">
					<text class="card-title">决策日志</text>
					<text class="card-text">记录重要决策的过程和依据。AI 可帮你梳理决策因素，并回顾历史决策，辅助未来判断。</text>
				</view>

				<view class="card">
					<text class="card-title">情景模拟</text>
					<text class="card-text">在安全环境中模拟各种社交场景（如面试、谈判、冲突处理）。AI 扮演不同角色，帮助你预演对话，提升表达和应变能力。</text>
					<text class="card-hint">💡 在聊天页顶部会出现模拟标识条，说「复盘」可结束模拟</text>
				</view>

				<view class="card">
					<text class="card-title">Agent 管理</text>
					<text class="card-text">创建和管理多个 AI Agent，每个 Agent 可自定义名称与图标、角色设定、回复风格。内置 5
						套模板：心理咨询师、健身教练、财务顾问、学习伙伴、极简助手。</text>
					<text class="card-hint">💡 所有 Agent 共用模型配置，系统提示词决定人设</text>
				</view>
			</view>

			<!-- ===== 记录 ===== -->
			<view v-if="activeTab === 'diary'" class="content-section">
				<view class="section-title">记录 · 记录每一天</view>

				<view class="card">
					<text class="card-title">创建方式</text>
					<text class="card-text">· 对话中说"写记录"或直接描述心情 → AI 自动创建</text>
					<text class="card-text">· 功能页 → 记录 → 点 + 号手动新建</text>
				</view>

				<view class="card">
					<text class="card-title">心情选择</text>
					<text class="card-text">每篇记录可选择心情（开心/平静/难过/兴奋/疲惫/愤怒），用于情绪趋势分析。</text>
				</view>

				<view class="card">
					<text class="card-title">标签管理</text>
					<text class="card-text">为记录添加标签（如"工作""旅行""生活"），方便分类筛选。标签颜色自动分配，支持自定义创建。</text>
				</view>

				<view class="card">
					<text class="card-title">标签筛选与按月浏览</text>
					<text class="card-text">记录列表页支持按标签筛选，点击标签按钮切换。按月份分组显示，左右切换月份查看历史记录。</text>
				</view>

				<view class="card">
					<text class="card-title">AI 润色</text>
					<text class="card-text">让 AI 帮你优化记录内容，提升表达质量。</text>
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
					<text class="card-title">月度预算</text>
					<text class="card-text">在记账页设置月度预算，顶部进度条实时显示本月消费占比，超支时变红提醒。</text>
				</view>

				<view class="card">
					<text class="card-title">分类筛选与备注搜索</text>
					<text class="card-text">横滑标签栏快速筛选某一分类。搜索框输入关键词，300ms 防抖自动搜索账单备注。</text>
				</view>

				<view class="card">
					<text class="card-title">消费分析</text>
					<text class="card-text">功能页展示消费分析模块：近 7 天柱状趋势图、月度总览、分类排行榜。详细统计页提供更全面的数据。</text>
				</view>

				<view class="card">
					<text class="card-title">日期分组与左滑操作</text>
					<text class="card-text">账单按日期自动分组显示，同一天消费汇总。列表项左滑可编辑或删除。</text>
				</view>

				<view class="card">
					<text class="card-title">自定义数字键盘</text>
					<text class="card-text">记账编辑页使用自定义数字键盘，大按键快速输入金额，支持快捷备注和日期选择。</text>
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
					<text class="card-title">优先级与子任务</text>
					<text class="card-text">· 3 级优先级：高/中/低，列表按优先级堆叠展示</text>
					<text class="card-text">· 子任务：勾选完成有进度反馈，AI 可自动拆解</text>
				</view>

				<view class="card">
					<text class="card-title">标签与筛选</text>
					<text class="card-text">计划支持标签分类，列表页支持 状态×优先级×标签 三维叠加筛选。</text>
				</view>

				<view class="card">
					<text class="card-title">统计看板</text>
					<text class="card-text">计划统计页展示：完成率四宫格、优先级分布、完成趋势、平均完成速度。</text>
				</view>

				<view class="card">
					<text class="card-title">模板系统</text>
					<text class="card-text">预设 5 套模板（每日复盘/读书计划/健身周计划/学习计划/项目周报），一键应用生成计划。也可自定义创建模板。</text>
					<text class="card-hint">💡 AI 可根据你的描述自动定制模板内容</text>
				</view>

				<view class="card">
					<text class="card-title">截止日期与提醒</text>
					<text class="card-text">计划详情页显示距截止日期的倒计时，超过会标红提醒。支持到时间自动通知。</text>
				</view>
			</view>

			<view style="height: 60rpx" />
		</scroll-view>
	</view>
</template>

<style scoped lang="scss">
	@import './about.scss';
</style>
