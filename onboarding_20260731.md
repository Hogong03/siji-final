# 首次使用引导（Onboarding）— 思迹

## 时间
2026-07-31 20:43

## 目标
在 `C:\Users\c3798\Desktop\思迹` 项目上，为用户第一次使用 App 时添加引导流程，引导填入 API Key 并了解功能用法。

## 改动

### 新增组件
**`components/chat/OnboardingGuide.vue`**（10KB）— 多步骤 Onboarding 向导
- 4 步流程：欢迎 → 配置 API Key → 功能引导 → 完成
- 步骤 1（API Key）：
  - 实时读取 `store.providerKeys[store.aiProvider]` 显示配置状态（已配置/未配置）
  - 未配置时显示「去配置 API Key」按钮 → navigateTo `/pages/settings/sub/ai`
  - 有「我已经配置好了」跳过按钮
- 步骤 2（功能引导）：列出 记账/日记/计划/查询/撤销 5 个说话示例
- 深色模式适配：fixed 组件用硬编码 + `@media`/`isDark` 查询（遵循项目规范）
- 完成/跳过时写入 `siji_onboarding_done='1'`
- `watch(props.show)` 每次打开重置到第 0 步
- 接受 `show` prop，`emit('finish')`

### 修改
**`pages/chat/index.vue`**
- import OnboardingGuide
- 新增 `showOnboarding` ref + `checkOnboarding()`（读 `siji_onboarding_done`，未置位则显示）
- `onMounted` 末尾调用 `checkOnboarding()`
- 模板 `<GuideModal>` 后加 `<OnboardingGuide :show="showOnboarding" @finish="showOnboarding=false" />`

## 触发逻辑
- App 启动 → splash → 首次弹免责声明（已存在）→ 同意后进 chat 页
- chat 页 `onMounted` → `checkOnboarding()` → 若 `siji_onboarding_done` 未置位，弹出引导
- 引导走完或点「跳过」→ 置位标记 → 不再显示

## 测试
81/81 全通过 ✅

## Bug 修复（2026-07-31 22:24）

**Global error: `Invalid args: type check failed for args "callback". Expected Function` in unmounted hook**

- **根因**：`OnboardingGuide.vue` 的 `onUnmounted` 里调用 `uni.offThemeChange()` 时未传回调函数，而该 API 强制要求 Function 类型，导致类型检查失败抛错。
- **修复**：完全移除组件内手动深色检测逻辑（`isDark` ref、`onMounted`/`onUnmounted` 里的 `uni.onThemeChange`/`uni.offThemeChange`）。因为项目已用全局 CSS 变量 + `@media (prefers-color-scheme: dark)` 自动适配深色，无需 JS 手动切换。
- **样式改造**：把所有 `.onb-mask.dark` 前缀选择器改成一个 `@media (prefers-color-scheme: dark) { ... }` 块，纯 CSS 硬编码覆盖（符合项目 fixed 组件规范）。
- **验证**：81/81 测试通过；组件内无残留 `onThemeChange`/`offThemeChange`/`.dark` 引用。

## 说明
- 引导为聊天页上的全屏 Modal（z-index 999），不新增路由页
- 「去配置 API Key」跳转到现有 AI 配置子页 `/pages/settings/sub/ai`，配置完成后返回继续引导
- 用户可随时点「跳过」跳过引导，之后不再弹出
