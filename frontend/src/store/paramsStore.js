import { defineStore } from 'pinia';

export const useParamsStore = defineStore('params', {
  state() {
    return {
      _token: ''
    };
  },

  getters: {
    token: (state) => state._token
  },

  actions: {
    setToken(token = '') {
      this._token = token;
    }
  }
});
