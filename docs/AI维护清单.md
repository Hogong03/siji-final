# AI 年度维护清单

> 每年 1 月跑一遍，逐项勾选登记。这些是「随时间流逝必然过期」的东西，平时不碰，年底集中维护。

## 1. 节假日表（utils/holidays.js）

- [ ] `LUNAR_HOLIDAY_TABLE` 补新年份的春节/端午/中秋三行（农历查表，公历节日自动生成年份无需补）
- [ ] 原则不变：**表里没有的年份不注入，宁可不给也不编错**（`upcomingHolidays` 窗口外自动不出现）
- [ ] 跑 `tests/holidays.test.js` 全绿（含日期漂移的动态断言）

## 2. 厂商模型与能力（utils/ai/providers.js）

- [ ] 四家厂商的模型名单复核：下线的模型移除，新模型补 capability（`structured` / `supportsStreamStructuredOutput` / `asrModels`）
- [ ] `PROVIDER_MAX_TOKENS` 复核：对照官方文档；实测手段 = 跑自检语料 `long-form-article`（要求 1000 字文章 + 落库 ≥600 字）
- [ ] capability 位与真实行为一致性抽查（4.8.2 教训：qwen ASR url 模式曾挂着 `supportsAsr:true`，客户端选中必败）
- [ ] 跑 `tests/providers-capabilities.test.js` + `tests/long-form.test.js` 全绿

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
