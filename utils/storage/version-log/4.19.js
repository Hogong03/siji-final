/**
 * 版本日志数据段：4.19.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V419 = [
  {
    version: '4.19.0',
    date: '2026-10-07',
    title: '内置内容换血：下线全部六级内容（记录 10 篇 + 六级备考模板），新增 BKD 项目技术学习手册 4 篇',
    summary: [
      '六级内容整体下线：4 章技巧 + 6 篇复习资料 + 计划模板「六级备考」全部移除，App 启动时自动软删设备上的存量（幂等，可恢复语义不硬删）',
      '新增「BKD 项目技术学习手册」4 篇内置记录（标签「技术手册」）：阅读方法十步路径 / 技术栈全景 / 前置技术三档清单 / 四阶段学习路线，目标项目为科皓 vue-basic-dev-platform-tenant-pc（安全生产智能化管控平台）',
      '手册内容基于对目标项目的实测调查：Vue2.6 + ElementUI2 + webpack5 动态路由低代码平台，3755 文件 60 万行，含 6 个反直觉点与各阶段验收标准',
      '「内置」徽标判定前缀从 tip_cet6_/mat_cet6_ 换为 bkdh_；新手册同样支持阅读页目录尺（## 分节）、删掉不复活',
    ],
    categories: [
      {
        title: '六级内容下线（4.19.0）',
        items: [
          '删除 utils/storage/cet6-tips.js（4 章技巧）与 cet6-material.js（6 篇复习资料）源文件及 tests/cet6-tips.test.js',
          '新增 utils/storage/seed-cleanup.js：removeCet6Content() 按 seed=cet6 与 tip_cet6_/mat_cet6_ 旧前缀软删记录分片，plan_template_all 里的 tpl_cet6 模板软删；App.vue appReady 调用（幂等）',
          'utils/storage/plan.js：DEFAULT_TEMPLATES 删除 tpl_cet6「六级备考」模板定义（用户已创建的计划数据不受影响）',
          '记忆检索词表与自动打标签词表中的六级同义词保留（用户自己写相关内容仍可用）',
        ],
      },
      {
        title: 'BKD 技术学习手册（4.19.0）',
        items: [
          '新增 utils/storage/bkd-handbook.js：4 篇长文（bkdh_read_path / bkdh_tech_stack / bkdh_prereq / bkdh_learning_path），seed=bkd-handbook，标签「技术手册」（学习种类）',
          '阅读方法篇：先跑起来（devServer/CAS 依赖）→ 十步阅读路径（每步带文件路径）→ 六个反直觉点（api 目录不是接口层、路由全动态下发等）',
          '技术栈篇：Vue2.6/Router3/Vuex3/ElementUI2/webpack5 骨架 + 图表/GIS/编辑器/视频监控领域库分组 + 构建配置要点',
          '前置技术篇：必须会（Vue2/Router3/Vuex3/ElementUI/axios/ES 混合/SCSS）+ 最好会 + 加分项三档，每条带项目内对照文件',
          '学习路线篇：四阶段（补课 → 骨架 → 动态路由与低代码深读 → 业务流实战）各带验收标准与常见卡点对策',
          'App.vue：ensureCet6Tips() 调用替换为 ensureBkdHandbook() + removeCet6Content()',
        ],
      },
    ],
  },
]
