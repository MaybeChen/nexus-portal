import { createRouter, createWebHashHistory } from 'vue-router';
import PortalHome from '@/views/PortalHome.vue';

const routes = [
  {
    path: '/',
    name: 'portal-home',
    component: PortalHome,
    meta: { title: 'WiseOffice' }
  },
  {
    path: '/html2pptx',
    name: 'html2pptx',
    component: () => import('@/views/html2pptx'),
    meta: { title: 'HTML2PPTX - WiseOffice' }
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

router.afterEach((to) => {
  document.title = to.meta.title || 'WiseOffice';
});

export default router;
