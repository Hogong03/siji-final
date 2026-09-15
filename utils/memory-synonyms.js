/**
 * memory-synonyms.js — 记忆检索的语义扩展层（3.5.18）
 *
 * 解决「换个说法就召不回来」：BM25 只能匹配字面词，用户说"对象"、记忆里写的是"女朋友"时命中为 0。
 * 两条纯本地扩展通道，不引向量库、不调 API：
 *   1. 同义分组：口语变体（对象/女友/媳妇/伴侣）归组，查询命中任一形式即扩展全组
 *   2. 拼音桥接：查询是拼音或首字母（jihua / jh）时，桥接到词表里的中文词（计划）
 *
 * 边界（明确声明，别指望超范围效果）：
 *   - 拼音桥接只覆盖 DOMAIN_LEXICON 的约 50 个高频域内词，不是全量拼音库
 *   - 同义分组是人工维护的口语表，未登录的变体不生效；加变体直接往 SYNONYM_GROUPS 里加
 *   - 不做跨句推理、不做指代消解（那是向量检索的活）
 *
 * 纯函数、不依赖 uni，可直接单测（tests/memory-semantic.test.js）。
 */

/** 字面命中权重 */
export const SELF_WEIGHT = 1
/** 同义扩展权重 */
export const SYNONYM_WEIGHT = 0.6
/** 拼音桥接权重：全拼 */
export const PINYIN_WEIGHT = 0.75
/** 拼音桥接权重：首字母缩写 */
export const INITIALS_WEIGHT = 0.65
/** 经拼音桥接后再取同义（两跳，权重最低） */
export const PINYIN_SYNONYM_WEIGHT = 0.45
/** 单组最多扩展的词数（防超大组把分数摊平） */
const MAX_GROUP_EXPANSION = 8

/** 同义分组：每组内的词视为同一语义，一个词只能出现在一个组里 */
export const SYNONYM_GROUPS = [
  ['女朋友', '女友', '对象', '媳妇', '老婆', '妻子', '伴侣', '爱人', '男朋友', '男友', '老公', '丈夫', '暧昧'],
  ['家人', '父母', '爸妈', '妈妈', '爸爸', '亲人', '老家', '家里'],
  ['朋友', '好友', '兄弟', '哥们', '闺蜜', '姐妹', '同学'],
  ['同事', '上司', '领导', '老板', '下属', '团队', '客户'],
  ['心情', '情绪', '状态', '心态', '感受', '心情不好'],
  ['抑郁', '低落', '难受', '压抑', '崩溃', '想哭', '丧', 'emo', '开心不起来'],
  ['焦虑', '紧张', '内耗', '担心', '慌', '害怕'],
  ['睡眠', '失眠', '熬夜', '睡不着', '作息', '生物钟', '早睡', '午休'],
  ['工作', '上班', '职场', '单位', '公司', '加班', '上班族', '离职'],
  ['学习', '复习', '备考', '考试', '刷题', '背单词', '学习计划'],
  ['六级', '英语六级', '四级', '四六级', 'CET', '四六级考试'],
  ['钱', '花销', '开销', '花费', '支出', '消费', '账单', '预算', '缺钱', '穷', '存款'],
  ['收入', '工资', '薪水', '进账', '发工资', '兼职'],
  ['计划', '安排', '规划', '日程', '待办', '任务', '日程表', '打卡计划'],
  ['记录', '日记', '日志', '备忘', '记一下', '写下来', '随手记'],
  ['标签', '分类', '归类', '打标签', '标签种类'],
  ['画像', '个人信息', '我的信息', '资料', '档案', '偏好', '喜好'],
  ['关系', '人脉', '人际', '社交', '相处', '应酬', '打交道', '沟通'],
  ['决策', '选择', '纠结', '权衡', '拿主意', '决定'],
  ['微光', '灵感', '想法', '点子', '闪光点'],
  ['饮食', '口味', '忌口', '外卖', '饭菜', '爱吃', '不吃', '吃辣'],
  ['运动', '健身', '跑步', '锻炼', '打球', '散步'],
  ['游戏', '打游戏', '开黑', '王者荣耀', '上分'],
  ['旅行', '旅游', '出去玩', '出行', '攻略', '露营'],
  ['身体', '健康', '体检', '生病', '感冒', '医院', '看医生'],
  ['动力', '干劲', '提不起劲', '没动力', '拖延', '摆烂', '躺平', '懒', '自律'],
  ['记忆', '长期记忆', '记住', '回忆', '总结'],
  ['反馈', '意见', '体验反馈', '问题反馈', 'bug'],
  ['对话', '聊天', '会话', '助手', '智能体', 'agent'],
  ['图片', '截图', '照片', '图片识别', '识别'],
  ['语音', '录音', '转写', '听写'],
  ['新闻', '时事', '热点', '最新消息', '联网搜索'],
  ['天气', '气温', '下雨', '温度'],
  ['账户', '登录', '注册', '密码', '备份', '导出']
]

/** 拼音词表：词 -> [全拼, 首字母]；只收录高频域内词，不追求全量 */
export const DOMAIN_LEXICON = {
  '计划': ['jihua', 'jh'],
  '记账': ['jizhang', 'jz'],
  '账单': ['zhangdan', 'zd'],
  '日记': ['riji', 'rj'],
  '记录': ['jilu', 'jl'],
  '心情': ['xinqing', 'xq'],
  '情绪': ['qingxu', 'qx'],
  '睡眠': ['shuimian', 'sm'],
  '失眠': ['shimian', 'sm'],
  '学习': ['xuexi', 'xx'],
  '工作': ['gongzuo', 'gz'],
  '朋友': ['pengyou', 'py'],
  '女朋友': ['nvpengyou', 'nyp'],
  '对象': ['duixiang', 'dx'],
  '家人': ['jiaren', 'jr'],
  '焦虑': ['jiaolv', 'jl'],
  '压力': ['yali', 'yl'],
  '旅行': ['lvxing', 'lx'],
  '游戏': ['youxi', 'yx'],
  '运动': ['yundong', 'yd'],
  '决策': ['juece', 'jc'],
  '标签': ['biaoqian', 'bq'],
  '画像': ['huaxiang', 'hx'],
  '人脉': ['renmai', 'rm'],
  '微光': ['weiguang', 'wg'],
  '预算': ['yusuan', 'ys'],
  '目标': ['mubiao', 'mb'],
  '习惯': ['xiguan', 'xg'],
  '身体': ['shenti', 'st'],
  '健康': ['jiankang', 'jk'],
  '体重': ['tizhong', 'tz'],
  '抑郁': ['yiyu', 'yy'],
  '英语': ['yingyu', 'yy'],
  '六级': ['liuji', 'lj'],
  '考试': ['kaoshi', 'ks'],
  '复习': ['fuxi', 'fx'],
  '动力': ['dongli', 'dl'],
  '记忆': ['jiyi', 'jy'],
  '反馈': ['fankui', 'fk'],
  '对话': ['duihua', 'dh'],
  '图片': ['tupian', 'tp'],
  '语音': ['yuyin', 'yy'],
  '新闻': ['xinwen', 'xw'],
  '天气': ['tianqi', 'tq'],
  '标签种类': ['biaqianzhonglei', 'bqzl'],
  '收入': ['shouru', 'sr'],
  '消费': ['xiaofei', 'xf']
}

/** 词 -> 分组下标 */
const TERM_GROUP = new Map()
SYNONYM_GROUPS.forEach((group, gi) => {
  for (const word of group) {
    const key = String(word).toLowerCase().trim()
    if (key && !TERM_GROUP.has(key)) TERM_GROUP.set(key, gi)
  }
})

/** 拼音形式 -> { term, kind } */
const PINYIN_INDEX = new Map()
for (const term of Object.keys(DOMAIN_LEXICON)) {
  const forms = DOMAIN_LEXICON[term]
  forms.forEach((form, idx) => {
    const key = String(form).toLowerCase().trim()
    if (key && !PINYIN_INDEX.has(key)) {
      PINYIN_INDEX.set(key, { term, kind: idx === 0 ? 'full' : 'initials' })
    }
  })
}

/** 归一化词面（小写 + 去首尾空白） */
export function normalizeTerm(value) {
  return String(value == null ? '' : value).toLowerCase().trim()
}

/** 是否为纯 ASCII 字母数字词（拼音 / 缩写 / 英文） */
export function isAsciiToken(token) {
  return /^[a-z][a-z0-9]*$/.test(normalizeTerm(token))
}

/** 取词所在同义分组下标；未登录返回 undefined */
export function groupIndexOf(term) {
  return TERM_GROUP.get(normalizeTerm(term))
}

/** 取词所属分组全部形式（未登录返回空数组） */
export function synonymVariants(term) {
  const gi = groupIndexOf(term)
  if (gi === undefined) return []
  return SYNONYM_GROUPS[gi].map(normalizeTerm)
}

/** 拼音 / 缩写桥接到中文词（未命中返回空数组） */
export function pinyinTargets(token) {
  const key = normalizeTerm(token)
  if (!isAsciiToken(key) || key.length < 2) return []
  const hit = PINYIN_INDEX.get(key)
  if (!hit) return []
  return [{ term: hit.term, kind: hit.kind }]
}

/** 词表全部词（文档侧拼音索引用） */
export function lexiconTerms() {
  return Object.keys(DOMAIN_LEXICON)
}

/**
 * 把查询词表扩展成带权重的检索项
 * @param {string[]} terms 已分词的基础词表
 * @returns {Array<{term:string, weight:number, from:string}>} 同词取最高权重，去重
 */
export function expandTerms(terms) {
  const weight = new Map()
  const origin = new Map()
  const add = (rawTerm, w, from) => {
    const term = normalizeTerm(rawTerm)
    if (!term) return
    const prev = weight.get(term)
    if (prev === undefined || w > prev) {
      weight.set(term, w)
      origin.set(term, from)
    }
  }

  for (const raw of terms || []) {
    const term = normalizeTerm(raw)
    if (!term) continue
    add(term, SELF_WEIGHT, 'self')

    const gi = TERM_GROUP.get(term)
    if (gi !== undefined) {
      let added = 0
      for (const word of SYNONYM_GROUPS[gi]) {
        const variant = normalizeTerm(word)
        if (variant === term || !variant) continue
        add(variant, SYNONYM_WEIGHT, 'synonym')
        if (++added >= MAX_GROUP_EXPANSION) break
      }
    }

    for (const target of pinyinTargets(term)) {
      add(target.term, target.kind === 'full' ? PINYIN_WEIGHT : INITIALS_WEIGHT, 'pinyin')
      const targetGroup = TERM_GROUP.get(normalizeTerm(target.term))
      if (targetGroup === undefined) continue
      let added = 0
      for (const word of SYNONYM_GROUPS[targetGroup]) {
        const variant = normalizeTerm(word)
        if (variant === normalizeTerm(target.term) || !variant) continue
        add(variant, PINYIN_SYNONYM_WEIGHT, 'pinyin-synonym')
        if (++added >= MAX_GROUP_EXPANSION) break
      }
    }
  }

  return [...weight.entries()].map(([term, w]) => ({ term, weight: w, from: origin.get(term) }))
}