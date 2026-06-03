import { NEXUS_API_PREFIX } from './constant';
import { request } from './request';

const noop = () => {};

const invoke = (promise, callback = noop) => {
  promise
    .then((data) => callback(data, null))
    .catch((error) => callback(null, error));

  return promise;
};

const withNexusPrefix = (path = '') => {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (path.startsWith(NEXUS_API_PREFIX)) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${NEXUS_API_PREFIX}${normalizedPath}`;
};

export const nexusGet = (path, params = {}, callback) => {
  return invoke(request.get(withNexusPrefix(path), params), callback);
};

export const nexusPost = (path, data = {}, callback) => {
  return invoke(request.post(withNexusPrefix(path), data), callback);
};

export const nexusPut = (path, data = {}, callback) => {
  return invoke(request.put(withNexusPrefix(path), data), callback);
};

export const nexusDel = (path, params = {}, callback) => {
  return invoke(request.delete(withNexusPrefix(path), params), callback);
};

export const nexusUpload = (path, file, data = {}, callback) => {
  return invoke(request.upload(withNexusPrefix(path), file, data), callback);
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

export const nexusDownload = (path, params = {}, callback) => {
  const promise = request
    .get(withNexusPrefix(path), params, { responseType: 'blob' })
    .then((data) => {
      saveBlob(data, params.name);
      return data;
    });

  return invoke(promise, callback);
};

export const get = nexusGet;
export const post = nexusPost;
export const put = nexusPut;
export const del = nexusDel;
export const upload = nexusUpload;
export const download = nexusDownload;

export default {
  nexusGet,
  nexusPost,
  nexusPut,
  nexusDel,
  nexusUpload,
  nexusDownload,
  get,
  post,
  put,
  del,
  upload,
  download
};
