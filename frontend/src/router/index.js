import { createRouter, createWebHistory } from 'vue-router';
import PortalHome from '@/views/PortalHome.vue';

const routes = [
  {
    path: '/',
    name: 'portal-home',
    component: PortalHome,
    meta: { title: 'Nexus Portal' }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.afterEach((to) => {
  document.title = to.meta.title || 'Nexus Portal';
});

export default router;
