import { useParamsStore } from '@/store';

import { X_WA_TOKEN } from './constant';

export const setCommonHeader = (headers = {}) => {
  const paramsStore = useParamsStore();

  if (paramsStore.token) {
    headers[X_WA_TOKEN] = paramsStore.token;
  }
};
