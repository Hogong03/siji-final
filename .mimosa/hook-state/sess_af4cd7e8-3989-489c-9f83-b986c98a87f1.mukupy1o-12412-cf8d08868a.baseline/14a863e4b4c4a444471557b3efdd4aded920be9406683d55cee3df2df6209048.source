/**
 * Vision Bridge — 图片识别中间层
 *
 * 当用户同时输入图片+文字时，先调 vision 模型识别图片内容，
 * 返回纯文本描述，再交给文字模型处理（识别+操作分两步，效果优于单次请求）
 *
 * 流程：图片+文字 → vision识别 → [图片描述 + 用户文字] → 文字模型处理
 */
import { getProvider, getProviderVisionModel } from './providers.js'
import { buildVisionMessage } from '@/utils/image.js'
import { logger } from '../logger.js'

/** Vision 识别专用 prompt（简短，只要描述不要操作） */
const VISION_RECOGNIZE_PROMPT = `你是一个图片识别助手。请识别并描述图片内容，要求：
1. 如果是聊天截图：提取对话内容、时间、参与人、金额等关键信息
2. 如果是票据/账单：提取金额、日期、类别、商家
3. 如果是其他图片：描述图片中的关键信息
4. 只做描述和提取，不要执行任何操作，不要生成 JSON
5. 用简洁的自然语言描述，不超过 200 字`

/**
 * 调用 vision 模型识别图片内容
 * @param {Object} imageData - { base64, width, height, size }
 * @param {string} userText - 用户输入的文字（作为识别参考）
 * @param {Object} cfg - 当前 AI 配置 { provider, apiKey }
 * @returns {Promise<string|null>} 图片描述文本，失败返回 null
 */
export function recognizeImage(imageData, userText, cfg) {
  const provider = getProvider(cfg.provider)
  const visionModel = getProviderVisionModel(cfg.provider)

  if (!visionModel) {
    logger.warn('[VisionBridge] 当前厂商不支持图片识别:', cfg.provider)
    return Promise.resolve(null)
  }

  // 构建 vision 消息
  const userContent = buildVisionMessage(
    userText || '请识别并描述这张图片的内容',
    imageData,
    cfg.provider
  )

  const body = {
    model: visionModel,
    messages: [
      { role: 'system', content: VISION_RECOGNIZE_PROMPT },
      { role: 'user', content: userContent }
    ],
    temperature: 0.3,  // 识别任务用低温度，保证准确性
    max_tokens: 500    // 描述不需要太长
  }

  logger.info(`[VisionBridge] 识别图片, model=${visionModel}, userText="${userText?.substring(0, 50)}"`)

  return new Promise((resolve) => {
    uni.request({
      url: provider.endpoint,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.apiKey}`
      },
      data: body,
      timeout: 30000,
      success(res) {
        if (res.statusCode === 200 && res.data?.choices?.[0]?.message?.content) {
          const desc = res.data.choices[0].message.content.trim()
          logger.info(`[VisionBridge] 识别成功, 长度=${desc.length}, 内容="${desc.substring(0, 80)}..."`)
          resolve(desc)
        } else {
          const errMsg = res.data?.error?.message || `HTTP ${res.statusCode}`
          logger.error('[VisionBridge] 识别失败:', errMsg)
          resolve(null)
        }
      },
      fail(err) {
        logger.error('[VisionBridge] 网络错误:', err.errMsg || err)
        resolve(null)
      }
    })
  })
}
