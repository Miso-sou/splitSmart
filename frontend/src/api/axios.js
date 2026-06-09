import axios from 'axios'
import { getAccessToken, setAccessToken } from './tokenStore.js'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
})

// Attach token to outgoing requests
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

let refreshPromise = null;

// Silent token refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      
      // If a refresh is not already in progress, start one
      if (!refreshPromise) {
        refreshPromise = axios.post(
          `${import.meta.env.VITE_API_URL}/api/auth/refresh`,
          {},
          { withCredentials: true }
        ).then(res => {
          const newToken = res.data.accessToken;
          setAccessToken(newToken);
          refreshPromise = null; // Reset promise on success
          return newToken;
        }).catch(error => {
          refreshPromise = null; // Reset promise on failure
          setAccessToken(null);
          const publicPaths = ['/login', '/register', '/'];
          if (!publicPaths.includes(window.location.pathname)) {
            window.location.href = '/login'
          }
          return Promise.reject(error);
        });
      }

      // Wait for the active refresh to finish, then retry the request
      return refreshPromise.then(newToken => {
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      });
    }
    return Promise.reject(err)
  }
)

export default api
