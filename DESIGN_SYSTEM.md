# 思迹（Siji）UI 设计标准规范

> **版本**: 1.0  
> **提取日期**: 2026-07-05  
> **项目**: 思迹 — AI 对话式生活助手  
> **平台**: uni-app（H5 / App / 微信小程序）  
> **设计语言**: 极简科技 + 温暖生活（微拟物 + 玻璃拟物残影）

---

## 一、设计哲学

| 维度 | 原则 |
|------|------|
| **色彩** | 纯黑白为主（#000000 / #FFFFFF），功能色仅用于状态标识，禁止渐变 |
| **层次** | 用 Zinc 灰阶（50→900）区分层级，非色彩堆叠 |
| **动效** | 极克制：仅入场动画 + 按钮反馈，禁止持续呼吸/脉动（功能性脉动除外） |
| **图标** | 统一 SijiIcon 组件，H5 用 SVG / App 用 PNG，stroke 风格 2px |
| **信息** | AI 回复内容是唯一有"权重"的视觉焦点，UI 本身退让 |

---

## 二、色彩系统

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
| `--bg-page` | `#FAFAFA` (Zinc-50) | `#0A0A0B` | 页面背景 |
| `--bg-card` | `#FFFFFF` | `#18181B` (Zinc-900) | 卡片/输入区背景 |
| `--bg-card-alt` | `#F8F8F8` | `#222226` | 卡片交替背景 |
| `--bg-input` | `#F4F4F5` (Zinc-100) | `#27272A` (Zinc-800) | 输入框/Chip 背景 |
| `--bg-subtle` | `#FAFAFA` | `#18181B` | 微妙背景 |
| `--bg-muted` | `#F4F4F5` | `#27272A` | 静音背景 |

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
- ❌ 禁止硬编码颜色值（必须使用 CSS 变量或 SCSS 变量）
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

| 变量 | 值 | 用途 |
|------|----|------|
| `$shadow-sm` | `0 2rpx 8rpx rgba(0,0,0,0.06)` | **默认卡片** |
| `$shadow-md` | `0 4rpx 16rpx rgba(0,0,0,0.08)` | 弹出层、悬浮卡片 |
| `$shadow-lg` | `0 8rpx 24rpx rgba(0,0,0,0.10)` | Modal、大弹层 |
| `$shadow-ai` | `0 2rpx 12rpx rgba(0,0,0,0.08)` | AI 元素专属 |

深色模式阴影使用 `var(--shadow-color)`。

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

### 8.1 卡片

```scss
// 标准卡片
background: var(--bg-card);
border-radius: $radius-md;  // 或 $radius-lg 用于概览卡
border: 1rpx solid var(--border-color);
box-shadow: $shadow-sm;
padding: $spacing-md;       // 或 $spacing-lg $spacing-md
margin: $spacing-sm $spacing-md;  // 或 $spacing-md
box-sizing: border-box;
overflow: hidden;
```

**交互反馈**: `&:active { transform: scale(0.98); border-color: var(--text-primary); }`

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
| 背景 | `var(--color-ai)` | `#F8F8F8` |
| 文字色 | `var(--bg-card)` (#FFF) | `var(--text-primary)` |
| 圆角 | `24rpx 24rpx 8rpx 24rpx` | `24rpx 24rpx 24rpx 8rpx` |
| 左边框 | 无 | `3rpx solid var(--border-color)` |
| 最大宽度 | `85%` | `85%` |
| Padding | `$spacing-sm $spacing-md` | 同左 |
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

统一使用 `SijiIcon.vue`，支持 61 个图标名。

### 9.2 尺寸

| Size | 值 | 用途 |
|------|----|------|
| `xs` | `24rpx` | 极小图标 |
| `sm` | `28rpx` | 小图标（气泡操作） |
| `md` | `32rpx` | **默认** |
| `lg` | `36rpx` | 大图标 |
| `xl` | `44rpx` | 特大 |
| `xxl` | `56rpx` | 空状态 |

### 9.3 颜色

- 默认 `currentColor`（继承父元素）
- 可传 CSS 变量：`color="var(--text-secondary)"`

### 9.4 跨平台

- **H5**: 内联 SVG，`stroke-width: 2`，`stroke-linecap: round`
- **App/小程序**: `<image>` 引用 `/static/icons/{name}.png`（24×24 PNG）

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
- 未选中色: `#94A3B8`（注：硬编码于 pages.json，需迁移）
- 选中色: `#000000`
- 背景: `#FFFFFF`

### 10.5 导航栏

- 默认白底黑字（`#FFFFFF` / `black`）
- 自定义导航栏页面：`navigationStyle: "custom"`（chat/index, splash, lock）

---

## 十一、主题系统

### 11.1 三种模式

| 模式 | 值 | 行为 |
|------|----|------|
| 浅色 | `light` | 固定浅色 |
| 深色 | `dark` | 固定深色 |
| 跟随系统 | `auto` | 监听 `prefers-color-scheme` |

### 11.2 实现机制

1. **CSS 变量**：`page` 选择器定义浅色默认值
2. **媒体查询**：`@media (prefers-color-scheme: dark)` 覆盖
3. **手动覆盖**：`[data-theme="dark"]` / `[data-theme="light"]` 属性选择器
4. **DOM 同步**：`syncThemeToDOM()` 在每个页面 `onShow` 时调用
5. **App 端**：`uni.setNavigationBarColor` + `uni.setTabBarStyle`

### 11.3 存储键

`siji_theme`，值为 `light` / `dark` / `auto`

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

```scss
// 文字
.text-primary { color: var(--text-primary); }
.text-secondary { color: var(--text-secondary); }
.text-hint { color: var(--text-hint); }
.text-success { color: $success; }
.text-warning { color: $warning; }
.text-danger { color: $danger; }
.text-ai { color: var(--color-ai); }
.text-center { text-align: center; }

// 字号
.font-xs { font-size: $font-xs; }
.font-sm { font-size: $font-sm; }
.font-md { font-size: $font-md; }
.font-lg { font-size: $font-lg; }
.font-xl { font-size: $font-xl; }
.font-xxl { font-size: $font-xxl; }

// 间距
.mt-xs { margin-top: $spacing-xs; }
.mt-sm { margin-top: $spacing-sm; }
.mt-md { margin-top: $spacing-md; }
.mt-lg { margin-top: $spacing-lg; }
.mb-sm { margin-bottom: $spacing-sm; }
.mb-md { margin-bottom: $spacing-md; }

// 卡片
.glass-card {
  background: var(--bg-card);
  border: 1rpx solid var(--border-color);
  border-radius: $radius-md;
}

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

| 项目 | 现状 | 应为 |
|------|------|------|
| TabBar `color` | `#94A3B8` 硬编码 | 应为 `var(--text-hint)` 或 `#A1A1AA` |
| TabBar 各页 `navigationBarBackgroundColor` | `#FFFFFF` 硬编码 | 深色模式需 `#18181B` |
| 气泡 AI 背景 `#F8F8F8` | 硬编码 | 应为 `var(--bg-card-alt)` |
| `budget-hint-text` | `rgba(255,255,255,0.6)` | 应为 `var(--text-hint)` |
| `hero-sub` | `rgba(255,255,255,0.7)` | 可接受（AI 色上的白字透明） |

---

## 十六、设计红线

1. **零渐变**：所有 `$gradient-*` 变量均为纯色 `#000000`
2. **零毛玻璃**：`backdrop-filter` 已废弃，`$glass-blur: none`
3. **零硬编码颜色**：所有颜色必须走 CSS 变量或 SCSS 变量
4. **零紫色残留**：Slate/Indigo/Purple 系列全部清除
5. **box-sizing: border-box**：所有容器必须设置，防溢出
6. **overflow: hidden**：卡片/容器默认隐藏溢出
7. **tabular-nums**：所有金额/统计数字必须使用等宽数字
8. **SijiIcon 统一**：禁止内联 emoji 替代图标（教学卡片/用户数据除外）
9. **rpx 单位**：所有尺寸用 `rpx`，禁止 `px`（`transform` 中的 `%` 除外）
10. **CSS 变量优先**：运行时颜色必须用 `var(--xxx)`，SCSS 变量仅用于静态值
