/**
 * 版本历史默认数据（聚合入口）
 *
 * 数据按大版本分段存放于 utils/storage/version-log/，每段是纯数组（新版本在前）。
 * 新增版本记录：写对应段文件顶部（最新段为 version-log/4.0.js），本文件只需在 getDefaultHistory 顶部加一段。
 * 分段原因：原单文件 2065 行，超出项目 300 行红线。
 */

import { V40 } from './version-log/4.0.js'
import { V310 } from './version-log/3.10.js'
import { V39 } from './version-log/3.9.js'
import { V38 } from './version-log/3.8.js'
import { V37 } from './version-log/3.7.js'
import { V36 } from './version-log/3.6.js'
import { V35 } from './version-log/3.5.js'
import { V35_EARLY } from './version-log/3.5-early.js'
import { V34 } from './version-log/3.4.js'
import { V30_33 } from './version-log/3.0-3.3.js'
import { V23_LATE } from './version-log/2.3-late.js'
import { V23_EARLY } from './version-log/2.3-early.js'
import { V22_LATE } from './version-log/2.2-late.js'
import { V22_EARLY } from './version-log/2.2-early.js'
import { V20_21 } from './version-log/2.0-2.1.js'
import { V1X } from './version-log/1.x.js'

export function getDefaultHistory() {
  return [
    ...V40,
    ...V310,
    ...V39,
    ...V38,
    ...V37,
    ...V36,
    ...V35,
    ...V35_EARLY,
    ...V34,
    ...V30_33,
    ...V23_LATE,
    ...V23_EARLY,
    ...V22_LATE,
    ...V22_EARLY,
    ...V20_21,
    ...V1X,
  ]
}
