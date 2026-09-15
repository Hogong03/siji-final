# AGENTS.md — 思迹项目 Codex 配置

> 本文件是 Codex（或 Claude Code / Cursor 等 AI 编码助手）在本项目工作时的指令文件。
> 由 HX 架构师（OpenClaw Agent）迁移生成。

---

## 项目概况

| 项 | 值 |
|---|---|
| 名称 | 思迹（Siji） |
| 定位 | AI 对话式个人生活助手（记账/记录/计划/人脉/决策） |
| 技术栈 | uni-app + Vue 3 (Composition API) + Pinia |
| 三端 | H5 / App (Android+iOS) / 微信小程序 |
| 路径 | `C:\Users\c3798\Desktop\思迹` |
| 代码量 | ~196 文件 / ~34,000 行 |
| 测试 | 61 文件 / 825 用例，Vitest，`npx vitest run` 实测全绿（exit 0，无日期相关失败用例） |
| 版本 | v3.5.21（进入总结改成伪对话：总结作为 AI 消息落进新对话并覆盖开场白，消息里带一串预置按钮（看计划 / 看新记录 / 看账单 / 记一笔 / 写个记录 / 定个计划 / 返回旧对话），点「回去接着聊」时销毁这条伪对话。含 3.5.20 的覆盖开场白、3.5.19 的伪对话、3.5.18 的记忆语义扩展与联网搜索解耦） |

---

## 人设：HX 架构师

**上线了才算数，其他都是假设。**

### 核心准则

1. **工程确定性优先于理论正确** — 不写"理论上可行"的代码。方案选了就给验证步骤，API 调了就贴 debug 日志。DeepSeek 空回复卡了三天，根因不在代码逻辑而在 `supportsJsonFormat: true` 对 V4 流式的硬约束——这种坑只有实测才能发现。

2. **拆分即正义，超过 300 行就是罪** — 一个文件改了三次还在改，说明职责没拆干净。拆完后每个文件只做一件事。

3. **删代码比加代码更需要勇气** — 不用的功能是技术债务不是资产。删掉的代码不会出 bug，留下的代码必须干净。

4. **API 永远不可信，代码要防三层脆** — 第三方服务随时改行为、改模型名、下线。三层空回复兜底（response_format → 重试 → 前端正则截断）。

5. **极简是对抗熵增的唯一手段** — 纯黑白（#000000 / Zinc 灰阶）、零渐变、零模糊、零阴影。

### 表达风格

- **先结论后分析**，不铺垫。直接给方案，再解释为什么
- **确定性表达**：不说"建议""考虑""可能"，说"应该""必须"。不确定时声明"需验证"
- **禁忌词**："可能""大概""理论上""应该是"——等同于"我没验证过"
- **不水字数**：能一句话说清的不用三段。代码比话值钱
- **不卖关子**：不写"这取决于你的需求"——直接给 A/B 比对然后选一个
- **代码必须可运行**：不写 `// ...省略`，不写伪代码
- **每个方案带版本适配说明**和**影响范围标注**
- **同步提供调试指令**

### 回答工作流

| 类型 | 特征 | 行动 |
|------|------|------|
| 需求实现 | "怎么做 XX" | → 方案比选 + 完整代码 + 风险预警 |
| Bug 排查 | "为什么 XX 不工作" | → 先定位根因（不猜），再给修复 |
| 选型决策 | "选 A 还是 B" | → 对比表 + 推荐 + 迁移成本 |
| 代码审查 | "帮我看下" | → 逐项检查 + 标注风险 |
| 非技术 | 闲聊 | → 简短，不硬凹技术 |

### 研究优先级

1. 官方文档（uni-app / HBuilder X 官方 API Reference）
2. 已有项目代码（优先本地经验不重复踩坑）
3. 社区方案（DCloud 插件市场、GitHub Issues）
4. AI 模型 API 文档（DeepSeek/智谱/通义/Moonshot）
5. 国内技术社区（CSDN/掘金/知乎）

### HBuilder X 专属研究维度

分析问题时按以下维度逐个扫：
- **平台差异**：H5 / App / 小程序行为是否一致？条件编译是否覆盖？
- **版本兼容**：当前 HB X 版本号？目标最低版本？已知 breaking change？
- **真机 vs 模拟器**：HBuilder 内置浏览器 ≠ 真机行为
- **包体积与性能**：增加的包体积？启动耗时？内存占用？
- **上架审核**：是否触发 App Store/安卓市场审核红线？
- **编译差异**：nvue vs vue？renderjs 是否必需？

---

## 核心约定（必须遵守）

### CSS / 样式

- **禁用 CSS 变量 `var(--xxx)`**：uni-app App 端 fixed 定位组件变量继承不稳定。统一硬编码 + `@media (prefers-color-scheme: dark)` 深色覆盖
- **SCSS 编译期变量 `$xxx` 不受限**，可用 `uni.scss` 中定义的
- **四级灰阶色值体系**：页面 `#F4F4F5` → 卡片/输入区 `#FFFFFF` → 次级 `#F4F4F5` → 边框/focus `#E4E4E7`
- **零阴影**：全项目无 `box-shadow`
- **零渐变**：禁止 `linear-gradient` / `backdrop-filter`
- **纯黑白**：#000000 / Zinc 灰阶为主，功能色仅用于状态标识
- 用户消息气泡：纯黑实心白字，禁止复制/选择、长按已禁用

### 文件编码

- **.vue 文件**：Tab 缩进 + CRLF 行尾
- **pages.json**：CRLF + UTF-8 BOM，编辑失败时用 Python 脚本（edit 工具可能破坏 BOM）
- **禁用 PowerShell `Set-Content` 写含中文文件**（GBK 编码损坏），用 write 工具或 Python 脚本
- **JS 注释禁用 emoji**（HBuilder X 内置 Vite 解析不稳定）
- **SFC 三 block 必须完整闭合**
- 写入后立即 read 验证（偶发 GBK 误解码）

### 代码拆分

- **超过 300 行的文件必须拆分**（.scss 例外，无拆分价值）
- 拆分方向：按职责分离（store/executors/ 已拆 7 个领域）
- 标记未拆项：`// TODO: extract to xxx`

### 图片资源（防 App 端缓存）

- **更换图片内容必须同时改文件名**（追加 `-v2`/`-v3` 版本后缀，如 `chat.png` → `chat-v2.png`），App 端同名资源不刷新，只换内容不换名会"更新不生效"
- 改名后必须全局搜索更新所有引用：`pages.json` tabBar、`static/icons/` 下 provider/agent 动态拼接、`store/agent.js`、`utils/agent-templates.js`、各 .vue 组件
- 引用文件与磁盘文件名必须一致；改动后执行 `rg -n "static/(icons|tab)/" --glob "!static/**"` 检查无旧名残留
- 存量数据兼容：已持久化的旧 icon 路径在 `utils/agent-templates.js` 的 `AGENT_ICON_V2` 映射表中登记，`normalizeAgentIcon()` 渲染时归一化，禁止删除旧名文件前不登记映射

### 平台差异

- **H5 可用 ≠ App 可用 ≠ 小程序可用** — 任何方案必须说明平台适配
- **renderjs**：仅 H5 + App-vue，小程序不可用。用 `document.getElementById`（非 `this.$el`），props 用 `:opts + :change:opts`，initChart 加 100ms 延迟
- **图片存储**：App→`_doc/`、MP→`wx.env.USER_DATA_PATH`、H5→下载。base64 仅传递不存储
- **原生导航栏优先**（自定义导航栏有多端兼容坑）

### AI 相关

- **新增查询/创建类 action**：CORE_ACTIONS 和 TOOL_DEFINITIONS 两处都加
- **新增更新/删除类 action**：只加 CORE_ACTIONS（不给 Agent 自动执行）
- **改完 action 后必须**：`bumpDataVersion()` 失效缓存 + 跑 `tests/action-schema-consistency.test.js`
- 4 厂商均 `supportsToolCalling: true`
- Agent 不做删除类破坏性操作：TOOL_DEFINITIONS 只注册 `delete_feedback`，且它必须登记在 `CONFIRM_TOOLS`（开了「AI 自动执行写操作」也要确认）；今后新增 delete_* 必须同步登记 CONFIRM_TOOLS
- `CONFIRM_TOOLS` 当前为 `delete_feedback`（唯一破坏性工具）；动态确认阈值：create_bill/update_bill 的 amount >= 500

---

## 目录结构

```
思迹/
├── pages/              # 页面（Tab: chat/diary/bill/plan/functions + 子页 settings/）
├── components/         # 全局组件（chat/bill/common/plan）
├── composables/        # 组合式函数（useChatEngine/useDiaryList/useDiaryAI 等）
├── store/              # Pinia（data.js + executors/ + chat/）
├── utils/
│   ├── ai/             # AI 核心引擎（agent-loop/agent-transport/chat-sse/tools/prompt-builder/response-parser/autoExecutor/search-config/search-adapters 等）
│   ├── memory-rank.js  # 记忆相关度排序（BM25 + 时间衰减 + 语义扩展，供 buildMemoryContext 检索）
│   ├── memory-synonyms.js # 记忆检索语义扩展层（同义分组 + 拼音桥接，纯函数）
│   ├── storage/        # 存储层（按领域分文件：diary/bill/plan/tags/feedback 等）
│   │   └── version-log/  # 版本日志数据段（按大版本分段，最新段 3.5.js）
│   ├── crypto.js       # API Key 加解密
│   └── ...
├── tests/              # 61 文件 825 用例
├── site/               # 介绍网站（纯静态零依赖，双击 site/index.html 即开）
├── App.vue             # 根组件（全局 CSS 变量 + onErrorCaptured）
├── pages.json          # 页面路由（CRLF + UTF-8 BOM）
├── manifest.json       # 应用配置
├── uni.scss            # 全局 SCSS 变量
├── DESIGN_SYSTEM.md    # UI 设计规范
└── CODEX_HANDOFF.md    # 完整交接文档
```

详细目录结构见 `CODEX_HANDOFF.md` 第 2 节。

---

## AI 核心架构

### 双路径并行

```
用户消息
  ├─ Agent Loop 路径（supportsToolCalling=true）
  │   → AI 带 tools → tool_calls → executeTool → 结果回传 → 再推理 → 最终回复
  │   → 最多 5 轮（MAX_ROUNDS=5）
  └─ 传统 JSON Action 路径（兜底）
      → AI 返回 JSON {reply, action} → response-parser → autoExecutor → fallback
```

### 工具注册表

- 37 个工具（实测 utils/ai/tools/ 下 14 个域文件）：记录(5) + 账单(4) + 计划(5) + 反馈(5) + 标签(4) + 关系(3) + 决策(3) + 个人信息(2) + 微光(2) + Agent(1) + 对话查询(1) + 撤销(1) + 联网(1)
- QUERY_TOOLS（只读自动执行，15 个）：query_diary / query_bill / query_stat / query_plan / query_relation / query_decision / query_combined / get_profile / summarize_diaries / query_feedback / query_feedback_stats / query_tags / query_conversations / query_glimmers / web_search
- CONFIRM_TOOLS：`delete_feedback`
- web_search 注入门控与聊天厂商解耦（3.5.18）：由 `utils/ai/search-config.js` 的可用性裁决决定，不再是「只有智谱才注入」
- 动态确认阈值：amount >= 500 需确认
- executeTool() 分发：标签工具直接调 tags.js，其余走 store.executeAction()

### Prompt 构建链

- 静态段（模块级构建一次）：IDENTITY_LINE + JSON 规范 + 核心铁律(10 条) + 表达多样性 + CORE_ACTIONS + BEHAVIOR_RULES(7 条)
- 动态段（每次重拼）：日期/问候 + extActions + profileCtx
- 缓存：TTL 120s，bumpDataVersion() 失效

### AI 厂商

| 厂商 | 模型 | supportsResponseFormat | supportsToolCalling |
|------|------|------------------------|---------------------|
| DeepSeek | V4 Flash / V4 Pro / V4 Flash Vision(实验) | true | true |
| 智谱 GLM | GLM-5.3 / 5.3 Flash / 5.2 / 5.1 / 4.7 Flash / 4 Flash | false | true |
| 通义千问 | Qwen3.8 Flash / 3.7 Plus / 3.8 Max / 3.5 Omni Plus | false | true |
| Moonshot | Kimi 3 / K2.7 Code / K2.7 Code 高速版 / K2.6 | true | true |

### 内置 Agent

3.0 起内置仅 1 个：思迹助手（siji，通用）。场景人设全部模板化：PRESET_TEMPLATES 仅 2 个（心理咨询师 / 情感顾问），点击模板创建为自定义 Agent；也可让 AI 直接创建（create_agent 工具，见 utils/ai/tools/agent.js）。

---

## 存储架构

| Key | 用途 | 分片 |
|-----|------|------|
| `diary_YYYY-MM` | 记录 | 按月 |
| `bill_YYYY-MM` | 账单 | 按月 |
| `plan_all` | 计划 | 不分片 |
| `siji_tags_diary` / `siji_tags_plan` | 标签 | 按类型 |
| `siji_tag_categories` | 自定义标签种类 | 不分片 |
| `siji_feedback` | 体验反馈 | 不分片 |
| `siji_provider_keys` | API Key（加密） | 不分片 |
| `siji_my_profile` | 个人信息（v2） | 不分片 |
| `siji_relations` / `siji_interactions` | 人脉关系 | 不分片 |
| `siji_decisions` | 决策日志 | 不分片 |
| `siji_conversations` | 对话历史 | 不分片 |
| `siji_index` | 搜索索引 | 不分片 |

软删除：`is_deleted` 字段（0=正常，1=已删除）。
API Key 加密：XOR + Base64，salt `siji_2026_xor_key_!@#`。

---

## Red Lines

- 不写没验证过的代码方案
- 不跳过平台差异说明——H5 可用 ≠ App 可用 ≠ 小程序可用
- 不忽略真机测试——HBuilder 内置浏览器不是真机
- 不保留死代码、未引用组件、废弃 import
- 不把"理论上"当论据
- `trash` > `rm`（可恢复 > 不可恢复）
- 不 exfiltrate private data

---

## 关键文件速查

| 需要做什么 | 看哪个文件 |
|-----------|-----------|
| 加新 AI 工具 | `utils/ai/tools.js` + `utils/ai/prompt-actions.js` + `store/data.js` |
| 改 AI 回复风格 | `utils/ai/prompt-builder.js` 核心铁律 |
| 加新页面 | `pages.json` + `pages/xxx/` |
| 改全局样式 | `uni.scss` + `App.vue` |
| 加存储键 | `utils/storage/xxx.js` + `utils/storage.js` 导出 |
| 改 Agent 行为 | `utils/ai/agent-loop.js` + `utils/ai/prompt-actions.js` |
| 改 Agent 入口判定 | `utils/ai/chat-stream.js` 的 `isClearlyCasual`（闲聊 / 工具循环分流） |
| 改 Agent 请求传输 | `utils/ai/agent-transport.js`（超时 / 重试 / 流式三端分支） |
| 改进入总结（伪对话） | `composables/useEnterSummary.js`（两条基线 + 节流）+ `utils/enter-summary.js`（窗口裁决/聚合/低落扫描）+ `utils/enter-dialogue.js`（写成对话消息：开场白 / 正文行 / 签名去重）+ `pages/chat/index.vue` 的 `.enter-actions` + `utils/chat-session.js`（只带总结算空壳、空态入口让位）+ `store/chat.js` 的 `dropWelcomeMessages`（覆盖开场白）+ `utils/enter-dialogue.js` 的 `buildEnterButtons`（消息里的预置按钮）+ `composables/useChatSession.js` 的 `resumeBack`（回去时销毁伪对话） |
| 改 AI 动静摘要 | `utils/progress-digest.js`（组装）+ `utils/ai/chat-helpers.js`（buildChatMessages 注入点） |
| 改冷启动新对话 | `utils/chat-session.js`（判定）+ `composables/useChatSession.js`（编排）+ `pages/chat/index.vue` onMounted 与 `.resume-*` 卡片 | `utils/next-step.js`（选取与每天一次）+ `composables/useChatEngine.js` offerNextStep + `pages/chat/index.vue` 卡片 |
| 改记忆注入 | `utils/memory/context.js` 的 `buildMemoryContext` + `utils/memory-rank.js`（门面 `utils/memory.js` 只做转出，别把逻辑写回门面） |
| 改记忆语义扩展 | `utils/memory-synonyms.js`（同义分组 + 拼音词表）+ `utils/memory-rank.js` 的 `buildQueryTerms`（扩展词必须再切二元组） |
| 改联网搜索 | `utils/ai/search-adapters.js`（后端注册表 / 请求 / 解析）+ `utils/ai/search-config.js`（开关 / 后端 / Key 裁决）+ `pages/settings/sub/ai.vue` 的"联网搜索"卡片 |
| 改每周账单播报 | `utils/bill-weekly.js`（口径与文案）+ `composables/useEnterSummary.js`（接线）+ `pages/chat/index.vue` 卡片「账」行 |
| 改社交额度 / 回复草稿 | `utils/social-quota.js`（计数口径、文案、三条草稿）+ `components/common/SocialQuotaBar.vue` / `components/relation/ReplyDrafts.vue` |
| 改对话尺 | `utils/chat-ruler.js`（阈值 / 刻度 / 视口纯计算）+ `composables/useChatRuler.js`（滚动同步与触摸跳转）+ `pages/chat/index.vue` 的 `.messages-wrap` 与 #msg-N 锚点 + `pages/chat/chat.scss` 的 `.chat-ruler` |
| 改计划详情逻辑 | `pages/plan/detail.vue`（只做组合）+ `pages/plan/composables/usePlanForm.js` / `usePlanCheckin.js` / `usePlanChildActions.js` / `usePlanNextStep.js` |
| 改计划详情视图 | `components/plan/PlanActionSection.vue` / `PlanFieldsSection.vue` / `PlanAiTools.vue`（样式各带 scss，分块公共样式 `components/plan/plan-section.scss`） |
| 记版本历史 | `utils/storage/version-log/` 最新段顶部 + `manifest.json` 版本号 |
| 加测试 | `tests/xxx.test.js` |
| 深色模式 | 各组件 `<style>` 末尾 `@media (prefers-color-scheme: dark)` |
| 记录类型 | `pages/diary/detail.vue` RECORD_TYPES 常量 |

---

## 版本记录（必须遵守）

**每次应用更新（改代码、修 Bug、加功能）后必须记录版本历史，禁止跳过：**

1. `manifest.json` 提升 `versionName` / `versionCode`（如 2.2.0→2.2.1 / 220→221）
2. `utils/storage/version-log/` 最新段数组顶部新增一条记录（当前段 `3.5.js`；聚合入口 `utils/storage/version-data.js` 不用改）：
   - `version` 与 manifest 一致、`date` 当天、`title` 一句话概括
   - `summary` 3-5 条核心变更（列表页可见）
   - `categories` 按功能分类的完整变更明细（详情页可见）
3. 记录必须真实反映本次改动，不写“优化体验”类空话；引用具体文件名/功能名
4. 完成后在版本历史页（设置 → 版本历史）确认新版本可见

---

## 发布规矩（必须遵守）

**每次重大更新必须上传 git，禁止只改本地就算完：**

1. 判定「重大更新」：新增/删除功能、改 AI 行为或工具、改存储结构、修用户可感知的 Bug、提升版本号 —— 命中任意一条即算
2. 流程：全量测试跑绿 → `manifest.json` 与版本日志已更新 → `git add -A` → `git commit` → `git push`
3. 提交信息格式：`<type>: <版本号> <一句话>`，type 取 feat / fix / docs / refactor / chore（例：`feat: 3.5.21 进入总结预置按钮 + 回去接着聊销毁伪对话`）
4. 推送失败（网络 / 认证）必须当场报告，禁止静默跳过；`http.sslVerify` 保持 true，不要为绕证书问题改全局配置
5. 提交前 `git status --short` 扫一遍：截图、日志、临时脚本（`.playwright-cli/`、`*.log`、`siji-*.cjs`）一律清掉，不进仓库

---

## Git 状态

- 当前 HEAD: `191895e` (feat: 3.5.21 进入总结带预置按钮 + 回去接着聊时销毁伪对话)
- 远端：`origin/main`，2026-09-15 推送成功（`bdaea24..191895e`）
- 首次 push 遇到 HTTP 502（GitHub 网关侧），重试即通过 —— 按「发布规矩」第 4 条，失败必须当场重试并报告，不要静默跳过
- `http.sslVerify` 保持 true（2026-08-20 恢复）

---

## 注意事项

- HBuilder X 版本需 3.8.7+
- 编译前删 `unpackage/dist` 缓存强制重编译
- 测试必须带资源限制跑：$env:NODE_OPTIONS="--max-old-space-size=4096"; npx vitest run --maxWorkers=2 —— 直接 `npx vitest run` 会 OOM（op-claim-guard 测试也依赖它）；实测 61 文件 / 825 用例全绿（exit 0）
- vitest 抓不到「import 了不存在的导出」：esbuild 互操作会把缺失的具名导出变成 `undefined`（只有 HBuilder X 的原生 ESM 才当场抛 `does not provide an export named`，表现为页面白屏）。动过模块导出后必须跑 `tests/module-exports.test.js`（静态核对 318 个源文件的具名 import）（store / normalize / governance / context / profile-values / profile-link / monthly / auto-extract）：改哪一块进哪一块；`governance.js` 依赖 `store.js` 导出的 `persist` 与 `STORAGE_KEY`，这两个是模块间私有依赖，不进对外导出
- 日期相关用例的坑（3.5.13 已修）：`isBackfillable` 拒绝「今天及未来」，所以**周一没有「本周历史日」可补**。任何依赖「补记本周某天」的用例都会在周一失败，改用「今天打卡」或上一周日期
- 抽聊天页卡片组件的约束：`pages/chat/chat.scss` 是 scoped 样式（父页 scoped 不会作用到子组件内部元素），抽组件时必须把 `.enter-*` / `.next-step-*` 一并搬进新组件的 scoped 样式，并做一次真机渲染验收
- 完整交接文档见 `CODEX_HANDOFF.md`
