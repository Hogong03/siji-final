# 思迹 (Siji) 技术规格书

## 项目概要

| 属性 | 值 |
|------|-----|
| **应用名** | 思迹 |
| **定位** | AI 个人生活助手（对话式日记/记账/计划） |
| **路径** | `C:\Users\c3798\Desktop\思迹` |
| **框架** | uni-app (Vue 3 Composition API + Vite 5) |
| **状态管理** | Pinia |
| **CSS 方案** | SCSS + CSS 自定义属性 |
| **AI 引擎** | DeepSeek V4 (Flash / Pro 可选) |
| **AI 代理** | Node.js 中间层 (待开发) |
| **数据库** | MySQL 8.0 on UCloud |
| **离线策略** | 本地优先 + 同步队列 + 后写覆盖 |
| **用户标识** | 设备ID (UUID)，无登录体系 |
| **多端同步** | 暂不支持 |

## 文件结构

```
思迹/
├── index.html                    # HTML 入口 (unibuild时由uni自动注入script)
├── package.json                  # 依赖声明
├── manifest.json                 # uni-app 应用配置
├── pages.json                    # 页面路由 + TabBar + easycom
├── vite.config.js                # Vite 构建配置 (@ 别名=/)
├── uni.scss                      # 全局 SCSS 变量
├── App.vue                       # 根组件 (设备注册+全局样式+同步调度)
├── main.js                       # Vue 入口 (createSSRApp + Pinia)
│
├── store/
│   └── index.js                  # Pinia useAppStore (设备/AI/聊天/同步/网络)
│
├── utils/
│   ├── device.js                 # getDeviceId (Storage持久化)
│   ├── storage.js                # 本地CRUD (按月分片: diary_YYYY-MM, bill_YYYY-MM)
│   ├── api.js                    # HTTP 封装 (uni.request + 重试; BASE_URL 待改)
│   ├── sync.js                   # 离线同步队列 (enqueue / dequeue / trySync)
│   └── uuid.js                   # generateClientId / generateConversationId
│
├── components/
│   ├── chat/
│   │   ├── MessageBubble.vue     # 聊天气泡 (user/assistant + loading动画 + actionCard)
│   │   ├── InputArea.vue         # 输入区 (模式标签 + send事件 + v-model)
│   │   └── FloatButtons.vue      # 浮动功能按钮 (日记/记账/计划/统计)
│   └── common/
│       └── EmptyState.vue        # 空状态占位组件
│
├── pages/
│   ├── chat/index.vue            # 首页 Tab0: AI 聊天核心
│   ├── diary/list.vue            # Tab1: 日记列表 (按月筛选 + AI摘要)
│   ├── diary/detail.vue          # 日记详情
│   ├── bill/index.vue            # Tab2: 账单列表 (收支概览)
│   ├── bill/stats.vue            # 收支统计 (分类占比)
│   ├── plan/index.vue            # Tab3: 计划列表 (进度 + 筛选)
│   ├── plan/detail.vue           # 计划详情 (AI拆解 + 状态变更)
│   └── settings/index.vue        # Tab4: 设置 (API Key + 模型切换 + 同步管理)
│
├── static/                       # TabBar 图标 PNG (10个, 81×81)
└── src/                          # uni-cli 构建时依赖的镜像目录 (与根目录保持同步)
```

## 路由配置

### TabBar (5个Tab)

| Tab | 路径 | 文字 | 颜色 |
|-----|------|------|------|
| 0 | pages/chat/index | 思迹 | #4A7C59 |
| 1 | pages/diary/list | 日记 | #4A7C59 |
| 2 | pages/bill/index | 账单 | #4A7C59 |
| 3 | pages/plan/index | 计划 | #667eea |
| 4 | pages/settings/index | 设置 | #4A7C59 |

### 非Tab页面

| 路径 | 标题 | 入口 |
|------|------|------|
| pages/diary/detail | 日记详情 | diary/list → navigateTo |
| pages/bill/stats | 收支统计 | chat/FloatButtons → navigateTo |
| pages/plan/detail | 计划详情 | plan/index → navigateTo |

## 状态管理 (Pinia)

```
useAppStore
├── deviceId: string               # 设备唯一标识
├── registered: boolean            # 是否已注册到服务端
├── apiKey: string                 # DeepSeek API Key
├── aiModel: 0|1                   # 0=Flash 1=Pro
├── currentMode: string            # chat|diary|bill|plan
├── conversationId: string         # 当前对话ID
├── messages: Message[]            # 当前聊天消息
├── isStreaming: boolean           # 是否正在AI回复中
├── syncQueueLength: number        # 待同步条目数
├── lastSyncTime: string           # 最近同步时间
├── isOnline: boolean              # 网络状态
│
├── getters:
│   ├── hasApiKey → boolean
│   ├── modelName → 'DeepSeek-V4-Pro'|'DeepSeek-V4-Flash'
│   └── modeLabel → 中文模式名
│
└── actions:
    ├── setDeviceId / setRegistered
    ├── setApiKey / setAiModel   (持久化到 Storage)
    ├── setCurrentMode / setConversationId
    ├── restoreFromStorage()     (启动时恢复)
    ├── addMessage / updateLastMessage / clearMessages
    └── setSyncQueueLength / setOnline
```

## 数据模型

### 日记 (Storage key: diary_YYYY-MM)

| 字段 | 类型 | 说明 |
|------|------|------|
| client_id | string | 客户端唯一ID |
| title | string | 标题 |
| content | string | 正文 |
| mood | int | 0-4 心情指数 |
| tags | string | JSON数组字符串 |
| ai_summary | string | AI生成摘要 (可选) |
| ai_advice | string | AI建议 (可选) |
| images | string | JSON图片列表 (可选) |
| created_at | int | 创建时间戳 |
| updated_at | int | 更新时间戳 |
| is_deleted | int | 软删除标记 0|1 |

### 账单 (Storage key: bill_YYYY-MM)

| 字段 | 类型 | 说明 |
|------|------|------|
| client_id | string | 客户端唯一ID |
| type | int | 0=支出 1=收入 |
| category | string | 分类 (餐饮/交通/购物/...) |
| amount | float | 金额 |
| remark | string | 备注 |
| bill_date | string | 记账日期 YYYY-MM-DD |
| ai_category | string | AI自动分类 |
| created_at | int | 创建时间戳 |
| updated_at | int | 更新时间戳 |
| is_deleted | int | 软删除标记 |

### 计划 (Storage key: plan_all)

| 字段 | 类型 | 说明 |
|------|------|------|
| client_id | string | 客户端唯一ID |
| title | string | 计划标题 |
| description | string | 描述 |
| priority | int | 0=普通 1=重要 2=紧急 |
| status | int | 0=待开始 1=进行中 2=已完成 |
| due_date | string | 截止日期 YYYY-MM-DD |
| ai_breakdown | string | AI拆解步骤 |
| ai_advice | string | AI建议 |
| created_at | int | 创建时间戳 |
| updated_at | int | 更新时间戳 |
| is_deleted | int | 软删除标记 |

### 消息 (内存中)

| 字段 | 类型 | 说明 |
|------|------|------|
| role | string | 'user'|'assistant' |
| content | string | 消息正文 |
| time | string | HH:MM |
| loading | boolean | 加载中动画 |
| actionCard | object|null | AI意图确认卡片 {type, payload} |

## API 接口

### 服务端 BASE_URL

- 开发环境 (H5): `/api` (Vite proxy)
- 生产环境 (APP): `https://your-server.ucloud.cn/api`
- 配置文件: `utils/api.js` 第10行

### 接口清单

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /user/register | 设备注册 |
| PUT | /user/settings | 更新设置 |
| POST | /chat | AI 对话 (30s timeout) |
| POST | /sync/batch | 批量同步 (60s timeout) |
| GET | /sync/pull | 拉取服务端增量 |
| POST | /diary | 创建日记 |
| GET | /diary?page=&size= | 日记列表 |
| PUT | /diary/:clientId | 更新日记 |
| DELETE | /diary/:clientId | 删除日记 |
| POST | /bill | 创建账单 |
| GET | /bill?month=YYYY-MM | 账单列表 |
| GET | /bill/stats?month= | 账单统计 |
| PUT | /bill/:clientId | 更新账单 |
| DELETE | /bill/:clientId | 删除账单 |
| POST | /plan | 创建计划 |
| GET | /plan | 计划列表 |
| PUT | /plan/:clientId | 更新计划 |
| DELETE | /plan/:clientId | 删除计划 |

### 请求格式

- Content-Type: application/json
- Header: X-Device-Id
- 响应格式: `{ code: 0, data: ..., message: '' }`

### AI 对话请求体

```json
{
  "message": "用户输入文本",
  "context_type": "chat|diary|bill|plan",
  "conversation_id": "会话ID(可选)"
}
```

### AI 对话响应体

```json
{
  "reply": "AI回复文本",
  "conversation_id": "新/续会话ID",
  "action": {
    "type": "create_bill|create_diary|create_plan|query_bill|query_diary|query_plan",
    "payload": { /* 具体数据 */ }
  }
}
```

## 离线同步机制

```
用户操作 → addItem(本地Storage) → enqueue(同步队列)
                                        ↓
    App onShow / 定时 / 手动 → trySync()
                                        ↓
        dequeue(批量出队) → POST /sync/batch
                                        ↓
           成功 → 清空已同步项 + 更新 lastSyncTime
           失败 → 保留队列，下次重试
```

- 同步队列存储: `sync_queue` (JSON Array)
- 每条记录带 `client_id` 作为幂等键
- 服务端后写覆盖 (last-write-wins)
- 软删除同步: `is_deleted=1`

## 关键设计决策

1. **无登录体系**: 设备ID标识，降低使用门槛 → 不支持多设备同步
2. **离线优先**: 所有写操作先落本地 → 入同步队列 → 异步推服务端
3. **AI 意图识别**: 聊天接口返回 action 对象 → 前端渲染确认卡片 → 用户确认后落库
4. **模式切换**: 自由对话 / 日记 / 记账 / 计划 四种语境，切换时 AI 上下文重置
5. **API Key**: 用户自行填写，前端仅显示，实际调用经服务端代理
6. **Tab 图标**: 静态位图占位（81×81 纯色圆），后续替换为 SVG/iconfont
7. **目录结构**: 根目录供 HBuilder X 使用，src/ 目录供 uni-cli (vite) 构建

## 已知问题 & 待办

| 优先级 | 问题 | 状态 |
|--------|------|------|
| 🔴 | 浏览器运行时空白页 | 待诊断（框架层+页面层已无语法错误，需浏览器DevTools排查） |
| 🔴 | 服务端未创建 | server/ 目录待开发 |
| 🟡 | api.js BASE_URL 需配置 | 部署时改为 UCloud 地址 |
| 🟡 | Tab 图标为占位色块 | 需设计师提供正式图标 |
| 🟢 | 语音输入未实现 | 后续迭代 |
| 🟢 | 多端同步 | 后续迭代 |

## 运行命令

```powershell
# 安装依赖
npm install

# H5 开发
npx uni                     # 或 npm run dev:h5

# 生产构建
npx uni build               # 输出到 dist/build/h5/

# HBuilder X 用法
# 打开项目 → 运行到浏览器（需先 npm install）
# 如遇 vue-cli-service 报错，用终端 npx uni 替代
```
