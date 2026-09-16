/**
 * Android 系统文件选择（3.7.5）
 *
 * 之前 App 端点「文件」只会弹一句提示（uni.chooseFile 官方不支持，需原生插件）。
 * 这一版用 plus.android 调 Android 系统选择器（ACTION_GET_CONTENT）——零插件、零存储权限，
 * 选完把 content:// 的内容用 FileChannel 拷进沙盒，之后沿用既有 plus.io 读法。
 *
 * 本文件用假 plus 覆盖编排与分支；**真机行为必须实测**（onActivityResult 回调与真实拷贝）。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import './setup.js'
import {
  safeFileName, uploadRelPath, isAndroidRuntime, pickFileViaAndroid,
  copyContentUriToSandbox, REQ_PICK_FILE, UPLOAD_DIR
} from '../utils/files/android-picker.js'
import { pickOneFile, appPickRoute, APP_PICK_HINT } from '../utils/files/picker.js'

describe('纯函数：文件名消毒与落地路径', () => {
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
    const long = 'x'.repeat(200) + '.pdf'
    const out = safeFileName(long)
    expect(out.length).toBeLessThanOrEqual(80)
    expect(out.endsWith('.pdf')).toBe(true)
  })

  it('落地路径带时间戳前缀，同名学生不会互相覆盖', () => {
    expect(uploadRelPath('报告.txt', 1700000000000)).toBe('_doc/' + UPLOAD_DIR + '/1700000000000_报告.txt')
    expect(uploadRelPath('报告.txt', 1700000000001)).not.toBe(uploadRelPath('报告.txt', 1700000000000))
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

describe('pickOneFile 路由：Android 走选择器，其它平台给提示', () => {
  const original = global.plus
  afterEach(() => { global.plus = original })

  it('没有 plus（H5 / 单测环境）时不会误入 Android 分支', () => {
    delete global.plus
    // vitest 下 pickOneFile 走 H5 分支（uni.chooseFile 不存在 → 直接返回不支持）
    return pickOneFile().then((r) => {
      expect(r.ok).toBe(false)
    })
  })

  it('App 端的去向判定：Android 走选择器，其余给提示（条件编译让 pickOneFile 在单测里先返回 H5 分支，所以直接测决策点）', () => {
    expect(appPickRoute(true)).toBe('android')
    expect(appPickRoute(false)).toBe('hint')
    // 提示里必须给两条立刻能做的路
    expect(APP_PICK_HINT).toContain('截图')
    expect(APP_PICK_HINT).toContain('粘贴')
  })
})

/** 假 plus：把「选 → 描述 → 拷贝 → 返回」这条链跑通 */
function fakePlus(options = {}) {
  const calls = { started: [], requested: 0, copied: [] }
  const uri = options.uri || 'content://com.android.providers.downloads/document/42'
  const meta = options.meta || { name: '六级真题.txt', size: 2048, mime: 'text/plain' }

  function activity() {
    return {
      getContentResolver() {
        return {
          getType: () => meta.mime,
          query: () => ({
            moveToFirst: () => true,
            getColumnIndex: (k) => (k === '_display_name' ? 0 : 1),
            getString: (i) => (i === 0 ? meta.name : String(meta.size)),
            close: () => {}
          }),
          openInputStream: () => ({ getChannel: () => ({ close() {} }), available: () => meta.size, close() {} })
        }
      },
      // 模拟用户选完：回来后由被测代码挂上的 onActivityResult 接管（用 this 取，拿到的就是它）
      startActivityForResult(intent, code) {
        calls.started.push(code)
        calls.requested++
        if (typeof this.onActivityResult === 'function') {
          this.onActivityResult(code, options.cancel ? 0 : -1, { getData: () => uri })
        }
      },
      // 由被测代码覆盖
      onActivityResult: null
    }
  }

  const runtime = activity()
  const that = {
    os: { name: 'Android' },
    android: {
      runtimeMainActivity: () => runtime,
      importClass: (name) => {
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
            this.getChannel = () => ({
              transferFrom: (inCh, pos, count) => { calls.copied.push({ path, count }); return count },
              write: () => {},
              close: () => {}
            })
            this.close = () => {}
            calls.copied.push({ open: path })
          }
        }
        return function () {}
      },
      newObject: () => ({})
    },
    io: {
      PRIVATE_DOC: 'PRIVATE_DOC',
      requestFileSystem: (type, ok) => ok({ root: { getDirectory: (n, o, cb) => cb({}) } }),
      convertLocalFileSystemURL: (rel) => '/storage/emulated/0/Android/data/app/doc/' + rel.replace('_doc/', '')
    }
  }
  return { plus: that, calls }
}

describe('pickFileViaAndroid：选 → 拷 → 交回沙盒路径', () => {
  const original = global.plus
  beforeEach(() => { global.plus = null })
  afterEach(() => { global.plus = original })

  it('选中一个 txt：返回沙盒相对路径 + 绝对路径 + 消毒后的名字', async () => {
    const { plus: fake, calls } = fakePlus()
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
    // 真的调了拷贝（transferFrom），不是只返回了个路径
    expect(calls.copied.some(c => c.count === 2048)).toBe(true)
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

describe('copyContentUriToSandbox：失败不炸', () => {
  const original = global.plus
  afterEach(() => { global.plus = original })

  it('取不到 session 时返回 false', () => {
    global.plus = { os: { name: 'Android' }, android: { runtimeMainActivity: () => ({ getContentResolver: () => ({ openInputStream: () => null }) }) } }
    expect(copyContentUriToSandbox('content://x', '_doc/upload/a.txt')).toBe(false)
  })
})