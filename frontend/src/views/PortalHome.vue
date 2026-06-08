<template>
  <div class="portal-shell">
    <header class="portal-header">
      <div class="portal-brand">
        <img class="portal-brand__mark" :src="headerLogo" alt="GTS 智能化装备库 logo" />
        <div>
          <strong>GTS技术规划与标准专利部-智能化装备库</strong>
          <small>量身定制专属AI装备库实现部门办公效率倍增</small>
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
          <img
            class="portal-menu__icon"
            :src="navigationIconFor(item.key)"
            :alt="`${item.title}图标`"
          />
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

import aiHighIcon from '@/assets/ai_high.svg';
import aiNormalIcon from '@/assets/ai_normal.svg';
import headerLogo from '@/assets/logo_200.png';
import shopHighIcon from '@/assets/shop_high.svg';
import shopNormalIcon from '@/assets/shop_normal.svg';
import skillsHighIcon from '@/assets/skills_high.svg';
import skillsNormalIcon from '@/assets/skills_normal.svg';

import AiTools from '@/components/AiTools.vue';
import ModelStore from '@/components/ModelStore.vue';
import SkillHub from '@/components/SkillHub.vue';
import { useUserStore } from '@/store';
import { usePortalStore } from '@/stores/portal';

const placeholderImage = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
const navigationIcons = {
  skillhub: { normal: skillsNormalIcon, active: skillsHighIcon },
  'ai-tools': { normal: aiNormalIcon, active: aiHighIcon },
  'model-store': { normal: shopNormalIcon, active: shopHighIcon }
};

const portal = usePortalStore();
const userStore = useUserStore();

const displayUser = computed(() => ({
  avatarUrl: userStore.avatar || placeholderImage,
  name: userStore.name || portal.user.name
}));

const navigationIconFor = (key) => {
  const iconSet = navigationIcons[key];

  if (!iconSet) {
    return placeholderImage;
  }

  return portal.activeSection === key ? iconSet.active : iconSet.normal;
};

</script>
