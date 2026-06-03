<template>
  <section class="workspace-panel">
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
</template>

<script setup>
import { usePortalStore } from '@/stores/portal';

const portal = usePortalStore();
</script>
