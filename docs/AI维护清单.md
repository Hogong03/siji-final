# AI 年度维护清单

> 每年 1 月跑一遍，逐项勾选登记。这些是「随时间流逝必然过期」的东西，平时不碰，年底集中维护。

## 1. 节假日表（utils/holidays.js）

- [ ] `LUNAR_HOLIDAY_TABLE` 补新年份的春节/端午/中秋三行（农历查表，公历节日自动生成年份无需补）
- [ ] 原则不变：**表里没有的年份不注入，宁可不给也不编错**（`upcomingHolidays` 窗口外自动不出现）
- [ ] 跑 `tests/holidays.test.js` 全绿（含日期漂移的动态断言）

## 2. 厂商模型与能力（utils/ai/providers.js）

- [x] 四家厂商的模型名单复核：下线的模型移除，新模型补 capability（`structured` / `supportsStreamStructuredOutput` / `asrModels`）—— **2026-10-31 提前执行（4.50.0）**：DeepSeek 换 `deepseek-flash`（V4.1 Flash，原生视觉）、智谱补 `glm-5.3-flashx`、通义换 3.8 线全视觉、Moonshot 换 K3.1 线并移除 K2
- [ ] `PROVIDER_MAX_TOKENS` 复核：对照官方文档；实测手段 = 跑自检语料 `long-form-article`（要求 1000 字文章 + 落库 ≥600 字）
- [ ] capability 位与真实行为一致性抽查（4.8.2 教训：qwen ASR url 模式曾挂着 `supportsAsr:true`，客户端选中必败）
- [x] 跑 `tests/providers-capabilities.test.js` + `tests/long-form.test.js` 全绿 —— 2026-10-31 通过（12 + 8 例）
- [ ] **待实测（4.50.0 登记，未改行为）**：通义 `json_object` 结构化输出（官方文档已支持，项目侧能力位仍 false，怕流式空回复）；DeepSeek V4.1 流式 + `response_format` 是否仍空回复（`streamNoResponseFormat` 暂保持 true）；智谱 `glm-4-flash` 裸 ID 是否仍可用（现登记带日期的 `glm-4-flash-250414`）

## 3. AI 效果自检（utils/ai/eval/）

- [ ] 在真机/开发者环境跑一轮真实模型自检（设置 → AI 效果自检，需配 Key），结果登记 `docs/AI效果自检基线.md`
- [ ] 语料结构跑一遍 `npx vitest run tests/ai-eval*.test.js`（24+ 条语料的结构断言）
- [ ] 语料覆盖对照：过去一年新增的 AI 能力是否都有语料（语料随行制的年度盘点）

## 4. 记忆系统体检

- [ ] 真机查看 `siji_long_term_memory` 条数与 TTL 清理是否正常（event 90 天 / summary 180 天）
- [ ] 结构化记忆三元组上限（实体 50 / 关系 60 / 事件 80）是否需要调整
- [ ] 抽查 3-5 条真实对话的「长期记忆注入段」，确认检索相关度符合体感

## 5. 提示词与工具预算

- [ ] `buildSystemPrompt()` 完整版字符数记录（4.9.0 起闲聊走 lite，完整版只影响 agent 路径）
- [ ] `JSON.stringify(TOOL_DEFINITIONS).length` 记录，同比涨幅 >20% 时做一轮描述压缩
- [ ] 跑全量测试（86+ 文件）确认无回归

---

## 登记记录

| 日期 | 执行人 | 覆盖项 | 结果 | 备注 |
|---|---|---|---|---|
| 2026-10-02 | ZCode | 首建清单 | — | 2027 年初首次执行：补 2028 农历表 + 厂商复核 |
| 2026-10-31 | DSH | 2（厂商模型与能力） | 完成 | 4.50.0：四家模型名单按官方文档（DeepSeek changelog / 智谱文档 / 阿里云 Model Studio / Kimi platform）刷新，旧 ID 全部登记 `MODEL_MIGRATION`；能力位 `supportsContextCache` 四家均改为自动命中。**未复测项见第 2 节最后一条**（通义 json_object、DeepSeek V4.1 流式 response_format、裸 `glm-4-flash`） |
