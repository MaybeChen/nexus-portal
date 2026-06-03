import { createPinia } from 'pinia';

import { useParamsStore } from './paramsStore';
import { useUserStore } from './userStore';

const pinia = createPinia();

export { pinia, useParamsStore, useUserStore };
