/**
 * AI 功能面板（AiToolPanel）静态守卫测试（4.29.0）
 *
 * 输入行的图片/文件/语音按钮收进「+」底部面板。项目不挂载组件（无 test-utils），
 * 沿用 sfc-bindings / theme-mode 的静态扫描风格，防止：
 *  - 动作项缺失、action 名写错
 *  - vision/voice 能力门控被删
 *  - InputArea 接线回退（旧按钮复活、面板未挂载、动作未分发）
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const panelSrc = fs.readFileSync(path.join(ROOT, 'components/chat/AiToolPanel.vue'), 'utf8')
const inputSrc = fs.readFileSync(path.join(ROOT, 'components/chat/InputArea.vue'), 'utf8')

describe('AiToolPanel AI 功能面板', () => {
	it('四个动作项齐全（图片/文件/语音/更多）', () => {
		expect(panelSrc).toContain("pick('image')")
		expect(panelSrc).toContain("pick('file')")
		expect(panelSrc).toContain("pick('voice')")
		expect(panelSrc).toContain("pick('more')")
	})

	it('图片/语音受能力开关门控，文件/更多始终显示', () => {
		expect(panelSrc).toMatch(/v-if="visionOn"[\s\S]*?pick\('image'\)/)
		expect(panelSrc).toMatch(/v-if="voiceOn"[\s\S]*?pick\('voice'\)/)
		// 文件、更多项无 v-if 门控（类名允许附加 btn-tactile 等动效类）
		const fileItem = panelSrc.match(/class="ai-tool-item[^"]*" @tap="pick\('file'\)"/)
		const moreItem = panelSrc.match(/class="ai-tool-item[^"]*" @tap="pick\('more'\)"/)
		expect(fileItem).not.toBeNull()
		expect(moreItem).not.toBeNull()
	})

	it('点击遮罩关闭面板', () => {
		expect(panelSrc).toMatch(/class="ai-tool-mask[^"]*"/)
		expect(panelSrc).toContain("@tap=\"emit('close')\"")
	})

	it('声明 pick 与 close 事件', () => {
		expect(panelSrc).toContain("defineEmits(['close', 'pick'])")
	})

	it('含深色双路径（html.theme-dark + MP media）', () => {
		expect(panelSrc).toContain('html.theme-dark')
		expect(panelSrc).toContain('@media (prefers-color-scheme: dark)')
	})
})

describe('InputArea 面板接线', () => {
	it('输入行只保留一个 + 入口（旧的图片/语音/文件按钮已移除）', () => {
		expect(inputSrc).not.toContain('@tap="pickImage"')
		expect(inputSrc).not.toContain('@tap="pickFile"')
		expect(inputSrc).not.toContain('@tap="toggleVoice"')
		expect(inputSrc).toContain('@tap="showAiTool = true"')
	})

	it('挂载 AiToolPanel 并接线 pick/close', () => {
		expect(inputSrc).toContain('<AiToolPanel')
		expect(inputSrc).toContain('@pick="onToolPick"')
		expect(inputSrc).toContain('@close="showAiTool = false"')
	})

	it('onToolPick 把动作分发到对应处理函数', () => {
		expect(inputSrc).toMatch(/action === 'image'[\s\S]*?pickImage\(\)/)
		expect(inputSrc).toMatch(/action === 'file'[\s\S]*?pickFile\(\)/)
		expect(inputSrc).toMatch(/action === 'voice'[\s\S]*?toggleVoice\(\)/)
		expect(inputSrc).toMatch(/action === 'more'[\s\S]*?navigateTo/)
	})
})
