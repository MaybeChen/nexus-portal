import { API_PREFIX } from './constant';
import { request } from './request';

const noop = () => {};

const invoke = (promise, callback = noop) => {
  promise
    .then((data) => callback(data, null))
    .catch((error) => callback(null, error));

  return promise;
};

const withApiPrefix = (path = '') => {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (path.startsWith(API_PREFIX)) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_PREFIX}${normalizedPath}`;
};

export const apiGet = (path, params = {}, callback) => {
  return invoke(request.get(withApiPrefix(path), params), callback);
};

export const apiPost = (path, data = {}, callback) => {
  return invoke(request.post(withApiPrefix(path), data), callback);
};

export const apiPut = (path, data = {}, callback) => {
  return invoke(request.put(withApiPrefix(path), data), callback);
};

export const apiDel = (path, params = {}, callback) => {
  return invoke(request.delete(withApiPrefix(path), params), callback);
};

export const apiUpload = (path, file, data = {}, callback) => {
  return invoke(request.upload(withApiPrefix(path), file, data), callback);
};

const saveBlob = (blob, fileName = 'download') => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export const apiDownload = (path, params = {}, callback) => {
  const promise = request
    .get(withApiPrefix(path), params, { responseType: 'blob' })
    .then((data) => {
      saveBlob(data, params.name);
      return data;
    });

  return invoke(promise, callback);
};

export const get = apiGet;
export const post = apiPost;
export const put = apiPut;
export const del = apiDel;
export const upload = apiUpload;
export const download = apiDownload;

export default {
  apiGet,
  apiPost,
  apiPut,
  apiDel,
  apiUpload,
  apiDownload,
  get,
  post,
  put,
  del,
  upload,
  download
};
