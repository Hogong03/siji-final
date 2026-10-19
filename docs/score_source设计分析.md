# `score_source` 设计分析（只分析，不改代码）

> 状态：**独立待办，暂缓实施**。本文只做数据模型与影响面分析，不修改任何生产代码。
> 触发背景见 `docs/关系回溯触发评估.md`；评分写入治理已由 4.38.0 / 4.39.0 两轮完成。
> 排期建议：关系回溯观察期结束后，作为独立版本实施（避免与回溯链路同时引入多个变量）。

## 一、要解决的问题

`siji_relations[].relationship_score` 是一个 1–10 的数字，但它**无法区分**三种语义完全不同的情况：

1. **系统默认值**：建卡时没评分 → 落 5；
2. **用户主动评价**：用户拖滑块选了 5；
3. **历史遗留**：4.39.0 之前关系模板自带的预填值（5/6/7/8/9），或 4.38.0 之前 AI 可能写入的值。

后果：AI 在回溯与关系上下文中拿到这个数字时，**不能断言"用户给过 TA 几分"**；统计口径（平均亲密度）也把"没人评过"混进了"评过"。

当前代码已经做了力所能及的防护（4.38.0 起）：

- AI 无法写入分数（`createRelation`/`updateRelation` 需显式 `trustScore`，只有 UI 手动路径传）；
- 注入提示词的文案带「来源未必可追溯」说明；
- BEHAVIOR_RULES 明令不得把现存分数说成用户评价。

**但"默认 5"与"评为 5"在数据里仍然同形**，这是本文要解决的语义缺口。

## 二、现状盘点（代码事实）

| 项 | 事实 | 位置 |
|---|---|---|
| 字段 | `relationship_score`（1–10 整数） | `utils/relations.js` |
| 默认值 | `DEFAULT_RELATIONSHIP_SCORE = 5` | `utils/relations.js` |
| 唯一合法写入 | UI 手动建卡/编辑（`{ trustScore: true }`） | `relations.vue` ×2、`relation-detail.vue` ×1 |
| AI 写入 | 已被执行层拒绝（字段剥离 + 回报"未采信"） | `store/executors/relation.js` |
| 模板预填 | 4.39.0 起模板不含分数 | `utils/relation-templates.js` |
| 展示 | 列表 badge、详情页大字、关系图平均亲密度、功能页统计 | `relations.vue`、`relation-graph.vue`、`getRelationsStats()`、`useFunctionsData.js` |
| 下游消费 | AI 注入行（`亲密度: N/10`）、情景模拟的人设分档（≥8 友善 / ≥5 中性 / ≥3 防备 / 否则冷淡） | `relations.js` `formatRelationLine`、`simulation-prompts.js` |

**结论**：来源信息在写入时就被丢弃了，事后无法恢复 —— 任何"推断用户曾经评分"的做法都是编造。

## 三、不可区分记录的量化（只读，用户自己跑）

在 H5 控制台执行（**只读，不写库**）：

```js
const rs = JSON.parse(uni.getStorageSync('siji_relations') || '[]').filter(r => r.is_deleted !== 1)
const at5 = rs.filter(r => r.relationship_score === 5).length
console.log({
  总人数: rs.length,
  等于5分: at5,
  其他分数: rs.length - at5,
  说明: '等于5分的记录无法区分「系统默认」与「用户评为5分」，是来源不可确认记录的上界'
})
```

判读方式：

- **等于 5 分**的记录 = 无法确认来源（上界，因为用户也可能真的评了 5）；
- **不等于 5 分**的记录 = 一定有人给过分（但无法区分是用户还是 4.38.0 之前的 AI/模板）。

## 四、数据模型选项

| 方案 | 做法 | 优点 | 代价 |
|---|---|---|---|
| **A（推荐）** | 新增可选字段 `score_source: 'user' \| 'default' \| 'legacy_unknown'`；旧数据不迁移，读时缺省视为 `legacy_unknown` | 向后兼容、可渐进；不丢信息；能明确区分"用户评过" | 需要改写入路径、展示层、统计口径的判读 |
| B | 默认值改为 `null`（表示未评分），UI 显示"未评分" | 语义最干净 | 破坏面大：统计、模拟器分档、AI 注入、UI 全要判空；旧数据要全量迁移 |
| C | 不改数据，只在 UI 加"未确认"文案 | 零迁移 | 语义仍缺失（无法按来源筛选/统计），治标不治本 |

**推荐 A**，理由是它把"来源"变成显式数据，且**默认值语义可以保留**（`default` 而不是 null），不必同时改动模拟器与统计的分档逻辑。

## 五、方案 A 的影响面清单（实施时逐项过）

| 层 | 需要改的点 |
|---|---|
| 写入 | `createRelation`（默认写入 `source: 'default'`）、`updateRelation`（`trustScore` 路径写 `'user'`）；执行器路径不变（仍拒绝） |
| 迁移 | 读时缺省 = `legacy_unknown`，**不回填、不推断**；如需落盘迁移，单独脚本且保留原值 |
| UI 展示 | 列表 badge / 详情页 / 编辑表单：`legacy_unknown` 与 `default` 显示为「未评分」或加"默认"角标；`user` 正常显示 |
| 统计 | `getRelationsStats().avgScore` 要决定口径：① 全部计入（现状）② 只算 `user` ③ 两个数都给（推荐：主数字只算 `user`，另给"已评分人数"） |
| AI 注入 | `formatRelationLine` 的 `亲密度: N/10` → 依来源改文案（如 `亲密度: 未评分（默认 5）`）；BEHAVIOR_RULES 现有「来源未必可追溯」规则可相应收紧为按来源表述 |
| 情景模拟 | `simulation-prompts.js` 的分档：`unknown`/`default` 时走"中性"档，且不要把默认值当"关系不错" |
| 测试 | `relation-score-governance` / `relation-template-score` / `relation-traceback-e2e` / `simulation-prompts` 等 fixture 需加 `score_source`；新增"来源判别"专项测试 |

## 六、迁移策略（核心原则：不推断用户曾评分）

1. **旧数据一律 `legacy_unknown`**：既不算"用户评价"，也不算"系统默认"——因为事实上无法知道。
2. **不写迁移脚本回填**：读时缺省即可；确需落盘时只补 `score_source` 字段，不动数值。
3. **统计不删数据**：`legacy_unknown` 仍参与总量展示，但可另给"已明确评分人数"，避免历史数据凭空消失。
4. **UI 不显示假精度**：`legacy_unknown` 不要显示成"5 分（用户评分）"。

## 七、需要产品决策的三个问题

1. **平均亲密度是否要区分口径**？（现状混算；建议主数字只算 `user`，并显示已评分人数）
2. **"未评分"在 UI 上怎么表达**？（保持数字 + 角标，还是显示"未评分"并置灰）
3. **是否允许用户清除自己的评分**（回到"未评分"）？（涉及 `updateRelation` 增加 `score: null` 语义）

## 八、实施顺序建议（排期在观察期之后）

1. 先定上面三个决策；
2. 补测试（来源写入 / 展示 / 统计三层）→ 再改代码；
3. 数据模型改动：`utils/relations.js` + 执行器 + 两个 UI 页面；
4. 下游口径：统计、AI 注入文案、情景模拟分档；
5. 全量回归 + 版本日志；
6. 独立提交，便于回滚。
