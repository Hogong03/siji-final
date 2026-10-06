# 思迹（Siji）UI 设计标准规范

> **版本**: 1.1  
> **更新日期**: 2026-10-06（校准深色模式类驱动机制、图标数 41、清理死引用、与 AGENTS.md 对齐）  
> **项目**: 思迹 — AI 对话式生活助手  
> **平台**: uni-app（H5 / App / 微信小程序）  
> **设计语言**: 极简黑白 + Zinc 灰阶（零阴影 / 零渐变 / 零毛玻璃）

---

## 一、设计哲学

| 维度 | 原则 |
|------|------|
| **色彩** | 纯黑白为主（#000000 / #FFFFFF），功能色仅用于状态标识，禁止渐变 |
| **层次** | 用 Zinc 灰阶（50→900）区分层级，非色彩堆叠 |
| **动效** | 极克制：仅入场动画 + 按钮反馈，禁止持续呼吸/脉动（功能性脉动除外） |
| **图标** | 统一 SijiIcon 组件，Lucide 线框 PNG（96×96 高清），三端一致，stroke 2px |
| **信息** | AI 回复内容是唯一有"权重"的视觉焦点，UI 本身退让 |

---

## 二、色彩系统

> 下表的 `--xxx` 仅为**语义分组示意**，不是运行时 CSS 变量。实际代码一律硬编码 hex 色值，深色通过 `html.theme-dark` 类（H5·App）或 `@media (prefers-color-scheme: dark)`（小程序）覆盖，见第十一节。

### 2.1 主色调

| 变量 | 浅色值 | 深色值 | 用途 |
|------|--------|--------|------|
| `--color-ai` | `#000000` | `#FFFFFF` | AI 主色、按钮、选中态 |
| `--text-primary` | `#18181B` (Zinc-900) | `#E4E4E7` (Zinc-200) | 主要文字 |
| `--text-strong` | `#3F3F46` (Zinc-700) | `#D4D4D8` (Zinc-300) | 加粗文字 |
| `--text-mid` | `#52525B` (Zinc-600) | `#A1A1AA` (Zinc-400) | 中等文字 |
| `--text-secondary` | `#71717A` (Zinc-500) | `#A1A1AA` (Zinc-400) | 次要文字 |
| `--text-hint` / `--text-tertiary` | `#A1A1AA` (Zinc-400) | `#71717A` (Zinc-500) | 提示文字 |
| `--text-on-ai` | `#FFFFFF` | `#FFFFFF` | AI 色上的文字 |

### 2.2 背景色

| 变量 | 浅色值 | 深色值 | 用途 |
|------|--------|--------|------|
| `--bg-page` | `#F4F4F5` (Zinc-100) | `#18181B` | 页面背景 |
| `--bg-card` | `#FFFFFF` | `#27272A` (Zinc-800) | 卡片背景 |
| `--bg-card-alt` | `#F4F4F5` | `#27272A` | AI 气泡背景 |
| `--bg-input` | `#F4F4F5` (Zinc-100) | `#3F3F46` (Zinc-700) | 输入框/Chip 背景 |
| `--bg-subtle` | `#FAFAFA` | `#27272A` | 微妙背景 |
| `--bg-muted` | `#F4F4F5` | `#3F3F46` | 静音背景 |

### 2.3 功能色

| 变量 | 值 | 用途 |
|------|----|------|
| `--color-plan` | `#10B981` (Emerald-500) | 计划模块 |
| `--color-bill` | `#F59E0B` (Amber-500) | 账单模块 |
| `--color-diary` | `#FCD34D` (Amber-300) | 日记模块 |
| `--color-danger` / `--color-red` | `#EF4444` (Red-500) | 危险/支出 |
| `--color-info` | `#0EA5E9` (Sky-500) | 信息 |
| `--color-warning` | `#D97706` (Amber-600) | 警告 |
| `--color-pink` | `#EC4899` (Pink-500) | 超预算 |
| `--color-plan-light` | `#D1FAE5` / `#064E3B` | 计划浅色背景 |
| `--color-bill-light` | `#FEF3C7` / `#78350F` | 账单浅色背景 |
| `--color-danger-light` | `#FEE2E2` / `#7F1D1D` | 危险浅色背景 |

### 2.4 边框与阴影

| 变量 | 浅色值 | 深色值 |
|------|--------|--------|
| `--border-color` | `#E4E4E7` (Zinc-200) | `#3F3F46` (Zinc-700) |
| `--border-strong` | `#D4D4D8` (Zinc-300) | `#52525B` (Zinc-600) |
| `--shadow-color` | `rgba(0,0,0,0.06)` | `rgba(0,0,0,0.4)` |

### 2.5 禁止项

- ❌ 禁止 `linear-gradient`（全部纯色）
- ❌ 禁止 `backdrop-filter: blur()`（已废弃玻璃拟物）
- ❌ 禁止 `box-shadow`（层级靠底色对比 + 1rpx 边框表达）
- ❌ **禁止 CSS 变量 `var(--xxx)`**（App 端 fixed 组件变量继承不稳定）——统一硬编码色值 + 主题类覆盖；SCSS 编译期变量 `$xxx` 不受限
- ❌ 禁止紫色/Indigo/Slate 系列残留

---

## 三、排版系统

### 3.1 字体族

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
  'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif;
```

### 3.2 字号

| 变量 | 值 | 用途 |
|------|----|------|
| `$font-xs` | `22rpx` | 辅助标签、时间戳、提示 |
| `$font-sm` | `26rpx` | 次要信息、卡片描述 |
| `$font-md` | `28rpx` | **正文默认** |
| `$font-lg` | `32rpx` | 卡片标题、小节标题 |
| `$font-xl` | `36rpx` | 页面标题、大数字 |
| `$font-xxl` | `44rpx` | 空状态图标 |

**特殊尺寸**：
- 概览大数字：`48~56rpx`，`font-weight: 800`，`letter-spacing: -1rpx`
- 品牌 Logo：`72rpx`，`font-weight: 700`，`letter-spacing: 8rpx`
- 品牌副标题：`22rpx`，`letter-spacing: 12rpx`，`text-transform: uppercase`

### 3.2.1 阅读字号四档（4.13.0）

`utils/font-scale.js`：存储键 `siji_font_scale`，只缩放**阅读内容**（对话气泡 / 简报卡 / 记录阅读页正文），UI 骨架（图标/按钮/导航）字号稳定。关键阅读面用 `fontRpx(baseRpx)` 产出内联 `font-size`，切换即时生效。

| 档位 | id | 比例 |
|------|----|------|
| 小 | `small` | `0.9` |
| 标准 | `normal`（默认） | `1.0` |
| 大 | `large` | `1.15` |
| 特大 | `xlarge` | `1.3` |

### 3.3 行高与字重

| 场景 | 行高 | 字重 |
|------|------|------|
| 正文气泡 | `1.65` | `400` |
| 卡片标题 | `1.6` (继承) | `600~700` |
| 大数字 | `1` | `800` |
| 辅助标签 | `1.6` | `400~600` |

### 3.4 数字特性

```css
font-variant-numeric: tabular-nums;  /* 等宽数字，金额/统计必用 */
letter-spacing: -1rpx;               /* 大数字收窄 */
```

---

## 四、间距系统

| 变量 | 值 | 用途 |
|------|----|------|
| `$spacing-xs` | `8rpx` | 紧凑间距（标签内、图标间） |
| `$spacing-sm` | `16rpx` | 小间距（卡片内元素间） |
| `$spacing-md` | `24rpx` | **默认间距**（卡片 padding、列表项间） |
| `$spacing-lg` | `32rpx` | 大间距（卡片 padding、section 间） |
| `$spacing-xl` | `48rpx` | 超大间距（空状态 padding） |

---

## 五、圆角系统

| 变量 | 值 | 用途 |
|------|----|------|
| `$radius-sm` | `8rpx` | 小按钮、标签 |
| `$radius-md` | `16rpx` | **卡片默认**、输入框、按钮 |
| `$radius-lg` | `24rpx` | 概览卡片、大模块 |
| `$radius-xl` | `32rpx` | 特殊容器 |
| `$radius-round` | `50%` | 圆形头像、FAB、图标按钮 |

**气泡特殊圆角**：
- 用户气泡：`24rpx 24rpx 8rpx 24rpx`（右下尖角）
- AI 气泡：`24rpx 24rpx 24rpx 8rpx`（左下尖角）

---

## 六、阴影系统

**零阴影**：全项目不使用 `box-shadow`（极简设计）。层级关系靠**底色对比 + 1rpx 边框**表达。

| 层级 | 浅色 | 深色 |
|------|------|------|
| 页面 | `#F4F4F5` | `#18181B` |
| 卡片 | `#FFFFFF` + `1rpx solid #E4E4E7` | `#27272A` + `1rpx solid #3F3F46` |
| 输入/Chip | `#F4F4F5` | `#3F3F46` |

历史 `$shadow-*` 变量已全部移除，禁止重新引入。

---

## 七、过渡与动画

### 7.1 过渡变量

| 变量 | 值 | 用途 |
|------|----|------|
| `$transition-fast` | `0.15s cubic-bezier(0.4,0,0.2,1)` | 按钮、图标反馈 |
| `$transition-normal` | `0.25s cubic-bezier(0.4,0,0.2,1)` | 卡片、面板展开 |
| `$transition-bounce` | `0.3s cubic-bezier(0.34,1.56,0.64,1)` | 弹性反馈 |

### 7.2 入场动画

```css
/* 通用渐入上移 */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20rpx); }
  to { opacity: 1; transform: translateY(0); }
}
/* 用法: animation: fadeInUp 0.3s ease both; (子页面) / 0.4s (通用) */
```

### 7.3 气泡入场

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
/* 0.25s ease both */
```

### 7.4 加载动画

AI 加载使用三段横线伸缩（非旋转 spinner）：
```css
@keyframes barSlide {
  0%, 100% { transform: scaleX(0.4); opacity: 0.3; }
  50% { transform: scaleX(1); opacity: 1; }
}
/* 三条段，错开 0.15s 延迟，周期 1.2s */
```

### 7.5 按钮反馈

```css
&:active { transform: scale(0.9~0.95); opacity: 0.85; }
```

### 7.6 功能性脉动（仅限特定场景）

- **录音按钮**: `voiceBtnPulse` 1s 循环，扩散光圈
- **停止按钮**: `stopBtnPulse` 1.5s 循环
- **超预算**: `budgetPulse` 1.5s 循环，opacity 闪烁
- **禁止**装饰性呼吸动画

---

## 八、组件规范

> 以下示例中的 `var(--xxx)` 与第二节色彩表一样，仅为语义示意，不是可执行代码。实际写样式时替换为对应硬编码 hex，并在 `html.theme-dark` 块内写深色值——8.1 卡片示例已是正确写法范本。

### 8.1 卡片

```scss
// 标准卡片（硬编码 hex + 主题类覆盖；SCSS 变量 $spacing/$radius 可用于间距/圆角）
background: #FFFFFF;
border-radius: 16rpx;        // 概览卡 24rpx
border: 1rpx solid #E4E4E7;
padding: 24rpx;
margin: 16rpx 24rpx;
box-sizing: border-box;
overflow: hidden;

html.theme-dark & {
  background: #27272A;
  border-color: #3F3F46;
}
```

**交互反馈**: `&:active { transform: scale(0.98); border-color: #18181B; }`（深色下 border-color: #FAFAFA）

### 8.2 按钮

| 类型 | 样式 | 尺寸 |
|------|------|------|
| 主按钮（发送） | `background: var(--color-ai); color: var(--bg-card)` | `72rpx` 圆形 |
| 停止按钮 | 同上 + `stopBtnPulse` 动画 | 同上 |
| 语音按钮 | `background: var(--bg-input)` → 录音时 `background: #000` | `72rpx` 圆形 |
| 确认按钮 | `background: var(--color-ai); color: var(--bg-card)` | `flex:1; padding: 14rpx 0` |
| 取消按钮 | `background: var(--bg-input); color: var(--text-secondary)` | 同上 |
| Chip | `background: var(--bg-input); border: 2rpx solid transparent` | `padding: 10rpx 22rpx` |
| Chip 选中 | `background: var(--color-ai); border-color: var(--color-ai)` | 同上 |
| FAB | `background: var(--color-ai); color: var(--bg-card)` | `56~72rpx` 圆形 |

### 8.3 输入框

```scss
background: var(--bg-input);
border-radius: $radius-md;
padding: $spacing-sm $spacing-md;
font-size: $font-md;
color: var(--text-primary);
```

### 8.4 消息气泡

| 属性 | 用户消息 | AI 消息 |
|------|----------|---------|
| 背景 | `#000000`（深色反白 `#FFFFFF`） | `#F4F4F5`（深色 `#27272A`） |
| 文字色 | `#FFFFFF` | `#18181B`（深色 `#FAFAFA`） |
| 圆角 | `24rpx 24rpx 8rpx 24rpx` | `24rpx 24rpx 24rpx 8rpx` |
| 最大宽度 | `85%` | `85%` |
| Padding | `16rpx 24rpx` | 同左 |
| 对齐 | `flex-end` | `flex-start` |

### 8.5 标签 (Chip / Tag)

```scss
// 功能 Chip
padding: 10rpx 22rpx;
border-radius: 10rpx;
background: var(--bg-input);
font-size: $font-xs;
font-weight: 600;

// 月份 Pill
padding: 8rpx 24rpx;
border-radius: 32rpx;

// AI 标签
font-size: 18rpx;
font-weight: 700;
padding: 2rpx 10rpx;
border-radius: 4rpx;
background: var(--border-color);
letter-spacing: 1rpx;
```

### 8.6 空状态

```scss
// 图标圆
width: 120rpx; height: 120rpx;
border-radius: 50%;
background: var(--bg-input);
// 图标 opacity: 0.4

// 标题
font-size: $font-lg; font-weight: 600;
color: var(--text-secondary);

// 描述
font-size: $font-sm;
color: var(--text-hint);
max-width: 480rpx; text-align: center;
```

### 8.7 Section 标题

```scss
font-size: $font-xs;
font-weight: 600;
color: var(--text-hint);
letter-spacing: 2rpx;
text-transform: uppercase;
margin: $spacing-lg 0 $spacing-sm $spacing-xs;
```

### 8.8 列表项

```scss
// 通用设置列表项
background: var(--bg-card);
padding: $spacing-md;
border-radius: $radius-md;
border: 1rpx solid var(--border-color);
// 子项间用 1rpx solid var(--border-color) 分隔
```

### 8.9 执行结果卡片 (ExecResultCard)

```scss
margin-top: $spacing-sm;
padding: $spacing-sm $spacing-md;
background: var(--bg-card);
border-radius: 12rpx;
border: 1rpx solid var(--border-color);
width: 85%;
```

### 8.10 待确认卡片

```scss
margin-top: $spacing-sm;
padding: $spacing-md;
background: var(--bg-card);
border-radius: 12rpx;
border: 2rpx solid var(--color-ai);  // 加粗边框突出
width: 85%;
```

---

## 九、图标系统

### 9.1 组件

统一使用 `SijiIcon.vue`（v4），基于 Lucide 线框图标，共 41 个图标名（浅深成对 `{name}-v2.png` / `{name}-v2-dark.png`）。
三端统一用 `<image>` 渲染 PNG（不再用 Unicode 字符或内联 SVG），杜绝跨平台字形不一致、个别字符变彩色 emoji 的问题。**换图标 src 是 JS 驱动**：SijiIcon 消费 theme.js 的 `isDark` 响应式切换浅/深图，不靠 CSS。

### 9.2 尺寸

| Size | 值 | 用途 |
|------|----|------|
| `xs` | `24rpx` | 极小图标 |
| `sm` | `28rpx` | 小图标（气泡操作） |
| `md` | `32rpx` | **默认** |
| `lg` | `36rpx` | 大图标 |
| `xl` | `44rpx` | 特大 |
| `xxl` | `56rpx` | 空状态 |

### 9.3 颜色（语义色调）

- `primary`（默认）：跟随主题（浅色黑图标 / 深色白图标）
- `secondary`（`#71717A` / `#A1A1AA`）：次要图标，半透明
- `white`（`#FFFFFF`）：深色/实心按钮上
- `amber`（`#B45309`）：仅微光 sun 图标

### 9.4 资源规格

- 源文件：96×96 RGBA，视觉区 72×72，`stroke-width: 2`，linecap/linejoin round
- 浅色：`/static/icons/{name}-v2.png`（深色图标 `#18181B`）
- 深色：`/static/icons/{name}-v2-dark.png`（白色图标 `#FFFFFF`）
- 更换图标内容必须同时改文件名（追加版本后缀），避免 App 端缓存

---

## 十、布局规范

### 10.1 页面骨架

```scss
.page-name {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-page);
  overflow: hidden;  // 或 auto
}
```

### 10.2 滚动区域

```scss
.scroll-area {
  flex: 1;
  height: 100%;
  padding: $spacing-sm $spacing-md;
  box-sizing: border-box;
}
```

### 10.3 安全区

```scss
padding-bottom: calc($spacing-sm + env(safe-area-inset-bottom));
// 或
padding-bottom: constant(safe-area-inset-bottom);
padding-bottom: env(safe-area-inset-bottom);
```

### 10.4 TabBar

- 3 入口：思迹 / 功能 / 设置
- 未选中色: `#A1A1AA`（浅色）/ `#71717A`（深色）
- 选中色: `#000000`（浅色）/ `#FFFFFF`（深色）
- 背景: `#FFFFFF`（浅色）/ `#18181B`（深色）
- 配色与图标路径由 theme.json 三变量化，`applyTheme()` 按主题 JS 切换（4.7 已完成）

### 10.5 导航栏

- 默认白底黑字（`#FFFFFF` / `black`）
- 自定义导航栏页面：`navigationStyle: "custom"`（chat/index, splash, lock）

---

## 十一、主题系统

### 11.1 三种模式（4.8.0 实装）

| 模式 | 值 | 行为 |
|------|----|------|
| 跟随系统 | `system`（默认） | H5/App 监听 matchMedia·onThemeChange；小程序走媒体查询 |
| 浅色 | `light` | 固定浅色，手动档 |
| 深色 | `dark` | 固定深色，手动档 |

### 11.2 实现机制（4.8.0 双路径）

1. **H5 / App**：深色规则全部包在 `.theme-dark {}` 类块内，`utils/theme.js` 往 `html` 挂/摘类；原生 tabBar/导航栏由 `applyTheme()` 调 `uni.setTabBarStyle` / `setTabBarItem` / `setNavigationBarColor`
2. **微信小程序**：深色规则走 `@media (prefers-color-scheme: dark)`（`#ifdef MP-WEIXIN` 分支），系统跟随，无手动档
3. **JS 注入色**：`useTheme()` 转出 theme.js 的响应式单例 `isDark`，图表配色/原生 switch/slider/标签圆点等动态绑定自动跟随
4. **页面重刷**：main.js 全局 mixin 每页 `onShow` 幂等调 `applyTheme()`
5. **历史说明**：本节曾描述 `[data-theme]` 属性选择器与 `syncThemeToDOM()`——那是未落地的规划，4.7.x 实际为纯系统跟随，4.8.0 才以类驱动方案实装手动档

### 11.3 存储键

`siji_theme_mode`，值为 `system` / `light` / `dark`（入口：设置页 → 外观）

---

## 十二、功能色映射

| 模块 | 主色 | 浅色背景 | 用途 |
|------|------|----------|------|
| 计划 | `#10B981` | `#ECFDF5` / `#D1FAE5` | 完成状态、计划图标 |
| 账单 | `#F59E0B` | `#FFFBEB` / `#FEF3C7` | 支出标识、账单图标 |
| 日记 | `#FCD34D` | — | 日记标识 |
| 支出 | `#EF4444` | `#FEF2F2` / `#FEE2E2` | 负数金额 |
| 收入 | `#10B981` | — | 正数金额 |
| 超预算 | `#EC4899` | — | 预算超支 |

---

## 十三、全局工具类

> 以下为示意骨架；实际项目以组件 scoped 样式内的硬编码 hex + `html.theme-dark` 覆盖为准。`.glass-card` 已于 4.6.0 删除，禁止重新引入。

```scss
// 文字色（实际值：primary #18181B / secondary #52525B / hint #71717A，深色对应 #FAFAFA/#A1A1AA/#71717A）
.text-center { text-align: center; }

// 字号
.font-xs { font-size: 22rpx; }
.font-sm { font-size: 26rpx; }
.font-md { font-size: 28rpx; }
.font-lg { font-size: 32rpx; }
.font-xl { font-size: 36rpx; }
.font-xxl { font-size: 44rpx; }

// 间距
.mt-xs { margin-top: 8rpx; }
.mt-sm { margin-top: 16rpx; }
.mt-md { margin-top: 24rpx; }
.mt-lg { margin-top: 32rpx; }
.mb-sm { margin-bottom: 16rpx; }
.mb-md { margin-bottom: 24rpx; }

// 动画
.fade-in-up { animation: fadeInUp 0.4s ease both; }
.tap-feedback { transition: background-color 0.15s, opacity 0.15s, transform 0.15s; }
.tap-feedback:active { opacity: 0.85; }
```

---

## 十四、页面路由结构

```
pages/
├── splash/index          # 品牌开屏（custom nav）
├── lock/index            # 隐私锁（custom nav）
├── chat/index            # AI 对话主页（custom nav）★ TabBar
├── functions/index       # 功能入口 ★ TabBar
├── settings/index        # 设置主页 ★ TabBar
│   └── sub/
│       ├── ai.vue         # AI 模型配置
│       ├── agent.vue      # Agent 管理
│       ├── agent_add.vue  # 创建 Agent
│       ├── profile.vue    # 我的信息
│       ├── memory.vue     # 记忆管理
│       ├── theme.vue      # 外观主题
│       ├── privacy.vue    # 应用锁
│       ├── data.vue       # 数据同步与导出
│       ├── feedback.vue   # 体验反馈
│       ├── feedback-new.vue
│       ├── help.vue       # 使用说明
│       └── about.vue      # 关于与设备
├── diary/ (subPackage)
│   ├── list.vue
│   └── detail.vue
├── bill/ (subPackage)
│   ├── index.vue
│   ├── stats.vue
│   └── edit.vue
└── plan/ (subPackage)
    ├── index.vue
    ├── detail.vue
    ├── templates.vue
    └── stats.vue
```

**预加载**: chat 和 functions 页面预加载 diary/bill/plan 三个子包。

---

## 十五、已知待修复项

深色模式三态（4.8.0）、原生 tabBar/导航栏变量化（4.7）、气泡背景统一（4.8）均已落地。当前无待修复硬编码项。

| 项 | 状态 |
|----|------|
| TabBar color / 选中色 / 背景 | 已由 theme.json 三变量化，`applyTheme()` 按主题切换 |
| 各页 navigationBar 背景/文字色 | 已由 theme.json 三变量化 |
| AI 气泡背景 | 已统一 `#F4F4F5` / `#27272A` |
| budget-hint / hero-sub 白字透明 | 保留（深色底或品牌色上的白字透明，语义正确） |

---

## 十六、设计红线

1. **零渐变**：所有 `$gradient-*` 变量均为纯色 `#000000`
2. **零毛玻璃**：`backdrop-filter` 已废弃，`$glass-blur: none`
3. **零 CSS 变量**：运行时颜色硬编码 hex + 主题类覆盖；SCSS 变量仅用于静态间距/圆角/字号
4. **零紫色残留**：Slate/Indigo/Purple 系列全部清除
5. **box-sizing: border-box**：所有容器必须设置，防溢出
6. **overflow: hidden**：卡片/容器默认隐藏溢出
7. **tabular-nums**：所有金额/统计数字必须使用等宽数字
8. **SijiIcon 统一**：禁止内联 emoji 替代图标（教学卡片/用户数据除外）
9. **rpx 单位**：所有尺寸用 `rpx`，禁止 `px`（`transform` 中的 `%` 除外）
10. **类驱动主题**：H5·App 深色规则写在 `html.theme-dark {}` 内；小程序走 `@media (prefers-color-scheme: dark)`（包在 `#ifdef MP-WEIXIN`）；图标换色由 JS 消费 `isDark` 切换 src
