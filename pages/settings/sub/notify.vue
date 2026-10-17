<script setup>
/**
 * 提示与提醒 — 设置子页面（4.30.0）
 *
 * 一处关掉所有主动提示。分两组：
 *   进入聊天页：计划汇总表（每天首次弹的表）/ 进入简报卡（消息流里的开场卡）
 *   计划到点：应用内提醒（前台 toast）/ 应用外通知（锁屏与通知栏推送，App 端）
 *
 * 前三个开关落在 siji_reminder_settings 的 prompts 字段，第四个是同一份文档的 enabled。
 * 全部走 utils/reminder/settings.js，不新建存储键（避免又多一处要同步的配置源）。
 */
import { ref, onMounted } from 'vue'
import { getPromptFlag, setPromptFlag, getReminderSettings, saveReminderSettings } from '@/utils/reminder/settings.js'

const summarySheet = ref(true)
const briefing = ref(true)
const reminderToast = ref(true)
const pushNotify = ref(true)

onMounted(() => {
  summarySheet.value = getPromptFlag('summarySheet')
  briefing.value = getPromptFlag('briefing')
  reminderToast.value = getPromptFlag('reminderToast')
  pushNotify.value = getReminderSettings().enabled !== false
})

/** uni switch 的 change 事件取新值（e.detail.value） */
function onFlag(key, target, e) {
  const on = !!(e && e.detail && e.detail.value)
  target.value = setPromptFlag(key, on)
}

function onPush(e) {
  const on = !!(e && e.detail && e.detail.value)
  const s = getReminderSettings()
  s.enabled = on
  saveReminderSettings(s)
  pushNotify.value = on
}
</script>

<template>
  <view class="np-page">
    <text class="np-intro">尽量少打扰。这里决定思迹什么时候主动跟你说话。</text>

    <text class="np-group">进入聊天页</text>
    <view class="np-card">
      <view class="np-row">
        <view class="np-row-main">
          <text class="np-row-title">计划汇总表</text>
          <text class="np-row-desc">每天首次进聊天页，弹一张全部计划明细的表</text>
        </view>
        <switch :checked="summarySheet" color="#000000" @change="onFlag('summarySheet', summarySheet, $event)" />
      </view>
      <view class="np-row">
        <view class="np-row-main">
          <text class="np-row-title">进入简报卡</text>
          <text class="np-row-desc">开场消息里的问候、指标与建议按钮</text>
        </view>
        <switch :checked="briefing" color="#000000" @change="onFlag('briefing', briefing, $event)" />
      </view>
    </view>

    <text class="np-group">计划到点</text>
    <view class="np-card">
      <view class="np-row">
        <view class="np-row-main">
          <text class="np-row-title">应用内提醒</text>
          <text class="np-row-desc">正在用思迹时，到点弹一条轻提示</text>
        </view>
        <switch :checked="reminderToast" color="#000000" @change="onFlag('reminderToast', reminderToast, $event)" />
      </view>
      <view class="np-row">
        <view class="np-row-main">
          <text class="np-row-title">应用外通知</text>
          <text class="np-row-desc">退出应用后，通过通知栏提醒（App 端，需重新打包含推送模块）</text>
        </view>
        <switch :checked="pushNotify" color="#000000" @change="onPush" />
      </view>
    </view>

    <text class="np-foot">关掉只影响「主动提示」，计划与打卡数据不受影响；汇总表仍可从聊天页顶部计划按钮或计划页查看。</text>
  </view>
</template>

<style lang="scss" scoped>
.np-page {
	min-height: 100vh;
	background: #F4F4F5;
	padding: 24rpx 28rpx 60rpx;
}

.np-intro {
	display: block;
	font-size: 22rpx;
	color: #71717A;
	line-height: 1.6;
	padding: 0 8rpx 20rpx;
}

.np-group {
	display: block;
	font-size: 22rpx;
	font-weight: 600;
	color: #71717A;
	padding: 16rpx 8rpx 12rpx;
}

.np-card {
	background: #FFFFFF;
	border-radius: 20rpx;
	overflow: hidden;
}

.np-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 20rpx;
	padding: 24rpx 24rpx;
	border-bottom: 1rpx solid #F4F4F5;
}
.np-row:last-child {
	border-bottom-width: 0;
}
.np-row-main {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}
.np-row-title {
	font-size: 28rpx;
	color: #18181B;
}
.np-row-desc {
	font-size: 20rpx;
	color: #A1A1AA;
	line-height: 1.5;
}

.np-foot {
	display: block;
	font-size: 20rpx;
	color: #A1A1AA;
	line-height: 1.6;
	padding: 24rpx 8rpx 0;
}

/* 深色：H5 / App */
/* #ifndef MP-WEIXIN */
html.theme-dark {
	.np-page { background: #18181B; }
	.np-intro { color: #A1A1AA; }
	.np-group { color: #A1A1AA; }
	.np-card { background: #27272A; }
	.np-row { border-bottom-color: #3F3F46; }
	.np-row-title { color: #FAFAFA; }
	.np-row-desc { color: #71717A; }
	.np-foot { color: #71717A; }
}
/* #endif */

/* 深色：微信小程序 */
/* #ifdef MP-WEIXIN */
@media (prefers-color-scheme: dark) {
	.np-page { background: #18181B; }
	.np-intro { color: #A1A1AA; }
	.np-group { color: #A1A1AA; }
	.np-card { background: #27272A; }
	.np-row { border-bottom-color: #3F3F46; }
	.np-row-title { color: #FAFAFA; }
	.np-row-desc { color: #71717A; }
	.np-foot { color: #71717A; }
}
/* #endif */
</style>
