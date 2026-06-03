import { request } from './request';

const noop = () => {};

const invoke = (promise, callback = noop) => {
  promise
    .then((data) => callback(data, null))
    .catch((error) => callback(null, error));

  return promise;
};

export const get = (path, params = {}, callback) => {
  return invoke(request.get(path, params), callback);
};

export const post = (path, data = {}, callback) => {
  return invoke(request.post(path, data), callback);
};

export const put = (path, data = {}, callback) => {
  return invoke(request.put(path, data), callback);
};

export const del = (path, params = {}, callback) => {
  return invoke(request.delete(path, params), callback);
};

export default {
  get,
  post,
  put,
  del
};
