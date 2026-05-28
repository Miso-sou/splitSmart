import api from '../api/axios'

export const userService = {
  updateProfile: (data) =>
    api.put('/api/user/profile', data),

  resetPassword: (currentPassword, newPassword) =>
    api.put('/api/user/reset-password', { currentPassword, newPassword }),
}
