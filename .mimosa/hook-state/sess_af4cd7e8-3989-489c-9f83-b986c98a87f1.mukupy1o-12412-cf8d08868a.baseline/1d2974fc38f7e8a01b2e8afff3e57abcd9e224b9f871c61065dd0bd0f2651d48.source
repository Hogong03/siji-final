/**
 * 环境配置 — 根据编译环境自动切换 API 地址
 *
 * H5 开发: /api (Vite proxy 转发)
 * APP 生产: 填写实际服务端地址
 * 本地调试: localhost
 */

// #ifdef H5
export const API_BASE_URL = '/api'
// #endif

// #ifdef APP-PLUS
export const API_BASE_URL = 'https://api.siji.app/api'
// #endif

// #ifdef MP-WEIXIN
export const API_BASE_URL = 'https://api.siji.app/api'
// #endif

// #ifndef H5 || APP-PLUS || MP-WEIXIN
export const API_BASE_URL = '/api'
// #endif

/** 反馈接口地址 */
// #ifdef APP-PLUS
export const FEEDBACK_URL = 'https://api.siji.app/api/feedback'
// #endif

// #ifndef APP-PLUS
export const FEEDBACK_URL = '/api/feedback'
// #endif

/** 图片上传地址 */
// #ifdef APP-PLUS
export const IMAGE_UPLOAD_URL = 'https://api.siji.app/api/upload'
// #endif

// #ifndef APP-PLUS
export const IMAGE_UPLOAD_URL = '/api/upload'
// #endif
