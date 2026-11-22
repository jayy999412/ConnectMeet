import api, { setToken } from './api';

/** Authentication service — wraps all /api/auth endpoints. */
export const authService = {
  async register({ name, email, password }) {
    const { data } = await api.post('/auth/register', { name, email, password });
    if (data?.token) setToken(data.token);
    return data;
  },

  async login({ email, password }) {
    const { data } = await api.post('/auth/login', { email, password });
    if (data?.token) setToken(data.token);
    return data;
  },

  async me() {
    const { data } = await api.get('/auth/me');
    return data;
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      setToken(null);
    }
  },
};

export default authService;
