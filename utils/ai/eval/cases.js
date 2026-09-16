/**
 * cases.js — AI 效果自检的语料集（3.7.0）
 *
 * 为什么要有这个：过去六轮都在加提示词规则（BEHAVIOR_RULES 7 条 → 10 条铁律 + 纠错主动权），
 * 但 tests/correction-regression.test.js 只能断言「提示词里写了这句话」，证明不了模型照做 ——
 * 用户体感一直没变。这里把历史真实反馈固化成可跑分的语料，跑批结果才是判断标准。
 *
 * 断言语义（由 runner.js 判定，纯数据文件）：
 *   tools       必须全部出现
 *   toolsAny    至少出现一个（为空数组等于不断言）
 *   forbid      一个都不许出现
 *   order       [a, b]：出现 b 时必须先出现 a（先查后改）
 *   args        { 工具名: (args, allToolCalls) => boolean }
 *   confirm     期望走「需用户确认」闸门
 *   replyIncludes / replyExcludes  最终回复必须 / 不许包含的子串
 *   needs       数据前置（3.7.2）：plan / bill。缺前置时该条判跳过，不算失败
 *
 * 日期一律现算（dayStr），不写死日期 —— 写死会让用例在特定日子里假失败。
 *
 * 3.7.2：涉及「某个已存在的计划 / 某一笔账单」的语料不再写死名字 —— 3.7.1 首跑里
 * 那 4 条的失败全是这个原因：语料里假设的「六级备考计划 / 学英语计划」根本不在你库里，
 * 模型查完如实说「没找到，要不要新建」，行为正确却被判失败。改用 {plan} / {billAmount}
 * 占位符，跑批前从你真实数据里取值（见 runner.buildEvalContext）。
 */

/** 相对今天偏移 n 天的 YYYY-MM-DD */
export function dayStr(offset, now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 取某工具的第一次调用参数 */
function firstArgs(all, name) {
  const hit = all.find((c) => c && c.name === name)
  return (hit && hit.args) || {}
}

/** 语料集，按主题分组（id 唯一，跑批按顺序执行） */
export const EVAL_CASES = [
  {
    id: 'plan-change-content',
    title: '计划内容变更 → 改原计划，不许新建',
    needs: 'plan',
    message: '「{plan}」改一下，从现在开始每天读 20 页，别再按原来的节奏来了',
    expect: {
      tools: ['update_plan'],
      order: [['query_plan', 'update_plan']],
      forbid: ['create_plan', 'create_plan_phases']
    }
  },
  {
    id: 'plan-change-deadline',
    title: '改计划截止时间 → 先查后改',
    needs: 'plan',
    message: '把「{plan}」的截止时间改到 12 月 12 日',
    expect: {
      tools: ['update_plan'],
      order: [['query_plan', 'update_plan']],
      forbid: ['create_plan']
    }
  },
  {
    id: 'plan-add-child',
    title: '给计划补一条子计划 → update 不 create',
    needs: 'plan',
    message: '给「{plan}」再加一条：每天读 20 页，二十分钟就够',
    expect: {
      tools: ['update_plan'],
      forbid: ['create_plan', 'create_plan_phases']
    }
  },
  {
    id: 'plan-new-large',
    title: '全新大目标 → 建计划（可多阶段）',
    message: '帮我定个计划，一个月内把房间收拾干净，要能真正执行的那种',
    expect: {
      toolsAny: ['create_plan', 'create_plan_phases'],
      forbid: ['update_plan']
    }
  },
  {
    id: 'plan-checkin',
    title: '计划打卡 → 打卡工具，不许新建计划',
    needs: 'plan',
    message: '「{plan}」今天的打卡完成了',
    expect: {
      tools: ['log_plan_checkin'],
      forbid: ['create_plan', 'create_diary']
    }
  },
  {
    id: 'plan-query',
    title: '问计划列表 → 只查不写',
    message: '我有哪些计划还没做完？',
    expect: {
      tools: ['query_plan'],
      forbid: ['create_plan', 'update_plan', 'log_plan_checkin']
    }
  },
  {
    id: 'profile-add-attribute',
    title: '自定义属性新增 → 落库，不许只口头答应',
    message: '我喜欢的颜色是深蓝',
    expect: {
      tools: ['smart_update_profile']
    }
  },
  {
    id: 'profile-update-attribute',
    title: '自定义属性变更 → 改而不新增重复项',
    message: '我的爱好改成爬山了，以前那个改掉',
    expect: {
      tools: ['smart_update_profile']
    }
  },
  {
    id: 'profile-read',
    title: '问「你了解我什么」→ 读画像',
    message: '你都知道我的哪些信息？',
    expect: {
      toolsAny: ['get_profile']
    }
  },
  {
    id: 'diary-typo',
    title: '错别字容忍 → 仍然落成记录',
    message: '我今天式去图书馆看书了，记一下',
    expect: {
      tools: ['create_diary']
    }
  },
  {
    id: 'diary-plain',
    title: '明确要求记录 → 落库',
    message: '记录：今天用上官婉儿冲金标，赢了三把',
    expect: {
      tools: ['create_diary']
    }
  },
  {
    id: 'bill-relative-date',
    title: '口头时间从原话算 → 昨天就是昨天',
    message: '记一笔昨天的午饭 25',
    expect: {
      tools: ['create_bill'],
      args: {
        create_bill: (args) => args.bill_date === dayStr(-1)
      }
    }
  },
  {
    id: 'bill-day-before-yesterday',
    title: '前天也要算对',
    message: '记一笔前天的打车费 48',
    expect: {
      tools: ['create_bill'],
      args: {
        create_bill: (args) => args.bill_date === dayStr(-2)
      }
    }
  },
  {
    id: 'bill-large-needs-confirm',
    title: '大额记账 → 必须走确认闸门',
    message: '记一笔房租 1500',
    expect: {
      tools: ['create_bill'],
      confirm: true
    }
  },
  {
    id: 'bill-correction',
    title: '记错了 → 先查后改，不许新增一条',
    needs: 'bill',
    message: '刚才那笔记账金额写错了，不是 {billAmount} 是 {billAmountPlus}，改一下',
    expect: {
      order: [['query_bill', 'update_bill']],
      tools: ['update_bill'],
      forbid: ['create_bill']
    }
  },
  {
    id: 'multi-intent',
    title: '一句话两个意图 → 两个都做',
    message: '记一笔午餐 35，再写个记录说今天开会开到六点',
    expect: {
      tools: ['create_bill', 'create_diary']
    }
  },
  {
    id: 'bill-stat',
    title: '问花费 → 只查不写',
    message: '我这个月一共花了多少钱？',
    expect: {
      toolsAny: ['query_bill', 'query_stat'],
      forbid: ['create_bill', 'update_bill']
    }
  },
  {
    id: 'undo-last',
    title: '撤销 → 走撤销工具',
    message: '撤销刚才那笔记账',
    expect: {
      tools: ['undo_last']
    }
  },
  {
    id: 'relation-interaction',
    title: '提到人和事 → 记互动，不许凭空新建人脉',
    message: '今天和阿伟聊了项目排期的事，聊得还行',
    expect: {
      toolsAny: ['log_interaction', 'query_relation']
    }
  },
  {
    id: 'url-cjk-stuck',
    title: '网址后面粘中文 → 只读网址本身（3.6.2 回归点）',
    message: 'https://www.deepseek.com/阅读这个网址',
    expect: {
      tools: ['read_url'],
      args: {
        read_url: (args) => String(args.url || '').indexOf('deepseek.com') >= 0 && !/[\u4e00-\u9fff]/.test(String(args.url || ''))
      }
    }
  },
  {
    id: 'url-clean',
    title: '干净网址 → 读网址而不是搜索',
    message: '帮我总结一下 https://www.example.com/post 这篇讲什么',
    expect: {
      tools: ['read_url'],
      args: {
        read_url: (args) => String(args.url || '').indexOf('example.com/post') >= 0
      },
      forbid: ['web_search']
    }
  },
  {
    id: 'search-realtime',
    title: '时效信息 → 联网搜索',
    message: '最近有什么新的大模型发布？要最新的消息',
    expect: {
      tools: ['web_search'],
      forbid: ['create_diary', 'create_plan']
    }
  },
  {
    id: 'casual-no-tools',
    title: '闲聊 → 一个写操作都不许调',
    message: '你好呀，今天天气还行，就是想随便聊两句',
    expect: {
      forbid: [
        'create_diary', 'create_bill', 'create_plan', 'create_plan_phases',
        'update_plan', 'update_bill', 'update_diary', 'smart_update_profile',
        'create_relation', 'create_decision', 'undo_last', 'log_interaction'
      ]
    }
  }
]

/** 所有断言字段名（runner 与测试据此校验语料结构） */
export const EXPECT_KEYS = ['tools', 'toolsAny', 'forbid', 'order', 'args', 'confirm', 'replyIncludes', 'replyExcludes']

export { firstArgs }