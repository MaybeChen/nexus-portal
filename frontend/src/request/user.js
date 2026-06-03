import { useUserStore } from '@/store';

import { USER_INFO } from './constant';
import { nexusGet } from './webservice';

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
