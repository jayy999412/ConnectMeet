import axios from 'axios';

/**
 * Central Axios instance.
 *
 * - In development the Vite dev server proxies `/api` -> `http://localhost:5000`,
 *   so `VITE_API_BASE_URL` can stay empty and no CORS configuration is needed.
 * - In production it points at the deployed Flask API (Render).
 * - The JWT access token is kept in memory and mirrored to localStorage so a
 *   page refresh keeps the session (only the token is stored, never credentials).
 */
const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export const TOKEN_KEY = 'connectmeet_access_token';

const api = axios.create({
  baseURL: BASE_URL ? `${BASE_URL}/api` : '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
});

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable (private mode) — session simply won't persist */
  }
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const payload = error.response?.data;

    // Normalised error shape used everywhere in the UI.
    const normalised = {
      status: status || 0,
      message:
        payload?.message ||
        payload?.error ||
        (status === 0 ? 'Cannot reach the server. Is the backend running?' : 'Something went wrong.'),
      errors: payload?.errors || null,
    };

    if (status === 401) {
      setToken(null);
    }

    return Promise.reject(normalised);
  }
);

export default api;
