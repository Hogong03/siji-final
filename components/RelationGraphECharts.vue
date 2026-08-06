<template>
	<view class="echarts-wrap">
		<view
			:id="containerId"
			class="echarts-container"
			:prop="chartOption"
			:change:prop="echartsHandler.update"
			:style="{ width: width, height: height }"
		></view>
	</view>
</template>

<script>
/**
 * ECharts 力导向关系图组件（renderjs 渲染）
 * 仅支持 H5 + App-vue（小程序不支持 renderjs）
 *
 * Props:
 *   chartOption: ECharts option 对象
 *   width/height: 容器尺寸
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

function loadEcharts() {
	if (loadPromise) return loadPromise
	loadPromise = new Promise((resolve, reject) => {
		if (echartsLib) { resolve(echartsLib); return }
		// 检查全局是否已加载
		if (typeof window !== 'undefined' && window.echarts) {
			echartsLib = window.echarts
			resolve(echartsLib)
			return
		}
		// 动态加载 echarts.min.js
		const script = document.createElement('script')
		// H5 端从 static 目录加载，App 端 renderjs 也有 DOM 可加载本地文件
		script.src = './static/js/echarts.min.js'
		script.onload = () => {
			echartsLib = window.echarts
			if (echartsLib) {
				resolve(echartsLib)
			} else {
				reject(new Error('echarts loaded but not found in window'))
			}
		}
		script.onerror = (e) => { reject(new Error('script load failed')) }
		document.head.appendChild(script)
	})
	return loadPromise
}

export default {
	mounted() {
		this.initChart()
	},
	methods: {
		async initChart() {
			try {
				await loadEcharts()
				const container = this.$el.querySelector('.echarts-container')
				if (!container) return
				chartInstance = echartsLib.init(container)
				// 空初始图
				chartInstance.setOption({
					series: [{
						type: 'graph',
						layout: 'force',
						data: [],
						links: []
					}]
				})
			} catch (e) {
				console.error('[echarts] init failed:', e)
			}
		},
		update(newValue) {
			if (!chartInstance || !newValue) return
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
