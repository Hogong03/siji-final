/**
 * 语音输入工具 — 讯飞实时语音转写（标准版）v2
 *
 * v2 优化：
 *  - 转写文本累积拼接（区分中间结果/最终结果）
 *  - 录音稳定性增强：H5 ScriptProcessor 持续采集不中断
 *  - 最大录音时长 5 分钟，防资源浪费
 *  - 录音时长回调，UI 可显示计时
 *  - 断线自动重连（1 次）
 *  - App 端 frameSize 增大减少发送频率
 *
 * 接入方式：WebSocket 直连讯飞 rtasr 服务
 * 鉴权：signa = base64(HmacSHA1(MD5(appid + ts), api_key))
 * 音频：16kHz 16bit 单声道 PCM
 */

// ==================== 讯飞配置 ====================
const XFYUN_APPID = '4c0ccb78'
const XFYUN_API_KEY = '8d75f95bbaf74146b4890907494f54ba'
const XFYUN_WS_URL = 'wss://rtasr.xfyun.cn/v1/ws'
// 讯飞可选参数：近场录音(vadMdn=2)、纯中文模式(engLangType=4)、标点开启(punc=1)
// 这些参数拼接到 WebSocket URL query string

const MAX_RECORD_MS = 5 * 60 * 1000 // 最大录音 5 分钟
const RECONNECT_DELAY = 1000 // 断线重连延迟
const MAX_RECONNECT = 1 // 最多重连 1 次
const FINAL_WAIT_MS = 2000 // 停止后等待最终结果的缓冲时间

// ==================== 状态 ====================
let ws = null
let isRecording = false
let audioContext = null
let mediaStream = null
let scriptProcessor = null
let recorderManager = null
let maxRecordTimer = null
let durationTimer = null
let recordStartTime = 0
let reconnectCount = 0
let isManualStop = false // 标记是否用户主动停止

// 累积文本
let finalText = '' // 已确定的最终文本
let currentText = '' // 当前中间结果（未确定）

// 回调
let onTextChangeCb = null
let onStatusChangeCb = null
let onErrorCb = null
let onDurationCb = null

// ==================== 加密库（轻量纯 JS 实现，替代 60KB 的 crypto-js）====================
import { md5HexStr, hmacSha1Base64 } from './crypto-lite.js'
import { logger } from './logger.js'

// ==================== 生成鉴权签名 ====================
// 讯飞签名算法：signa = base64(HmacSHA1(MD5(appid + ts), api_key))
function generateSigna() {
  const ts = Math.floor(Date.now() / 1000).toString()
  const baseString = XFYUN_APPID + ts
  const md5Result = md5HexStr(baseString)
  const signa = hmacSha1Base64(XFYUN_API_KEY, md5Result)
  logger.log('[voice] 签名生成:', { ts, md5: md5Result.substring(0, 8) + '...', signa: signa.substring(0, 12) + '...' })
  return { signa, ts }
}

// ==================== 解析转写结果 ====================
/**
 * 讯飞实时转写返回 JSON 结构：
 * { cn: { st: { type: "0|1", rt: [{ ws: [{ cw: [{ w: "文字" }] }] }] } } }
 * type=0: 最终结果（该句已确定）
 * type=1: 中间结果（该句还在变化）
 *
 * 策略：
 *  - type=1（中间）：更新 currentText，finalText 不变
 *  - type=0（最终）：finalText += currentText，currentText 清空
 *  - 回调返回 finalText + currentText（拼接显示）
 */
function parseResult(data) {
  try {
    const obj = JSON.parse(data)
    if (!obj.cn || !obj.cn.st) return null

    const st = obj.cn.st
    const type = st.type // "0" 最终, "1" 中间

    let text = ''
    if (st.rt) {
      for (const segment of st.rt) {
        if (segment.ws) {
          for (const word of segment.ws) {
            if (word.cw) {
              for (const cw of word.cw) {
                text += cw.w
              }
            }
          }
        }
      }
    }

    return { type, text }
  } catch (e) {
    return null
  }
}

/** 通知回调：累积文本 */
function notifyTextChange() {
  const combined = (finalText + currentText).trim()
  if (onTextChangeCb) onTextChangeCb(combined)
}

// ==================== 平台检测 ====================
function getPlatform() {
  // #ifdef H5
  return 'h5'
  // #endif
  // #ifdef APP-PLUS
  return 'app'
  // #endif
  // #ifdef MP
  return 'mp'
  // #endif
  return 'unknown'
}

/** 是否支持语音输入 */
export function isVoiceSupport() {
  const platform = getPlatform()
  if (platform === 'h5') {
    // H5 环境：检测 getUserMedia 和 AudioContext
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return false
    }
    if (typeof window === 'undefined' || (!window.AudioContext && !window.webkitAudioContext)) {
      return false
    }
    // 检测是否是安全上下文（getUserMedia 需要 https 或 localhost）
    if (typeof window.isSecureContext !== 'undefined' && !window.isSecureContext) {
      return false
    }
    return true
  }
  // App / 小程序环境：默认支持
  return true
}

export const isVoiceSupported = true

// ==================== H5 录音 ====================
async function setupH5AudioPipeline() {
  // mediaStream 已在 startRecord 中提前获取
  // 尝试 16kHz，如果浏览器不支持则用默认采样率后续转换
  const sampleRate = 16000
  const AC = window.AudioContext || window.webkitAudioContext
  audioContext = new AC({ sampleRate })

  // 如果实际采样率不是 16k，需要重采样
  const actualSampleRate = audioContext.sampleRate
  const needResample = actualSampleRate !== sampleRate

  const source = audioContext.createMediaStreamSource(mediaStream)

  // bufferSize: 讯飞建议每 40ms 发送 1280 字节（16k/16bit/单声道）
  // 4096 样本@16k = 256ms ≈ 8192 字节，偏大但稳定
  // 2048 样本@16k = 128ms ≈ 4096 字节，更接近讯飞建议频率
  // 使用 4096 平衡延迟与稳定性
  const bufferSize = 4096
  scriptProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1)

  scriptProcessor.onaudioprocess = (e) => {
    if (!isRecording) return
    const float32 = e.inputBuffer.getChannelData(0)

    // 重采样到 16k（如果需要）—— 使用 FIR 低通滤波 + 线性插值，减少混叠失真
    let resampled
    if (needResample) {
      const ratio = sampleRate / actualSampleRate
      const newLength = Math.round(float32.length * ratio)
      resampled = new Float32Array(newLength)
      // 简易低通滤波：取相邻 3 点加权平均，抑制高频混叠
      for (let i = 0; i < newLength; i++) {
        const srcIdx = i / ratio
        const idx0 = Math.floor(srcIdx)
        const idx1 = Math.min(idx0 + 1, float32.length - 1)
        const idx2 = Math.min(idx0 + 2, float32.length - 1)
        const frac = srcIdx - idx0
        // 三点二次插值（更平滑）
        const a = float32[idx0]
        const b = float32[idx1]
        const c = float32[idx2]
        resampled[i] = a * (1 - frac) * (1 - frac) + b * 2 * frac * (1 - frac) + c * frac * frac
      }
    } else {
      resampled = float32
    }

    // Float32 → Int16 PCM
    const int16 = new Int16Array(resampled.length)
    for (let i = 0; i < resampled.length; i++) {
      const s = Math.max(-1, Math.min(1, resampled[i]))
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
    }

    if (ws && ws.readyState === 1) {
      ws.send({ data: int16.buffer })
    }
  }

  // 连接节点：source → scriptProcessor → destination
  // 必须连接 destination 才能持续触发 onaudioprocess
  source.connect(scriptProcessor)
  scriptProcessor.connect(audioContext.destination)
}

function stopH5Recording() {
  if (scriptProcessor) {
    scriptProcessor.disconnect()
    scriptProcessor.onaudioprocess = null
    scriptProcessor = null
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop())
    mediaStream = null
  }
  if (audioContext) {
    try { audioContext.close() } catch {}
    audioContext = null
  }
}

// ==================== App / 小程序录音 ====================
function startAppRecording() {
  recorderManager = uni.getRecorderManager()

  recorderManager.onFrameRecorded((res) => {
    if (!isRecording) return
    if (ws && ws.readyState === 1 && res.frameBuffer) {
      ws.send({ data: res.frameBuffer })
    }
  })

  recorderManager.onError((err) => {
    if (onErrorCb) onErrorCb(err)
  })

  recorderManager.start({
    format: 'pcm',
    sampleRate: 16000,
    numberOfChannels: 1,
    frameSize: 5 // 每帧 5KB ≈ 160ms，更接近讯飞建议的 40ms 发送频率
  })
}

function stopAppRecording() {
  if (recorderManager) {
    recorderManager.stop()
    recorderManager = null
  }
}

// ==================== WebSocket 连接（uni-app 全平台兼容）====================
function connectWebSocket() {
  return new Promise((resolve, reject) => {
    const { signa, ts } = generateSigna()
    // vadMdn=2 近场模式（手机近距离录音）
    // engLangType=2 中文模式（可能含少量英文，适合日常对话）
    // punc=1 开启标点
    const params = `appid=${XFYUN_APPID}&ts=${ts}&signa=${encodeURIComponent(signa)}&lang=cn&punc=1&vadMdn=2&engLangType=2`
    const url = `${XFYUN_WS_URL}?${params}`

    logger.log('[voice] 连接 WebSocket:', url.substring(0, 60) + '...')

    let handshakeResolved = false
    let handshakeTimeout = null

    // 握手超时：10 秒未收到 started 则失败
    handshakeTimeout = setTimeout(() => {
      if (!handshakeResolved) {
        logger.warn('[voice] 握手超时')
        try { ws.close({}) } catch {}
        ws = null
        reject(new Error('连接讯飞超时，请检查网络'))
      }
    }, 10000)

    // 使用 uni.connectSocket 替代 new WebSocket（App 端无全局 WebSocket 构造函数）
    ws = uni.connectSocket({
      url,
      success: () => {
        logger.log('[voice] WebSocket 连接请求已发出')
      },
      fail: (err) => {
        logger.warn('[voice] WebSocket 连接失败', err)
        if (handshakeTimeout) { clearTimeout(handshakeTimeout); handshakeTimeout = null }
        reject(new Error('WebSocket 连接失败，请检查网络或 API 配置'))
      }
    })

    ws.onOpen(() => {
      logger.log('[voice] WebSocket 已连接，等待握手确认...')
    })

    ws.onMessage((res) => {
      try {
        // res.data 可能是 string 或 ArrayBuffer
        const dataStr = typeof res.data === 'string' ? res.data : ''
        const result = JSON.parse(dataStr)

        if (result.action === 'started') {
          // 握手成功
          handshakeResolved = true
          if (handshakeTimeout) { clearTimeout(handshakeTimeout); handshakeTimeout = null }
          logger.log('[voice] 握手成功')
          if (onStatusChangeCb) onStatusChangeCb('connected')
          resolve()
        } else if (result.action === 'result') {
          // 转写结果
          const parsed = parseResult(result.data)
          if (parsed) {
            if (parsed.type === '0') {
              // 最终结果：累积到 finalText
              if (parsed.text) {
                finalText += parsed.text
                currentText = ''
              }
            } else {
              // 中间结果：更新 currentText
              currentText = parsed.text
            }
            notifyTextChange()
          }
        } else if (result.action === 'error') {
          const errCode = result.code || 'unknown'
          const errDesc = result.desc || ''
          logger.warn(`[voice] 讯飞错误: code=${errCode}, desc=${errDesc}`)
          if (onErrorCb) onErrorCb(new Error(`讯飞错误: ${errCode} ${errDesc}`))
          // 部分错误可以继续（如超时警告），不主动断开
        }
      } catch (e) {
        // 忽略解析错误
      }
    })

    ws.onError((err) => {
      logger.warn('[voice] WebSocket error', err)
      if (!handshakeResolved) {
        if (handshakeTimeout) { clearTimeout(handshakeTimeout); handshakeTimeout = null }
        reject(new Error('WebSocket 连接失败，请检查网络或 API 配置'))
      } else if (onErrorCb) {
        onErrorCb(err)
      }
    })

    ws.onClose(() => {
      logger.warn('[voice] WebSocket closed', { isManualStop, isRecording, reconnectCount })
      if (!handshakeResolved && handshakeTimeout) {
        clearTimeout(handshakeTimeout)
        handshakeTimeout = null
      }
      if (onStatusChangeCb) onStatusChangeCb('closed')
      ws = null

      // 非用户主动停止 + 还在录音中 → 尝试重连
      if (!isManualStop && isRecording && reconnectCount < MAX_RECONNECT) {
        reconnectCount++
        if (onStatusChangeCb) onStatusChangeCb('reconnecting')

        setTimeout(async () => {
          if (!isRecording) return // 可能已在此期间停止
          try {
            await connectWebSocket()
            // 重连成功，继续录音（不需要重新启动麦克风）
            if (onStatusChangeCb) onStatusChangeCb('recording')
          } catch (e) {
            if (onErrorCb) onErrorCb(new Error('重连失败'))
            isRecording = false
          }
        }, RECONNECT_DELAY)
      }
    })
  })
}

// ==================== 计时器 ====================
function startTimers() {
  recordStartTime = Date.now()

  // 最大录音时长
  maxRecordTimer = setTimeout(() => {
    if (isRecording) {
      // 自动停止
      stopRecord()
    }
  }, MAX_RECORD_MS)

  // 录音时长回调（每秒更新）
  durationTimer = setInterval(() => {
    if (isRecording && onDurationCb) {
      const elapsed = Date.now() - recordStartTime
      onDurationCb(elapsed)
    }
  }, 1000)
}

function stopTimers() {
  if (maxRecordTimer) { clearTimeout(maxRecordTimer); maxRecordTimer = null }
  if (durationTimer) { clearInterval(durationTimer); durationTimer = null }
}

// ==================== 对外 API ====================

/**
 * 开始录音 + 实时转写
 * @param {Object} callbacks - { onTextChange, onStatusChange, onError, onDuration }
 */
export async function startRecord(callbacks = {}) {
  if (isRecording) return

  // 重置状态
  onTextChangeCb = callbacks.onTextChange || null
  onStatusChangeCb = callbacks.onStatusChange || null
  onErrorCb = callbacks.onError || null
  onDurationCb = callbacks.onDuration || null
  finalText = ''
  currentText = ''
  reconnectCount = 0
  isManualStop = false

  const platform = getPlatform()

  try {
    // 1. H5 端先检测麦克风权限（避免权限拒绝后浪费 WebSocket 连接）
    if (platform === 'h5') {
      if (onStatusChangeCb) onStatusChangeCb('connecting')
      // 提前请求麦克风权限，失败则直接报错不连 WebSocket
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        })
      } catch (permErr) {
        const msg = permErr && permErr.name
          ? (permErr.name === 'NotAllowedError' ? '麦克风权限被拒绝，请在浏览器设置中允许'
             : permErr.name === 'NotFoundError' ? '未检测到麦克风设备'
             : permErr.name === 'NotReadableError' ? '麦克风被其他程序占用'
             : permErr.message || '麦克风权限获取失败')
          : '麦克风权限获取失败'
        throw new Error(msg)
      }
    }

    // 2. 连接 WebSocket
    if (onStatusChangeCb) onStatusChangeCb('connecting')
    await connectWebSocket()

    // 3. 开始录音
    isRecording = true
    if (onStatusChangeCb) onStatusChangeCb('recording')

    if (platform === 'h5') {
      // 麦克风已在上面获取，继续设置 AudioContext
      await setupH5AudioPipeline()
    } else {
      startAppRecording()
    }

    // 4. 启动计时器
    startTimers()

  } catch (e) {
    isRecording = false
    // 清理可能已获取的 mediaStream（权限成功但后续步骤失败的情况）
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop())
      mediaStream = null
    }
    if (onErrorCb) onErrorCb(e)
    if (ws) { try { ws.close() } catch {} ws = null }
  }
}

/**
 * 停止录音，返回最终文本
 */
export async function stopRecord() {
  if (!isRecording) return

  isManualStop = true
  isRecording = false

  const platform = getPlatform()

  // 停止录音采集
  if (platform === 'h5') {
    stopH5Recording()
  } else {
    stopAppRecording()
  }

  // 停止计时器
  stopTimers()

  // 发送结束标识
  if (ws && ws.readyState === 1) {
    try {
      ws.send({ data: JSON.stringify({ end: true }) })
    } catch {}
  }

  // 等待服务端返回最后的结果
  await new Promise(resolve => setTimeout(resolve, FINAL_WAIT_MS))

  if (ws) {
    try { ws.close() } catch {}
    ws = null
  }

  // 通知最终文本
  const finalResult = (finalText + currentText).trim()
  if (onTextChangeCb) onTextChangeCb(finalResult)

  if (onStatusChangeCb) onStatusChangeCb('stopped')

  return finalResult
}

/**
 * 取消录音（不保存结果）
 */
export function cancelRecord() {
  isManualStop = true
  isRecording = false

  const platform = getPlatform()

  if (platform === 'h5') {
    stopH5Recording()
  } else {
    stopAppRecording()
  }

  stopTimers()

  if (ws) {
    try { ws.close() } catch {}
    ws = null
  }

  finalText = ''
  currentText = ''

  if (onStatusChangeCb) onStatusChangeCb('cancelled')
}
