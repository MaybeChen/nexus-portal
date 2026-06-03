import axios from 'axios';

import { isUndefined } from '@/utils';
import { STATUS_CODE, X_WA_TOKEN } from './constant';
import { setCommonHeader } from './processor';
import { useParamsStore } from '@/store';

const instance = axios.create({
  baseURL: '',
  timeout: 6000000,
  withCredentials: false,
  transformResponse: [
    (data) => {
      if (isUndefined(data) || typeof data !== 'string') {
        return data;
      }

      try {
        try {
          const normalizedData = data.replace(/('|")id('|")\: *[0-9]{16,}/g, (bigint) => {
            return bigint.replace(/[0-9]{16,}/g, (big) => {
              return `"${big}"`;
            });
          });
          return JSON.parse(normalizedData);
        } catch (error) {
          return JSON.parse(data);
        }
      } catch (error) {
        return data;
      }
    }
  ]
});

const getLoginUrl = (data = {}) => data?.data?.loginUrl ?? data?.loginUrl;

const isUnauthorizedPayload = (data = {}) => {
  return [data?.code, data?.status, data?.statusCode].some((code) => Number(code) === STATUS_CODE.UNAUTHORIZED);
};

const redirectToLogin = (response = {}) => {
  const loginUrl = getLoginUrl(response.data);

  if (isUndefined(loginUrl) || loginUrl === '') {
    return;
  }

  window.location = `${loginUrl}${encodeURIComponent(window.location.href)}`;
};

const errorProcess = {
  [STATUS_CODE.UNAUTHORIZED]: redirectToLogin
};

const preProcess = (headers) => {
  setCommonHeader(headers);
};

instance.interceptors.request.use(
  (config) => {
    preProcess(config.headers);
    return config;
  },
  (error) => Promise.reject(error)
);

instance.interceptors.response.use(
  (response) => {
    if (response.headers[X_WA_TOKEN]) {
      const store = useParamsStore();
      store.setToken(response.headers[X_WA_TOKEN]);
    }

    if (isUnauthorizedPayload(response.data)) {
      redirectToLogin(response);
      return Promise.reject(response.data);
    }

    if (response.data?.success === false) {
      return Promise.reject(response.data);
    }

    return response.data?.data ?? response.data;
  },
  (error) => {
    const { response } = error;
    const process = errorProcess[response?.status];

    if (!isUndefined(process)) {
      process(response);
    }

    return Promise.reject(error);
  }
);

export const axiosInstance = (method = 'get', url = '', params = {}, data = {}, config = {}) => {
  return instance({ method, url, params, data, ...config });
};

export const uploadInstance = (url = '', file, data = {}, config = {}) => {
  const formData = new FormData();
  formData.append('file', file);

  Object.entries(data).forEach(([key, value]) => {
    if (!isUndefined(value) && value !== null) {
      formData.append(key, value);
    }
  });

  return axiosInstance('post', url, {}, formData, {
    ...config,
    headers: {
      'Content-Type': 'multipart/form-data',
      ...config.headers
    }
  });
};

export const request = {
  get: (url, params = {}, config = {}) => axiosInstance('get', url, params, {}, config),
  post: (url, data = {}, config = {}) => axiosInstance('post', url, {}, data, config),
  put: (url, data = {}, config = {}) => axiosInstance('put', url, {}, data, config),
  delete: (url, params = {}, config = {}) => axiosInstance('delete', url, params, {}, config),
  upload: uploadInstance
};

export default request;
