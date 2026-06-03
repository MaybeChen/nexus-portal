import axios from 'axios';

import { API_PREFIX } from './constant';

const DEFAULT_TIMEOUT = 15000;

class Request {
  constructor(config = {}) {
    this.instance = axios.create({
      timeout: DEFAULT_TIMEOUT,
      ...config
    });

    this.instance.interceptors.response.use(
      (response) => response.data,
      (error) => Promise.reject(error)
    );
  }

  normalizeUrl(url = '') {
    if (/^https?:\/\//i.test(url)) {
      return url;
    }

    const normalizedPath = url.startsWith('/') ? url : `/${url}`;
    return `${API_PREFIX}${normalizedPath}`;
  }

  request(options = {}) {
    const { url, ...restOptions } = options;

    return this.instance.request({
      ...restOptions,
      url: this.normalizeUrl(url)
    });
  }

  get(url, params = {}, config = {}) {
    return this.request({ ...config, method: 'get', url, params });
  }

  post(url, data = {}, config = {}) {
    return this.request({ ...config, method: 'post', url, data });
  }

  put(url, data = {}, config = {}) {
    return this.request({ ...config, method: 'put', url, data });
  }

  delete(url, params = {}, config = {}) {
    return this.request({ ...config, method: 'delete', url, params });
  }
}

export const request = new Request();
export default Request;
