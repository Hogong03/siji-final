/**
 * 运行时配置中心 — 集中管理所有可调参数
 *
 * 各模块从这里读取配置，不硬编码魔法数字。
 * 支持运行时覆盖：const original = RUNTIME_CONFIG.ai.timeout; RUNTIME_CONFIG.ai.timeout = 60000
 */

export const RUNTIME_CONFIG = {
  // AI 请求相关
  ai: {
    timeout: 30000,           // 请求超时 ms
    retryCount: 2,            // 最大重试次数
    retryDelay: 1000,         // 重试初始延迟 ms
    retryBackoff: 2,          // 退避倍数
    streamThrottle: 33,       // 流式渲染节流 ms (~30fps)
    maxStreamTimeout: 90000,  // 流式总超时 ms
    staleTimerMs: 30000,      // 流式 stale 检测 ms
    titleModel: 'deepseek-v4-flash', // 标题生成模型
    fallbackModel: 'deepseek-v4-flash' // 兜底模型
  },

  // 存储与持久化
  storage: {
    persistDebounce: 500,     // 对话持久化防抖 ms
    maxConversationLength: 200, // 单会话最大消息条数
    offlineQueueKey: 'siji_offline_queue',
    offlineMaxRetries: 3
  },

  // UI 交互
  ui: {
    maxInputLength: 2000,      // 输入框最大字符数
    scrollThreshold: 50,       // 距底部多少 rpx 显示"回到底部"
    backToBottomThreshold: 200, // 距底部多少 rpx 自动滚动
    simStreamMinChunk: 5,      // 模拟流式最小分组
    simStreamMaxChunk: 12,     // 模拟流式最大分组
    simStreamLongThreshold: 150 // 长回复阈值（超过则用大分组）
  },

  // 缓存
  cache: {
    promptTTL: 120000,         // system prompt 缓存 TTL ms
    profileTTL: 60000,         // 用户画像缓存 TTL ms
    dataVersionCheck: true     // 是否启用 dataVersion 缓存校验
  },

  // Token 估算
  token: {
    cnPerChar: 1.5,            // 中文字符 token 系数
    enPerChar: 0.25,           // 英文字符 token 系数
    fixedOverhead: 10          // 每条消息固定开销
  },

  // 错误上报
  errorReport: {
    enabled: true,
    maxQueueSize: 50,          // 本地最多存储错误条数
    flushInterval: 300000      // 上报间隔 ms (5分钟)
  }
}

/** 运行时覆盖配置 */
export function overrideConfig(path, value) {
  const keys = path.split('.')
  let obj = RUNTIME_CONFIG
  for (let i = 0; i < keys.length - 1; i++) {
    obj = obj[keys[i]]
    if (!obj) return false
  }
  obj[keys[keys.length - 1]] = value
  return true
}
