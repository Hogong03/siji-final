/**
 * 版本日志数据段：4.24.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V424 = [
  {
    version: '4.24.0',
    date: '2026-10-11',
    title: '对话管理升级：修桌面端删除不可用 + 搜索/行菜单/摘要/自动标题',
    summary: [
      '修对话删除在桌面 H5 完全不可用：删除此前只靠长按（touchstart/touchend 监听），鼠标没有 touch 事件，桌面用户没有任何删除入口 —— 操作收敛为行尾「⋯」菜单（重命名/编辑标签/删除对话），长按保留为移动端快捷方式',
      '新建对话入口提到面板右上角：原来「新对话」压在列表最底部，会话一多要滚到底才能新建；header 加「+ 新对话」按钮，底部 divider 保留',
      '新增对话搜索：面板常驻搜索框，按标题 + 消息正文实时过滤；无结果时有专属空态文案',
      '列表加最后一条消息摘要行（40 字截断），不再只看标题猜对话；打开面板自动 scroll-into-view 定位当前会话',
      '默认标题自动生成：首条用户消息前 20 字自动成为对话标题（仅「对话/新对话N」默认名触发，手动重命名不覆盖）',
      '新建对话前先清理历史遗留的空壳会话（0 条），不再堆积「新对话N 0 条」；全部弹窗补 confirmColor（删除红色 #EF4444，其余黑色），不再吃平台默认蓝色',
    ],
    categories: [
      {
        title: '功能修复（4.24.0）',
        items: [
          'components/chat/ConversationListItem.vue：独立的 ✎ 重命名图标与 ⋯ 加标签图标语义不明，收敛为单个「⋯」more 事件；emits 收敛为 switch/delete/more',
          'composables/useConversationManager.js：新增 handleMoreConversation（ActionSheet 三项分发）；删除确认 confirmColor #EF4444 + confirmText「删除」，重命名/新建标签 confirmColor #000000',
          '桌面 H5 长按失效根因：usePressHold 绑定 touchstart/touchmove/touchend，鼠标事件不触发 —— 实测鼠标按住 700ms 无任何反应，此前桌面端无法删除对话',
        ],
      },
      {
        title: '体验升级（4.24.0）',
        items: [
          'ConversationPanelHeader.vue：右上角「+ 新对话」按钮（add 图标，黑底白字/深色反白）',
          'ConversationPanel.vue：header 下常驻搜索行（search 图标 + input + 清除钮），keyword 经 useConversationManager 的 matchKeyword 过滤（标题或任一条消息 content/aiReply 命中）；scroll-view 加 :scroll-into-view，打开面板自动定位当前会话（ConversationListItem 根节点挂 conv-{id} 锚点）',
          'ConversationListItem.vue：新增 lastPreview 摘要行（倒序取第一条有内容消息，user 取 content、assistant 取 aiReply，40 字截断，图片/文件/执行结果各有占位文案）',
          'store/chat.js：addMessage 首条用户消息自动写默认标题（正则 /^(对话|新对话\\d+)$/ 守卫，手动命名与自定义标题不受影响）',
          'useConversationManager.handleNewConversation：新建前 store.pruneEmptyConversations(保留当前)，清掉历史空壳',
          'pages/chat/index.vue：面板事件接线同步（@rename/@add-tag → @more，新增 :keyword/@search），未用的 handleRenameConversation/handleAddTag 解构移除',
        ],
      },
    ],
  },
]
