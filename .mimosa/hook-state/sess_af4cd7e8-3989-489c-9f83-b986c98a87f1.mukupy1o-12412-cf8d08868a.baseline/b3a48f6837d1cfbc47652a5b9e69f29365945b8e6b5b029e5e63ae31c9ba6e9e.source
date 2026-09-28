/**
 * HTTP 请求封装 (uni.request + 重试)
 *
 * 从 api.js 拆分，api.js 现在只做 AI 相关 re-export
 *
 * BASE_URL 配置：
 *   H5 开发: /api (Vite proxy → localhost:3000)
 *   APP 生产: https://your-server.ucloud.cn/api
 */

// TODO: 部署时改为 UCloud 地址
const BASE_URL = '/api'

/** 通用请求 */
export function request(options) {
  const { url, method = 'GET', data, timeout = 15000 } = options
  const deviceId = uni.getStorageSync('siji_device_id') || ''

  return new Promise((resolve, reject) => {
    uni.request({
      url: BASE_URL + url,
      method,
      data,
      timeout,
      header: {
        'Content-Type': 'application/json',
        'X-Device-Id': deviceId
      },
      success(res) {
        const { statusCode, data: body } = res
        if (statusCode === 200 && body && body.code === 0) {
          resolve(body.data)
        } else {
          reject(new Error(body?.message || `HTTP ${statusCode}`))
        }
      },
      fail(err) {
        reject(new Error(err.errMsg || 'Network error'))
      }
    })
  })
}

/** GET 请求 */
export function get(url, params = {}, timeout) {
  const query = Object.keys(params)
    .filter(k => params[k] !== undefined && params[k] !== null)
    .map(k => `${k}=${encodeURIComponent(params[k])}`)
    .join('&')
  return request({ url: query ? `${url}?${query}` : url, method: 'GET', timeout })
}

/** POST 请求 */
export function post(url, data, timeout) {
  return request({ url, method: 'POST', data, timeout })
}

/** PUT 请求 */
export function put(url, data, timeout) {
  return request({ url, method: 'PUT', data, timeout })
}

/** DELETE 请求 */
export function del(url, timeout) {
  return request({ url, method: 'DELETE', timeout })
}
