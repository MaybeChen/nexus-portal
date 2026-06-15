import { useUserStore } from '@/store';

import { EVENT_UPLOAD, USER_INFO, USER_PERMISSION } from './constant';
import { apiGet, apiPost } from './webservice';

/* 获取用户信息 */
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
/* 日志上传 */
export const reportBusinessEvent = (type, logic) => {
  return apiPost(EVENT_UPLOAD, { type, logic });
};
/* 获取用户权限 */
export const getUserPermission = () => {
  return apiGet(USER_PERMISSION).then(res => {
    const { is_gts = false } = (res ?? {});
    useUserStore().setGts(is_gts);
  }).catch(() => { })
}
