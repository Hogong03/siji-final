# 思迹 · 全页面灵动性（微动效）审视方案

> 版本：v1.0　日期：2026-10-24
> 范围：H5 / App / 微信小程序三端，约 60 个页面 + 50 个组件
> 方法：全量统计每页动效密度（`:active / @keyframes / animation / transition / 触感 / 手势 / <transition> / 骨架屏`）+ 逐页精读 `.vue` + 同名 `.scss`
> 定位：这是第三轮 UI 专项，前两份（`UI优化方案.md` 视觉减法、`UI优化方案二.md` 一致性/深色）解决"看起来对不对"，本篇只解决"动起来活不活"。三份不重复。

---

## 一、先划边界：灵动 ≠ 花哨

`DESIGN_SYSTEM.md §7` 已把红线写死，本方案所有改动都在红线内，**不新增任何违反设计语言的东西**：

- 只允许三类动效：**入场动画、按压/点击反馈、功能性脉动**（loading、倒计时）。
- 禁止：持续呼吸、装饰性漂浮、渐变、毛玻璃、阴影、弹簧乱弹。
- 时长收敛：按压 0.15s、入场/过渡 0.2–0.35s、图表 0.6–0.9s；缓动优先 `ease`，仅在 FAB、tab 下划线等弹性点位用现有 `cubic-bezier(0.34,1.56,0.64,1)`。
- 动效必须**降级安全**：小程序低性能机、`prefers-reduced-motion`、长列表（stagger 只做前 8 项）下不卡顿。
- 所有动效只动 `transform / opacity`（不触发布局重排），颜色切换走 `transition`。

---

## 二、现状实测结论（为什么"有些页面看起来没动效"）

### 1. 一个最关键的发现：整套微动效系统写了，但根本没接上（P0）

`common/animation.scss` 定义了完整的微动效系统：`card-press`、`card-list-stagger`、`slide-in-left-stagger`、`btn-tactile`、`list-item-tactile`、`number-animate`、`tab-indicator`、`pulse-subtle`、`fadeInUp` 等。

但全项目检索：

- **没有任何文件 `@import` 这个文件**；
- `vite.config.js` 全局只注入了 `@/uni.scss`（里面只有颜色/间距变量，没有上述类）；
- `App.vue` 全局样式里也没有引入。

**结果：** `pages/settings/index.vue` 用的 `card-press`、`slide-in-left-stagger`，`pages/functions/index.vue` 用的 `card-press`，全部是**不生效的死类名**——卡片其实没有按压反馈、没有交错入场。这是一处"一行配置就能救活整套动效"的最高 ROI 修复。

### 2. 其余量化结论

| 现象 | 实测 | 影响 |
|---|---|---|
| 骨架屏组件 `Skeleton.vue`（list/card/chart/circle 四型） | **0 个页面引用**，完全没用 | 列表/统计加载时是纯文字"加载中..."或硬切 |
| Vue `<transition>` / `<Transition>` | **全项目 0 处** | 所有 tab 面板、折叠区、弹窗都是 v-if 硬切 |
| 触感 `vibrate` | 仅 5 处（打卡、对话删除、对话长按、计划/账单滑动） | 新建、保存、tab 切换、删除、移卡等关键操作无反馈 |
| 图表 `SijiChart`（canvas 自绘） | `chart-renderer.js` 中 `requestAnimationFrame` **0 次**，一次性绘制 | 环形/柱状/折线/仪表盘无生长、描边、数字补间 |
| 统计大数字 | bill/stats、plan/stats、report 长图均静态插值 | 无 count-up，数据"砸"在屏幕上，没有"算出来"的感觉 |
| 进度条 | bill 预算条有 `transition: width 0.5s`（好范本）；plan/stats 的 `.pc-bar/.ts-bar` 无 transition | 完成率变化硬切 |
| 列表 stagger | 仅 settings、functions 试图用（且因第 1 点未生效） | bill/plan/diary 列表、模板网格、Top5、图例、热力图全部无入场 |
| 弹层动画 | settings 主题 sheet 有 `sheetUp`（页面私有）；bill 预算弹窗、templates 弹窗、decisions 新建弹层等**硬出现** | 每个页面各写一套、大部分没有动画 |
| 页面入场 | App.vue 只给写死的 6 个类名（`.sub-page/.ai-page/.memory-page` 等）加 fadeInUp | 新增页面（stats、report、relations、decisions、simulation、glimmer、templates、trash、search 等）进入无动画 |

### 3. 动效密度现状（按页面，便于排期）

- **已较完善（只补细节）**：`splash`、`chat` 全链路（7 keyframes + 等待文案 + 计时）、`settings/index`（接线后即完善）、`settings/profile`、`settings/ai`、`components/common/EmptyState`、`bill` 列表项（swipe + 按压）、`plan/index`（FAB 有 fabIn）。
- **中等（骨架已在，缺关键反馈）**：`bill/edit`、`plan/detail`、`plan/index` 看板、`plan/records`、`diary/detail`、`diary/read`、`functions/index`。
- **贫瘠（几乎 0 动效）**：
  - 统计图表三页：`bill/stats`、`plan/stats`、`stats/report`
  - 模板/回收站：`plan/templates`、`bill/trash`、`diary/trash`、`plan/trash`
  - settings 子页群：`sub/decisions`、`sub/decision-detail`、`sub/relations`、`sub/relation-graph`、`sub/simulation`、`sub/memory`、`sub/version-history`、`sub/version-detail`、`sub/glimmer`、`sub/key-guide`、`sub/ai-eval`
  - 组件：`SijiChart`、`AgentAvatar`、`SocialQuotaBar`、`PlanTimeStrip`、`PlanWeekStrip`、`PlanSummarySheet`、`ReplyDrafts`、`TemplateCard`、`TemplateForm`
  - `search/result`、`lock`（反馈类动效缺失）

---

## 三、全局基础设施改进（做一次，所有页面受益）

### 【P0-1】把微动效系统接进全局（1 行改动，立即生效）

`App.vue` 顶部全局 `<style lang="scss">`（非 scoped）中引入：

```scss
@import '@/common/animation.scss';
```

> 不要放进 `vite.config.js` 的 `additionalData`——那会注入到每个 scoped 组件并被加作用域属性，导致 `.card-list-stagger > *` 这类选择器失效。全局样式只需在 `App.vue` 引入一次。

接线后需回归验证：
1. settings 首页卡片按压、交错入场是否出现；
2. functions 入口卡按压是否出现；
3. 小程序端长列表性能（stagger 只给前 8 项，安全）。

**注意**：`.card-list-stagger` 用 `animation: fadeInUp ... both`，列表数据刷新时若 key 复用会重播。给列表用稳定的 `:key`（如 `client_id`）即可，必要时只在首次加载挂 stagger 类。

### 【P0-2】在 animation.scss 补齐"全局缺的 6 个动效类"

现有的类偏少，补齐后逐页直接挂类即可，无需每页重写：

```scss
/* ===== 底部弹层（sheet）：遮罩淡入 + 面板上滑，统一各页弹窗 ===== */
@keyframes sijiMaskIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes sijiSheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes sijiModalPop { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
.sheet-mask  { animation: sijiMaskIn 0.22s ease both; }
.sheet-panel { animation: sijiSheetUp 0.28s cubic-bezier(0.16, 1, 0.3, 1) both; }
.modal-pop   { animation: sijiModalPop 0.24s cubic-bezier(0.34, 1.56, 0.64, 1) both; }

/* ===== 进度条生长（数据驱动） ===== */
.bar-grow { transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1); }

/* ===== v-if 面板切换：淡入 + 轻微上移（替代硬切） ===== */
@keyframes sijiFadeIn   { from { opacity: 0; } to { opacity: 1; } }
@keyframes sijiPanelIn  { from { opacity: 0; transform: translateY(12rpx); } to { opacity: 1; transform: translateY(0); } }
.panel-in   { animation: sijiPanelIn 0.24s ease both; }
.fade-in-x  { animation: sijiFadeIn 0.2s ease both; }

/* ===== 锁屏错误抖动 / 勾选成功（功能性） ===== */
@keyframes sijiShake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-12rpx); }
  40%, 80% { transform: translateX(12rpx); }
}
.shake { animation: sijiShake 0.36s ease both; }

@keyframes sijiPop { 0% { transform: scale(1); } 50% { transform: scale(1.25); } 100% { transform: scale(1); } }
.pop { animation: sijiPop 0.22s ease both; }

/* ===== 勾选打勾（打卡 / 完成） ===== */
@keyframes sijiCheck {
  from { stroke-dashoffset: 48; } to { stroke-dashoffset: 0; }
}
```

深色模式无需特殊处理（以上均只动 transform/opacity）。

### 【P1-3】封装统一触感工具 `utils/haptic.js`

现在 5 处触感是各写各的 `uni.vibrateShort`。统一封装，避免小程序/App 差异：

```js
// utils/haptic.js
// 统一触感反馈，三端安全降级
export function haptic(type = 'light') {
  // #ifdef APP-PLUS
  try {
    const map = { light: 15, medium: 30, success: 10, warning: 20, select: 10 }
    uni.vibrateShort && uni.vibrateShort({ type: type === 'light' ? 'light' : 'medium' })
  } catch (e) {}
  // #endif
  // #ifdef MP-WEIXIN
  try { uni.vibrateShort && uni.vibrateShort({ type: type === 'light' ? 'light' : 'medium' }) } catch (e) {}
  // #endif
  // #ifdef H5
  // H5 多数浏览器不支持短震，静默跳过
  // #endif
}
export const hapticLight = () => haptic('light')    // 点按、tab 切换
export const hapticSelect = () => haptic('select')  // 选中
export const hapticSuccess = () => haptic('success')// 保存/打卡成功
export const hapticWarning = () => haptic('warning')// 删除/错误
```

**挂载点（按优先级）**：
1. 各页 FAB「新建」点击（light）；
2. 保存/创建/打卡成功（success，打卡可复用现有 `checkin-feedback.js`）；
3. segmented / tab / 筛选切换（light）；
4. 看板移卡、子任务勾选（select）；
5. 删除确认的删除动作（warning）；
6. 锁屏数字键（light）、PIN 错误（warning）。

> 克制原则：触感只在"改变状态"的动作给，普通浏览滑动不给。

### 【P1-4】数字滚动指令 `v-count-up`

统计页所有大数字（账单收支、余额、四宫格、完成率、月报数字）统一用一个指令做 0.6s 补间：

```js
// directives/countUp.js
export const countUp = {
  mounted(el, binding) { animate(el, binding.value) },
  updated(el, binding) {
    if (binding.value !== binding.oldValue) animate(el, binding.value)
  }
}
function animate(el, target) {
  const end = Number(target) || 0
  const opts = (el.dataset) || {}
  const decimals = Number(opts.decimals || 0)
  const prefix = el.dataset.prefix || ''
  const suffix = el.dataset.suffix || ''
  const start = performance.now(), dur = 600
  function frame(now) {
    const p = Math.min(1, (now - start) / dur)
    const ease = 1 - Math.pow(1 - p, 3) // easeOutCubic
    const v = end * ease
    el.textContent = prefix + v.toFixed(decimals) + suffix
    if (p < 1) requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}
```

用法：`<text class="sum-value" v-count-up="totalExpense" data-prefix="¥" data-decimals="0">`。

> 小程序端自定义指令支持有限，`v-` 指令在 uni-app 小程序端可能不生效，需在 App/H5 用指令、小程序端降级为 `onReady` 里调同一个 `animate(el, n)`（封装成普通函数即可，指令内部也调用该函数）。**这点务必真机验证，不能想当然。**

### 【P1-5】SijiChart 图表加入场动画（改 renderer，收益最大）

`utils/chart-renderer.js` 现在是 `renderChart` 一次性绘制 `drawRing/drawBar/drawLine/drawGauge`。给它加一个 `progress`（0→1），由 SijiChart 用 `requestAnimationFrame` 驱动，在 **0.75s** 内补间：

- **环形 ring**：`endAngle = start + (fullAngle) * progress`，描边随进度扫一圈；中心数字同步 count-up。
- **柱状 bar**：每根柱高度 `h * easeOut(progress)`，从基线向上生长（可加每根 0.03s 级联，前 8 根）。
- **折线 line**：按点数 `Math.floor(n * progress)` 分段绘制 + 末端点淡入，做"描绘"效果。
- **仪表盘 gauge**：指针角度随 progress 扫到目标值。

骨架（在 SijiChart.vue）：

```js
function play() {
  const start = performance.now(), dur = 750
  const step = (now) => {
    const p = Math.min(1, (now - start) / dur)
    const eased = 1 - Math.pow(1 - p, 3)
    renderChart(ctx, { ...props, progress: eased }) // renderer 内按 progress 缩放
    if (p < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}
onMounted(() => setTimeout(play, 50))
watch(data, () => play()) // 切换月/年/类型时重放
```

> 小程序 canvas 支持 `requestAnimationFrame`（uni-app 有 polyfill）；若个别低版本不支持，降级为一次性绘制（`progress=1`）。`renderChart` 内部所有取值乘 `progress` 即天然降级。

### 【P1-6】让 Skeleton 骨架屏真正用起来

`Skeleton.vue` 已写好却没用。加载态替换规则：

| 现在 | 改成 |
|---|---|
| diary/list `<view class="loading-hint">加载中...</view>` | `<Skeleton type="list" />`（5–6 条） |
| bill/stats、plan/stats 图表加载 | 图表区 `<Skeleton type="chart" />`，数字区 `<Skeleton type="card" />` |
| bill/plan 列表首次加载 | `<Skeleton type="list" />` |
| 模板网格 `templates` | `<Skeleton type="card" :count="6" />` |
| 搜索结果加载 | `<Skeleton type="list" />` |

注意：骨架只在**首次进入/无缓存**时显示，`onShow` 已有数据时静默刷新，不要每次都闪骨架。

### 【P2-7】页面入场动画从"写死类名"改为"统一覆盖"

当前 `App.vue` 用 `.sub-page`、`.ai-page` 等**硬编码类名**白名单决定哪些页有入场，新页面全漏。建议：

- 方案 A（推荐）：用 `onShow` 不可控，直接在 `App.vue` 全局对页面根容器统一加 `fadeInUp 0.28s`（uni-app 可用 `uni-page` 选择器或全局 `page { }` 配 `view:first-child`，三端兼容性需真机验证）；
- 方案 B（最稳）：在 `animation.scss` 提供 `.page-enter` 类，新页面根节点统一挂这个类，替代现在散落的 `.sub-page` 等命名，逐步把旧类名收敛。

---

## 四、逐页改进清单

> 标注：🔴 高价值（用户高频可见、改动小）　🟡 中　🟢 锦上添花；"类"列=挂全局类即可，"代码"=需要少量逻辑。

### 4.1 启动 / 安全

| 页面 | 现状 | 改进 | 级别 | 做法 |
|---|---|---|---|---|
| `splash/index` | 已有 logo 渐入 + 线条生长（好） | 加载等待时给一个极克制的进度点（1 个点 `opacity` 脉动，禁止转圈堆叠） | 🟢 | 类 |
| `lock/index` | 圆点有过渡、按键有按压 | ① PIN 错误时整排圆点/容器 `.shake` + hapticWarning；② 每输入一位，对应圆点 `.pop`；③ 数字键 hapticLight；④ 验证成功进入前可给一次 success 触感 | 🔴 | 类+代码 |

### 4.2 对话（核心，已最完善，只补细节）

| 位置 | 现状 | 改进 | 级别 |
|---|---|---|---|
| `chat/index` 等待状态 | 已有"正在思考/回复 + 计时"（好） | 工具调用阶段（如"正在查账本/写记录"）给步骤逐个出现的淡入（`.panel-in`），让多步工具调用有进度感 | 🟡 |
| `MessageBubble` | 已有 4 keyframes（好） | 最新气泡出现用 fadeInUp；失败重试图标给 warning 反馈 | 🟡 |
| `ExecResultCard` | 执行结果卡 | 结果卡展开用 `.panel-in`，成功/失败结果加一个极简打勾/叉的描边动画（功能性） | 🟡 |
| 各 `Switcher`（Model/Provider/Agent/Unified） | 弹窗按压反馈弱 | 统一挂 `.sheet-mask/.sheet-panel`（或 `.modal-pop`），消除硬出现 | 🟡 |
| `AgentAvatar` | 0 动效 | 生成中头像给一个极克制的 1 点/线条脉动（功能性 loading），不要持续呼吸 | 🟡 |
| `ConversationPanel/ListItem` | 已有 swipe 手势 | 会话列表首次进入挂 `card-list-stagger` | 🟢 |
| `ReplyDrafts` | 0 动效 | 草稿项展开/切换用 `.panel-in` | 🟢 |

### 4.3 功能总览

| 位置 | 现状 | 改进 | 级别 | 做法 |
|---|---|---|---|---|
| 顶部 segmented 面板 | life/ai 用 `v-if/v-else` **硬切**，滑块有位移但面板无过渡 | 给当前面板容器挂 `.panel-in`（`:key` 随 tab 变化触发重播） | 🔴 | 类 |
| "更多 AI 功能" | `v-if="showMoreAI"` 硬展开 | 用高度 `max-height + opacity` 过渡，或统一 `.panel-in`；箭头随展开旋转 | 🔴 | 类 |
| 统计条数字 | 静态 | `v-count-up` | 🟡 | 代码 |
| 入口卡 | 用了 `card-press`（死类，接线后生效） | 接线即恢复；可再给首屏 `card-list-stagger` | 🔴 | 类 |

### 4.4 记账 bill

| 页面/组件 | 现状 | 改进 | 级别 | 做法 |
|---|---|---|---|---|
| `bill/index` picker 筛选面板 | `v-if` 硬展开 | 挂 `.sheet` 类或 `.panel-in` 展开，时间箭头旋转（已有过渡） | 🔴 | 类 |
| `bill/index` 预算弹窗 | `.modal-mask/.modal-content` **无任何动画** | 遮罩 `.sheet-mask` + 面板 `.modal-pop`（居中弹窗） | 🔴 | 类 |
| `bill/index` 列表 | bill-item 有 swipe+按压（好），但无入场 | 分组首次加载挂 `card-list-stagger`（按日分组，组内级联） | 🟡 | 类 |
| `bill/index` 概览数字 | 静态 | 收支/余额 `v-count-up` | 🔴 | 代码 |
| `bill/index` FAB | 仅有 `:active scale 0.88`，无入场 | 复用 plan 的 `fabIn` 弹性入场；点击 hapticLight | 🟡 | 类 |
| `bill/index` type-chip/chip | 选中颜色硬切 | 加 `transition: background/color 0.2s` | 🟡 | 类 |
| `bill/index` 快捷金额 `.quick-val` | 无按压 | 挂 `.btn-tactile`（接线后） | 🟢 | 类 |
| `bill/edit` | 按钮按压有 10 处（好） | 保存成功 hapticSuccess + 成功态；金额输入变化时数字微反馈；删除 hapticWarning | 🟡 | 代码 |
| `bill/edit` AmountInput/CategoryPicker | 有按压 | 选择器弹出走统一 sheet；选中分类有 `.pop` | 🟡 | 类 |
| `bill/stats` | 月/年、range 切换硬切；图表硬渲染；洞察卡 `v-if` 硬出现；Top5/图例无入场；hero 数字静态 | ① 图表 SijiChart 动画（P1-5）；② 数字 count-up；③ mode/range 切换面板 `.panel-in` + hapticLight；④ 洞察卡 `.panel-in`；⑤ Top5/图例 `card-list-stagger` | 🔴 | 类+代码 |
| `bill/trash` | 列表无入场 | 挂 `card-list-stagger`；还原/删除成功触感 | 🟡 | 类 |

### 4.5 计划 plan

| 页面/组件 | 现状 | 改进 | 改进 | 级别 | 做法 |
|---|---|---|---|---|---|
| `plan/index` 列表/看板 | `v-if` 硬切 | 切换挂 `.panel-in` + hapticLight | 🔴 | 类 |
| `plan/index` 看板卡 | 无按压、无入场、移卡 `→/←` 硬改 | 卡片挂 `.card-press`；移卡时卡片 `.panel-in` 滑入目标列 + hapticSelect；列计数变化 count-up | 🔴 | 类+代码 |
| `plan/detail` 打卡按钮 | 有 checkin toast + 震动（好），但按钮本身无完成动效 | 打卡成功：按钮内描边打勾（`sijiCheck`）或进度环描边 + 一次 `.pop`，再落回常态；连续打卡里程碑数字 count-up | 🔴 | 代码 |
| `plan/detail` 子任务勾选 | 待确认 | 勾选瞬间文字加删除线 + 打勾描边，0.25s | 🟡 | 类 |
| `PlanCard` | 1 按压 | 列表挂 `card-list-stagger`；倒计时徽标在跨天/临期时给一次功能性 `pulse-subtle`（只在异常态，不持续） | 🟡 | 类 |
| `PlanDailyStrip` | 7 按压 + 长按手势（好） | 今日打卡后该日圆点 `.pop` 填充 | 🟡 | 类 |
| `PlanHeatmap` / 统计页热力图 | 格子无入场 | 格子按时间顺序 0.02s 级联淡入（仅首屏，前 N 格），或整体一次淡入 | 🟡 | 类 |
| `PlanSummarySheet` | 0 动效 | 挂 `.sheet-mask/.sheet-panel` | 🟡 | 类 |
| `PlanTimeStrip / PlanWeekStrip` | 0 动效 | 选中项滑动时指示位置用现有 tab-indicator 弹性过渡 | 🟡 | 类 |
| `plan/stats` | 环形/柱/仪表盘无动画、四宫格数字静态、`.pc-bar/.ts-bar` 无 transition、热力图无入场 | ① 图表动画（P1-5）；② 四宫格 count-up；③ 进度条挂 `.bar-grow`；④ 热力图级联；⑤ 卡片 stagger | 🔴 | 类+代码 |
| `plan/templates` | 网格无 stagger；两个弹窗**硬出现**；AI 生成仅文案"AI 思考中..."无 spinner；分类切换硬切 | ① 网格 `card-list-stagger`；② 弹窗 `.sheet`；③ AI 生成加极简三点/线条脉动（功能性）；④ 分类切换过渡 | 🔴 | 类+代码 |
| `plan/records` | 3 按压 | 列表 stagger | 🟢 | 类 |
| `plan/trash` | 2 按压 | 同 bill/trash | 🟡 | 类 |

### 4.6 日记 diary

| 页面 | 现状 | 改进 | 级别 | 做法 |
|---|---|---|---|---|
| `diary/list` 加载 | 纯文字"加载中..." | 换 `<Skeleton type="list">` | 🔴 | 组件 |
| `diary/list` 三视图（列表/时间线/日历） | `v-else-if` 硬切 | 视图容器挂 `.panel-in`（`:key="viewMode"`）+ hapticLight | 🔴 | 类 |
| `diary/list` 卡片 | 无 stagger、无按压 | 列表卡挂 `.card-press` + `card-list-stagger`；时间线按组级联 | 🔴 | 类 |
| `diary/list` 时间选择 / 标签展开 | `v-if` 硬切（筛选面板有 `.show` 类，需确认是否已做 transform） | 统一 `.panel-in`；筛选面板若已做 transform 保持；补遮罩淡入 | 🟡 | 类 |
| `diary/list` 回顾卡 | `v-if` 硬出现 | 挂 `.panel-in`（每天一次，出现要"轻"） | 🟡 | 类 |
| `diary/list` 日历热力格 | 无动效 | 格子级联淡入（前 N 格） | 🟢 | 类 |
| `diary/list` 分页页码 | 无按压 | 页码挂 `.btn-tactile`；翻页时列表 `.fade-in-x` | 🟡 | 类 |
| `diary/list` FAB | 无入场 | 复用 `fabIn` | 🟡 | 类 |
| `diary/detail` | 1 keyframe | 保存成功 hapticSuccess；心情 5 档选择给 `.pop` + 选中过渡；图片插入缩略图淡入 | 🟡 | 类+代码 |
| `diary/read` | 3 手势、2 按压 | 章节切换内容 `.fade-in-x`；目录条展开 `.panel-in` | 🟡 | 类 |
| `diary/trash` | 0 动效 | 列表 stagger + 还原触感 | 🟡 | 类 |

### 4.7 搜索 / 统计报告

| 页面 | 现状 | 改进 | 级别 | 做法 |
|---|---|---|---|---|
| `search/result` | 3 按压、1 手势 | 结果列表 stagger；搜索中骨架屏；结果为空走 EmptyState（已有动画） | 🟡 | 组件+类 |
| `stats/report` | 翻月 canvas 重绘硬切；选月/保存按钮无按压；整页无入场 | ① 翻月给 canvas 一次 fade（先 opacity 0→1 再重绘）或图表动画；② 按钮挂 `.btn-tactile`；③ 页面 `.page-enter`；④ 长图生成中给功能性进度 | 🟡 | 类+代码 |

### 4.8 settings 子页群（共性问题，批量处理）

`decisions / decision-detail / relations / relation-graph / simulation / memory / version-history / version-detail / glimmer / key-guide / ai-eval` 等几乎 0 动效，且**问题高度一致**，用统一动作批量解决：

1. **列表卡片**：统一挂 `.card-press` + 首屏 `card-list-stagger`；
2. **FAB**：统一复用 `fabIn` 入场 + `:active`（多个子页 FAB 现在无入场、无按压，如 `decisions`）；
3. **弹层**：`decisions` 新建/编辑等所有底部弹层挂 `.sheet-mask/.sheet-panel`，遮罩和面板不再硬出现；
4. **筛选 tab**：`filter-tab` 等选中颜色加 `transition`，切换挂 hapticLight（如 `decisions`）；
5. **空状态**：`decisions` 等用 emoji（🤔）自建空态，统一替换为 `EmptyState` 组件（已带 float + 延迟入场）；
6. **特殊关系图**：`relation-graph` 若有 canvas 节点，首次进入节点连线给"描边生长"（同折线描绘方案），进入节点 `.pop`；
7. **页面根节点**：统一挂 `.page-enter`，解决进入无动画。

> 已较完善的 `settings/index`（stagger+sheet 动画）、`profile`、`ai`、`agent` 只需在 P0-1 接线后回归，不必重写。

---

## 五、推荐落地顺序（按"改动小、感知强"排）

**第一批（半天，全局回血，先做）**
1. P0-1 App.vue 引入 animation.scss（1 行）—— 立即恢复 settings/functions 已写好的按压与入场；
2. P0-2 补齐 6 个全局动效类；
3. P1-3 封装 `utils/haptic.js`，先挂 FAB、保存成功、tab 切换三类高频点。

**第二批（1–2 天，用户最常见的列表/弹窗）**
4. 统一所有底部弹层（bill 预算、templates、decisions、各 Switcher）的 sheet 动画；
5. 各核心列表（bill/plan/diary/templates）挂 stagger + card-press；
6. 视图切换（functions、plan 看板、diary 三视图）加 `.panel-in`。

**第三批（1–2 天，"数据感"）**
7. SijiChart 四类图表动画（P1-5）；
8. `v-count-up` 接入 bill/stats、plan/stats、report、各概览数字；
9. 进度条 `.bar-grow`、热力图级联；
10. 打卡/勾选完成动效（plan/detail 打勾、子任务）。

**第四批（收尾）**
11. Skeleton 骨架屏接入所有列表/统计首屏；
12. lock 抖动/弹点、页面入场统一、settings 子页群批量扫尾。

每批做完真机验证三端（尤其小程序 canvas 与自定义指令、App 端 fixed 组件），并在长列表、低端机上确认不掉帧。

---

## 六、落地后验收清单

- [ ] P0-1 接线后，settings/functions 卡片按压与交错入场真实出现；
- [ ] 所有底部弹层均为遮罩淡入 + 面板上滑，无硬出现；
- [ ] 主要图表（环形/柱/折线/仪表盘）有入场动画，切月/切类型时重放；
- [ ] 统计大数字、看板计数有 count-up；
- [ ] 列表首次加载为骨架屏，非纯文字；
- [ ] 三视图、tab、看板、更多展开不再硬切；
- [ ] 关键操作（新建、保存、打卡、删除、移卡、锁屏）有触感；
- [ ] 深色模式下动效正常（不应出现阴影/渐变/毛玻璃）；
- [ ] 小程序、App、H5 三端均正常，低端机列表不卡顿；
- [ ] 全程未引入持续呼吸/装饰脉动、渐变、阴影、毛玻璃、紫色（符合 §7）。

---

## 附：本次审视的实测依据

- 动效密度通过逐文件统计 `:active`、`@keyframes`、`animation:`、`transition:`、`stagger/card-press/btn-tactile`、`vibrate`、手势事件、`<transition>`、`Skeleton`、`showToast/showLoading` 九维计数得出；
- 关键结论均经文件级核对：`animation.scss` 无 import、Skeleton 0 引用、`<transition>` 0 处、`chart-renderer.js` 无 `requestAnimationFrame`、vibrate 仅 5 处；
- 各页面 `.vue` 与同名 `.scss` 成对阅读（动画常写在 scss，单看 vue 计数为 0 属正常）。
- 未逐一精读的页面（部分 chat 深层组件、settings 子页）已按其动效密度归入"批量共性处理"，落地时如发现个别页面已有对应动效，跳过即可，不重复添加。
