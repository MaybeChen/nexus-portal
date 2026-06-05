import { defineStore } from 'pinia';

export const usePortalStore = defineStore('portal', {
  state: () => ({
    activeSection: 'skillhub',
    activeToolCategory: '通用与办公',
    user: {
      name: '陈超',
      role: 'admin',
      avatar: 'HTP'
    },
    sections: [
      { key: 'skillhub', title: 'Skill Hub', badge: '▱' },
      { key: 'ai-tools', title: 'AI工具', badge: '▣' },
      { key: 'model-store', title: '模型商店', badge: '▤' }
    ],
    skills: [],
    toolCategories: [
      { key: '通用与办公', label: '通用与办公' },
      { key: '邮件与沟通', label: '邮件与沟通' },
      { key: '会议与日程', label: '会议与日程' },
      { key: '搜索与信息查询', label: '搜索与信息查询' },
      { key: '数据分析', label: '数据分析' },
      { key: '其他', label: '其他' }
    ],
    tools: [
      { id: 1, type: '通用与办公', logo: '✍️', name: '智能写作台', description: '面向公告、邮件和方案的多模板内容生成工具。' },
      { id: 2, type: '通用与办公', logo: '🎨', name: '创意海报助手', description: '基于活动主题生成海报文案、视觉关键词与排版建议。' },
      { id: 3, type: '通用与办公', logo: '📣', name: '社媒运营助手', description: '生成适配不同平台的短内容、话题标签和发布时间建议。' },
      { id: 4, type: '通用与办公', logo: '🧾', name: '合同摘要器', description: '提取合同核心条款、风险点和需要关注的履约节点。' },
      { id: 5, type: '数据分析', logo: '📊', name: '指标解读器', description: '自动解读经营看板，定位波动原因并生成管理层摘要。' },
      { id: 6, type: '数据分析', logo: '🔎', name: '日志分析助手', description: '对日志进行异常聚类、根因提示和排障路径推荐。' },
      { id: 7, type: '数据分析', logo: '🧮', name: '财务预测器', description: '结合历史数据生成预算预测、偏差说明与敏感性分析。' },
      { id: 8, type: '数据分析', logo: '🗺️', name: '市场雷达', description: '追踪行业动态与客户反馈，输出市场机会与风险信号。' },
      { id: 9, type: '其他', logo: '🤖', name: '工单分派机器人', description: '根据问题类型、优先级和团队负载自动分派工单。' },
      { id: 10, type: '其他', logo: '🔁', name: '审批流助手', description: '自动校验审批材料完整性，并提醒相关负责人处理。' },
      { id: 11, type: '其他', logo: '📦', name: '资产巡检员', description: '定时巡检模型、工具和技能状态，输出异常报告。' },
      { id: 12, type: '其他', logo: '⏱️', name: '定时任务编排', description: '通过自然语言配置周期任务、通知规则和执行日志。' }
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
    filteredTools: (state) => state.tools.filter((item) => (item.type || item.category) === state.activeToolCategory)
  },
  actions: {
    setActiveSection(key) {
      this.activeSection = key;
    },
    setActiveToolCategory(key) {
      this.activeToolCategory = key;
    },
    setSkills(skills) {
      this.skills = skills;
    },
    setTools(tools) {
      this.tools = tools;
    },
    setModels(models) {
      this.models = models;
    }
  }
});
