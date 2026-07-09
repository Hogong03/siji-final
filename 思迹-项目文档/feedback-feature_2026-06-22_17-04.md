# 体验反馈功能 — 纯本地存储

## 新增文件（1 个）
- `pages/settings/sub/feedback.vue` — 体验反馈完整页面

## 改动文件（3 个）

### `utils/storage.js`
新增反馈 CRUD API：
- `getFeedbackList()` — 获取所有反馈（按时间倒序）
- `saveFeedback(fb)` — 保存反馈（自动生成 ID，含 rating/category/content/contact）
- `deleteFeedback(clientId)` — 软删除反馈
- `getFeedbackStats()` — 统计概览（总条数、平均评分、分类计数）
- 存储 key：`siji_feedback`

### `pages/functions/index.vue`（功能中心）
- 底部新增「体验反馈」入口卡片（玻璃拟物风格）
- 显示反馈统计（条数 + 均分）
- 显示最近 2 条反馈预览（分类标签 + 星级 + 内容截断）
- 点击跳转到反馈详情页

### `pages.json`
- 注册 `pages/settings/sub/feedback` 路由

## 功能详情

**反馈页面 (`feedback.vue`)：**
1. **统计概览卡片**：紫色渐变背景，显示平均评分（大字+星星）和总条数
2. **分类统计**：横排 pill 标签显示各分类数量
3. **反馈表单**：
   - 评分（1-5 星，点击选择，带文字提示）
   - 分类（4 类：💡功能建议 / 🐛Bug反馈 / 💭体验感受 / ✨功能需求）
   - 内容（textarea，500 字上限，带字数统计）
   - 联系方式（可选）
   - 提交按钮
4. **历史反馈列表**：卡片式展示，含分类图标、星级、内容、时间、联系方式、删除按钮
5. **表单收起/展开**：提交后可收起表单，点击"写新反馈"展开

## 设计决策
- **纯本地存储**：数据存在 `uni.getStorageSync('siji_feedback')`，不走任何网络请求
- **软删除**：`is_deleted=1`，保留数据痕迹
- **自动 ID**：`fb_{timestamp}_{random4}` 格式
- **功能页入口**：放在功能中心底部，最近反馈预览直接可见
