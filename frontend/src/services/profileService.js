import api from './api';

/** Profile service — view / update profile and change password. */
export const profileService = {
  async get() {
    const { data } = await api.get('/profile');
    return data;
  },

  async update(payload) {
    const { data } = await api.put('/profile', payload);
    return data;
  },

  async changePassword({ currentPassword, newPassword }) {
    const { data } = await api.post('/profile/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return data;
  },
};

export default profileService;
