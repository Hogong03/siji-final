// 思迹 H5 实机演示 · 前置数据
//
// 由 capture-app.mjs 通过 Page.addScriptToEvaluateOnNewDocument 注入：
// 在应用脚本之前跑，把 localStorage 铺成「已连接、有数据」的状态，
// 这样截出来的就是真实界面，而不是空白首启页。
//
// 注意：这里的 Key 是占位值，只为了让「连接一个 AI」引导卡消失；
// 截屏过程不会真的发请求（演示对话是预先铺进会话里的）。
(function () {
  'use strict';

  // 1. 跳过首启引导层（否则它会盖住整页，且 appReady 的内置种子不会跑）
  localStorage.setItem('siji_onboarding_done', '1');

  // 2. 占位 Key（明文兼容读取），让聊天页不再显示「去连接」
  localStorage.setItem('siji_provider_keys', JSON.stringify({ deepseek: 'sk-demo-placeholder-key' }));

  // 3. 一条真实感的对话：账单落库 → 计划拆步 → 当场改错
  var now = Date.now();
  var conv = {
    id: 'conv_demo',
    title: '和阿伟吃饭',
    agentId: 'siji',
    agentName: '思迹助手',
    createdAt: now - 3600000,
    updatedAt: now,
    summary: null,
    summaryIndex: 0,
    tags: [],
    messages: [
      { id: 'm1', role: 'user', content: '昨天和阿伟吃饭花了 168' },
      {
        id: 'm2', role: 'assistant', content: '记下了：餐饮 · 168 元。',
        actionCard: { type: 'create_bill', payload: { amount: 168, category: '餐饮' } },
        execResult: {
          type: 'bill',
          success: true,
          message: '已记录一笔支出',
          detail: { type: 'bill', amount: 168, category: '餐饮', billType: 'expense', bill_date: '2026-10-10', note: '和阿伟吃饭' }
        }
      },
      { id: 'm3', role: 'user', content: '我这周想把跑步捡起来' },
      {
        id: 'm4', role: 'assistant', content: '拆成三小步，先动起来。',
        actionCard: { type: 'create_plan', payload: { title: '重新开始跑步' } },
        execResult: {
          type: 'plan',
          success: true,
          message: '已创建计划',
          detail: {
            type: 'plan', title: '重新开始跑步', description: '每周三次，先动起来再说',
            priority: 3, childCount: 3,
            estimated_time: '2026-10-15', due_date: '2026-11-15',
            children: [
              { title: '走 20 分钟', status: 0 },
              { title: '慢跑 15 分钟', status: 0 },
              { title: '慢跑 20 分钟', status: 0 }
            ]
          }
        }
      },
      { id: 'm5', role: 'user', content: '等等，是 198' },
      {
        id: 'm6', role: 'assistant', content: '已改成 ¥198 · 分类不变。',
        actionCard: { type: 'update_bill', payload: { amount: 198 } },
        execResult: {
          type: 'bill',
          success: true,
          message: '已更新金额',
          detail: { type: 'bill', amount: 198, category: '餐饮', billType: 'expense', bill_date: '2026-10-10', note: '和阿伟吃饭' }
        }
      }
    ]
  };

  localStorage.setItem('siji_conversations', JSON.stringify([conv]));
  localStorage.setItem('siji_active_conversation', 'conv_demo');

  // 4. 记录：一条带章节的长文（阅读页的目录尺就靠它）+ 两条短的
  var day = 24 * 3600 * 1000;
  var longRecord = {
    client_id: 'rec_demo_long',
    title: '十月第一周复盘',
    record_type: 'diary',
    tags: ['复盘', '生活'],
    category: '',
    images: [],
    pinned: false,
    emotion: '平静',
    ai_summary: '',
    ai_advice: '',
    created_at: now - 2 * day,
    updated_at: now - 2 * day,
    is_deleted: 0,
    content: [
      '## 一、这周做了什么',
      '把拖了两周的报销单交了，跑了三次步，其中两次只跑了十分钟就回家。',
      '周三晚上陪阿伟看了场球，回来路上聊到他准备换工作。',
      '',
      '## 二、卡在哪里',
      '早上起不来，原定的晨跑全部推到晚上，晚上又容易被别的事挤掉。',
      '真正的问题不是没时间，是前一晚睡太晚。',
      '',
      '## 三、花了多少钱',
      '餐饮 486，交通 120，买书 168。外卖比上周多了三顿，都在加班那天。',
      '',
      '## 四、身体状态',
      '睡眠六小时出头，下午容易困。膝盖没有不适，跑量可以慢慢加。',
      '',
      '## 五、下周只做三件事',
      '十一点前躺下；周二周四各跑一次，十分钟也算；把报销的下半段流程走完。',
      '',
      '## 六、留一句话',
      '不是每一周都要有进展，能看清卡在哪儿就已经算收获。'
    ].join('\n')
  };

  var shortA = {
    client_id: 'rec_demo_a',
    title: '报销单交上去了',
    record_type: 'note',
    tags: ['工作'],
    category: '', images: [], pinned: false, emotion: '轻松',
    ai_summary: '', ai_advice: '',
    created_at: now - 1 * day, updated_at: now - 1 * day, is_deleted: 0,
    content: '拖了两周的报销单终于交上去了，票据差点又丢一张。'
  };

  var shortB = {
    client_id: 'rec_demo_b',
    title: '阿伟可能要换工作',
    record_type: 'note',
    tags: ['朋友', '工作'],
    category: '', images: [], pinned: false, emotion: '感慨',
    ai_summary: '', ai_advice: '',
    created_at: now - 6 * 3600 * 1000, updated_at: now - 6 * 3600 * 1000, is_deleted: 0,
    content: '看完球聊到他准备换工作，说想换个城市试试。'
  };

  var monthKey = 'diary_' + new Date(now).getFullYear() + '-' + String(new Date(now).getMonth() + 1).padStart(2, '0');
  localStorage.setItem(monthKey, JSON.stringify([shortB, shortA, longRecord]));

  // 5. 计划：一条根计划 + 三小步（前两步已完成，演示打卡后的样子）
  var sub = function (id, title, status) {
    return {
      client_id: id, title: title, description: '', status: status, priority: 2,
      estimated_time: '', due_date: '', start_time: '', end_time: '',
      subtasks: [], tags: [], created_at: now - 3 * day, updated_at: now - 3 * day, is_deleted: 0
    };
  };
  var plan = {
    client_id: 'plan_demo_run',
    title: '重新开始跑步',
    description: '每周三次，先动起来再说',
    status: 1,
    priority: 2,
    estimated_time: '2026-10-15',
    due_date: '2026-11-15',
    start_time: '2026-10-15',
    end_time: '',
    deadline: '',
    subtasks: [
      sub('sub_run_1', '走 20 分钟', 2),
      sub('sub_run_2', '慢跑 15 分钟', 2),
      sub('sub_run_3', '慢跑 20 分钟', 0)
    ],
    tags: ['运动'],
    created_at: now - 3 * day,
    updated_at: now - 1 * day,
    is_deleted: 0
  };
  localStorage.setItem('plan_all', JSON.stringify([plan]));
})();
