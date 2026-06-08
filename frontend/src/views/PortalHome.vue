<template>
  <div class="portal-shell">
    <header class="portal-header">
      <div class="portal-brand">
        <img class="portal-brand__mark" :src="placeholderImage" alt="网页 logo 占位" />
        <div>
          <strong>GTS技术规划与标准专利部-智能化武装库部司</strong>
          <small>算法为刃，智械为盾。</small>
        </div>
      </div>

      <div class="portal-user">
        <img class="portal-user__avatar" :src="displayUser.avatarUrl" alt="用户头像" />
        <strong>{{ displayUser.name }}</strong>
      </div>
    </header>

    <aside class="portal-sidebar">
      <el-menu :default-active="portal.activeSection" class="portal-menu" @select="portal.setActiveSection">
        <el-menu-item v-for="item in portal.navigationItems" :key="item.key" :index="item.key">
          <span class="portal-menu__badge">{{ item.badge }}</span>
          <span>{{ item.title }}</span>
        </el-menu-item>
      </el-menu>
    </aside>

    <main class="portal-main">
      <SkillHub v-if="portal.activeSection === 'skillhub'" />
      <AiTools v-else-if="portal.activeSection === 'ai-tools'" />
      <ModelStore v-else />
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue';

import AiTools from '@/components/AiTools.vue';
import ModelStore from '@/components/ModelStore.vue';
import SkillHub from '@/components/SkillHub.vue';
import { useUserStore } from '@/store';
import { usePortalStore } from '@/stores/portal';

const placeholderImage = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
const portal = usePortalStore();
const userStore = useUserStore();

const displayUser = computed(() => ({
  avatarUrl: userStore.avatar || placeholderImage,
  name: userStore.name || portal.user.name
}));
</script>
