/**
 * 版本日志数据段：4.28.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V428 = [
  {
    version: '4.28.0',
    date: '2026-10-12',
    title: '内置个人画像：经历 / 23 岁画像 / 学习计划 / MBTI + 「我的画像」画像卡',
    summary: [
      '用户画像内置为记录：4 篇（我的经历 / 个人画像·23 岁 / 学习计划与路线 / MBTI 性格自评），标签「个人画像」，与 BKD 手册同一套幂等补发机制（缺的补、旧版刷新、用户删掉的不复活）',
      '新增「我的画像」个人信息卡（设置 → 个人信息可见）：当前阶段/职业方向/性格优势/主要短板/金钱目标/家庭目标/感情目标/人生关键词/MBTI 九个维度，写入不动 enabled —— 是否注入 AI 对话由用户在设置页自己决定',
      'seed-records.js 注册 prof_ 前缀：画像四篇在记录列表带「内置」徽标；prof_ 图片按种子规矩不在 App 端做反色版',
    ],
    categories: [
      {
        title: '内置个人画像（4.28.0）',
        items: [
          '新增 utils/storage/profile-seed.js：PROFILE_ARTICLES 4 篇（prof_journey 经历 / prof_portrait 23 岁画像 / prof_learning 学习计划 / prof_mbti MBTI 自评），内容来自用户本机画像材料整理；ensureProfileSeed() 幂等补发（scanSeedRecords 近 13 个月 + 存储 key 列表），标签「个人画像」归生活种类',
          '画像卡：PROFILE_CARD_ID=portrait 固定 id 保证幂等，存在即不重写（用户改过的字段不覆盖），source=ai_extracted，不自动开 enabled；getProfile 自动迁移与固定卡补齐兼容',
          'utils/storage.js 聚合导出 ensureProfileSeed / PROFILE_ARTICLES / PROFILE_ARTICLE_IDS / PROFILE_TAG；App.vue appReady 在 ensureBkdHandbook 后调用，失败不影响启动',
          'utils/seed-records.js：SEED_CLIENT_ID_PREFIXES 扩为 [bkdh_, prof_]，内置徽标覆盖画像篇目',
          'tests/profile-seed.test.js 7 例：首跑全补发/幂等/seed_v 刷新/软删不复活/画像卡写入与不重写/前缀注册；全量 105 文件 / 1403 用例全绿',
        ],
      },
    ],
  },
]
