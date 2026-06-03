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
        <span class="portal-user__avatar">{{ displayUser.avatar }}</span>
        <div>
          <strong>{{ displayUser.name }}</strong>
          <small>{{ displayUser.role }}</small>
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
        <SkillHub v-if="portal.activeSection === 'skillhub'" />
        <AiTools v-else-if="portal.activeSection === 'ai-tools'" />
        <ModelStore v-else />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue';

import AiTools from '@/components/AiTools.vue';
import ModelStore from '@/components/ModelStore.vue';
import SkillHub from '@/components/SkillHub.vue';
import { useUserStore } from '@/store';
import { usePortalStore } from '@/stores/portal';

const portal = usePortalStore();
const userStore = useUserStore();

const displayUser = computed(() => ({
  avatar: userStore.avatar || portal.user.avatar,
  name: userStore.name || portal.user.name,
  role: userStore.role || portal.user.role
}));
</script>
