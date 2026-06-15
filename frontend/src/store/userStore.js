import { defineStore } from 'pinia';

export const useUserStore = defineStore('user', {
  state() {
    return {
      _id: '',
      _avatar: '', // 头像
      _employeeNumber: '',
      _name: '',
      _role: '',
      _isGts: false,
    };
  },

  getters: {
    id: (state) => state._id,
    avatar: (state) => state._avatar,
    name: (state) => state._name,
    employeeNumber: (state) => state._employeeNumber,
    role: (state) => state._role,
    isGts: (state) => state._isGts,
  },

  actions: {
    setUserInfo(userInfo = {}) {
      const { id, _id, name, avatar, employeeNumber, role } = userInfo;
      this._id = id || _id || '';
      this._name = name || '';
      this._employeeNumber = employeeNumber || '';
      this._avatar = avatar || '';
      this._role = role || '';
    },

    setGts(isGts = false) {
      this._isGts = isGts;
    }
  }
});
