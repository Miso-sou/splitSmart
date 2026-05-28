import api from '../api/axios'

export const authService = {
  login: (email, password) =>
    api.post('/api/auth/login', { email, password }),

  register: (username, email, password) =>
    api.post('/api/auth/register', { username, email, password }),

  loginAsGuest: (displayName, guestId) =>
    api.post('/api/auth/guest', { displayName, guestId }),

  logout: () =>
    api.post('/api/auth/logout'),

  getMe: () =>
    api.get('/api/auth/me'),

  upgradeGuest: (username, email, password) =>
    api.post('/api/auth/upgrade', { username, email, password }),
}
