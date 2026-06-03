import { defineStore } from 'pinia';

export const usePortalStore = defineStore('portal', {
  state: () => ({
    activeSection: 'skillhub',
    activeSkillCategory: 'productivity',
    activeToolCategory: 'writing',
    user: {
      name: 'Alex Chen',
      role: '管理员',
      avatar: 'AC'
    },
    sections: [
      { key: 'skillhub', title: 'Skill Hub', badge: 'SH' },
      { key: 'ai-tools', title: 'AI工具', badge: 'AI' },
      { key: 'model-store', title: '模型商店', badge: 'MS' }
    ],
    skillCategories: [
      { key: 'productivity', label: '效率协同' },
      { key: 'development', label: '研发提效' },
      { key: 'marketing', label: '营销增长' }
    ],
    skills: [
      { id: 1, category: 'productivity', name: '会议纪要助手', description: '自动整理会议录音与要点，输出行动项、责任人与截止时间。' },
      { id: 2, category: 'productivity', name: '周报生成器', description: '聚合项目进展、风险与数据指标，快速生成结构化团队周报。' },
      { id: 3, category: 'productivity', name: '知识库问答', description: '连接企业知识库，支持自然语言检索制度、流程与项目文档。' },
      { id: 4, category: 'productivity', name: '流程审阅', description: '识别流程表单中的缺失字段与异常审批节点，降低人工审核成本。' },
      { id: 5, category: 'development', name: '代码评审清单', description: '基于团队规范生成代码评审建议，覆盖安全、性能和可维护性。' },
      { id: 6, category: 'development', name: '接口文档生成', description: '根据接口定义自动生成 API 文档、调用示例与错误码说明。' },
      { id: 7, category: 'development', name: '测试用例补全', description: '分析业务分支与边界条件，推荐单测、集成测试与回归用例。' },
      { id: 8, category: 'development', name: '故障复盘助手', description: '整理告警、日志和时间线，形成故障原因、影响面与改进项。' },
      { id: 9, category: 'marketing', name: '活动文案创作', description: '按照品牌语气生成多渠道活动文案，支持标题、短信和海报内容。' },
      { id: 10, category: 'marketing', name: '竞品洞察摘要', description: '汇总竞品动态、卖点与价格变化，为运营决策提供参考。' },
      { id: 11, category: 'marketing', name: '用户反馈聚类', description: '对评论和工单进行主题聚类，提炼核心诉求与优先级建议。' },
      { id: 12, category: 'marketing', name: '投放复盘模板', description: '生成投放数据分析框架，标注异常指标并给出优化方向。' }
    ],
    toolCategories: [
      { key: 'writing', label: '内容创作' },
      { key: 'analysis', label: '数据分析' },
      { key: 'automation', label: '自动化' }
    ],
    tools: [
      { id: 1, category: 'writing', logo: '✍️', name: '智能写作台', description: '面向公告、邮件和方案的多模板内容生成工具。' },
      { id: 2, category: 'writing', logo: '🎨', name: '创意海报助手', description: '基于活动主题生成海报文案、视觉关键词与排版建议。' },
      { id: 3, category: 'writing', logo: '📣', name: '社媒运营助手', description: '生成适配不同平台的短内容、话题标签和发布时间建议。' },
      { id: 4, category: 'writing', logo: '🧾', name: '合同摘要器', description: '提取合同核心条款、风险点和需要关注的履约节点。' },
      { id: 5, category: 'analysis', logo: '📊', name: '指标解读器', description: '自动解读经营看板，定位波动原因并生成管理层摘要。' },
      { id: 6, category: 'analysis', logo: '🔎', name: '日志分析助手', description: '对日志进行异常聚类、根因提示和排障路径推荐。' },
      { id: 7, category: 'analysis', logo: '🧮', name: '财务预测器', description: '结合历史数据生成预算预测、偏差说明与敏感性分析。' },
      { id: 8, category: 'analysis', logo: '🗺️', name: '市场雷达', description: '追踪行业动态与客户反馈，输出市场机会与风险信号。' },
      { id: 9, category: 'automation', logo: '🤖', name: '工单分派机器人', description: '根据问题类型、优先级和团队负载自动分派工单。' },
      { id: 10, category: 'automation', logo: '🔁', name: '审批流助手', description: '自动校验审批材料完整性，并提醒相关负责人处理。' },
      { id: 11, category: 'automation', logo: '📦', name: '资产巡检员', description: '定时巡检模型、工具和技能状态，输出异常报告。' },
      { id: 12, category: 'automation', logo: '⏱️', name: '定时任务编排', description: '通过自然语言配置周期任务、通知规则和执行日志。' }
    ],
    models: [
      {
        id: 1,
        name: 'Nexus GPT Enterprise',
        description: '适合企业知识问答、流程自动化和复杂任务编排的大语言模型服务。',
        supportedModels: ['GPT-4.1', 'GPT-4o', 'GPT-5.3-Codex'],
        appKey: 'nx-ent-8f7a-42c9'
      },
      {
        id: 2,
        name: 'Vision Matrix',
        description: '支持图像理解、票据识别、视觉质检和多模态检索能力。',
        supportedModels: ['Vision-Pro', 'Omni-VL', 'DocScan-Max'],
        appKey: 'nx-vsn-31bd-92ae'
      },
      {
        id: 3,
        name: 'Code Forge',
        description: '面向研发团队的代码生成、修复、评审和测试补全模型套件。',
        supportedModels: ['CodePilot-L', 'Refactor-X', 'TestGen-Pro'],
        appKey: 'nx-code-5c21-aa90'
      },
      {
        id: 4,
        name: 'Data Analyst Suite',
        description: '提供报表洞察、指标解释、预测建模和数据问答能力。',
        supportedModels: ['DataGPT', 'Forecast-M', 'BI-Agent'],
        appKey: 'nx-data-66de-17bf'
      }
    ]
  }),
  getters: {
    navigationItems: (state) => state.sections,
    filteredSkills: (state) => state.skills.filter((item) => item.category === state.activeSkillCategory),
    filteredTools: (state) => state.tools.filter((item) => item.category === state.activeToolCategory)
  },
  actions: {
    setActiveSection(key) {
      this.activeSection = key;
    },
    setActiveSkillCategory(key) {
      this.activeSkillCategory = key;
    },
    setActiveToolCategory(key) {
      this.activeToolCategory = key;
    }
  }
});
