/**
 * doc-parse.js — 二进制文档解析后端（3.6.0）
 *
 * PDF / Word / Excel 这类文件本地解析要引重依赖（而且小程序端跑不动），
 * 所以走「解析后端」：把文件传给云端解析服务，拿回纯文本。
 * 后端注册表与 utils/ai/search-adapters.js 同一套套路，新增后端零改动其余代码。
 *
 * 存储键：
 *   siji_doc_parse_backend  后端 id（缺省 moonshot）
 *   siji_doc_parse_key      独立 Key（enc2 加密；留空则复用同名 AI 厂商 Key）
 *
 * 验证状态：
 *   - moonshot：按 Moonshot 开放平台文件接口的公开形状实现（POST /v1/files
 *     purpose=file-extract → GET /v1/files/{id}/content 取正文），
 *     本地单测覆盖请求组装与响应解析，**线上尚未用真实 Key 跑过**。
 */
import { decryptKey, encryptKey } from '@/utils/crypto.js'
import { getProviderKeys } from '@/utils/ai/providers.js'

export const DOC_KEYS = {
  backend: 'siji_doc_parse_backend',
  key: 'siji_doc_parse_key'
}

const MOONSHOT_UPLOAD = 'https://api.moonshot.cn/v1/files'
const MOONSHOT_CONTENT = 'https://api.moonshot.cn/v1/files/'

/** Moonshot（Kimi）文件解析：上传 → 取正文 → 尽力删远端文件 */
const moonshotBackend = {
  id: 'moonshot',
  name: 'Moonshot 文件解析',
  desc: '支持 pdf / doc / docx / xls / xlsx / ppt / pptx，可与 Moonshot(Kimi) AI Key 共用',
  providerId: 'moonshot',
  keyLabel: 'Moonshot API Key',
  keyPlaceholder: 'sk-xxxxxxxxxxxxxxxx',
  docs: 'https://platform.moonshot.cn/docs',
  buildUpload(fileRef, apiKey) {
    const header = { 'Authorization': 'Bearer ' + apiKey }
    // H5 走 files（File 对象），App/小程序走 filePath
    if (fileRef && fileRef.file) {
      return {
        url: MOONSHOT_UPLOAD,
        files: [{ name: 'file', file: fileRef.file }],
        formData: { purpose: 'file-extract' },
        header: header,
        timeout: 60000
      }
    }
    return {
      url: MOONSHOT_UPLOAD,
      // Android 系统选择器选来的文件同时给了沙盒绝对路径：uni.uploadFile 认绝对路径最稳
      filePath: (fileRef && (fileRef.absPath || fileRef.path)) || '',
      name: 'file',
      formData: { purpose: 'file-extract' },
      header: header,
      timeout: 60000
    }
  },
  buildContentRequest(fileId, apiKey) {
    return {
      url: MOONSHOT_CONTENT + fileId + '/content',
      method: 'GET',
      header: { 'Authorization': 'Bearer ' + apiKey },
      dataType: 'text',
      timeout: 30000
    }
  },
  /** 上传响应 → file id */
  parseUpload(res) {
    let data = res && res.data
    if (typeof data === 'string') {
      try { data = JSON.parse(data) } catch (e) { data = null }
    }
    if (!data || !data.id) {
      const msg = (data && (data.error && data.error.message || data.message)) || ('HTTP ' + ((res && res.statusCode) || 0))
      return { ok: false, reason: '上传失败：' + msg }
    }
    return { ok: true, fileId: data.id }
  }
}

/** 后端注册表 */
export const DOC_BACKENDS = { moonshot: moonshotBackend }

/** 后端列表（设置页渲染用） */
export function listDocBackends() {
  return Object.keys(DOC_BACKENDS).map(id => DOC_BACKENDS[id])
}

export const DEFAULT_DOC_BACKEND = 'moonshot'

export function getDocBackend(id) {
  return DOC_BACKENDS[id] || DOC_BACKENDS[DEFAULT_DOC_BACKEND]
}

export function getDocBackendId() {
  const raw = uni.getStorageSync(DOC_KEYS.backend)
  return DOC_BACKENDS[raw] ? raw : DEFAULT_DOC_BACKEND
}

export function setDocBackend(id) {
  if (DOC_BACKENDS[id]) uni.setStorageSync(DOC_KEYS.backend, id)
  else uni.removeStorageSync(DOC_KEYS.backend)
}

export function getOwnDocKey() {
  const raw = uni.getStorageSync(DOC_KEYS.key)
  if (!raw) return ''
  try { return decryptKey(raw) || '' } catch (e) { return '' }
}

export function setOwnDocKey(plain) {
  const value = String(plain || '').trim()
  if (!value) { uni.removeStorageSync(DOC_KEYS.key); return }
  uni.setStorageSync(DOC_KEYS.key, encryptKey(value))
}

export function hasOwnDocKey() {
  return !!getOwnDocKey()
}

/**
 * 裁决文档解析配置
 * @returns {{ available: boolean, reason: string, backendId: string, backend: Object, key: string, source: string }}
 *   reason: ok | no_key    source: own | provider | none
 */
export function resolveDocConfig() {
  const backendId = getDocBackendId()
  const backend = getDocBackend(backendId)
  const own = getOwnDocKey()
  if (own) return { available: true, reason: 'ok', backendId, backend, key: own, source: 'own' }
  if (backend.providerId) {
    const reused = (getProviderKeys() || {})[backend.providerId] || ''
    if (reused) return { available: true, reason: 'ok', backendId, backend, key: reused, source: 'provider' }
  }
  return { available: false, reason: 'no_key', backendId, backend, key: '', source: 'none' }
}

/** 界面状态文案 */
export function docStatusText() {
  const cfg = resolveDocConfig()
  if (cfg.available) {
    return cfg.source === 'own' ? '已配置（独立 Key）' : '已配置（复用 AI 厂商 Key）'
  }
  return '未配置 Key，PDF / Word / Excel 暂时读不了'
}

/** 是否可用（UI 判断要不要提示先配置） */
export function isDocParseAvailable() {
  return resolveDocConfig().available
}

/**
 * 解析一个二进制文档为纯文本
 * @param {{ name?: string, path?: string, file?: any }} fileRef picker 结果
 * @param {string} [overrideKey] 覆盖 Key（单测用）
 * @returns {Promise<{ ok: boolean, text?: string, reason?: string }>}
 */
export function parseDocument(fileRef, overrideKey) {
  const cfg = resolveDocConfig()
  const key = overrideKey || cfg.key
  if (!key) {
    return Promise.resolve({ ok: false, reason: 'PDF / Word / Excel 需要先配置文档解析 Key（设置 → AI 配置 → 读文件）' })
  }
  const backend = cfg.backend
  return new Promise((resolve) => {
    uni.uploadFile(Object.assign(backend.buildUpload(fileRef, key), {
      success: (res) => {
        const up = backend.parseUpload(res)
        if (!up.ok) { resolve({ ok: false, reason: up.reason }); return }
        uni.request(Object.assign(backend.buildContentRequest(up.fileId, key), {
          success: (r) => {
            deleteRemote(backend, up.fileId, key)
            const text = typeof r.data === 'string' ? r.data : JSON.stringify(r.data || '')
            if (!text) { resolve({ ok: false, reason: '解析服务没有返回正文' }); return }
            resolve({ ok: true, text: text })
          },
          fail: () => { deleteRemote(backend, up.fileId, key); resolve({ ok: false, reason: '取正文失败，请检查网络' }) }
        }))
      },
      fail: (err) => resolve({ ok: false, reason: '上传失败：' + ((err && err.errMsg) || '网络异常') })
    }))
  })
}

/** 尽力删掉云端临时文件（失败不影响结果，只记不报） */
function deleteRemote(backend, fileId, key) {
  if (!fileId) return
  try {
    uni.request({
      url: MOONSHOT_CONTENT + fileId,
      method: 'DELETE',
      header: { 'Authorization': 'Bearer ' + key },
      success: () => {},
      fail: () => {}
    })
  } catch (e) { /* ignore */ }
}
