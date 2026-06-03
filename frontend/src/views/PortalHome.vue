<template>
  <el-container class="portal-shell">
    <el-header class="portal-header">
      <div class="portal-brand">
        <span class="portal-brand__mark">N</span>
        <div>
          <strong>Nexus Portal</strong>
          <small>AI capability marketplace for every team</small>
        </div>
      </div>

      <div class="portal-user">
        <span class="portal-user__avatar">{{ portal.user.avatar }}</span>
        <div>
          <strong>{{ portal.user.name }}</strong>
          <small>{{ portal.user.role }}</small>
        </div>
      </div>
    </el-header>

    <el-container class="portal-body">
      <el-aside width="248px" class="portal-sidebar">
        <el-menu :default-active="portal.activeSection" class="portal-menu" @select="portal.setActiveSection">
          <el-menu-item v-for="item in portal.navigationItems" :key="item.key" :index="item.key">
            <span class="portal-menu__badge">{{ item.badge }}</span>
            <span>{{ item.title }}</span>
          </el-menu-item>
        </el-menu>
      </el-aside>

      <el-main class="portal-main">
        <section v-if="portal.activeSection === 'skillhub'" class="workspace-panel">
          <div class="workspace-panel__header">
            <div>
              <p>Skill Hub</p>
              <h1>可复用技能资产</h1>
            </div>
            <el-button type="primary" round>发布技能</el-button>
          </div>

          <div class="category-tabs">
            <button
              v-for="category in portal.skillCategories"
              :key="category.key"
              :class="['category-tab', { 'is-active': portal.activeSkillCategory === category.key }]"
              type="button"
              @click="portal.setActiveSkillCategory(category.key)"
            >
              {{ category.label }}
            </button>
          </div>

          <div class="asset-grid asset-grid--quarter">
            <article v-for="skill in portal.filteredSkills" :key="skill.id" class="asset-card skill-card">
              <h3>{{ skill.name }}</h3>
              <p>{{ skill.description }}</p>
              <el-button type="primary" plain round>下载</el-button>
            </article>
          </div>
        </section>

        <section v-else-if="portal.activeSection === 'ai-tools'" class="workspace-panel">
          <div class="workspace-panel__header">
            <div>
              <p>AI工具</p>
              <h1>智能应用工作台</h1>
            </div>
            <el-button type="primary" round>创建工具</el-button>
          </div>

          <div class="category-tabs">
            <button
              v-for="category in portal.toolCategories"
              :key="category.key"
              :class="['category-tab', { 'is-active': portal.activeToolCategory === category.key }]"
              type="button"
              @click="portal.setActiveToolCategory(category.key)"
            >
              {{ category.label }}
            </button>
          </div>

          <div class="asset-grid asset-grid--quarter">
            <article v-for="tool in portal.filteredTools" :key="tool.id" class="asset-card tool-card">
              <span class="tool-card__logo">{{ tool.logo }}</span>
              <h3>{{ tool.name }}</h3>
              <p>{{ tool.description }}</p>
              <el-button type="success" plain round>使用</el-button>
            </article>
          </div>
        </section>

        <section v-else class="workspace-panel">
          <div class="workspace-panel__header">
            <div>
              <p>模型商店</p>
              <h1>模型资产与 AppKey</h1>
            </div>
            <el-button type="primary" round>申请模型</el-button>
          </div>

          <div class="asset-grid asset-grid--half">
            <article v-for="model in portal.models" :key="model.id" class="asset-card model-card">
              <div class="model-card__topline">
                <h3>{{ model.name }}</h3>
                <el-tag type="info">可接入</el-tag>
              </div>
              <p>{{ model.description }}</p>
              <div class="model-card__models">
                <span v-for="item in model.supportedModels" :key="item">{{ item }}</span>
              </div>
              <div class="app-key">
                <code>{{ model.appKey }}</code>
                <el-button size="small" type="primary" plain @click="copyAppKey(model.appKey)">复制</el-button>
              </div>
            </article>
          </div>
        </section>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ElMessage } from 'element-plus';
import { usePortalStore } from '@/stores/portal';

const portal = usePortalStore();

const copyAppKey = async (appKey) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(appKey);
  } else {
    const textArea = document.createElement('textarea');
    textArea.value = appKey;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  }

  ElMessage.success('AppKey 已复制');
};
</script>
