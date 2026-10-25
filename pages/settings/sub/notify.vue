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
 *
 * 4.35.0：新增「后台运行」组（仅 App 端）—— 后台常驻开关走 utils/keepalive.js
 * （Android 前台服务原生插件），钥匙单独存 siji_keepalive_enabled：它跟「要不要提示」
 * 是两件事，混进 siji_reminder_settings 会让「关掉常驻」连带影响提醒配置。
 */
import { ref, onMounted } from 'vue'
import { getPromptFlag, setPromptFlag, getReminderSettings, saveReminderSettings } from '@/utils/reminder/settings.js'
import {
  isKeepAliveOn,
  setKeepAliveOn,
  isKeepAliveSupported,
  startKeepAlive,
  stopKeepAlive,
  openBatteryOptimizationSettings
} from '@/utils/keepalive.js'

const summarySheet = ref(true)
const advice = ref(true)
const briefing = ref(true)
const reminderToast = ref(true)
const pushNotify = ref(true)
const keepAlive = ref(false)
const keepAliveSupported = ref(false)

onMounted(() => {
  summarySheet.value = getPromptFlag('summarySheet')
  advice.value = getPromptFlag('advice')
  briefing.value = getPromptFlag('briefing')
  reminderToast.value = getPromptFlag('reminderToast')
  pushNotify.value = getReminderSettings().enabled !== false
  keepAlive.value = isKeepAliveOn()
  // 4.48.2：开关本来就关着时不做插件探测 —— 标准基座里探测会打一条框架级
  // 「基座不包含原生插件」错误；等用户真去打开时再判，失败回滚并说明原因
  keepAliveSupported.value = keepAlive.value ? isKeepAliveSupported() : true
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

/** 后台常驻开关（4.35.0，App 端）：开即拉起 Android 前台服务，关即停掉并移除常驻通知 */
function onKeepAlive(e) {
  const on = !!(e && e.detail && e.detail.value)
  if (on) {
    keepAlive.value = setKeepAliveOn(true)
    if (!startKeepAlive()) {
      // 标准基座 / 旧包没打进原生插件：回滚开关并把「不支持」的说明露出来
      keepAlive.value = setKeepAliveOn(false)
      keepAliveSupported.value = isKeepAliveSupported()
      try {
        uni.showToast({ title: '当前安装包不含后台常驻插件，需自定义基座或云打包', icon: 'none', duration: 3000 })
      } catch (err) { /* toast 失败不影响开关 */ }
      return
    }
  } else {
    keepAlive.value = setKeepAliveOn(false)
    stopKeepAlive()
  }
  try {
    uni.showToast({ title: keepAlive.value ? '已开启后台常驻' : '已关闭后台常驻', icon: 'none' })
  } catch (err) { /* toast 失败不影响开关 */ }
}

/** 去系统电池优化列表放行（国产 ROM 杀后台的第一现场） */
function onBatteryOptimization() {
  const ok = openBatteryOptimizationSettings()
  if (!ok) {
    try {
      uni.showToast({ title: '请到 系统设置 - 应用 - 思迹 - 电池 手动设置', icon: 'none', duration: 3000 })
    } catch (err) { /* ignore */ }
  }
}
</script>

<template>
  <view class="np-page page-enter">
    <text class="np-intro">尽量少打扰。这里决定思迹什么时候主动跟你说话。</text>

    <text class="np-group">进入聊天页</text>
    <view class="np-card panel-in">
      <view class="np-row">
        <view class="np-row-main">
          <text class="np-row-title">计划汇总表</text>
          <text class="np-row-desc">每天首次进聊天页，弹一张全部计划明细的表</text>
        </view>
        <switch :checked="summarySheet" color="#000000" @change="onFlag('summarySheet', summarySheet, $event)" />
      </view>
      <view class="np-row">
        <view class="np-row-main">
          <text class="np-row-title">应用建议</text>
          <text class="np-row-desc">按内容、时段与运行环境给几条建议，情况变了才重出</text>
        </view>
        <switch :checked="advice" color="#000000" @change="onFlag('advice', advice, $event)" />
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
    <view class="np-card panel-in">
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

    <!-- #ifdef APP-PLUS -->
    <text class="np-group">后台运行</text>
    <view class="np-card panel-in">
      <view class="np-row">
        <view class="np-row-main">
          <text class="np-row-title">后台常驻</text>
          <text class="np-row-desc">通知栏常驻一条「正在后台运行」，减少被系统回收；关掉后到点提醒只剩本地推送一条路，国产 ROM 清理会漏</text>
        </view>
        <switch
          :checked="keepAlive"
          :disabled="!keepAliveSupported"
          color="#000000"
          @change="onKeepAlive"
        />
      </view>
      <view v-if="keepAliveSupported" class="np-row np-row-tap btn-tactile" @click="onBatteryOptimization">
        <view class="np-row-main">
          <text class="np-row-title">允许后台运行</text>
          <text class="np-row-desc">去系统「电池优化」把思迹设为不受限制（小米 / 华为 / OPPO 还需开自启动）</text>
        </view>
        <text class="np-arrow">›</text>
      </view>
      <view v-else class="np-row">
        <view class="np-row-main">
          <text class="np-row-title">当前安装包不支持</text>
          <text class="np-row-desc">标准基座没有内置原生插件，需用自定义基座或云打包（勾选本地插件 siji-keepalive）后重新安装</text>
        </view>
      </view>
    </view>
    <!-- #endif -->

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

/* 可点行（4.35.0 电池优化引导） */
.np-row-tap {
	transition: background-color 0.15s ease;
}
.np-row-tap:active {
	background: #F4F4F5;
}
.np-arrow {
	font-size: 32rpx;
	color: #D4D4D8;
	line-height: 1;
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
	.np-row-tap:active { background: #3F3F46; }
	.np-arrow { color: #52525B; }
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
	.np-row-tap:active { background: #3F3F46; }
	.np-arrow { color: #52525B; }
	.np-foot { color: #71717A; }
}
/* #endif */
</style>
