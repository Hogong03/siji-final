# 标签功能优化 — 创建修复 + 日记标签筛选 + 独立性确认

## 问题与修复

### 1. 创建标签没效果（核心 Bug）
**根因**：`addNewTag()` 调用 `addCustomTag()` 写入注册表后：
- `allUsedTags` 没有刷新 → 标签选择器列表中不显示新标签
- `tagColorCache` 没有清除 → 新标签颜色显示为默认色而非分配色
- 无视觉反馈 → 用户不知道创建成功

**修复**（diary/detail.vue + plan/detail.vue）：
- `addNewTag()` 执行后立即 `allUsedTags.value = getUsedTags(type)` 刷新列表
- `delete tagColorCache[name]` 清除颜色缓存
- 添加 `uni.showToast({ title: '标签已创建', icon: 'success' })` 反馈
- `tagColor()` 函数增加三级查找：已用标签 → 注册表 → 默认色

### 2. 日记列表无标签筛选（功能缺失）
**修复**（diary/list.vue 重写）：
- 新增标签筛选行（月份切换栏下方）
- 支持「全部」+ 各标签按钮（显示使用次数）
- 点击高亮，再次点击取消
- 月份切换时自动重置标签筛选
- 筛选后无结果显示 EmptyState 提示
- 日记卡片标签改为彩色显示（使用 `tagColor()` 函数）
- 新增 `onShow` 生命周期 + `loadTags()` 保证返回页面时刷新

### 3. 日记和计划标签独立性（确认）
- 存储 key 独立：`siji_tags_diary` vs `siji_tags_plan`
- 数据来源独立：日记从 `diary_YYYY-MM` 提取，计划从 `plan_all` 提取
- `getUsedTags('diary')` 和 `getUsedTags('plan')` 完全隔离
- 已确认无交叉引用

## 改动文件（3 个）

| 文件 | 改动 |
|------|------|
| `pages/diary/detail.vue` | 修复 addNewTag + 增强 tagColor 三级查找 + 导入 getTags |
| `pages/plan/detail.vue` | 同样修复 addNewTag + 增强 tagColor + 导入 getTags |
| `pages/diary/list.vue` | 重写：新增标签筛选行 + onShow 刷新 + 标签彩色显示 |
