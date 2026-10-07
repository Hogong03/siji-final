/**
 * bkd-handbook.js — 内置的 BKD 项目技术学习手册（4.19.0）
 *
 * 项目：vue-basic-dev-platform-tenant-pc（科皓 bkd，安全生产智能化管控平台租户 PC 端）。
 * 实测档案：Vue 2.6 + Element UI 2 + vue-cli5(webpack5)，纯 JS 全 Options API，
 * src 下 3755 个文件（1769 个 .vue 约 60 万行），菜单/路由/页面全部由后端下发，
 * 业务页面由表单引擎按 formId 动态渲染 —— 阅读方法与常规后台项目完全不同。
 *
 * 种子数据的规矩（与已下线的六级种子同一套）：
 *   - 每条带 seed: 'bkd-handbook' 与 seed_v，本文件是唯一来源
 *   - ensureBkdHandbook() 幂等补发：缺的补、旧版（seed_v 小）的刷新
 *   - 用户删掉的（is_deleted=1）不复活、不刷新
 *
 * 复习入口：记录 → 标签「技术手册」→ 点开 → 右上「阅读」。
 */
import { getRawList, getMonthFromDate } from './helpers.js'
import { asyncSetStorageJSON } from '../store-helpers.js'
import { addCustomTag } from './tags.js'

/** 手册的标签：在记录页按这个标签筛 */
export const BKD_TAG = '技术手册'

/** 标签种类（学习） */
export const BKD_TAG_CATEGORY = 'study'

/** 种子标记与版本（改内容就 +1，ensureBkdHandbook 据此刷新） */
export const BKD_SEED_MARK = 'bkd-handbook'
export const BKD_SEED_VERSION = 1

/* ────────────────────────── 第一篇：阅读方法 ────────────────────────── */

const READ_PATH = [
  '# BKD 阅读方法：从跑起来到看懂一条业务流',
  '',
  '对象：vue-basic-dev-platform-tenant-pc（页面标题「安全生产智能化管控平台」）。',
  '它是多租户低代码平台型前端：**菜单、路由、页面全部由后端下发**，大量业务页面由表单引擎按 formId 动态渲染。',
  '所以传统后台项目「打开路由表就能找到页面」的读法在这里完全失效 —— 先建立这个认知，再按下面的顺序读。',
  '',
  '## 一、先跑起来（半天）',
  '1. 改 src/config/devServer.js 的 targetServer 指向可达的后端（当前注释标注「多企业」环境）。',
  '2. npm run dev（端口 9001；脚本自带大内存参数，webpack5 已开文件系统持久化缓存）。',
  '3. 登录不在本前端 —— 走 CAS 单点登录 + 服务端 Cookie 会话。后端不通会一直跳转失败，先跟后端要测试账号。',
  '4. 注意 npm run system 是坏脚本（指向的 src/router/system 目录不存在），别在它身上耗时间。',
  '',
  '## 二、十步阅读路径（每步都有明确产出）',
  '**第 1 步 src/main.js**（86 行，10 分钟）：入口注册了 ElementUI/Vant 和 4 个 KH 插件（KHConfig/KHHttp/KHUtils/KHForm），全局组件 SingleTable，末尾 import permission。记住「KH 前缀 = 公司自研封装」。',
  '**第 2 步 src/App.vue 的 created()**：getUser 拉用户与企业列表（companyInfoList / currentCompanyId），租户信息从这里进 vuex；baseConfig.json 与后端下发的系统配置表也在这读。',
  '**第 3 步 src/permission.js**：全局路由守卫，动态路由的触发点 —— 白名单直过，否则 dispatch permission/generateRoutes 后 addRoutes。',
  '**第 4 步 src/vuex/modules/permission.js**：generateRoutes 串行调三个菜单接口，filterAsyncRouter 把后端返回的「组件名字符串」映射成真实组件。读完这步就懂了「路由表里为什么搜不到业务页面」。',
  '**第 5 步 src/utils/route/index.js 与 src/router/_import_development.js**：菜单树怎么拼成路由；_import 的 dev/prod 两版差异。',
  '**第 6 步 布局三选一**：src/components/layout/NavGroup.vue 按 settings.navBarMode 切换 layout/layout2/layout3；切换企业、改密码、退出都在 layout2/TopNav/avatar.vue。',
  '**第 7 步 请求层**：src/utils/khHttp.js（拦截器、errCode===0 才算成功、401 跳 CAS）+ public/static/kh.config.js（运行时配置）+ public/static/apiUrl/（真正的接口 URL 注册表，16 个文件按域分类）。',
  '**第 8 步 低代码主线（本项目最特殊处）**：src/views/FormCustom.vue（列表渲染器）→ src/components/form-build/（表单渲染）→ src/utils/ext/req.js（$req.queryFormData(formId)）→ src/config/form/formRequest.js（formId 常量）。看懂「一个 formId 拉配置、渲染、提交」这条链，60% 的业务页面不用逐个读。',
  '**第 9 步 一条完整业务流**：推荐待办流（src/views/backlog/Backlog.vue 只有 145 行 → src/components/waitDoneTask/ → src/api/waitdone.js），纯前端可读；再进阶到 ext/ 下的业务子系统。',
  '**第 10 步 租户体系**：src/views/tenant/（租户管理后台 8 个文件）→ src/components/hse/settings/companyInfo/TenantSettings.vue（按 currentCompanyId===0 区分平台租户与企业）→ avatar.vue 的 handleChangeCompany（switchCompanyToken 后整页刷新换会话）。',
  '',
  '## 三、六个反直觉点（读码前先背下来）',
  '1. src/api/ 不是接口层，只是业务常量；真正的接口注册表在 public/static/apiUrl/。',
  '2. 路由表里搜不到业务页面 —— 全部动态下发，组件名是后端菜单里的字符串。',
  '3. kh.config.js 的 rest 是空串 + devServer 代理，所以请求 URL 看起来全是相对路径。',
  '4. 有 Post2（post 但参数进 query）这类自定义约定；switchCompanyToken 用 GET 做写操作。',
  '5. public/static/meunconfig.js 文件名拼错（menu 拼成 meun）但被 webpack 特意单独分包，不能随手改名。',
  '6. vuex 的 user 模块没开 namespaced 而 permission 模块开了，dispatch 时别混。',
  '',
  '## 四、读码心法',
  '这个项目是「中央插件 + this.$xxx」的 jQuery 式风格（100% Options API，没有 setup 语法糖），不要用组合式 API 的预期去找逻辑。遇到找不到来源的方法，先查 main.js 挂的原型属性，再查 mixins（只有 2 个，好排查）。ext/ 目录 760 个文件占了大头，第一次通读跳过它，只读一条业务流即可。'
].join('\n')

/* ────────────────────────── 第二篇：技术栈全景 ────────────────────────── */

const TECH_STACK = [
  '# BKD 技术栈全景：核心框架与领域库',
  '',
  '先给结论：这是典型的 Vue 2 老牌企业级大仓 —— 框架老、依赖重、领域库极多。读它的正确姿势是「分层看」，别被 package.json 里一百多个依赖吓住。',
  '',
  '## 一、核心框架（构成项目的骨架）',
  '- Vue ^2.6.14：全部 1769 个 .vue 文件都是 Options API，无 TS（jsconfig，0 个 .ts 文件）。',
  '- vue-router ^3.5.1：history 模式；重度使用动态 addRoutes（这是 Vue Router 3 的 API，Router 4 已移除）。',
  '- vuex ^3.6.2 + vuex-persistedstate：16 个模块平铺，只有 settings 模块持久化到 localStorage。',
  '- Element UI ^2.15.6：全局 size=small；另有 override-element-ui.css 与本地主题包做皮肤。',
  '- 构建：@vue/cli-service 5（webpack 5），不是 Vite；根目录配置是 vue.config.js（465 行）。',
  '- 请求：axios ^0.19.0 + qs，封装在 src/utils/khHttp.js，挂成 $Get/$Post/$Post2/$PostJson/$PostFromData 原型方法。',
  '- 样式：SCSS 为主（main.scss 全局注入），postcss-pxtorem + rem.js 做移动适配。',
  '',
  '## 二、领域库（按业务域分组，用到哪个域再看哪个）',
  '**图表**：echarts 5 + echarts-gl + highcharts 8 + d3（老版本）。入口在 src/plugins/Echarts.js 与 src/utils/report/khChart.js。',
  '**GIS/地图**：Leaflet 1.9（主地图）、Cesium（3D，静态文件在 public/static/Cesium）、高德（kh.config.js 里 gisType 可切）、turf 地理计算、proj4 坐标转换。',
  '**富文本/编辑器**：wangeditor、quill 系、ckeditor4、vue-codemirror（含 SqlEditor）—— 四套并存，读代码时先确认页面用的是哪套。',
  '**文件/Office**：vue-office 三件套（docx/excel/pdf）、xlsx + xlsx-style、jspdf、html2canvas、vue-print-nb。',
  '**视频监控**：flv.js、hls.js、ezuikit（萤石）、海康/大华静态集成（public/static/hik、dh），实时告警走 WebSocket（src/utils/websocket.js + rmaw/push/WarnPushAlertV2.vue）。',
  '**加密**：jsencrypt —— 登录相关组件里 RSA 加密密码。',
  '',
  '## 三、构建配置要点（vue.config.js）',
  '1. 输出目录 dist_tpc；单入口 main.js。',
  '2. devServer 代理 9 条以上（/api /app /apc /3d /editor /flow /RPC2 等），全转发到 devServer.js 的 targetServer。',
  '3. webpack5 文件系统持久化缓存（解决 dev server 内存溢出），dev 脚本带大内存参数。',
  '4. splitChunks 把 elementUI/vue/highcharts/视频库单独分包；生产开 gzip、关 sourcemap。',
  '5. 自定义插件构建时写出 version.json，配合 src/utils/versionUpdate.js 做线上热更新提醒（每 3 分钟比对）。',
  '6. PWA 已启用。',
  '',
  '## 四、代码规模与风格（2026-10 实测）',
  'src 下 3755 个文件：.vue 1769 个约 60 万行、.js 309 个约 6.6 万行、.scss 284 个。100% Options API，没有 setup；mixins 只有 2 个，更多靠中央插件挂原型。版本管理是 SVN（目录里没有 .git）。读代码时按「入口 → 守卫 → 布局 → 请求 → 一条业务流」的顺序，不要试图按目录顺序通读。'
].join('\n')

/* ────────────────────────── 第三篇：前置技术清单 ────────────────────────── */

const PREREQ = [
  '# BKD 前置技术清单：必须会 / 最好会 / 加分项',
  '',
  '三档划分的标准：不会就读不了代码的算「必须会」；不影响读懂但影响效率的算「最好会」；只有特定模块才用到的算「加分项」。每条都标了项目内的对照文件，学完直接对着读。',
  '',
  '## 一、必须会（不会读不了代码）',
  '1. **Vue 2 Options API**：data/computed/watch/生命周期、$set、slot/scope-slot。对照：src/App.vue、src/components/layout2/TopNav/avatar.vue。如果你只写过 Vue 3 组合式 API，重点补 watch 的 immediate/deep、过滤器 filter、$listeners/$attrs。',
  '2. **Vue Router 3**：动态 addRoutes、路由守卫、嵌套路由、history 模式。对照：src/permission.js、src/vuex/modules/permission.js。addRoutes 是 Router 3 独有 API，Router 4 已删 —— 别拿新文档套。',
  '3. **Vuex 3**：modules/getters/mapGetters，特别注意项目里有的模块开了 namespaced 有的没开。对照：src/vuex/store.js、src/vuex/modules/user.js。',
  '4. **Element UI 2**：table/form/dialog/notification/dropdown 与主题覆盖。对照：src/views/tenant/manage/TenantManage.vue、src/css/override-element-ui.css。',
  '5. **axios + Promise**：拦截器、错误码约定（errCode===0 成功）。对照：src/utils/khHttp.js（262 行，半天能吃透）。',
  '6. **ES5/ES6 混合 JS**：项目里有同步 XHR、prototype 扩展这类老写法。对照：src/utils/route/index.js（同步 XHR 拉菜单）、src/main.js（改写 VueRouter.prototype.push）。',
  '7. **SCSS**：变量/嵌套/全局注入。对照：src/assets/style/main.scss（构建时 additionalData 注入所有组件）。',
  '',
  '## 二、最好会（影响理解效率）',
  '1. 动态组件与组件字符串映射（低代码思想）—— 对照 filterAsyncRouter（permission.js 271-383 行）。',
  '2. webpack 配置：splitChunks、devServer proxy、loader 链 —— 对照 vue.config.js 全文。',
  '3. WebSocket —— 对照 src/utils/websocket.js、rmaw/push/WarnPushAlertV2.vue。',
  '4. ECharts 5 —— 对照 src/plugins/Echarts.js、src/utils/report/khChart.js。',
  '5. Leaflet / Cesium / 高德三套 GIS 的取舍 —— 对照 kh.config.js 的 gisType 与 src/utils/cesium/。',
  '6. CAS 单点登录概念（会话、redirect 跳登录）—— 对照 khHttp.js 的 401 分支。',
  '7. sessionStorage/localStorage 分层缓存 —— 对照 src/utils/systemContext.js。',
  '8. 大组件封装（910 行通用表格 SingleTable.vue、form-build 表单引擎）—— 这是本项目的组件风格基线。',
  '',
  '## 三、加分项（特定模块才需要）',
  '1. 微前端/iframe 嵌入（isIframe 模式）—— src/utils/envJudge.js、src/components/micro-app/。',
  '2. 视频流协议 flv/hls 与海康/大华/萤石 SDK —— src/mixins/loadVideo.js。',
  '3. RSA 前端加密（jsencrypt）—— avatar.vue 登录段。',
  '4. Office 在线预览（office-js、vue-office、xlsx-style）—— public/static/wps.html、src/components/PreviewFile/。',
  '5. DataV 大屏组件与无缝滚动 —— src/ext/park-overview/。',
  '6. 3D Tiles 与 turf 地理计算 —— kh.config.js 的 tilesetUrl、$turf 原型挂载。',
  '7. G6 关系图 —— src/components/G6/。',
  '',
  '## 四、学习顺序建议',
  '先补「必须会」里的 1/2/3（Vue2/Router3/Vuex3 是一个整体，约一周），Element UI 边用边查不需要专门学；然后直接进项目按「阅读方法」篇的十步走。「最好会」里优先补 webpack 代理与动态组件思想，其余用到再学。'
].join('\n')

/* ────────────────────────── 第四篇：学习路线 ────────────────────────── */

const LEARNING_PATH = [
  '# BKD 学习路线：四阶段从补课到上手改需求',
  '',
  '总量按四周设计（每天 2-3 小时）。每阶段有明确的验收标准，过不了就别往下走 —— 这个项目的复杂度集中在「动态路由」和「低代码表单」两处，其他都是常规后台开发。',
  '',
  '## 阶段一（第 1 周）：Vue2 技术栈补课',
  '目标：补齐与 Vue 3 组合式 API 的差异。你已经会 Vue3/Pinia，重点反向学四件事。',
  '1. Options API 全家：data/computed/watch/methods/生命周期钩子对照。',
  '2. Vue Router 3：addRoutes 动态注册、beforeEach 守卫、嵌套路由与重定向。',
  '3. Vuex 3：module/state/getter/dispatch，namespaced 开与不开的调用差异（对比你熟悉的 Pinia：setup store、无 mutations）。',
  '4. Element UI 常用件：el-table 的 scope-slot 写法、el-form 的 rules 校验、el-dialog 与 $notify。',
  '验收：不看资料手写一个带二级路由 + vuex 计数 + el-table 列表的小页面。',
  '',
  '## 阶段二（第 2 周）：跑通项目 + 读懂骨架',
  '目标：本地跑起来，把「入口 → 守卫 → 布局 → 请求」四层骨架读透。',
  '1. 配 devServer targetServer，拿到 CAS 测试账号，登录进首页。',
  '2. 读 src/main.js 与 src/App.vue created()：KH 四插件、getUser 与租户信息、baseConfig.json。',
  '3. 读 src/permission.js + vuex/modules/permission.js + utils/route/index.js + router/_import_development.js（动态路由四件套，本周重点，花一半时间）。',
  '4. 读 src/utils/khHttp.js 全文，再看 public/static/apiUrl/user.js 对着找一个真实接口的完整链路。',
  '验收：能在源码里回答「菜单是哪三个接口来的」「组件名字符串怎么变成真组件」「接口 URL 在哪个文件注册」。',
  '',
  '## 阶段三（第 3 周）：动态路由与低代码主线深读',
  '目标：拿下本项目的两个复杂度高地。',
  '1. 低代码主线：FormCustom.vue 列表渲染器 → form-build/ 表单渲染 → utils/ext/req.js → config/form/formRequest.js。动手：在系统里拖一个简单表单，再回源码找它的渲染分支。',
  '2. 布局体系：NavGroup.vue 三布局切换 + layout2 的 tagsView 与 avatar.vue。',
  '3. 通用组件：SingleTable.vue（910 行）挑核心逻辑读（列配置、分页、事件上抛）。',
  '4. 杂项机制扫一遍：versionUpdate.js 热更新提醒、websocket.js、envJudge.js 的 isIframe。',
  '验收：能说清「新增一个菜单页面，前端需要写什么、后端需要配什么」，以及「表单引擎渲染一张表单的完整数据流」。',
  '',
  '## 阶段四（第 4 周）：业务流实战 + 上手改需求',
  '目标：在真实业务里闭环。',
  '1. 完整读一条业务流：待办（backlog/Backlog.vue 145 行起步）或安全检查（securityCheck/），从菜单下发到页面渲染到提交全链路。',
  '2. 租户体系实操：用平台租户账号（currentCompanyId===0）与企业账号分别登录，对比可见差异；读 tenant/ 管理页与 TenantSettings.vue。',
  '3. 找导师要一个小需求（加字段/加按钮/调文案级别），走完整流程：定位动态路由组件 → 改代码 → 联调 → 提测。',
  '4. 整理自己的「项目地图」笔记：把三套布局、接口注册表、formId 常量、常用组件的位置记下来。',
  '验收：独立完成一个不带新接口的小需求，并能在 10 分钟内定位任何菜单页面对应的源码文件。',
  '',
  '## 五、常见卡点与对策',
  '1. 登录死循环跳 CAS —— 后端不通或没给账号，不是前端问题。',
  '2. dev server 内存溢出 —— 确认 webpack 持久化缓存生效，别删缓存目录。',
  '3. 改了页面没生效 —— 先确认你改的组件真的被下发菜单引用（组件名字符串匹配），可能改错了同名文件。',
  '4. 找不到某个 $xxx 方法来源 —— 按顺序查 main.js 原型挂载、plugins/、mixins/。',
  '5. 路由改了不生效 —— 动态路由来自后端，本地改路由表只对静态路由有效。'
].join('\n')

/**
 * 全部内置篇目：4 篇（阅读方法 / 技术栈 / 前置清单 / 学习路线），顺序即记录列表里的先后
 * content 用 Markdown：## 小节标题 → 阅读页会切成小节，左侧目录尺按小节跳转
 */
export const BKD_ARTICLES = [
  { client_id: 'bkdh_read_path', title: 'BKD 项目·阅读方法：从跑起来到看懂一条业务流', content: READ_PATH },
  { client_id: 'bkdh_tech_stack', title: 'BKD 项目·技术栈全景：核心框架与领域库', content: TECH_STACK },
  { client_id: 'bkdh_prereq', title: 'BKD 项目·前置技术清单：必须会 / 最好会 / 加分项', content: PREREQ },
  { client_id: 'bkdh_learning_path', title: 'BKD 项目·学习路线：四阶段从补课到上手改需求', content: LEARNING_PATH }
]

/** 全部篇目的 client_id（测试与排查用） */
export const BKD_ARTICLE_IDS = BKD_ARTICLES.map(a => a.client_id)

/**
 * 可能装着手册的记录分片：近 13 个月 + getStorageInfoSync 列出的所有 diary_* key
 * @param {number} at
 * @returns {string[]}
 */
function candidateDiaryKeys(at) {
  const base = new Date(at)
  const keys = new Set()
  for (let i = 0; i <= 12; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1)
    keys.add('diary_' + getMonthFromDate(d.getTime()))
  }
  try {
    const info = (typeof uni !== 'undefined' && uni.getStorageInfoSync) ? uni.getStorageInfoSync() : null
    const all = (info && info.keys) || []
    all.forEach(k => { if (/^diary_\d{4}-\d{2}$/.test(k)) keys.add(k) })
  } catch (e) { /* 拿不到存储清单也不影响：近 13 个月已经覆盖 */ }
  return Array.from(keys)
}

/**
 * 扫近 13 个月的分片，把「client_id → { item, key }」摊平（含软删）
 * @param {number} at
 * @returns {Map<string, {item: Object, key: string}>}
 */
function scanSeedRecords(at) {
  const found = new Map()
  candidateDiaryKeys(at).forEach(key => {
    getRawList(key).forEach((item) => {
      if (item && item.client_id && !found.has(item.client_id)) {
        found.set(item.client_id, { item: item, key: key })
      }
    })
  })
  return found
}

/**
 * 补发 / 刷新 BKD 手册（幂等）
 * @param {number} [now] 生成时间（测试注入用）
 * @returns {{ added: number, updated: number, month: string, ids: string[] }}
 */
export function ensureBkdHandbook(now) {
  const at = Number(now) || Date.now()
  const month = getMonthFromDate(at)
  const key = 'diary_' + month
  const existing = scanSeedRecords(at)

  // 缺的补、旧 seed_v 的刷新（用户删掉的不动）
  const toAdd = []
  let updated = 0
  BKD_ARTICLES.forEach((a, i) => {
    const hit = existing.get(a.client_id)
    if (!hit) { toAdd.push(i); return }
    if (hit.item.is_deleted === 1) return
    if (Number(hit.item.seed_v) === BKD_SEED_VERSION) return
    const list = getRawList(hit.key)
    const target = list.find(x => x && x.client_id === a.client_id)
    if (!target) return
    target.title = a.title
    target.content = a.content
    target.tags = [BKD_TAG]
    target.record_type = 'note'
    target.seed = BKD_SEED_MARK
    target.seed_v = BKD_SEED_VERSION
    target.updated_at = at
    asyncSetStorageJSON(hit.key, list)
    updated++
  })

  if (toAdd.length > 0) {
    const raw = getRawList(key)
    const records = toAdd.map((i, n) => {
      const a = BKD_ARTICLES[i]
      return {
        client_id: a.client_id,
        title: a.title,
        content: a.content,
        record_type: 'note',
        type: 'diary',
        tags: [BKD_TAG],
        category: '',
        images: [],
        pinned: 0,
        emotion: '',
        ai_summary: '',
        ai_advice: '',
        seed: BKD_SEED_MARK,
        seed_v: BKD_SEED_VERSION,
        created_at: at + n,
        updated_at: at,
        is_deleted: 0
      }
    })
    asyncSetStorageJSON(key, raw.concat(records))
  }

  // 标签注册表补齐「技术手册」（归到「学习」种类）
  try {
    addCustomTag('diary', BKD_TAG, null, null, BKD_TAG_CATEGORY)
  } catch (e) { /* 标签表写失败不影响记录本身 */ }

  return {
    added: toAdd.length,
    updated: updated,
    month: month,
    ids: toAdd.map(i => BKD_ARTICLES[i].client_id)
  }
}
