/**
 * 轻量加密工具 — 纯 JS 实现 MD5 + HMAC-SHA1 + Base64
 *
 * 基于 Paul Johnston 的经典实现 (pajhome.org.uk/crypt/md5)，BSD License。
 * 替代 crypto-js.min.js（60KB → ~6KB），仅保留讯飞鉴权所需功能。
 * 无外部依赖，全平台兼容（H5 / App / 小程序）。
 * 经过 Node.js crypto 模块验证：MD5/HMAC-SHA1 结果完全一致。
 */

// ==================== Base64 ====================
function base64Encode(bytes) {
  const tab = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let str = ''
  for (let i = 0; i < bytes.length * 4; i += 3) {
    const triplet = (((bytes[i >> 2] >> (8 * (3 - i % 4))) & 0xFF) << 16)
      | (((bytes[i + 1 >> 2] >> (8 * (3 - (i + 1) % 4))) & 0xFF) << 8)
      | ((bytes[i + 2 >> 2] >> (8 * (3 - (i + 2) % 4))) & 0xFF)
    for (let j = 0; j < 4; j++) {
      if (i * 8 + j * 6 > bytes.length * 32) str += '='
      else str += tab.charAt((triplet >> (6 * (3 - j))) & 0x3F)
    }
  }
  return str
}

// ==================== 共用工具 ====================
function safeAdd(x, y) {
  const lsw = (x & 0xFFFF) + (y & 0xFFFF)
  const msw = (x >> 16) + (y >> 16) + (lsw >> 16)
  return (msw << 16) | (lsw & 0xFFFF)
}

function rol(num, cnt) {
  return (num << cnt) | (num >>> (32 - cnt))
}

// 字符串 → little-endian 32位整数数组（MD5 用）
function str2binbLE(str) {
  const bin = []
  for (let i = 0; i < str.length * 8; i += 8) {
    bin[i >> 5] |= (str.charCodeAt(i / 8) & 0xFF) << (i % 32)
  }
  return bin
}

// little-endian 整数数组 → hex 字符串（MD5 用）
function binb2hexLE(binarray) {
  const hexTab = '0123456789abcdef'
  let str = ''
  for (let i = 0; i < binarray.length * 4; i++) {
    str += hexTab.charAt((binarray[i >> 2] >> ((i % 4) * 8 + 4)) & 0xF)
      + hexTab.charAt((binarray[i >> 2] >> ((i % 4) * 8)) & 0xF)
  }
  return str
}

// 字符串 → big-endian 32位整数数组（SHA-1 用）
function str2binb(str) {
  const bin = []
  const mask = 0xFF
  for (let i = 0; i < str.length * 8; i += 8) {
    bin[i >> 5] |= (str.charCodeAt(i / 8) & mask) << (24 - i % 32)
  }
  return bin
}

// big-endian 整数数组 → hex 字符串
function binb2hex(binarray) {
  const hexTab = '0123456789abcdef'
  let str = ''
  for (let i = 0; i < binarray.length * 4; i++) {
    str += hexTab.charAt((binarray[i >> 2] >> ((3 - i % 4) * 8 + 4)) & 0xF)
      + hexTab.charAt((binarray[i >> 2] >> ((3 - i % 4) * 8)) & 0xF)
  }
  return str
}

// ==================== MD5 ====================
function md5core(x, len) {
  x[len >> 5] |= 0x80 << (len % 32)
  x[(((len + 64) >>> 9) << 4) + 14] = len

  let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878

  for (let i = 0; i < x.length; i += 16) {
    const olda = a, oldb = b, oldc = c, oldd = d

    a = md5ff(a, b, c, d, x[i], 7, -680876936); d = md5ff(d, a, b, c, x[i + 1], 12, -389564586)
    c = md5ff(c, d, a, b, x[i + 2], 17, 606105819); b = md5ff(b, c, d, a, x[i + 3], 22, -1044525330)
    a = md5ff(a, b, c, d, x[i + 4], 7, -176418897); d = md5ff(d, a, b, c, x[i + 5], 12, 1200080426)
    c = md5ff(c, d, a, b, x[i + 6], 17, -1473231341); b = md5ff(b, c, d, a, x[i + 7], 22, -45705983)
    a = md5ff(a, b, c, d, x[i + 8], 7, 1770035416); d = md5ff(d, a, b, c, x[i + 9], 12, -1958414417)
    c = md5ff(c, d, a, b, x[i + 10], 17, -42063); b = md5ff(b, c, d, a, x[i + 11], 22, -1990404162)
    a = md5ff(a, b, c, d, x[i + 12], 7, 1804603682); d = md5ff(d, a, b, c, x[i + 13], 12, -40341101)
    c = md5ff(c, d, a, b, x[i + 14], 17, -1502002290); b = md5ff(b, c, d, a, x[i + 15], 22, 1236535329)

    a = md5gg(a, b, c, d, x[i + 1], 5, -165796510); d = md5gg(d, a, b, c, x[i + 6], 9, -1069501632)
    c = md5gg(c, d, a, b, x[i + 11], 14, 643717713); b = md5gg(b, c, d, a, x[i], 20, -373897302)
    a = md5gg(a, b, c, d, x[i + 5], 5, -701558691); d = md5gg(d, a, b, c, x[i + 10], 9, 38016083)
    c = md5gg(c, d, a, b, x[i + 15], 14, -660478335); b = md5gg(b, c, d, a, x[i + 4], 20, -405537848)
    a = md5gg(a, b, c, d, x[i + 9], 5, 568446438); d = md5gg(d, a, b, c, x[i + 14], 9, -1019803690)
    c = md5gg(c, d, a, b, x[i + 3], 14, -187363961); b = md5gg(b, c, d, a, x[i + 8], 20, 1163531501)
    a = md5gg(a, b, c, d, x[i + 13], 5, -1444681467); d = md5gg(d, a, b, c, x[i + 2], 9, -51403784)
    c = md5gg(c, d, a, b, x[i + 7], 14, 1735328473); b = md5gg(b, c, d, a, x[i + 12], 20, -1926607734)

    a = md5hh(a, b, c, d, x[i + 5], 4, -378558); d = md5hh(d, a, b, c, x[i + 8], 11, -2022574463)
    c = md5hh(c, d, a, b, x[i + 11], 16, 1839030562); b = md5hh(b, c, d, a, x[i + 14], 23, -35309556)
    a = md5hh(a, b, c, d, x[i + 1], 4, -1530992060); d = md5hh(d, a, b, c, x[i + 4], 11, 1272893353)
    c = md5hh(c, d, a, b, x[i + 7], 16, -155497632); b = md5hh(b, c, d, a, x[i + 10], 23, -1094730640)
    a = md5hh(a, b, c, d, x[i + 13], 4, 681279174); d = md5hh(d, a, b, c, x[i], 11, -358537222)
    c = md5hh(c, d, a, b, x[i + 3], 16, -722521979); b = md5hh(b, c, d, a, x[i + 6], 23, 76029189)
    a = md5hh(a, b, c, d, x[i + 9], 4, -640364487); d = md5hh(d, a, b, c, x[i + 12], 11, -421815835)
    c = md5hh(c, d, a, b, x[i + 15], 16, 530742520); b = md5hh(b, c, d, a, x[i + 2], 23, -995338651)

    a = md5ii(a, b, c, d, x[i], 6, -198630844); d = md5ii(d, a, b, c, x[i + 7], 10, 1126891415)
    c = md5ii(c, d, a, b, x[i + 14], 15, -1416354905); b = md5ii(b, c, d, a, x[i + 5], 21, -57434055)
    a = md5ii(a, b, c, d, x[i + 12], 6, 1700485571); d = md5ii(d, a, b, c, x[i + 3], 10, -1894986606)
    c = md5ii(c, d, a, b, x[i + 10], 15, -1051523); b = md5ii(b, c, d, a, x[i + 1], 21, -2054922799)
    a = md5ii(a, b, c, d, x[i + 8], 6, 1873313359); d = md5ii(d, a, b, c, x[i + 15], 10, -30611744)
    c = md5ii(c, d, a, b, x[i + 6], 15, -1560198380); b = md5ii(b, c, d, a, x[i + 13], 21, 1309151649)
    a = md5ii(a, b, c, d, x[i + 4], 6, -145523070); d = md5ii(d, a, b, c, x[i + 11], 10, -1120210379)
    c = md5ii(c, d, a, b, x[i + 2], 15, 718787259); b = md5ii(b, c, d, a, x[i + 9], 21, -343485551)

    a = safeAdd(a, olda); b = safeAdd(b, oldb); c = safeAdd(c, oldc); d = safeAdd(d, oldd)
  }
  return [a, b, c, d]
}

function md5cmn(q, a, b, x, s, t) { return safeAdd(rol(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b) }
function md5ff(a, b, c, d, x, s, t) { return md5cmn((b & c) | (~b & d), a, b, x, s, t) }
function md5gg(a, b, c, d, x, s, t) { return md5cmn((b & d) | (c & ~d), a, b, x, s, t) }
function md5hh(a, b, c, d, x, s, t) { return md5cmn(b ^ c ^ d, a, b, x, s, t) }
function md5ii(a, b, c, d, x, s, t) { return md5cmn(c ^ (b | ~d), a, b, x, s, t) }

function md5Hex(str) {
  const x = str2binbLE(str)
  return binb2hexLE(md5core(x, str.length * 8))
}

// ==================== SHA-1 ====================
function sha1Core(x, len) {
  x[len >> 5] |= 0x80 << (24 - len % 32)
  x[((len + 64 >> 9) << 4) + 15] = len

  const w = Array(80)
  let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878, e = -1009589776

  for (let i = 0; i < x.length; i += 16) {
    const olda = a, oldb = b, oldc = c, oldd = d, olde = e

    for (let j = 0; j < 80; j++) {
      if (j < 16) w[j] = x[i + j]
      else w[j] = rol(w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16], 1)

      const t = safeAdd(safeAdd(rol(a, 5), sha1Ft(j, b, c, d)),
        safeAdd(safeAdd(e, w[j]), sha1Kt(j)))
      e = d; d = c; c = rol(b, 30); b = a; a = t
    }

    a = safeAdd(a, olda); b = safeAdd(b, oldb); c = safeAdd(c, oldc)
    d = safeAdd(d, oldd); e = safeAdd(e, olde)
  }
  return [a, b, c, d, e]
}

function sha1Ft(t, b, c, d) {
  if (t < 20) return (b & c) | (~b & d)
  if (t < 40) return b ^ c ^ d
  if (t < 60) return (b & c) | (b & d) | (c & d)
  return b ^ c ^ d
}

function sha1Kt(t) {
  return (t < 20) ? 1518500249 : (t < 40) ? 1859775393 :
    (t < 60) ? -1894007588 : -899497514
}

function coreHmacSha1(key, data) {
  let bkey = str2binb(key)
  if (bkey.length > 16) bkey = sha1Core(bkey, key.length * 8)

  const ipad = Array(16), opad = Array(16)
  for (let i = 0; i < 16; i++) {
    ipad[i] = bkey[i] ^ 0x36363636
    opad[i] = bkey[i] ^ 0x5C5C5C5C
  }

  const hash = sha1Core(ipad.concat(str2binb(data)), 512 + data.length * 8)
  return sha1Core(opad.concat(hash), 512 + 160)
}

// ==================== 对外 API ====================
export function md5HexStr(str) {
  return md5Hex(str)
}

export function hmacSha1Base64(key, message) {
  return base64Encode(coreHmacSha1(key, message))
}
