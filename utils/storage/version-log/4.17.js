/**
 * 版本日志数据段：4.17.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V417 = [
  {
    version: '4.17.0',
    date: '2026-10-07',
    title: '文件解析接入智谱后端：配了智谱 Key 就能读 PDF/Word/Excel，自动选用不再死守 Moonshot',
    summary: [
      'doc-parse 后端注册表新增「智谱文件解析」（purpose=file-extract 上传 → files/{id}/content 取正文），与 Moonshot 同构，复用已有智谱聊天 Key，支持 pdf/doc/docx/xls/xlsx/ppt/pptx 与图片文字提取',
      '解析后端自动选用：未手动指定时按 智谱 → Moonshot 顺序复用已配置的厂商 Key —— 此前默认后端锁死 Moonshot，只配智谱 Key 的用户文件功能完全不可用（本版主修点）',
      '聊天输入区选文件后显示「正在解析文件，请稍候…」占位卡；免 Key 引导弹窗文案同步改为「智谱 / Moonshot Key 均可，自动选用已配置的那个」',
      '修 deleteRemote 硬编码 Moonshot 删除端点：删除端点改为由后端声明（deleteUrl），智谱文件不再拿智谱 Key 去调 Moonshot 的 DELETE 接口',
      '修 4.16.1 遗留测试：file-read 两个 picker 用例仍 mock uni.chooseFile（H5 已改原生 input），重写为原生 input change / focus 取消路径',
    ],
    categories: [
      {
        title: '文件解析后端（4.17.0）',
        items: [
          'utils/files/doc-parse.js：新增 zhipuBackend（buildUpload 双形态 H5 File / App filePath、parseUpload 取 file id、buildContentRequest、normalizeContent 兼容纯文本与 {content} JSON 两种返回）',
          'resolveDocConfig：own Key → 指定后端复用厂商 Key → 自动选用（zhipu → moonshot，autoPicked 标记）→ no_key 四层裁决',
          'docStatusText：未配置文案改为「智谱 / Moonshot 任配其一」，与自动选用口径一致',
          'deleteRemote：删除端点改由后端 deleteUrl 声明，无声明的后端跳过删除',
          '设置页「读文件」后端列表走 listDocBackends() 动态渲染，智谱自动出现，无需改 UI 代码',
        ],
      },
      {
        title: '聊天输入区',
        items: [
          'components/chat/InputArea.vue：selectedFile 为空且 fileLoading 时显示解析中占位卡',
          '4.12.2 引导弹窗文案更新为双后端口径（智谱 / Moonshot 均可）',
        ],
      },
      {
        title: '测试',
        items: [
          '新增 tests/doc-parse-zhipu.test.js 9 例：请求组装双形态、正文端点、normalizeContent 三态、自动选用 / 独立 Key 优先 / no_key、parseDocument 全链路（上传 + 取正文 + 尽力删除计数）',
          'tests/file-read.test.js：picker 两用例改走 H5 原生 input（fake document/window + fake timers 模拟取消）',
          '全量 98 文件 / 1347 用例全绿（NODE_OPTIONS=--max-old-space-size=4096 + --maxWorkers=2）',
        ],
      },
    ],
  },
]
