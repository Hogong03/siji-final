/**
 * 语音转写模块（C 语音输入 — 转写部分）
 *
 * 方案：录制短语音（≤25s）→ 上传转写 → 返回文本（由调用方填入输入框）
 * - 首选智谱 GLM-ASR-2512：multipart 直传，官方限制 ≤30s / ≤25MB
 * - 通义 qwen-audio-3.0-asr-flash-filetrans 为 url 模式（需公网音频链接），
 *   客户端无法直传，留待服务端网关接入
 * - 录音部分见 recorder.js
 *
 * 低侵入设计：不自动发送、不修改消息流，只产出文本。
 */

import { getAsrProvider, getAsrModel, getAsrEndpoint, getAsrMode } from './providers.js'
import { getProviderKeys } from './providers.js'
import { logger } from '../logger.js'

const MAX_FILE_BYTES = 24 * 1024 * 1024 // 24MB，避开 25MB 硬限

// ==================== 配置 ====================

/**
 * 获取当前 ASR 配置
 * @returns {{ providerId:string, apiKey:string, model:string, endpoint:string, mode:string }|null}
 */
export function getAsrConfig() {
  const providerId = getAsrProvider()
  if (!providerId) return null
  const keys = getProviderKeys()
  const apiKey = keys[providerId] || ''
  if (!apiKey) return null
  return {
    providerId,
    apiKey,
    model: getAsrModel(providerId),
    endpoint: getAsrEndpoint(providerId),
    mode: getAsrMode(providerId)
  }
}

/** 是否可用（有配置且为直传模式） */
export function isAsrReady() {
  const cfg = getAsrConfig()
  return !!(cfg && cfg.mode === 'multipart')
}

// ==================== 转写 ====================

/**
 * 转写音频文件
 * @param {string} filePath - 本地临时文件路径（App/小程序）
 * @param {Blob} [h5Blob] - H5 录音得到的 Blob
 * @param {object} [cfg] - 复用 getAsrConfig() 结果
 * @returns {Promise<string>} 识别文本
 */
export function transcribeAudio(filePath, h5Blob, cfg) {
  const config = cfg || getAsrConfig()
  if (!config) {
    return Promise.reject(new Error('未配置语音识别：请先在设置页配置智谱 API Key'))
  }
  if (config.mode !== 'multipart') {
    return Promise.reject(new Error('当前语音厂商需服务端网关转写，请使用智谱 GLM 语音'))
  }
  // #ifdef H5
  if (h5Blob) return transcribeH5(config, h5Blob)
  // #endif
  if (!filePath) {
    return Promise.reject(new Error('未获取到录音文件'))
  }
  return transcribeUpload(config, filePath)
}

/** uni.uploadFile 上传转写（App/小程序） */
function transcribeUpload(config, filePath) {
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: config.endpoint,
      filePath,
      name: 'file',
      formData: { model: config.model, stream: 'false' },
      header: { 'Authorization': `Bearer ${config.apiKey}` },
      timeout: 30000,
      success(res) {
        if (res.statusCode === 200) {
          try {
            const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
            const text = data.text || data.result || (data.output && data.output.text) || ''
            if (text && text.trim()) {
              resolve(text.trim())
            } else {
              reject(new Error('语音识别成功但返回为空'))
            }
          } catch (e) {
            reject(new Error('语音识别响应解析失败'))
          }
        } else {
          logger.warn('[ASR] upload failed', res.statusCode, res.data)
          reject(new Error(parseError(res.data)))
        }
      },
      fail(err) {
        logger.warn('[ASR] upload error', err.errMsg)
        reject(new Error('语音上传失败：' + (err.errMsg || '网络错误')))
      }
    })
  })
}

// #ifdef H5
/** H5 直传（fetch + FormData） */
function transcribeH5(config, blob) {
  if (blob.size > MAX_FILE_BYTES) {
    return Promise.reject(new Error('音频文件超过 24MB，无法转写'))
  }
  const form = new FormData()
  form.append('model', config.model)
  form.append('stream', 'false')
  form.append('file', blob, 'recording.webm')
  return fetch(config.endpoint, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${config.apiKey}` },
    body: form
  }).then(async (resp) => {
    let data = {}
    try { data = await resp.json() } catch { /* ignore */ }
    if (!resp.ok) {
      throw new Error(parseError(data))
    }
    const text = data.text || data.result || (data.output && data.output.text) || ''
    if (!text || !text.trim()) throw new Error('语音识别成功但返回为空')
    return text.trim()
  })
}
// #endif

/** 提取接口错误信息 */
function parseError(raw) {
  if (!raw) return '语音服务错误'
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (data.error && data.error.message) return data.error.message
    if (data.error && data.error.code) return `语音服务错误（${data.error.code}）`
    if (data.message) return data.message
    if (data.msg) return data.msg
  } catch { /* ignore */ }
  return '语音服务错误'
}