<template>
  <div class="portal-shell">
    <aside class="portal-sidebar">
      <div class="portal-brand">
        <img class="portal-brand__mark" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" alt="品牌标识占位" />
        <div>
          <strong>GTS技术规划与标准专利部-智能化武装库部司</strong>
          <small>算法为刃，智械为盾。</small>
        </div>
      </div>

      <el-menu :default-active="portal.activeSection" class="portal-menu" @select="portal.setActiveSection">
        <el-menu-item v-for="item in portal.navigationItems" :key="item.key" :index="item.key">
          <span class="portal-menu__badge">{{ item.badge }}</span>
          <span>{{ item.title }}</span>
        </el-menu-item>
      </el-menu>

      <img class="portal-sidebar__visual" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" alt="侧边栏装饰图占位" />
    </aside>

    <section class="portal-content">
      <header class="portal-header">
        <div></div>
        <div class="portal-user">
          <span class="portal-user__avatar">{{ displayUser.avatar }}</span>
          <div>
            <strong>{{ displayUser.name }}</strong>
            <small>{{ displayUser.role }}</small>
          </div>
          <span class="portal-user__chevron">⌄</span>
        </div>
      </header>

      <main class="portal-main">
        <SkillHub v-if="portal.activeSection === 'skillhub'" />
        <AiTools v-else-if="portal.activeSection === 'ai-tools'" />
        <ModelStore v-else />
      </main>
    </section>
  </div>
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
