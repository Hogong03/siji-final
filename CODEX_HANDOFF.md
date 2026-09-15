# 思迹（Siji）— Codex 交接文档

> 本文件供 AI 编码助手（Codex/Claude/Cursor 等）快速接手项目开发。
> 包含项目架构、核心约定、代码风格、禁用项、关键模块索引。
> 最后更新：2026-09-14

---

## 1. 项目概况

| 项 | 值 |
|---|---|
| 名称 | 思迹（Siji） |
| 定位 | AI 对话式个人生活助手（记账/记录/计划/人脉/决策） |
| 技术栈 | uni-app + Vue 3 (Composition API) + Pinia |
| 三端 | H5 / App (Android+iOS) / 微信小程序 |
| 仓库 | `github.com/Hogong03/siji-private.git`（main 分支） |
| 路径 | `C:\Users\c3798\Desktop\思迹` |
| 代码量 | ~196 文件 / ~34,000 行（不含 node_modules/unpackage） |
| 测试 | 61 文件 / 812 用例，Vitest 框架（全绿，exit 0） |
| 版本 | v3.5.19（进入总结改成伪对话：总结作为 AI 消息落进新对话，消息下挂「查看详情 / 返回旧对话」，不再是顶部卡片。含 3.5.18 的记忆语义扩展与联网搜索解耦、3.5.17 的对话尺、3.5.16 的每次进来都是新对话、3.5.15 的白屏修复） |

---

## 2. 目录结构

```
思迹/
├── pages/              # 页面（Tab: chat/diary/bill/plan/functions + 子页 settings/）
│   ├── chat/           # AI 对话主界面
│   ├── diary/          # 记录（list + detail，5 种类型：随手记/日记/灵感/待办/闪念）
│   ├── bill/           # 记账（index + edit + stats）
│   ├── plan/           # 计划（index + detail，支持阶段化 phases）
│   ├── functions/      # 功能页（v6，Tab 内嵌 Segmented Control）
│   ├── settings/       # 设置（AI 配置/个人信息/人脉/决策/关于）
│   ├── search/         # 全局搜索
│   ├── splash/         # 启动页
│   ├── lock/           # 隐私锁
│   └── disclaimer/     # 免责声明
├── components/         # 全局组件
│   ├── chat/           # 对话相关（MessageBubble/ExecResultCard/ConversationPanel/OnboardingGuide/MarkdownRenderer/InputArea）
│   ├── bill/           # 账单组件
│   ├── common/         # 通用组件（SijiIcon/VirtualList/SocialQuotaBar 等）
│   ├── relation/       # 人脉组件（ReplyDrafts：回一条草稿）
│   └── plan/           # 计划组件
├── composables/        # 组合式函数
│   ├── useChatEngine.js  # 聊天引擎（518 行，核心，待拆）
│   ├── useDiaryList.js   # 记录列表逻辑
│   ├── useDiaryAI.js     # 记录 AI 摘要/改写
│   ├── useTagPicker.js   # 标签选择器
│   ├── useDiaryImages.js # 记录图片管理
│   ├── useChatSession.js # 冷启动新对话编排 + 进入总结当开场白（3.5.16 / 3.5.19）
│   └── useChatRuler.js   # 对话尺：滚动同步与触摸跳转（3.5.17）
├── store/              # Pinia 状态管理
│   ├── data.js         # 数据操作 Store（AI 执行分发 + 撤销栈 + 就地编辑）
│   ├── executors/      # 按领域拆分的 executor
│   │   ├── diary.js    # 记录 CRUD
│   │   ├── bill.js     # 账单 CRUD
│   │   ├── plan.js     # 计划 CRUD
│   │   ├── profile.js  # 个人信息
│   │   ├── relation.js # 人脉关系
│   │   ├── decision.js # 决策日志
│   │   ├── simulation.js # 情景演练
│   │   └── feedback.js # 体验反馈 CRUD（新增）
│   └── chat/           # 聊天 store（chat-store.js + chat-helpers.js）
├── utils/              # 工具层
│   ├── ai/             # AI 核心引擎
│   │   ├── agent-loop.js       # Agent 工具循环引擎（402 行）
│   │   ├── tools.js            # Agent 工具注册表 facade（拆分自 640 行）
│   │   ├── prompt-builder.js   # 系统提示词构建（缓存 120s）
│   │   ├── prompt-actions.js   # Action schema + 行为准则
│   │   ├── response-parser.js  # AI 输出解析 + 清洗 + 兜底
│   │   ├── autoExecutor.js     # 自动执行 + 结果渲染
│   │   ├── fallback.js         # 前端兜底
│   │   ├── providers.js        # 4 厂商注册表
│   │   ├── chat-helpers.js     # 消息构建
│   │   ├── chat-store.js       # 聊天会话存储
│   │   ├── search-adapters.js  # 联网搜索后端注册表（3.5.18）
│   │   ├── search-config.js    # 联网搜索开关 / 后端 / Key 裁决（3.5.18）
│   │   └── constants.js        # 共享正则与类型映射
│   ├── storage/        # 存储层（按领域分文件）
│   │   ├── diary.js    # 记录存储（按月分片 diary_YYYY-MM）
│   │   ├── bill.js     # 账单存储（按月分片 bill_YYYY-MM）
│   │   ├── plan.js     # 计划存储（plan_all）
│   │   ├── tags.js     # 标签管理（6 种类 + 自定义）
│   │   ├── feedback.js # 体验反馈
│   │   ├── profile.js  # 个人信息
│   │   ├── relations.js # 人脉关系
│   │   ├── decisions.js # 决策
│   │   ├── search.js   # 搜索索引
│   │   ├── export.js   # 数据导出
│   │   └── helpers.js  # 存储工具函数
│   ├── memory/         # 长期记忆分模块（3.5.14 从 692 行单文件拆出）
│   │   ├── store.js          # CRUD + 开关 + 过期清理
│   │   ├── normalize.js      # 文本归一化（去重与治理共用）
│   │   ├── governance.js     # 合并 / 隐藏 / 删除 / 归类修正
│   │   ├── context.js        # buildMemoryContext（注入提示词的摘要）
│   │   ├── profile-values.js # 画像字段值（过滤冗余记忆）
│   │   ├── profile-link.js   # 记忆采纳进画像
│   │   ├── monthly.js        # 月度记忆卡
│   │   └── auto-extract.js   # 对话后提取 + AI 摘要
│   ├── memory.js       # 长期记忆门面（只做转出，60 行）
│   ├── memory-synonyms.js # 记忆语义扩展：同义分组 34 组 + 拼音词表 47 词（3.5.18）
│   ├── chat-session.js # 冷启动新对话判定：空壳 / 入口让位（3.5.16、3.5.19）
│   ├── enter-dialogue.js # 进入总结写成对话消息：开场白 / 正文行 / 签名（3.5.19）
│   ├── chat-ruler.js   # 对话尺纯计算：阈值 / 刻度 / 视口（3.5.17）
│   ├── social-quota.js # 社交额度与回复草稿（3.5.14）
│   ├── reminder/       # 提醒模块
│   ├── crypto.js       # API Key 加解密（XOR+Base64）
│   ├── logger.js       # 日志
│   ├── uuid.js         # ID 生成
│   └── store-helpers.js # 存储辅助
├── config/             # 配置
├── common/             # 公共资源
├── static/             # 静态资源（图标/图片）
├── tests/              # 测试（61 文件 812 用例，Vitest）
├── App.vue             # 根组件（全局 CSS 变量 + onErrorCaptured）
├── pages.json          # 页面路由（CRLF + UTF-8 BOM，编辑需注意）
├── manifest.json       # 应用配置
├── uni.scss            # 全局 SCSS 变量
└── DESIGN_SYSTEM.md    # UI 设计规范
```

---

## 3. AI 核心架构

### 3.1 双路径并行

```
用户消息
  ├─ Agent Loop 路径（provider.supportsToolCalling=true 时）
  │   → AI 带 tools 参数 → tool_calls → executeTool → 结果回传 → 再推理 → 最终回复
  │   → 最多 5 轮（MAX_ROUNDS=5）
  │
  └─ 传统 JSON Action 路径（兜底）
      → AI 返回 JSON {reply, action} → response-parser 解析 → autoExecutor 执行 → fallback 兜底
```

### 3.2 工具注册表（tools.js）

- **31 个工具**：记录(5) + 账单(4) + 计划(4) + 个人信息(2) + 关系(3) + 决策(3) + 通用(1) + 反馈(5) + 标签(4)；schema 按领域拆到 `utils/ai/tools/{domain}.js`，执行器在 `utils/ai/tools/executor.js`
- **QUERY_TOOLS**（只读自动执行）：query_diary/bill/stat/plan/relation/decision/combined + get_profile + summarize_diaries + query_feedback/feedback_stats + query_tags
- **CONFIRM_TOOLS**（需确认）：空集（delete_* 未注册到 Agent）
- **动态确认阈值**：create_bill/update_bill 的 amount >= 500 需确认
- **executeTool()** 分发：标签工具直接调 tags.js，其余走 `store.executeAction()`

### 3.3 Prompt 构建链

```
prompt-builder.js
  ├─ 静态段（模块级构建一次）：IDENTITY_LINE + JSON 规范 + 核心铁律(10 条) + 表达多样性 + CORE_ACTIONS + BEHAVIOR_RULES(7 条)
  ├─ 动态段（每次重拼）：日期/问候 + extActions(数据检测) + profileCtx(月度画像)
  └─ 缓存：TTL 120s，bumpDataVersion() 失效
```

### 3.4 AI 厂商

| 厂商 | 模型 | supportsResponseFormat | supportsToolCalling |
|------|------|------------------------|---------------------|
| DeepSeek | V4 Flash / V4 Pro | true | true |
| 智谱 GLM | GLM-4 Flash / 4.7 Flash / 5.1 / 5.2 | false | true |
| 通义千问 | Turbo / Max / Plus | false | true |
| Moonshot | v1-8k / v1-32k | true | true |

### 3.5 内置 Agent

3.0 起内置仅 1 个：思迹助手（siji 通用）。
场景人设模板化：`utils/agent-templates.js` 的 `PRESET_TEMPLATES` 仅保留 2 个（心理咨询师 / 情感顾问），点击模板创建为自定义 Agent；另支持 AI 对话直接创建（`create_agent` 工具）。

3.1 起技能体系整体下线：`utils/ai/skills.js` 已删除，Agent 无 `skills` 字段，人设即能力（原 7 段技能引导等价物并入 CORE_ACTIONS / agent-loop 提示词）；Agent 新增 `starts[]` 开场引导（≤3 条、每条 ≤20 字，思迹助手与 2 个模板预置，create_agent 支持 AI 生成）；会话新增 `agentId/agentName` 绑定（新建会话记录活跃 Agent，历史会话不符时聊天页显示一次性「切换」提示）。

### 3.6 AI 输出三层加固

1. **Prompt 铁律**：10 条核心规则（JSON 格式 / 真人聊天 / 禁操作完成语 / 纠错主动权 / 标签管理 等）
2. **Response Parser 清洗**：提取 JSON / 检测虚假操作声明 / 兜底回复
3. **Stream Parser 兜底**：流式期间实时解析 + 截断保护

---

## 4. 存储架构

### 4.1 存储键清单

| Key | 用途 | 分片策略 |
|-----|------|----------|
| `diary_YYYY-MM` | 记录 | 按月分片 |
| `bill_YYYY-MM` | 账单 | 按月分片 |
| `plan_all` | 计划 | 不分片 |
| `siji_tags_diary` / `siji_tags_plan` | 标签注册表 | 按类型 |
| `siji_tag_categories` | 自定义标签种类 | 不分片 |
| `siji_feedback` | 体验反馈 | 不分片 |
| `siji_provider_keys` | API Key（加密） | 不分片 |
| `siji_ai_provider` / `siji_ai_model` | 当前厂商/模型 | 不分片 |
| `siji_my_profile` | 个人信息（v2） | 不分片 |
| `siji_relations` / `siji_interactions` | 人脉关系 | 不分片 |
| `siji_decisions` | 决策日志 | 不分片 |
| `siji_long_term_memory` | 长期记忆 | 不分片 |
| `siji_conversations` | 对话历史（多会话） | 不分片 |
| `siji_conv_tags` | 对话标签 | 不分片 |
| `siji_index` | 搜索索引 | 不分片 |

### 4.2 软删除

所有数据使用 `is_deleted` 字段软删除（0=正常，1=已删除），查询时过滤。

### 4.3 API Key 加密

`crypto.js`：XOR + Base64，salt `siji_2026_xor_key_!@#`。加可打印 ASCII 校验 + 空值前置拦截。

---

## 5. 核心约定（必须遵守）

### 5.1 CSS / 样式

- **禁用 CSS 变量 `var(--xxx)`**：uni-app App 端 fixed 定位组件变量继承不稳定。统一硬编码颜色 + `@media (prefers-color-scheme: dark)` 深色覆盖
- **SCSS 编译期变量 `$xxx` 不受限**，可用 `uni.scss` 中定义的
- **四级灰阶色值体系**：
  - 页面背景 `#F4F4F5` → 卡片/输入区 `#FFFFFF` → 次级背景 `#F4F4F5` → 边框/focus `#E4E4E7`
- **零阴影**：全项目无 `box-shadow`（功能性阴影除外）
- **零渐变**：禁止 `linear-gradient` / `backdrop-filter`
- **纯黑白设计**：#000000 / Zinc 灰阶为主，功能色仅用于状态标识
- **用户消息气泡**：纯黑实心白字，禁止复制/选择、长按已禁用

### 5.2 文件编码

- **.vue 文件**：Tab 缩进 + CRLF 行尾
- **pages.json**：CRLF + UTF-8 BOM，编辑失败时用 Python 脚本（edit 工具可能破坏 BOM）
- **禁用 PowerShell `Set-Content` 写含中文文件**（GBK 编码损坏），用 write 工具或 Python 脚本
- **JS 注释禁用 emoji**（HBuilder X 内置 Vite 解析不稳定）
- **SFC 三 block 必须完整闭合**

### 5.3 代码拆分

- **超过 300 行的文件必须拆分**（.scss 例外，无拆分价值）
- 拆分方向：按职责分离（store/executors/ 已拆 7 个领域）
- 标记未拆项：`// TODO: extract to xxx`

### 5.4 平台差异

- **H5 可用 ≠ App 可用 ≠ 小程序可用** — 任何方案必须说明平台适配
- **renderjs**：仅 H5 + App-vue，小程序不可用。用 `document.getElementById`（非 `this.$el`），props 用 `:opts + :change:opts`，initChart 加 100ms 延迟
- **图片存储**：App→`_doc/`、MP→`wx.env.USER_DATA_PATH`、H5→下载。base64 仅传递不存储
- **原生导航栏优先**（自定义导航栏有多端兼容坑）

### 5.5 AI 相关

- **新增查询/创建类 action**：CORE_ACTIONS 和 TOOL_DEFINITIONS 两处都加
- **新增更新/删除类 action**：只加 CORE_ACTIONS（不给 Agent 自动执行）
- **改完 action 后必须**：`bumpDataVersion()` 失效缓存 + 跑 `tests/action-schema-consistency.test.js`
- **4 厂商均 supportsToolCalling: true**
- Agent 不做删除类破坏性操作（delete_* 未注册到 TOOL_DEFINITIONS）

---

## 6. 测试

```bash
# 运行测试
npx vitest run

# 预期：15 文件 94 用例全通过
# 退出码 1 是正常的（stderr 日志来自 op-claim-guard 测试的预期输出）
```

测试覆盖：
- `rate-limiter.test.js` / `datetime.test.js` / `uuid.test.js` / `crypto.test.js` / `nav-helper.test.js`
- `storage-helper.test.js` / `categories.test.js` / `version-check.test.js` / `debounce.test.js`
- `simulation-prompts.test.js` / `fallback-relation.test.js` / `response-parser.test.js`
- `op-claim-guard.test.js` / `action-schema-consistency.test.js` / `agent-tools.test.js`

覆盖率 < 5%，核心业务严重不足（待补）。

---

## 7. 用户风格偏好

### 代码风格

- **先结论后分析**：不要铺垫三段才入正题，直接给方案
- **确定性表达**：不说"建议""考虑""可能"，说"应该""必须"。不确定时声明"需验证"
- **代码优先于文字**：用户要方案不是听分析
- **代码必须可运行**：不写 `// ...省略`，不写伪代码
- **每个方案带版本适配说明**和**影响范围标注**
- **同步提供调试指令**

### 做事风格

- **工程确定性优先**：不写"理论上可行"的代码，方案选了就给验证步骤
- **拆分即正义**：超过 300 行就是罪
- **删代码比加代码更需要勇气**：不用的功能是技术债务不是资产
- **API 永远不可信**：第三方服务随时改行为，代码要防三层脆
- **极简是对抗熵增的唯一手段**

### 禁忌

- 不写"最佳实践"等泛词
- 不分点罗列到废话程度（超过 7 条在凑数）
- 不保留死代码、未引用组件、废弃 import
- 不用 `trash` > `rm`（可恢复 > 不可恢复）
- 不把"理论上"当论据

---

## 8. 待办清单

### P1（高优先）

- [x] 补核心业务测试（executors 14 例 + prompt-builder 11 例；stream-parser/chat-store 待补）
- [x] 拆分 reminder.js（已完成：现 65 行 + `utils/reminder/` 目录）
- [ ] 标签种类管理 UI 适配（detail.vue 标签选择器增加种类分组）
- [ ] 真机验收 3.5.19 进入总结伪对话（冷启动开场白 / 回前台插消息 / 「返回旧对话」按钮 / 深色模式）+ H5 渲染截图留存
- [ ] 真机验收 3.5.18 联网搜索设置卡片（开关 / 后端切换 / Key 保存清除）+ H5 渲染截图留存
- [ ] Tavily 后端线上验证（代码与解析已被单测覆盖，尚未用真实 Key 跑过一次）
- [ ] 真机验证 AI 纠错流程（先 query 再 update 的完整链路）

### P2

- [x] 拆分 tools.js（640→facade 12 行 + tools/ 目录）与 ConversationPanel.vue（712→284 + 3 子组件）；其余超标文件待拆
- [ ] H3 Markdown 编辑器
- [ ] 补全 SijiIcon 图标映射（缺 more/chat 等）
- [ ] 真机验证清单 20 项
- [ ] plan/index.vue 拆分
- [ ] 真机验证对话尺（App 端 scroll-into-view 扩窗跳转与 touchmove 拖动；H5 已验收）
- [x] 拆分 `utils/memory.js`（692 → 门面 60 行 + `utils/memory/` 八块；memory 系列 70 用例全绿）
- [ ] 拆分 `composables/useChatEngine.js`（518 行）：`handleSend` 主体约 390 行（图片识别 → 流式 → pumpDisplay → 动作执行）抽到 `utils/ai/send-pipeline.js`，引擎只留状态与编排；抽完必须跑 `tests/agent-engine-smoke.test.js` + 真机发一轮图文消息
- [ ] 拆分 UI 组件：`pages/chat/index.vue`（636 行）/ `components/plan/PlanChildPlans.vue`（591 行）/ `pages/settings/sub/memory.vue`（549 行）/ `pages/settings/sub/relations.vue`（385 行）/ `pages/settings/sub/relation-detail.vue`（368 行）；抽聊天页卡片前先读 AGENTS.md「注意事项」里的 scoped 样式约束，且必须真机验收
- [x] 状态觉察之外的 P3：账单周播报三数字（`utils/bill-weekly.js`）、社交能量预算 + 回复草稿（`utils/social-quota.js`）——3.5.14 完成
- [ ] response-parser.js 空回复兜底测试
- [ ] voice recognition（需接原生插件）

### 安全 / 工程

- [x] 恢复 git sslVerify（2026-08-20 已置 true）
- [x] scripts/ 已清理（仅剩 gen-icons.cjs）
- [ ] vite build 验证重复导出
- [ ] 用户重新输入 DeepSeek API Key（损坏的 storage）
- [ ] aiConfig.js 旧格式迁移逻辑（确认所有用户迁移后可删）

---

## 9. 关键文件速查

| 需要做什么 | 看哪个文件 |
|-----------|-----------|
| 加新 AI 工具 | `utils/ai/tools.js` + `utils/ai/prompt-actions.js` + `store/data.js` |
| 改 AI 回复风格 | `utils/ai/prompt-builder.js` 核心铁律 |
| 加新页面 | `pages.json` + `pages/xxx/` |
| 改全局样式 | `uni.scss` + `App.vue` |
| 加存储键 | `utils/storage/xxx.js` + `utils/storage.js` 导出 |
| 改 Agent 行为 | `utils/ai/agent-loop.js` + `utils/ai/prompt-actions.js` |
| 加测试 | `tests/xxx.test.js` |
| 改每周账单播报 | `utils/bill-weekly.js` + `composables/useEnterSummary.js` + `pages/chat/index.vue` |
| 改进入总结（伪对话） | `utils/enter-dialogue.js`（消息组装/签名）+ `composables/useChatSession.js` 的 `appendEnterSummary` + `utils/chat-session.js`（空壳/让位）+ `pages/chat/index.vue` 的 `.enter-actions` |
| 改社交额度/回复草稿 | `utils/social-quota.js` + `components/common/SocialQuotaBar.vue` / `components/relation/ReplyDrafts.vue` |
| 改对话尺 | `utils/chat-ruler.js`（纯计算）+ `composables/useChatRuler.js`（编排）+ `pages/chat/index.vue` / `chat.scss` |
| 改联网搜索 | `utils/ai/search-adapters.js`（后端 + 请求/解析）+ `utils/ai/search-config.js`（开关/Key 裁决）+ `pages/settings/sub/ai.vue` 卡片 |
| 改记忆语义扩展 | `utils/memory-synonyms.js`（同义分组 + 拼音词表）+ `utils/memory-rank.js` 的 `buildQueryTerms` |
| 改长期记忆 | `utils/memory.js`（门面）→ `utils/memory/xxx.js` 对应职责文件 |
| 深色模式 | 各组件 `<style>` 末尾 `@media (prefers-color-scheme: dark)` |
| 记录类型 | `pages/diary/detail.vue` RECORD_TYPES 常量 |

---

## 10. Git 状态

- 当前 HEAD: `673e0b1` (chore: 新增 AGENTS.md 供 Codex 接手开发)
- GitHub push 已恢复（2026-08-20 成功推送 27 个 commit）
- `http.sslVerify` 已恢复为 true（2026-08-20）

---

## 11. HBuilder X 注意事项

- HBuilder X 版本需 3.8.7+（nvue 编译差异）
- 编译前删 `unpackage/dist` 缓存强制重编译
- 内置浏览器 ≠ 真机行为，必须真机验证
- Tab 缩进（非空格）
- `http.sslVerify` 已恢复为 true

---

> 本文档由 HX 架构师生成。有问题直接看源码，别猜。
