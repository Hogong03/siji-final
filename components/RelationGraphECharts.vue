<template>
	<view class="echarts-wrap">
		<view
			:id="containerId"
			class="echarts-container"
			:prop="chartOption"
			:change:prop="echartsHandler.update"
			:opts="containerId"
			:change:opts="echartsHandler.setContainerId"
			:style="{ width: width, height: height }"
		></view>
	</view>
</template>

<script>
/**
 * ECharts 力导向关系图组件（renderjs 渲染）
 * 仅支持 H5 + App-vue（小程序不支持 renderjs）
 */
export default {
	props: {
		chartOption: { type: Object, default: () => ({}) },
		width: { type: String, default: '100%' },
		height: { type: String, default: '400px' },
		containerId: { type: String, default: 'echarts-relation' }
	},
	mounted() {
		this.$emit('ready')
	}
}
</script>

<!-- renderjs 层：直接操作 DOM + echarts -->
<script module="echartsHandler" lang="renderjs">
let chartInstance = null
let echartsLib = null
let loadPromise = null
let pendingOption = null
let currentContainerId = 'echarts-relation'

function loadEcharts() {
	if (loadPromise) return loadPromise
	loadPromise = new Promise((resolve, reject) => {
		if (echartsLib) { resolve(echartsLib); return }
		if (typeof window !== 'undefined' && window.echarts) {
			echartsLib = window.echarts
			resolve(echartsLib)
			return
		}
		const script = document.createElement('script')
		// App 端路径相对于根目录，H5 端相对于当前页面
		// 两种路径都试一下
		script.src = './static/js/echarts.min.js'
		script.onload = () => {
			echartsLib = window.echarts
			if (echartsLib) {
				resolve(echartsLib)
			} else {
				reject(new Error('echarts loaded but not found in window'))
			}
		}
		script.onerror = () => {
			// fallback: 绝对路径
			const fallback = document.createElement('script')
			fallback.src = '/static/js/echarts.min.js'
			fallback.onload = () => {
				echartsLib = window.echarts
				if (echartsLib) resolve(echartsLib)
				else reject(new Error('echarts fallback load failed'))
			}
			fallback.onerror = () => reject(new Error('echarts script load failed'))
			document.head.appendChild(fallback)
		}
		document.head.appendChild(script)
	})
	return loadPromise
}

export default {
	mounted() {
		this.initChart()
	},
	methods: {
		setContainerId(val) {
			if (val) currentContainerId = val
		},
		async initChart() {
			try {
				await loadEcharts()
				// 等待 DOM 完全渲染
				await new Promise(r => setTimeout(r, 100))
				const container = document.getElementById(currentContainerId)
					|| document.querySelector('.echarts-container')
				if (!container) {
					console.error('[echarts] container not found:', currentContainerId)
					return
				}
				chartInstance = echartsLib.init(container)
				if (pendingOption) {
					chartInstance.setOption(pendingOption, true)
					pendingOption = null
				}
			} catch (e) {
				console.error('[echarts] init failed:', e)
			}
		},
		update(newValue) {
			if (!newValue) return
			if (!chartInstance) {
				pendingOption = newValue
				this.initChart().then(() => {
					if (chartInstance && pendingOption) {
						chartInstance.setOption(pendingOption, true)
						pendingOption = null
					}
				})
				return
			}
			chartInstance.setOption(newValue, true)
		}
	},
	beforeDestroy() {
		if (chartInstance) {
			chartInstance.dispose()
			chartInstance = null
		}
	}
}
</script>

<style scoped>
.echarts-wrap { width: 100%; }
.echarts-container { width: 100%; min-height: 400px; }
</style>
