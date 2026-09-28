/**
 * 录音模块（C 语音输入 — 录音部分）
 *
 * - App / 小程序：uni.getRecorderManager
 * - H5：navigator.mediaDevices.getUserMedia + MediaRecorder
 *
 * 统一接口：startRecording / stopRecording / cancelRecording / isRecording
 * 自动限时 MAX_RECORD_MS（25s，官方 30s 上限留 5s 冗余）。
 */

export const MAX_RECORD_MS = 25000

let recorderState = null // 当前录音会话

/** 是否正在录音 */
export function isRecording() {
  return !!(recorderState && recorderState.active)
}

/**
 * 开始录音
 * @param {object} [opts] - { onTick(ms), onAutoStop() } 回调
 * @returns {Promise<boolean>} 是否成功开始
 */
export function startRecording(opts = {}) {
  // #ifdef H5
  return startRecordingH5(opts)
  // #endif
  // #ifndef H5
  return startRecordingNative(opts)
  // #endif
}

/**
 * 停止录音并返回音频
 * @returns {Promise<{ path:string, blob:Blob|null, duration:number, cancelled:boolean }>}
 */
export function stopRecording() {
  // #ifdef H5
  return stopRecordingH5()
  // #endif
  // #ifndef H5
  return stopRecordingNative()
  // #endif
}

/** 取消录音（丢弃不转写） */
export function cancelRecording() {
  if (!recorderState) return
  recorderState.cancelled = true
  try {
    if (recorderState.manager) recorderState.manager.stop()
    if (recorderState.mediaRecorder) recorderState.mediaRecorder.stop()
  } catch { /* ignore */ }
  if (recorderState.timer) clearTimeout(recorderState.timer)
}

// #ifndef H5
// ==================== App / 小程序 ====================

function startRecordingNative(opts) {
  return new Promise((resolve) => {
    const manager = uni.getRecorderManager()
    const state = { active: false, cancelled: false, manager, timer: null, startTs: 0, duration: 0, resolveStop: null }
    recorderState = state

    manager.onStart(() => {
      state.active = true
      state.startTs = Date.now()
      state.timer = setInterval(() => {
        state.duration = Date.now() - state.startTs
        if (opts.onTick) opts.onTick(state.duration)
        if (state.duration >= MAX_RECORD_MS) {
          if (opts.onAutoStop) opts.onAutoStop()
          try { manager.stop() } catch { /* ignore */ }
        }
      }, 500)
      resolve(true)
    })
    manager.onError(() => {
      clearInterval(state.timer)
      state.active = false
      if (state.resolveStop) {
        state.resolveStop.reject(new Error('录音失败'))
        state.resolveStop = null
      }
      recorderState = null
      resolve(false)
    })
    manager.onStop((res) => {
      clearInterval(state.timer)
      state.active = false
      state.duration = res.duration || state.duration
      if (state.resolveStop) {
        const isCancelled = state.cancelled
        recorderState = null
        if (isCancelled) {
          state.resolveStop.resolve({ path: '', duration: 0, cancelled: true })
        } else {
          state.resolveStop.resolve({ path: res.tempFilePath || '', duration: state.duration })
        }
        state.resolveStop = null
      }
    })

    try {
      manager.start({ format: 'mp3', duration: MAX_RECORD_MS })
    } catch (e) {
      manager.start()
    }
  })
}

function stopRecordingNative() {
  return new Promise((resolve, reject) => {
    if (!recorderState || !recorderState.active) {
      resolve({ path: '', duration: 0 })
      return
    }
    recorderState.resolveStop = { resolve, reject }
    try {
      recorderState.manager.stop()
    } catch (e) {
      reject(new Error('停止录音失败'))
    }
  })
}
// #endif

// #ifdef H5
// ==================== H5 ====================

function startRecordingH5(opts) {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
      resolve(false)
      return
    }
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        const mime = pickMimeType()
        let mediaRecorder
        try {
          mediaRecorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
        } catch (e) {
          mediaRecorder = new MediaRecorder(stream)
        }
        const chunks = []
        const state = {
          active: true, cancelled: false, mediaRecorder, stream, chunks,
          timer: null, startTs: Date.now(), duration: 0, resolveStop: null
        }
        recorderState = state
        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data)
        }
        mediaRecorder.onstop = () => {
          clearInterval(state.timer)
          state.active = false
          state.stream.getTracks().forEach(t => t.stop())
          const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' })
          if (state.resolveStop) {
            const isCancelled = state.cancelled
            recorderState = null
            if (isCancelled) {
              state.resolveStop.resolve({ blob: null, duration: 0, cancelled: true })
            } else {
              state.resolveStop.resolve({ blob, duration: state.duration })
            }
            state.resolveStop = null
          }
        }
        mediaRecorder.onerror = () => {
          clearInterval(state.timer)
          state.active = false
          state.stream.getTracks().forEach(t => t.stop())
          if (state.resolveStop) {
            state.resolveStop.reject(new Error('录音失败'))
            state.resolveStop = null
          }
          recorderState = null
        }
        state.timer = setInterval(() => {
          state.duration = Date.now() - state.startTs
          if (opts.onTick) opts.onTick(state.duration)
          if (state.duration >= MAX_RECORD_MS) {
            if (opts.onAutoStop) opts.onAutoStop()
            try { mediaRecorder.stop() } catch { /* ignore */ }
          }
        }, 500)
        mediaRecorder.start(250)
        resolve(true)
      })
      .catch(() => resolve(false))
  })
}

function stopRecordingH5() {
  return new Promise((resolve, reject) => {
    if (!recorderState || !recorderState.active) {
      resolve({ blob: null, duration: 0 })
      return
    }
    recorderState.resolveStop = { resolve, reject }
    try {
      recorderState.mediaRecorder.stop()
    } catch (e) {
      reject(new Error('停止录音失败'))
    }
  })
}

function pickMimeType() {
  const candidates = ['audio/mp4;codecs=mp4a.40.2', 'audio/webm;codecs=opus', 'audio/webm']
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(type)) {
      return type
    }
  }
  return ''
}
// #endif