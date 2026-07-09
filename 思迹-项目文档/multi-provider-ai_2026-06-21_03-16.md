# 多厂商 AI 模型选择功能 — 全链路实现

## 目标
用户要求在思迹 App 中不仅可选择 DeepSeek 的不同模型，还能选择其他大模型厂商，并且在设置界面进行切换。

## 改动范围（5 文件）

### 1. `utils/api.js` — 核心引擎层
- 新增 `AI_PROVIDERS` 注册表，包含 5 个厂商：
  - **DeepSeek** (V3 / R1)
  - **OpenAI** (GPT-4o Mini / GPT-4o)
  - **Moonshot** (Kimi 8K / 32K)
  - **智谱 GLM** (GLM-4 Flash / GLM-4)
  - **通义千问** (Qwen Turbo / Qwen Plus)
- 每个厂商定义：`id/name/icon/color/models[]/endpoint/keyLabel/keyPlaceholder/supportsJsonFormat`
- 新增 `getProvider()` `getProviderModels()` `getProviderDefaultModel()` `getProviderKeys()` 工具函数
- 重构 `chatRequest()`: 第 4 参数从 `apiKey: string` 改为 `config: { provider, model, apiKey }`，同时兼容旧字符串调用（自动降级为 deepseek-chat）
- 重构 `chatRequestWithRetry()`: 通过 `buildProviderRequest()` 动态构建不同厂商的请求
- 更新 `chatRequestStream()` 签名同步适配

### 2. `store/index.js` — 状态管理层
- 新增状态：`providerKeys: ref({})` `aiProvider: ref('deepseek')` `aiModel: ref('deepseek-chat')`
- 新增 getters：`currentProviderName` `modelLabel` `aiConfig`（三合一配置对象）
- 新增 actions：`setProviderKey(provider, key)` `setAiProvider(provider)` 
- `setAiModel(model)` 改为接受完整 model id 字符串
- `restoreFromStorage()` 兼容旧版 `siji_api_key` 自动迁移到 `providerKeys.deepseek`

### 3. `pages/settings/index.vue` — 设置 UI 重构
- **厂商横滑选择器**：5 个胶囊标签，选中时用厂商主题色高亮
- **Key 输入区**：跟随选中厂商动态显示对应的 Key 标签和 placeholder
- **模型网格**：每厂商 2 个模型卡片（带 emoji tag + 名称 + 描述）
- **应用切换按钮**：渐变紫色按钮，仅在厂商或模型变更时显示
- 保存 Key / 测试连接 / 切换模型 / 应用厂商 四个操作独立

### 4. `pages/chat/index.vue` — 传参适配
- `chatRequest` 调用从 `store.apiKey` 改为 `store.aiConfig`
- 导航栏徽章从固定文字改为动态 `{{ store.modelLabel }}`（如 "⚡ DeepSeek-V3"）

### 5. `pages/plan/detail.vue` — 传参适配
- `store.apiKey` → `store.hasApiKey` + `store.aiConfig`

## 验证结果
| 文件 | 检查 | 结果 |
|------|------|------|
| utils/api.js | JS 语法 | ✅ PASS |
| store/index.js | JS 语法 | ✅ PASS |
| pages/chat/index.vue | Vue script | ✅ PASS |
| pages/settings/index.vue | Vue script | ✅ PASS |
| pages/plan/detail.vue | Vue script | ✅ PASS |

## 兼容性设计
- 旧 `siji_api_key` 自动迁移到 `providerKeys.deepseek`
- 旧 `siji_ai_model` (0/1 数字) 自动映射为 `deepseek-chat` / `deepseek-reasoner`
- `chatRequest` 旧调用者（传字符串）仍可工作，默认 deepseek-chat
- 每个厂商记住独立模型偏好（`siji_model_${provider}`）
