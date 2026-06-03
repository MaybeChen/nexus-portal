import axios from 'axios';

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

  request(options = {}) {
    return this.instance.request(options);
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

  upload(url, file, data = {}, config = {}) {
    const formData = new FormData();
    formData.append('file', file);

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value);
      }
    });

    return this.post(url, formData, {
      ...config,
      headers: {
        'Content-Type': 'multipart/form-data',
        ...config.headers
      }
    });
  }
}

export const request = new Request();
export default Request;
