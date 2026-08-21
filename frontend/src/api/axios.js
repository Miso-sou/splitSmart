import axios from 'axios'
import { getAccessToken, setAccessToken } from './tokenStore.js'
import { getCanonicalOrigin } from '../utils/apiUrl.js'

const api = axios.create({
  baseURL: getCanonicalOrigin(),
  withCredentials: true,
})

const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/guest', '/auth/refresh']

// Attach token to outgoing requests & mark auth requests
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    // Mark auth requests so the response interceptor can skip token refresh
    if (config.url && AUTH_PATHS.some(path => config.url.endsWith(path))) {
      config._isAuthRequest = true
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
      // Don't refresh token on login, register, guest-login, or refresh paths
      if (original._isAuthRequest) {
        return Promise.reject(err)
      }

      original._retry = true

      // If a refresh is not already in progress, start one
      if (!refreshPromise) {
        const rawBaseURL = getCanonicalOrigin();
        refreshPromise = axios.post(
          `${rawBaseURL}/api/auth/refresh`,
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
