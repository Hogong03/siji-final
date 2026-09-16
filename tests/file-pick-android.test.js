/**
 * Android 系统文件选择（3.7.5 起，3.7.8 加固）
 *
 * 真机踩坑顺序（每一版都是真机反馈驱动）：
 *   3.7.5 首次实现：plus.android 调 ACTION_GET_CONTENT + FileChannel 拷进沙盒
 *   3.7.6 真机「拷贝失败」→ ① convertLocalFileSystemURL 可能给 file:// URL（FileOutputStream 只认裸路径）
 *                        ② content:// 的流未必支持 getChannel → 字节数组流拷贝优先，文本另留 inlineText 兜底
 *   3.7.7 真机「拷贝失败（open-input）」→ Uri 被 String() 字符串化，必须传 Java 对象；开流三级
 *   3.7.8 真机「open-all-failed」→ 三种开流全在 resolver 层失败 = 类没导入 → invokeSafe（直接调不通就
 *        plus.android.invoke）+ 逐个 importClass + plus.io 直读 content:// 的文本兜底
 *
 * 真机行为仍必须实测：onActivityResult 回调、真实 provider 的开流与拷贝，单测只能覆盖编排与分支。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import './setup.js'
import {
  safeFileName, uploadRelPath, toNativePath, isAndroidRuntime, pickFileViaAndroid,
  copyContentUriToSandbox, REQ_PICK_FILE, UPLOAD_DIR
} from '../utils/files/android-picker.js'
import { readPickedFile } from '../utils/files/index.js'
import { pickOneFile, appPickRoute, APP_PICK_HINT } from '../utils/files/picker.js'

const PDF_META = { name: '真题.pdf', size: 4096, mime: 'application/pdf' }

/* ==================== 纯函数 ==================== */

describe('纯函数：文件名消毒 / 落地路径 / 路径归一', () => {
  it('非法字符换成下划线，路径分隔符不会被带进来', () => {
    expect(safeFileName('../../etc/passwd')).toBe('passwd')
    expect(safeFileName('a:b*c?d"e<f>g|h.txt')).toBe('a_b_c_d_e_f_g_h.txt')
    expect(safeFileName('报告 2026.pdf')).toBe('报告 2026.pdf')
  })

  it('空名字 / 全是非法字符时有兜底名', () => {
    expect(safeFileName('')).toBe('file')
    expect(safeFileName('///')).toBe('file')
    expect(safeFileName(null)).toBe('file')
  })

  it('超长名字截断但保留后缀', () => {
    const out = safeFileName('x'.repeat(200) + '.pdf')
    expect(out.length).toBeLessThanOrEqual(80)
    expect(out.endsWith('.pdf')).toBe(true)
  })

  it('落地路径带时间戳前缀，同名学生不会互相覆盖', () => {
    expect(uploadRelPath('报告.txt', 1700000000000)).toBe('_doc/' + UPLOAD_DIR + '/1700000000000_报告.txt')
    expect(uploadRelPath('报告.txt', 1700000000001)).not.toBe(uploadRelPath('报告.txt', 1700000000000))
  })

  it('toNativePath：file:// 前缀必须去掉（真机拷贝失败的第一嫌疑人）', () => {
    expect(toNativePath('file:///storage/emulated/0/doc/a.txt')).toBe('/storage/emulated/0/doc/a.txt')
    expect(toNativePath('/storage/emulated/0/doc/a.txt')).toBe('/storage/emulated/0/doc/a.txt')
    expect(toNativePath('  file:///a/b.txt ')).toBe('/a/b.txt')
    expect(toNativePath('')).toBe('')
  })
})

describe('isAndroidRuntime：没 plus 的环境一律 false', () => {
  const original = global.plus
  afterEach(() => { global.plus = original })

  it('plus 不存在 / 不是 Android 都返回 false', () => {
    delete global.plus
    expect(isAndroidRuntime()).toBe(false)
    global.plus = { os: { name: 'iOS' } }
    expect(isAndroidRuntime()).toBe(false)
    global.plus = { os: { name: 'Android' } }
    expect(isAndroidRuntime()).toBe(true)
  })
})

describe('pickOneFile 路由：Android 走选择器，其余给提示', () => {
  const original = global.plus
  afterEach(() => { global.plus = original })

  it('没有 plus（H5 / 单测环境）时不会误入 Android 分支', async () => {
    delete global.plus
    const r = await pickOneFile()
    expect(r.ok).toBe(false)
  })

  it('去向判定：Android → 选择器，其余 → 提示（条件编译让 pickOneFile 在单测里先返回 H5 分支，所以直接测决策点）', () => {
    expect(appPickRoute(true)).toBe('android')
    expect(appPickRoute(false)).toBe('hint')
    expect(APP_PICK_HINT).toContain('截图')
    expect(APP_PICK_HINT).toContain('粘贴')
  })
})

/* ==================== 假 plus ==================== */

/**
 * 假 plus：把「选 → 描述 → 开流 → 拷贝 → 校验 → 返回」整条链跑通
 * 开关（都是真机上出现过的情形）：
 *   cancel           用户取消
 *   clipOnly         getData 为空，Uri 在 ClipData 里
 *   openFails        openInputStream 抛异常（3.7.7 的 fd 链、3.7.8 的兜底都靠它）
 *   openReturnsNull  openInputStream 返回 null
 *   onlyFd           openFileDescriptor 可用
 *   readFails        流的 read 抛异常（拷贝失败但能开流）
 *   noByteBuffer     newObject('[B') 返回 null（只能走 channel）
 *   channelMoves     transferFrom 返回 0
 *   verifySize       校验时报告的字节数（0 = 空文件）
 *   textLines        文本直读能读出几行
 *   plusIoText       plus.io 直读 content:// 能拿到的正文（3.7.8 兜底）
 *   invokeFails      直接调对象方法一律抛（模拟「类没导入」，只有 plus.android.invoke 可用）
 */
function fakePlus(options = {}) {
  const calls = { started: [], copied: [], openedWith: [], invoked: [], imported: [] }
  const uri = options.uri || { uri: 'content://com.android.providers.downloads/document/42' }
  const meta = options.meta || { name: '六级真题.txt', size: 2048, mime: 'text/plain' }

  const resolver = {
    getType: () => meta.mime,
    query: () => ({
      moveToFirst: () => true,
      getColumnIndex: (k) => (k === '_display_name' ? 0 : 1),
      getString: (i) => (i === 0 ? meta.name : String(meta.size)),
      close: () => {}
    }),
    openInputStream: (u) => {
      calls.openedWith.push(u)
      if (options.openFails) throw new Error('security-denied')
      if (options.openReturnsNull) return null
      return {
        getChannel: () => ({ close() {} }),
        available: () => meta.size,
        read: function (buf, off, len) {
          if (options.readFails) throw new Error('read-denied')
          if (this.__done) return -1
          this.__done = true
          return Math.min(meta.size, len)
        },
        close() {}
      }
    },
    openFileDescriptor: () => (options.onlyFd ? { getFileDescriptor: () => ({ fd: 1 }), close() {} } : null),
    openAssetFileDescriptor: () => null
  }

  const runtime = {
    // 类没导入时，连 resolver 的方法都直接调不通（真机就是这种表现）
    getContentResolver: () => (options.invokeFails ? guard(resolver) : resolver),
    startActivityForResult(intent, code) {
      calls.started.push(code)
      if (typeof this.onActivityResult === 'function') {
        this.onActivityResult(code, options.cancel ? 0 : -1, {
          getData: () => (options.clipOnly ? null : uri),
          getClipData: () => (options.clipOnly ? { getItemAt: () => ({ getUri: () => uri }) } : null)
        })
      }
    },
    onActivityResult: null
  }

  /**
   * 直接调对象方法时抛错（模拟「类没导入」），但把原对象挂在 __raw 上 ——
   * 真机上 plus.android.invoke(obj, ...) 不需要导入类就能调到方法，所以走 invoke 时要能拿到原对象
   */
  function guard(obj) {
    if (!options.invokeFails) return obj
    return new Proxy(obj, {
      get(target, prop) {
        if (prop === '__raw') return target
        if (typeof target[prop] === 'function') {
          return () => { throw new Error('method-not-imported') }
        }
        return target[prop]
      }
    })
  }

  function importClassImpl(name) {
    if (name === 'android.content.Intent') {
      const Intent = function (action) { this.action = action; this.category = ''; this.type = '' }
      Intent.ACTION_GET_CONTENT = 'android.intent.action.GET_CONTENT'
      Intent.CATEGORY_OPENABLE = 'android.intent.category.OPENABLE'
      Intent.prototype.addCategory = function (c) { this.category = c }
      Intent.prototype.setType = function (t) { this.type = t }
      return Intent
    }
    if (name === 'java.io.FileOutputStream') {
      return function (path) {
        this.path = path
        this.getChannel = () => ({
          transferFrom: (inCh, pos, count) => {
            calls.copied.push({ via: 'channel', path, count })
            return options.channelMoves === 0 ? 0 : count
          },
          write: () => {},
          close: () => {}
        })
        this.write = () => { calls.copied.push({ via: 'stream', path }) }
        this.flush = () => {}
        this.close = () => {}
      }
    }
    if (name === 'java.io.FileInputStream') {
      return function () {
        this.getChannel = () => ({ close() {} })
        this.available = () => meta.size
        this.read = function (buf, off, len) {
          if (this.__done) return -1
          this.__done = true
          return Math.min(meta.size, len)
        }
        this.close = () => {}
      }
    }
    if (name === 'java.io.BufferedReader' || name === 'java.io.InputStreamReader') {
      return function () {
        let served = 0
        this.readLine = () => (served++ < (options.textLines || 0) ? 'line' + served : null)
        this.close = () => {}
      }
    }
    return function () {}
  }

  const that = {
    os: { name: 'Android' },
    android: {
      runtimeMainActivity: () => (options.invokeFails ? new Proxy(runtime, {
        get(target, prop) {
          if (typeof target[prop] === 'function') return (...args) => target[prop].apply(runtime, args)
          return target[prop]
        }
      }) : runtime),
      importClass: (name) => { calls.imported.push(name); return importClassImpl(name) },
      invoke: (obj, method, ...args) => {
        calls.invoked.push(method)
        // 真机的 plus.android.invoke 不需要导入类：这里取原对象（guard 代理把原对象挂在 __raw）
        const target = (obj && obj.__raw) || obj
        try {
          if (target && typeof target[method] === 'function') return target[method].apply(target, args)
        } catch (e) { /* 真机同样会抛 */ }
        return undefined
      },
      newObject: () => (options.noByteBuffer ? null : { sig: '[B' })
    },
    io: {
      PRIVATE_DOC: 'PRIVATE_DOC',
      requestFileSystem: (type, ok) => ok({ root: { getDirectory: (n, o, cb) => cb({}) } }),
      convertLocalFileSystemURL: (rel) => (options.fileUrl ? 'file://' : '') + '/storage/emulated/0/Android/data/app/doc/' + rel.replace('_doc/', ''),
      resolveLocalFileSystemURL: (rel, ok, fail) => {
        if (options.plusIoFails && String(rel).indexOf('content://') === 0) { fail && fail(); return }
        if (options.plusIoText && String(rel).indexOf('content://') === 0) {
          const text = options.plusIoText
          ok({ file: (cb) => cb({ size: text.length, __text: text }) })
          return
        }
        ok({ file: (cb) => cb({ size: options.verifySize === undefined ? meta.size : options.verifySize }) })
      }
    }
  }
  that.__guard = guard
  return { plus: that, calls }
}

/* ==================== 选文件主流程 ==================== */

describe('pickFileViaAndroid：选 → 拷 → 交回沙盒路径', () => {
  const original = global.plus
  beforeEach(() => { global.plus = null })
  afterEach(() => { global.plus = original })

  it('选中一个 txt：返回沙盒相对路径 + 绝对路径 + 消毒后的名字', async () => {
    const fakeUri = { uri: 'content://doc/42' }
    const { plus: fake, calls } = fakePlus({ textLines: 2, uri: fakeUri })
    global.plus = fake
    const r = await pickFileViaAndroid()
    expect(r.ok).toBe(true)
    expect(r.pick.path.startsWith('_doc/' + UPLOAD_DIR + '/')).toBe(true)
    expect(r.pick.path.endsWith('_六级真题.txt')).toBe(true)
    expect(r.pick.absPath.startsWith('/storage/emulated/0/')).toBe(true)
    expect(r.pick.name).toBe('六级真题.txt')
    expect(r.pick.size).toBe(2048)
    expect(r.pick.mime).toBe('text/plain')
    expect(calls.started).toEqual([REQ_PICK_FILE])
    // 3.7.7 回归点：喂给 openInputStream 的必须是 getData() 那个对象本身，不能是 String(uri)
    expect(calls.openedWith.length).toBeGreaterThan(0)
    expect(calls.openedWith[0]).toBe(fakeUri)
    expect(typeof calls.openedWith[0]).toBe('object')
    // 真的拷了（字节数组策略）
    expect(calls.copied.some(c => c.via === 'stream')).toBe(true)
    expect(r.pick.inlineText).toBe('line1\nline2')
  })

  it('用户取消：静默返回，不带提示文案', async () => {
    const { plus: fake } = fakePlus({ cancel: true })
    global.plus = fake
    const r = await pickFileViaAndroid()
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('')
  })

  it('超过 5MB：先拦下来，不拷贝', async () => {
    const { plus: fake, calls } = fakePlus({ meta: { name: '大文件.pdf', size: 9 * 1024 * 1024, mime: 'application/pdf' } })
    global.plus = fake
    const r = await pickFileViaAndroid()
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('超过')
    expect(calls.copied.length).toBe(0)
  })

  it('非 Android 环境直接返回，不抛异常', async () => {
    global.plus = { os: { name: 'iOS' } }
    const r = await pickFileViaAndroid()
    expect(r.ok).toBe(false)
  })
})

/* ==================== 3.7.6：路径归一 + 文本兜底 ==================== */

describe('3.7.6：路径归一并能拷成功 / 文本兜底 / 失败可定位', () => {
  const original = global.plus
  afterEach(() => { global.plus = original })

  it('convertLocalFileSystemURL 给 file:// URL 时，归一化后仍能拷成功', async () => {
    const { plus: fake, calls } = fakePlus({ fileUrl: true, textLines: 2 })
    global.plus = fake
    const r = await pickFileViaAndroid()
    expect(r.ok).toBe(true)
    expect(calls.copied.some(c => c.via === 'stream')).toBe(true)
  })

  it('文本类文件：拷贝彻底失败也能靠 inlineText 读进来（path 置空）', async () => {
    const { plus: fake } = fakePlus({ readFails: true, noByteBuffer: true, channelMoves: 0, textLines: 3, verifySize: 0 })
    global.plus = fake
    const r = await pickFileViaAndroid()
    expect(r.ok).toBe(true)
    expect(r.pick.inlineText).toContain('line1')
    expect(r.pick.path).toBe('')
    const read = await readPickedFile(r.pick)
    expect(read.ok).toBe(true)
    expect(read.text).toContain('line1')
  })

  it('二进制文件拷贝失败：如实报错并带上失败阶段', async () => {
    const { plus: fake } = fakePlus({ readFails: true, noByteBuffer: true, channelMoves: 0, verifySize: 0, meta: PDF_META })
    global.plus = fake
    const r = await pickFileViaAndroid()
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('拷贝失败')
    expect(r.reason).toContain('stream-fail')
  })

  it('拷完是 0 字节：当失败处理（不再把空文件当成功）', async () => {
    const { plus: fake } = fakePlus({ verifySize: 0, meta: PDF_META })
    global.plus = fake
    const r = await pickFileViaAndroid()
    expect(r.ok).toBe(false)
  })
})

/* ==================== 3.7.7：Uri 对象 + 开流三级 ==================== */

describe('3.7.7：Uri 传对象 + 开流三级 + ClipData', () => {
  const original = global.plus
  afterEach(() => { global.plus = original })

  it('Uri 不是字符串：String() 出来的东西喂回 openInputStream 必然失败，现在传对象本身', async () => {
    const uri = { uri: 'content://media/1', toString: () => '[object Object]' }
    const { plus: fake, calls } = fakePlus({ uri: uri, textLines: 1 })
    global.plus = fake
    const r = await pickFileViaAndroid()
    expect(r.ok).toBe(true)
    calls.openedWith.forEach((u) => expect(typeof u).toBe('object'))
  })

  it('openInputStream 抛异常时退到 openFileDescriptor + FileInputStream，照样拷成功', async () => {
    const { plus: fake, calls } = fakePlus({ openFails: true, onlyFd: true, textLines: 1 })
    global.plus = fake
    const r = await pickFileViaAndroid()
    expect(r.ok).toBe(true)
    expect(calls.copied.some(c => c.via === 'stream')).toBe(true)
  })

  it('getData 为空时退到 ClipData 取 Uri', async () => {
    const uri = { uri: 'content://clip/9' }
    const { plus: fake } = fakePlus({ uri: uri, clipOnly: true, textLines: 1 })
    global.plus = fake
    const r = await pickFileViaAndroid()
    expect(r.ok).toBe(true)
  })

  it('三级都打不开（二进制）：报错给出可执行建议', async () => {
    const { plus: fake } = fakePlus({ openFails: true, verifySize: 0, meta: PDF_META })
    global.plus = fake
    const r = await pickFileViaAndroid()
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('打不开这个文件')
    expect(r.reason).toContain('保存到手机')
  })
})

/* ==================== 3.7.8：invoke 兜底 + plus.io 兜底 ==================== */

describe('3.7.8：类没导入（直接调不通）时靠 plus.android.invoke + plus.io 兜底', () => {
  const original = global.plus
  afterEach(() => { global.plus = original })

  it('直接调对象方法一律抛错时，plus.android.invoke 仍能把流程走通', async () => {
    const { plus: fake, calls } = fakePlus({ invokeFails: true, textLines: 2 })
    global.plus = fake
    const r = await pickFileViaAndroid()
    expect(r.ok).toBe(true)
    // 走了 invoke（而不是直接调用）
    expect(calls.invoked.length).toBeGreaterThan(0)
    expect(calls.invoked).toContain('openInputStream')
  })

  it('ContentResolver 与 Uri 的类会被 importClass（3.7.8 的真因）', async () => {
    const { plus: fake, calls } = fakePlus({ textLines: 1 })
    global.plus = fake
    await pickFileViaAndroid()
    expect(calls.imported).toContain('android.content.ContentResolver')
    expect(calls.imported).toContain('android.net.Uri')
  })

  it('resolver 三条路全败但 plus.io 能解析 content:// → 文本仍读得进来', async () => {
    const { plus: fake } = fakePlus({
      openFails: true, verifySize: 0, textLines: 0,
      plusIoText: '第一行\n第二行'
    })
    // 让 plus.io 的 FileReader 也能给出文本：直接用被测代码里的 readAsText 路径
    fake.io.resolveLocalFileSystemURL = (rel, ok, fail) => {
      if (String(rel).indexOf('content://') === 0) {
        ok({
          file: (cb) => cb({ size: 11 }),
          // 老实现走 entry.file + FileReader；这里直接给 file 让 readAsText 拿到内容
        })
        return
      }
      ok({ file: (cb) => cb({ size: 0 }) })
    }
    // 假 FileReader 返回写死的文本
    fake.io.__text = '第一行\n第二行'
    global.plus = Object.assign({}, fake, {
      io: Object.assign({}, fake.io, {
        FileReader: function () {
          this.readAsText = () => { this.onloadend({ target: { result: '第一行\n第二行' } }) }
        }
      })
    })
    const r = await pickFileViaAndroid()
    expect(r.ok).toBe(true)
    expect(r.pick.inlineText).toContain('第一行')
    expect(r.pick.path).toBe('')
  })

  it('open-all-failed 的阶段名里带上「试过哪三级」，一份报错就能定位', async () => {
    global.plus = {
      os: { name: 'Android' },
      io: { convertLocalFileSystemURL: (rel) => '/abs/' + rel },
      android: {
        runtimeMainActivity: () => ({ getContentResolver: () => ({ openInputStream: () => null }) }),
        invoke: (obj, method) => { try { return obj[method]() } catch (e) { return undefined } },
        importClass: () => function () {}
      }
    }
    const r = await copyContentUriToSandbox('content://x', '_doc/upload/a.txt')
    expect(r.ok).toBe(false)
    expect(r.stage).toContain('open-all-failed')
    expect(r.stage).toContain('openInputStream/openFileDescriptor/openAssetFileDescriptor')
    expect(r.stage).toContain('content://x')
  })

  it('路径解析不出来时阶段名是 resolve-path，不误报成开流失败', async () => {
    global.plus = {
      os: { name: 'Android' },
      io: { convertLocalFileSystemURL: () => '' },
      android: { runtimeMainActivity: () => ({ getContentResolver: () => ({ openInputStream: () => null }) }) }
    }
    const r = await copyContentUriToSandbox('content://x', '_doc/upload/a.txt')
    expect(r.stage).toBe('resolve-path')
  })

  it('取不到输入流且没有其它能力时，不抛异常、返回失败', async () => {
    global.plus = {
      os: { name: 'Android' },
      io: { convertLocalFileSystemURL: (rel) => '/abs/' + rel },
      android: { runtimeMainActivity: () => ({ getContentResolver: () => ({ openInputStream: () => null }) }) }
    }
    const r = await copyContentUriToSandbox('content://x', '_doc/upload/a.txt')
    expect(r.ok).toBe(false)
  })
})