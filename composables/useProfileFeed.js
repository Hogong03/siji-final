/**
 * 4.15 P1-6：记录保存后自动喂画像（默认关闭，设置 → AI 能力「记录通道」里开启）
 * 流程：LLM 从记录提取值得长期记住的个人信息 → 确认弹窗（写入前必确认）→ store 执行 smart_update_profile
 * 注意：handleSave 会立刻返回列表，本模块的确认弹窗是全局 API，不依赖页面存活
 */
import { getDefaultConfig, buildProviderRequest } from '@/utils/ai/providers.js'
import { useAppStore } from '@/store/index.js'
import { isFeatureOn } from '@/utils/ai/features.js'

export function autoProfileEnabled() {
  return isFeatureOn('auto_profile')
}

/** 从文本提取画像更新（LLM）；无更新返回 []；失败抛错 */
export async function extractProfileUpdates(text) {
  const cfg = getDefaultConfig()
  if (!cfg?.apiKey) throw new Error('未配置 API Key')
  const reqOpts = buildProviderRequest(cfg.provider, cfg.model, [
    { role: 'system', content:
      '你是个人信息助手。从用户的记录中提取值得长期记住的个人信息（工作、城市、喜好、习惯、重要关系、目标等）。' +
      'card 只能取 "basic"（基本信息）或 "lifestyle"（生活方式），field 用短词（如 职业/城市/喜好）。' +
      '返回纯 JSON：{"updates":[{"card":"basic","field":"职业","value":"程序员"}]}。没有可提取的返回 {"updates":[]}' },
    { role: 'user', content: String(text || '').trim() }
  ], cfg.apiKey, 0.3)
  const res = await new Promise((resolve, reject) => {
    uni.request({ ...reqOpts, timeout: 15000, success: resolve, fail: reject })
  })
  if (!(res.statusCode === 200 && res.data?.choices)) throw new Error('提取失败')
  const content = (res.data.choices[0]?.message?.content || '')
    .replace(/```json\n?/g, '').replace(/```/g, '').trim()
  const result = JSON.parse(content)
  return Array.isArray(result.updates) ? result.updates : []
}

/**
 * 保存记录后调用：开关关闭 / 无内容 / 无更新 时静默跳过
 * 有更新时弹确认卡（写入前必确认，与确认门控语义一致）
 */
export async function feedProfileFromText(text) {
  try {
    if (!autoProfileEnabled()) return
    if (!String(text || '').trim()) return
    const updates = await extractProfileUpdates(text)
    if (!updates || updates.length === 0) return
    const desc = updates.map(u => `· ${u.field}：${u.value}`).join('\n')
    uni.showModal({
      title: '更新个人信息？',
      content: `从刚保存的记录里注意到：\n${desc}`,
      confirmText: '更新画像',
      cancelText: '忽略',
      success: (r) => {
        if (!r.confirm) return
        const store = useAppStore()
        const res = store.executeAction({ type: 'smart_update_profile', payload: { updates } })
        uni.showToast({ title: res && res.success ? '画像已更新' : ((res && res.message) || '未更新'), icon: 'none' })
      }
    })
  } catch (e) {
    // 后台增强：失败静默
    console.warn('[画像喂送] 跳过:', e && e.message)
  }
}
