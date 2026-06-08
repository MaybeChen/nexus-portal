import { useUserStore } from '@/store';

import { EVENT_UPLOAD, USER_INFO } from './constant';
import { apiGet, apiPost } from './webservice';

export const getUserInfo = () => {
  return apiGet(USER_INFO)
    .then((res) => {
      const userStore = useUserStore();
      userStore.setUserInfo(res);
      return res;
    })
    .catch(() => {});
};

export const GetUserInfo = getUserInfo;

export const reportBusinessEvent = (type, logic) => {
  return apiPost(EVENT_UPLOAD, { type, logic });
};
