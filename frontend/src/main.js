import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import { createApp } from 'vue';

import App from './App.vue';
import router from './router';
import { pinia } from './store';
import './assets/styles.less';

createApp(App).use(pinia).use(router).use(ElementPlus).mount('#app');
