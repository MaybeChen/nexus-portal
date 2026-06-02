const sections = [
  {
    key: 'skillhub',
    title: 'SkillHub',
    description: 'Centralize reusable skills, prompts, integrations, and workflow capabilities.',
    metrics: { total: 128, active: 97, pendingReview: 11 }
  },
  {
    key: 'ai-tools',
    title: 'AI Tools',
    description: 'Manage productivity assistants, analysis workbenches, and automation tools.',
    metrics: { total: 42, active: 35, pendingReview: 4 }
  },
  {
    key: 'model-store',
    title: 'Model Store',
    description: 'Publish, compare, and govern foundation models and domain-specific model assets.',
    metrics: { total: 24, active: 18, pendingReview: 3 }
  }
];

function getPortalCatalog() {
  return {
    name: 'Nexus Portal',
    generatedAt: new Date().toISOString(),
    sections
  };
}

module.exports = {
  getPortalCatalog
};
