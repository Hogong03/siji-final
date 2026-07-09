# 语音输入修复 — voice.js 条件编译与错误处理

## 问题
语音输入按钮无效果。根因分析：

### 根因 1：`getPlatform()` 条件编译问题
原代码使用 `// #ifdef` 条件编译注释，但在某些运行环境下（如 HBuilder X 内置浏览器预览），条件编译可能不正确裁剪，导致多个 `return` 语句只有第一个执行。

### 根因 2：`isVoiceSupported()` 未检测 `plus` 对象是否存在
App 环境下直接 `return true`，但某些运行环境 `plus` 可能未定义。

### 根因 3：缺少错误日志
没有 console.log/error 输出，问题难以定位。

## 修复内容

### `utils/voice.js`
- `isVoiceSupport()` 增加运行时检测：App 端检查 `typeof plus !== 'undefined' && plus.audio && plus.speech`
- H5 端增加 `not-allowed` 错误处理（麦克风权限被拒绝时给出明确提示）
- 导出 `isVoiceSupported` 别名保持向后兼容
- 保留条件编译注释（在 HBuilder X 编译时正确裁剪），但运行时也有检测兜底

### `components/common/VoiceButton.vue`
- `isVoiceSupport` 引用更新
- 增加 try-catch 包裹初始化检测
- 全流程增加 `console.log/error` 调试日志
- Toast 显示时间延长到 3 秒

## 环境限制说明
- **HBuilder X 内置浏览器**：不支持 Web Speech API，语音按钮不会显示
- **Chrome/Firefox 浏览器**：支持 Web Speech API，但需要联网（Google API）
- **真机运行（App）**：需要 `plus.speech` 模块，已配置 Speech module + RECORD_AUDIO 权限
- **Safari iOS 14+**：支持 Web Speech API

## manifest.json 已配置
- `modules.Speech: {}` ✅
- `android.permissions.RECORD_AUDIO` ✅
