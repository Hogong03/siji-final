/**
 * features.js — AI 能力注册表（4.10.0）
 *
 * 单一事实源：每个可选 AI 能力的开关状态、分组、注入映射。设置页「AI 能力」分组卡与
 * 各注入点（工具过滤 / prompt 段 / extSection / 进入消息 / 输入区）统一从这里裁决。
 *
 * 三类能力：
 *   - delegate（联网搜索 / 读网址）：开关与 Key 裁决由 search-config / read-config 负责，
 *     注册表只做读写转发 —— 不复制状态，避免两处开关打架
 *   - legacy（长期记忆）：开关落在注册表，但写穿到旧键 siji_memory_enabled
 *     （memory/store.js 的 isMemoryEnabled 消费它管提取侧），读侧兼容旧值
 *   - 普通（其余）：状态存 siji_ai_features，缺省按 default
 *
 * 关掉的能力同时从三处消失：TOOL_DEFINITIONS 注入（TOOL_FEATURE_MAP）、
 * system prompt 段与 extSection、UI 入口。安全底座（确认闸门/白名单/撤销）不可关。
 */

import { isSearchEnabled, setSearchEnabled, isWebSearchAvailable } from './search-config.js'
import { isReadEnabled, setReadEnabled, isReadUrlAvailable } from './read-config.js'

export const FEATURE_KEY = 'siji_ai_features'

/** 能力清单（group: info 信息获取 / context 上下文感知 / care 主动关怀 / channel 记录通道 / input 输入方式） */
export const AI_FEATURES = [
  { id: 'web_search', name: '联网搜索', desc: '回答时效性问题时自动联网查证', group: 'info', default: true, delegate: 'search' },
  { id: 'read_url', name: '读网址', desc: '把网页正文读给 AI（直连优先）', group: 'info', default: true, delegate: 'read' },
  { id: 'memory', name: '长期记忆', desc: '跨对话记住事实与偏好（写入与注入）', group: 'context', default: true, legacy: true },
  { id: 'digest', name: '动静摘要', desc: '告诉 AI「你不在时」完成了什么', group: 'context', default: true },
  { id: 'energy', name: '能量感知', desc: '状态低落时自动放轻语气、少提任务', group: 'context', default: true },
  { id: 'next_step', name: '下一步建议', desc: '进入对话时给一个约 5 分钟的最小行动', group: 'care', default: true },
  { id: 'week_bill', name: '周账单播报', desc: '每周一报上周支出概况', group: 'care', default: true },
  { id: 'guide_ask', name: '引导追问', desc: '记录类回复末尾附一个深入追问（引导式日记）', group: 'care', default: true },
  { id: 'glimmer', name: '微光本收集', desc: 'AI 主动收集「还行的小事」', group: 'channel', default: true },
  { id: 'relation', name: '人脉互动', desc: '认识人、记互动、查关系（有人脉数据时）', group: 'channel', default: true },
  { id: 'simulation', name: '情景演练', desc: '与 AI 预演社交/规划对话', group: 'channel', default: true },
  { id: 'auto_profile', name: '自动补全画像', desc: '保存记录后 AI 提取个人信息，经确认更新画像', group: 'channel', default: false },
  { id: 'vision', name: '图片识别', desc: '发图片让 AI 看（需模型支持）', group: 'input', default: true },
  { id: 'voice', name: '语音转文字', desc: '输入区麦克风说话转文字（走智谱 ASR，需智谱 Key）', group: 'input', default: false }
]

/** 能力分组（设置页渲染顺序） */
export const FEATURE_GROUPS = [
  { id: 'info', name: '信息获取' },
  { id: 'context', name: '上下文感知' },
  { id: 'care', name: '主动关怀' },
  { id: 'channel', name: '记录通道' },
  { id: 'input', name: '输入方式' }
]

/** 工具名 → 能力 id（注入过滤与执行拦截共用） */
export const TOOL_FEATURE_MAP = {
  web_search: 'web_search',
  read_url: 'read_url',
  create_glimmer: 'glimmer',
  query_glimmers: 'glimmer',
  create_relation: 'relation',
  update_relation: 'relation',
  delete_relation: 'relation',
  query_relation: 'relation',
  log_interaction: 'relation',
  query_interaction: 'relation'
}

function readStore() {
  try {
    const raw = uni.getStorageSync(FEATURE_KEY)
    if (raw) return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch (e) { /* 读不到按缺省 */ }
  return {}
}

/**
 * 能力开关是否打开（不含资源可用性 —— Key 未配等由 isFeatureActive 裁决）
 * 缺省按 AI_FEATURES.default；memory 兼容旧键 siji_memory_enabled 的 'false'
 */
export function isFeatureOn(id) {
  const f = AI_FEATURES.find(x => x.id === id)
  if (!f) return false
  if (f.delegate === 'search') return isSearchEnabled()
  if (f.delegate === 'read') return isReadEnabled()
  const store = readStore()
  if (store[id] != null) return store[id] === true
  if (id === 'memory') {
    try {
      if (uni.getStorageSync('siji_memory_enabled') === 'false') return false
    } catch (e) { /* 读不到按默认开 */ }
  }
  return f.default !== false
}

/** 能力是否实际生效：开关 + 资源可用性（搜索/读网址的 Key 裁决）双重判定 —— 注入点用这个 */
export function isFeatureActive(id) {
  if (!isFeatureOn(id)) return false
  if (id === 'web_search') return isWebSearchAvailable()
  if (id === 'read_url') return isReadUrlAvailable()
  return true
}

/** 写开关。delegated 能力转发给各自配置；memory 写穿旧键（提取侧 isMemoryEnabled 消费） */
export function setFeatureOn(id, on) {
  const f = AI_FEATURES.find(x => x.id === id)
  if (!f) return
  if (f.delegate === 'search') { setSearchEnabled(on === true); return }
  if (f.delegate === 'read') { setReadEnabled(on === true); return }
  try {
    const store = readStore()
    store[id] = on === true
    uni.setStorageSync(FEATURE_KEY, JSON.stringify(store))
    if (id === 'memory') uni.setStorageSync('siji_memory_enabled', on === true ? 'true' : 'false')
  } catch (e) { /* 存储失败不致命，下次再写 */ }
}

/** 按分组组织能力清单（设置页渲染用） */
export function listFeatureGroups() {
  return FEATURE_GROUPS
    .map(g => ({ ...g, features: AI_FEATURES.filter(f => f.group === g.id) }))
    .filter(g => g.features.length > 0)
}
