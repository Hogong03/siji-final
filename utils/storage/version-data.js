/**
 * 版本历史默认数据（聚合入口）
 *
 * 数据按大版本分段存放于 utils/storage/version-log/，每段是纯数组（新版本在前）。
 * 新增版本记录：写对应段文件顶部（最新段为 version-log/4.17.js），本文件只需在 getDefaultHistory 顶部加一段。
 * 分段原因：原单文件 2065 行，超出项目 300 行红线。
 * 4.10.7 发布前整合：各小版本线（2.2/2.3/3.4/3.5/3.6/3.7/3.10/4.0/4.1/4.2/4.3/4.5/4.7/4.8/4.9/4.10）
 * 的补丁条目已各自合并为单条，原 2.2-early/late、2.3-early/late、3.5-early 分段文件已删。
 */

import { V422 } from './version-log/4.22.js'
import { V421 } from './version-log/4.21.js'
import { V420 } from './version-log/4.20.js'
import { V419 } from './version-log/4.19.js'
import { V418 } from './version-log/4.18.js'
import { V417 } from './version-log/4.17.js'
import { V416 } from './version-log/4.16.js'
import { V414 } from './version-log/4.14.js'
import { V413 } from './version-log/4.13.js'
import { V412 } from './version-log/4.12.js'
import { V411 } from './version-log/4.11.js'
import { V410 } from './version-log/4.10.js'
import { V49 } from './version-log/4.9.js'
import { V48 } from './version-log/4.8.js'
import { V47 } from './version-log/4.7.js'
import { V46 } from './version-log/4.6.js'
import { V45 } from './version-log/4.5.js'
import { V44 } from './version-log/4.4.js'
import { V43 } from './version-log/4.3.js'
import { V42 } from './version-log/4.2.js'
import { V40 } from './version-log/4.0.js'
import { V310 } from './version-log/3.10.js'
import { V39 } from './version-log/3.9.js'
import { V38 } from './version-log/3.8.js'
import { V37 } from './version-log/3.7.js'
import { V36 } from './version-log/3.6.js'
import { V35 } from './version-log/3.5.js'
import { V34 } from './version-log/3.4.js'
import { V30_33 } from './version-log/3.0-3.3.js'
import { V23 } from './version-log/2.3.js'
import { V22 } from './version-log/2.2.js'
import { V20_21 } from './version-log/2.0-2.1.js'
import { V1X } from './version-log/1.x.js'

export function getDefaultHistory() {
  return [
    ...V422,
    ...V421,
    ...V420,
    ...V419,
    ...V418,
    ...V417,
    ...V416,
    ...V414,
    ...V413,
    ...V412,
    ...V411,
    ...V410,
    ...V49,
    ...V48,
    ...V47,
    ...V46,
    ...V45,
    ...V44,
    ...V43,
    ...V42,
    ...V40,
    ...V310,
    ...V39,
    ...V38,
    ...V37,
    ...V36,
    ...V35,
    ...V34,
    ...V30_33,
    ...V23,
    ...V22,
    ...V20_21,
    ...V1X,
  ]
}
