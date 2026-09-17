/**
 * test: 读文件（3.6.0）
 *
 * 覆盖 file-types（类型判定 / 大小上限）、html-text（实体解码 / 正文提取 / 截断）、
 * file-text（清洗 / 二进制拦截 / 截断 / 拼装）、picker（三端统一形状）、
 * index.readPickedFile（文本直读 / 文档解析 / 各拒绝分支）与聊天历史里的文件窗口。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import './setup.js'
import {
  TEXT_EXTS, DOC_EXTS, MAX_FILE_BYTES,
  extOf, baseNameOf, classifyFile, checkSize, formatBytes, pickerExtensions
} from '../utils/files/file-types.js'
import {
  MAX_FILE_CHARS, stripBom, looksBinary, cleanFileText, truncateFileText,
  countLines, buildFileContext, composeFileMessage
} from '../utils/files/file-text.js'
import { decodeEntities, extractTitle, normalizeText, isHtmlLike, htmlToText } from '../utils/ai/html-text.js'
import { toPick, pickOneFile, APP_PICK_HINT } from '../utils/files/picker.js'
import {
  readPickedFile, fileCardText, unsupportedHint, setOwnDocKey, hasOwnDocKey,
  docStatusText, resolveDocConfig, listDocBackends, getDocBackendId, setDocBackend
} from '../utils/files/index.js'
import { buildChatHistory } from '../utils/ai/chatHistoryBuilder.js'

let originals = {}

beforeEach(() => {
  global.uni.clearStorageSync?.()
  originals = {
    request: global.uni.request,
    uploadFile: global.uni.uploadFile,
    getFileSystemManager: global.uni.getFileSystemManager,
    chooseFile: global.uni.chooseFile
  }
})

afterEach(() => {
  Object.keys(originals).forEach(k => {
    if (originals[k] === undefined) delete global.uni[k]
    else global.uni[k] = originals[k]
  })
})

/** 假小程序文件系统：把 path 当成内容读回来（vitest 里三个平台的代码都是活的） */
function stubLocalFile(content) {
  global.uni.getFileSystemManager = () => ({
    readFile({ success, fail }) {
      if (content === null) fail({})
      else success({ data: content })
    }
  })
}

describe('文件类型判定', () => {
  it('扩展名取小写，无扩展名返回空串', () => {
    expect(extOf('六级真题.PDF')).toBe('pdf')
    expect(extOf('README')).toBe('')
    expect(extOf('a.b.txt')).toBe('txt')
  })

  it('文件名去目录，两种分隔符都认', () => {
    expect(baseNameOf('C:/doc/a.txt')).toBe('a.txt')
    expect(baseNameOf('C:\\doc\\a.txt')).toBe('a.txt')
    expect(baseNameOf('a.txt')).toBe('a.txt')
    expect(baseNameOf('')).toBe('')
  })

  it('分类：文本 / 文档 / 图片 / 不支持', () => {
    expect(classifyFile('notes.md')).toBe('text')
    expect(classifyFile('data.json')).toBe('text')
    expect(classifyFile('run.log')).toBe('text')
    expect(classifyFile('srt_test.srt')).toBe('text')
    expect(classifyFile('六级.pdf')).toBe('document')
    expect(classifyFile('综述.docx')).toBe('document')
    expect(classifyFile('账单.xlsx')).toBe('document')
    expect(classifyFile('截图.png')).toBe('image')
    expect(classifyFile('安装包.apk')).toBe('unsupported')
    expect(classifyFile('无后缀名')).toBe('unsupported')
  })

  it('MIME 优先于扩展名（H5 端拿得到 type）', () => {
    expect(classifyFile('a.bin', 'text/plain')).toBe('text')
    expect(classifyFile('a.txt', 'image/png')).toBe('image')
    expect(classifyFile('a.dat', 'application/pdf')).toBe('document')
  })

  it('大小上限：5MB 以内放行，超了拒绝并说人话', () => {
    expect(checkSize(0).ok).toBe(true)
    expect(checkSize(1024).ok).toBe(true)
    expect(checkSize(MAX_FILE_BYTES).ok).toBe(true)
    const big = checkSize(MAX_FILE_BYTES + 1)
    expect(big.ok).toBe(false)
    expect(big.reason).toContain('5.0 MB')
  })

  it('大小格式化与 picker 后缀清单', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB')
    const exts = pickerExtensions()
    expect(exts).toContain('txt')
    expect(exts).toContain('pdf')
    expect(exts).toContain('md')
    expect(exts.length).toBe(TEXT_EXTS.length + DOC_EXTS.length)
  })
})

describe('HTML 转文本（读网址共用）', () => {
  it('命名实体与数字实体都解码', () => {
    expect(decodeEntities('a &amp; b &lt;c&gt; &quot;d&quot;')).toBe('a & b <c> "d"')
    expect(decodeEntities('&#20320;&#22909;')).toBe('你好')
    expect(decodeEntities('&#x4F60;&#x597D;')).toBe('你好')
    expect(decodeEntities('&nbsp;x')).toBe(' x')
  })

  it('标题优先 og:title，其次 title', () => {
    expect(extractTitle('<meta property="og:title" content="OG标题"><title>普通标题</title>')).toBe('OG标题')
    expect(extractTitle('<title>只有标题</title>')).toBe('只有标题')
    expect(extractTitle('<div>x</div>')).toBe('')
  })

  it('isHtmlLike 判定', () => {
    expect(isHtmlLike('<div>a</div>')).toBe(true)
    expect(isHtmlLike('就是一段普通文字')).toBe(false)
    expect(isHtmlLike('')).toBe(false)
  })

  it('剥掉 script/style，块级标签转换行', () => {
    const r = htmlToText('<html><body><style>p{color:red}</style><p>第一段</p><p>第二段</p></body></html>')
    expect(r.ok).toBe(true)
    expect(r.text).toContain('第一段')
    expect(r.text).toContain('第二段')
    expect(r.text).not.toContain('color:red')
    expect(r.text.split('\n').length).toBeGreaterThan(1)
  })

  it('非 HTML 当纯文本处理', () => {
    const r = htmlToText('就是一段纯文本，带 &amp; 实体')
    expect(r.ok).toBe(true)
    expect(r.text).toBe('就是一段纯文本，带 & 实体')
  })

  it('空内容返回 ok=false', () => {
    expect(htmlToText('').ok).toBe(false)
    expect(htmlToText(null).ok).toBe(false)
    expect(htmlToText('<div>   </div>').ok).toBe(false)
  })

  it('超过上限截断并留说明', () => {
    const long = '<p>' + '字'.repeat(200) + '</p>'
    const r = htmlToText(long, { limit: 50 })
    expect(r.ok).toBe(true)
    expect(r.truncated).toBe(true)
    expect(r.length).toBe(200)
    expect(r.text).toContain('已截断')
  })
})

describe('文件正文加工', () => {
  it('去 BOM', () => {
    expect(stripBom('\uFEFF标题')).toBe('标题')
    expect(stripBom('')).toBe('')
  })

  it('二进制拦截：NUL 与控制字符', () => {
    expect(looksBinary('正常文本\n第二行')).toBe(false)
    expect(looksBinary('PDF\u0000\u0001\u0002')).toBe(true)
    expect(looksBinary('')).toBe(false)
  })

  it('清洗：统一换行、去行尾空格、压连续空行', () => {
    const r = cleanFileText('第一行   \r\n\r\n\r\n\r\n\r\n第二行\t')
    expect(r).toBe('第一行\n\n\n第二行')
  })

  it('截断：短的原样返回，长的切在换行处并标注', () => {
    const short = truncateFileText('abc', 10)
    expect(short.truncated).toBe(false)
    expect(short.text).toBe('abc')

    const lines = Array.from({ length: 200 }, (_, i) => '第 ' + i + ' 行内容').join('\n')
    const r = truncateFileText(lines, 100)
    expect(r.truncated).toBe(true)
    expect(r.kept).toBeLessThanOrEqual(100)
    expect(r.text).toContain('已截断')
    expect(r.text).toContain('共 ' + lines.length + ' 字')
  })

  it('默认上限是 8000 字，与 read_url 的截断口径一致', () => {
    expect(MAX_FILE_CHARS).toBe(8000)
  })

  it('行数统计', () => {
    expect(countLines('a\nb\nc')).toBe(3)
    expect(countLines('')).toBe(0)
  })

  it('拼给模型：文件在前、用户话在后；没话时给一句默认指令', () => {
    const ctx = buildFileContext({ name: '真题.txt', text: '正文' })
    expect(ctx).toBe('[文件 真题.txt]\n正文')
    expect(composeFileMessage(ctx, '帮我总结')).toBe('[文件 真题.txt]\n正文\n\n---\n帮我总结')
    expect(composeFileMessage(ctx, '')).toContain('请先读一遍上面的文件')
    expect(composeFileMessage('', '只有话')).toBe('只有话')
  })
})

describe('选文件（三端统一形状）', () => {
  it('toPick 归一：path / name / size / mime', () => {
    const p = toPick({ path: 'blob:x', name: 'a.md', size: 12, type: 'text/markdown' })
    expect(p.name).toBe('a.md')
    expect(p.size).toBe(12)
    expect(p.mime).toBe('text/markdown')
    expect(p.file).toBe(null)
  })

  it('toPick 没名字时从路径取，支持反斜杠', () => {
    const p = toPick({ path: 'C:\\tmp\\笔记.txt' })
    expect(p.name).toBe('笔记.txt')
  })

  it('picker 成功：返回 pick；后缀过滤按官方示例带点', async () => {
    let opts0 = null
    global.uni.chooseFile = (opts) => {
      opts0 = opts
      opts.success({
        tempFiles: [{ path: 'blob:1', name: 'a.txt', size: 5, type: 'text/plain' }],
        tempFilePaths: ['blob:1']
      })
    }
    const r = await pickOneFile()
    expect(r.ok).toBe(true)
    expect(r.pick.name).toBe('a.txt')
    expect(opts0.type).toBe('all')
    expect(opts0.extension).toContain('.txt')
    expect(opts0.extension).toContain('.pdf')
    expect(opts0.extension.every(e => e.charAt(0) === '.')).toBe(true)
  })

  it('用户取消：ok=false 且没有 reason（UI 不提示）', async () => {
    global.uni.chooseFile = (opts) => opts.fail({ errMsg: 'cancel' })
    const r = await pickOneFile()
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('')
  })

  it('没选到文件也给出 ok=false', async () => {
    global.uni.chooseFile = (opts) => opts.success({ tempFiles: [] })
    const r = await pickOneFile()
    expect(r.ok).toBe(false)
  })

  it('App 端提示不是空话（写清了两条替代路径）', () => {
    expect(APP_PICK_HINT).toContain('截图')
    expect(APP_PICK_HINT).toContain('粘贴')
  })
})

describe('readPickedFile', () => {
  it('文本文件：本地直读 + 清洗 + 统计', async () => {
    stubLocalFile('\uFEFF第一行\r\n第二行\r\n')
    const r = await readPickedFile({ name: '笔记.txt', path: 'a.txt', size: 100 })
    expect(r.ok).toBe(true)
    expect(r.kind).toBe('text')
    expect(r.text).toBe('第一行\n第二行')
    expect(r.lines).toBe(2)
    expect(fileCardText(r)).toContain('笔记.txt')
    expect(fileCardText(r)).toContain('2 行')
  })

  it('图片走识别通道，不进读文件', async () => {
    const r = await readPickedFile({ name: '截图.png', path: 'a.png', size: 100 })
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('图片按钮')
  })

  it('不支持的格式给替代路径', async () => {
    const r = await readPickedFile({ name: 'app.apk', path: 'a.apk', size: 100 })
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('截图')
    expect(unsupportedHint('image')).toContain('图片按钮')
  })

  it('超过 5MB 直接拒绝，不去读', async () => {
    const r = await readPickedFile({ name: '大.txt', path: 'a.txt', size: MAX_FILE_BYTES + 1 })
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('5.0 MB')
  })

  it('读到空文件说空文件，读到二进制说不是文本', async () => {
    stubLocalFile('')
    let r = await readPickedFile({ name: '空.txt', path: 'a.txt' })
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('空')

    stubLocalFile('abc\u0000\u0001\u0002def')
    r = await readPickedFile({ name: '假.txt', path: 'a.txt' })
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('不是文本文件')
  })

  it('读不到（三端都失败）也说得出原因', async () => {
    stubLocalFile(null)
    const r = await readPickedFile({ name: '读不到.txt', path: 'nope.txt' })
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('读不到')
  })

  it('超长文本截断，卡片上标已截断', async () => {
    stubLocalFile('行内容\n'.repeat(3000))
    const r = await readPickedFile({ name: '长.txt', path: 'a.txt' })
    expect(r.ok).toBe(true)
    expect(r.truncated).toBe(true)
    expect(fileCardText(r)).toContain('已截断')
  })
})

describe('文档解析后端', () => {
  it('注册表与配置裁决：没 Key 时说清去哪儿配', () => {
    const ids = listDocBackends().map(b => b.id)
    expect(ids).toContain('moonshot')
    expect(getDocBackendId()).toBe('moonshot')
    expect(hasOwnDocKey()).toBe(false)
    expect(resolveDocConfig().available).toBe(false)
    expect(docStatusText()).toContain('未配置')
    setDocBackend('nope')
    expect(getDocBackendId()).toBe('moonshot')
  })

  it('没有 Key 时不发上传请求', async () => {
    let uploaded = false
    global.uni.uploadFile = () => { uploaded = true }
    const r = await readPickedFile({ name: '六级.pdf', path: 'a.pdf', size: 1000 })
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('解析 Key')
    expect(uploaded).toBe(false)
  })

  it('有 Key：上传 → 取正文 → 顺手删远端文件', async () => {
    setOwnDocKey('sk-test')
    expect(hasOwnDocKey()).toBe(true)
    expect(docStatusText()).toContain('独立 Key')

    const calls = []
    global.uni.uploadFile = (opts) => {
      calls.push({ kind: 'upload', url: opts.url, purpose: opts.formData.purpose, auth: opts.header.Authorization })
      opts.success({ statusCode: 200, data: JSON.stringify({ id: 'file_1' }) })
    }
    global.uni.request = (opts) => {
      calls.push({ kind: 'content', url: opts.url, method: opts.method || 'GET' })
      opts.success({ statusCode: 200, data: '这是 PDF 里的正文' })
    }

    const r = await readPickedFile({ name: '六级.pdf', path: 'a.pdf', size: 1000 })
    expect(r.ok).toBe(true)
    expect(r.kind).toBe('document')
    expect(r.text).toContain('这是 PDF 里的正文')
    expect(calls[0].url).toContain('/v1/files')
    expect(calls[0].purpose).toBe('file-extract')
    expect(calls[0].auth).toBe('Bearer sk-test')
    expect(calls[1].url).toContain('/v1/files/file_1/content')
    expect(calls.some(c => c.method === 'DELETE')).toBe(true)
  })

  it('上传被拒：把服务端原话带出来', async () => {
    setOwnDocKey('sk-test')
    global.uni.uploadFile = (opts) => opts.success({ statusCode: 401, data: JSON.stringify({ error: { message: 'invalid api key' } }) })
    const r = await readPickedFile({ name: '六级.pdf', path: 'a.pdf', size: 1000 })
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('invalid api key')
  })

  it('取正文失败：提示检查网络，不吐半截结果', async () => {
    setOwnDocKey('sk-test')
    global.uni.uploadFile = (opts) => opts.success({ statusCode: 200, data: JSON.stringify({ id: 'file_1' }) })
    global.uni.request = (opts) => opts.fail({ errMsg: 'request:fail' })
    const r = await readPickedFile({ name: '六级.pdf', path: 'a.pdf', size: 1000 })
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('网络')
  })
})

describe('聊天历史里的文件', () => {
  it('最近一条带文件的消息保留正文，之前的只留卡片', () => {
    const history = buildChatHistory([
      { role: 'user', content: '看看这个', file: { name: '真题.txt' }, fileText: '[文件 真题.txt]\n旧正文' },
      { role: 'assistant', content: '看完了' },
      { role: 'user', content: '再读这个', file: { name: '新笔记.md' }, fileText: '[文件 新笔记.md]\n新正文' },
      { role: 'assistant', content: '好的' }
    ])
    // 旧文件：只留一张卡，正文不再占上下文
    expect(history[0].content).toContain('[已读过文件 真题.txt]')
    expect(history[0].content).not.toContain('旧正文')
    expect(history[0].content).toContain('看看这个')
    // 最近一个文件：正文留着，追问还问得上
    expect(history[2].content).toContain('新正文')
    expect(history[2].content).toContain('再读这个')
  })

  it('没有文件的消息不受影响', () => {
    const history = buildChatHistory([
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '你好呀' }
    ])
    expect(history).toEqual([
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '你好呀' }
    ])
  })
})

/* ==================== 3.10.0：放宽可读类型 + 图片走识别通道 ==================== */

describe('文件类型放宽（3.10.0）', () => {
  it('新增的文本类后缀都能当文本读', () => {
    const added = ['note.mdx', 'doc.rst', 'x.adoc', 'a.org', 'b.ndjson', 'c.xhtml', 'page.svg', 'd.plist', 'sub.ssa', 'e.kts', 'f.cc', 'g.zsh', 'h.cmd', 'i.patch', 'j.diff', 'k.graphql', 'l.proto']
    added.forEach(name => expect(classifyFile(name, '')).toBe('text'))
  })

  it('SVG 按文本读（mime 是 image/svg+xml，但内容是 XML）', () => {
    expect(classifyFile('logo.svg', 'image/svg+xml')).toBe('text')
  })

  it('常见图片仍然走识别通道', () => {
    expect(classifyFile('shot.png', '')).toBe('image')
    expect(classifyFile('photo.HEIC', '')).toBe('image')
    expect(classifyFile('x.jpg', 'image/jpeg')).toBe('image')
  })
})
