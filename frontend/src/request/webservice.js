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

export const get = nexusGet;
export const post = nexusPost;
export const put = nexusPut;
export const del = nexusDel;
export const upload = nexusUpload;

export default {
  nexusGet,
  nexusPost,
  nexusPut,
  nexusDel,
  nexusUpload,
  get,
  post,
  put,
  del,
  upload
};
