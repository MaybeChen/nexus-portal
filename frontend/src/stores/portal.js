import { defineStore } from 'pinia';

export const usePortalStore = defineStore('portal', {
  state: () => ({
    sections: [
      {
        key: 'skillhub',
        title: 'SkillHub',
        subtitle: '技能资产中枢',
        description: '统一沉淀组织内的 Prompt、插件、工作流和可复用技能，支持审核、发布与效果追踪。',
        badge: 'SH',
        color: '#635bff',
        metrics: [
          { label: '技能总数', value: '128' },
          { label: '本月调用', value: '36.8k' },
          { label: '待审核', value: '11' }
        ]
      },
      {
        key: 'ai-tools',
        title: 'AI工具',
        subtitle: '智能应用工作台',
        description: '集中管理智能问答、内容生成、数据分析和自动化助手，让团队快速启用 AI 能力。',
        badge: 'AI',
        color: '#0ea5e9',
        metrics: [
          { label: '工具数量', value: '42' },
          { label: '活跃用户', value: '2.4k' },
          { label: '自动化任务', value: '315' }
        ]
      },
      {
        key: 'model-store',
        title: '模型商店',
        subtitle: '模型资产与治理',
        description: '提供模型上架、评测、计费、权限和版本治理，帮助业务选择最合适的模型。',
        badge: 'MS',
        color: '#14b8a6',
        metrics: [
          { label: '模型资产', value: '24' },
          { label: '评测集', value: '86' },
          { label: '上线版本', value: '18' }
        ]
      }
    ]
  }),
  getters: {
    navigationItems: (state) => state.sections.map(({ key, title, badge }) => ({ key, title, badge }))
  }
});
