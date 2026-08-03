# 免责声明首次启动展示 — 2026-07-14_05:04

## 目标
应用首次启动时展示用户协议与免责声明，必须同意才能进入。

## 改动文件

### 新增
- `utils/disclaimer.js` — `getDisclaimerAccepted()` / `setDisclaimerAccepted()`，基于 `siji_disclaimer_accepted` 存储键
- `pages/disclaimer/index.vue` — 免责声明全屏页，包含六节法律文本（关于思迹、AI服务说明、数据隐私、免责条款、知识产权、协议变更）

### 修改
- `pages.json` — 注册 `pages/disclaimer/index` 页面（custom navigation style）
- `pages/splash/index.vue` — splash 跳转前检查 `getDisclaimerAccepted()`，未同意→跳转免责声明页
- `pages/settings/sub/about.vue` — 关于页增加「用户协议与免责声明」入口

## 流程
```
启动 → splash (1.6s) → 首次? → 免责声明页 → 同意 → lock/chat
                                    → 不同意 → 二次确认 → 退出/浏览器回退
                        → 非首次 → lock/chat（原流程）
```

## 设计要点
- 首启模式：双按钮「同意并继续」+「不同意」
- 回看模式（设置进入）：单按钮「返回」，调用 `uni.navigateBack()`
- 不同意：先弹出 modal 二次确认 → 确认后 App端 `plus.runtime.quit()`，H5端回退或白屏提示
- 纯黑白极简风格，与整体设计语言一致
