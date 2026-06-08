import { useUserStore } from '@/store';

import { EVENT_UPLOAD, USER_INFO } from './constant';
import { nexusGet, nexusPost } from './webservice';

export const getUserInfo = () => {
  return nexusGet(USER_INFO)
    .then((res) => {
      const userStore = useUserStore();
      userStore.setUserInfo(res);
      return res;
    })
    .catch(() => {});
};

export const GetUserInfo = getUserInfo;

export const reportBusinessEvent = (type, logic) => {
  return nexusPost(EVENT_UPLOAD, { type, logic });
};
