# AI 聊天页介绍文案改为 Modal 显示

## 变更
将 AI 使用说明从内联展开面板（`v-if` 插入消息列表上方）改为**自定义 Modal 弹窗**。

### 改动文件
- `pages/chat/index.vue`

### 具体改动
1. **模板**：移除 `<scroll-view>` 内的 `guide-panel` 面板，在页面底部添加 `modal-mask` + `modal-container` 弹窗
2. **脚本**：`showGuide` 改为 ref 控制 modal 显隐；新增 `showGuideModal()`、`closeGuide()`、`goToFullHelp()` 三个函数
3. **样式**：删除 `guide-panel`/`guide-header`/`guide-body` 旧样式，新增 `modal-mask`/`modal-container`/`modal-header`/`modal-body` 样式；`guide-item`/`guide-tip`/`guide-more` 样式保留并适配 modal

### Modal 交互
- 点击 📖 按钮 → 弹出 Modal
- 点击遮罩或 ✕ → 关闭
- Modal 内容可滚动（`scroll-view`）
- 底部「查看完整使用说明 ›」→ 关闭 Modal 并跳转 help 页面
