<template>
  <el-container class="portal-shell">
    <el-aside width="260px" class="portal-sidebar">
      <div class="portal-brand">
        <span class="portal-brand__mark">N</span>
        <div>
          <strong>Nexus Portal</strong>
          <small>AI Management Suite</small>
        </div>
      </div>

      <el-menu default-active="skillhub" class="portal-menu">
        <el-menu-item v-for="item in portal.navigationItems" :key="item.key" :index="item.key">
          <span class="portal-menu__badge">{{ item.badge }}</span>
          <span>{{ item.title }}</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="portal-header">
        <div>
          <p>综合管理门户</p>
          <h1>Nexus Portal</h1>
        </div>
        <el-button type="primary" round>创建资产</el-button>
      </el-header>

      <el-main class="portal-main">
        <section class="hero-panel">
          <el-tag type="success" effect="dark">SkillHub + AI工具 + 模型商店</el-tag>
          <h2>统一管理企业 AI 能力、工具与模型资产</h2>
          <p>
            Nexus Portal 帮助团队在一个门户中发现技能、启用智能工具、治理模型供应，
            并通过统一指标持续优化 AI 投入产出。
          </p>
        </section>

        <section class="section-grid">
          <PortalSectionCard v-for="section in portal.sections" :key="section.key" :section="section" />
        </section>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import PortalSectionCard from '@/components/PortalSectionCard.vue';
import { usePortalStore } from '@/stores/portal';

const portal = usePortalStore();
</script>
