import api from '../api/axios'

export const groupService = {
  createGroup: (data) =>
    api.post('/api/group', data),

  joinGroup: (token) =>
    api.post(`/api/group/join/${token}`),

  getGroups: () =>
    api.get('/api/group'),

  getGroupById: (id) =>
    api.get(`/api/group/${id}`),

  getSettlement: (id) =>
    api.get(`/api/group/${id}/settlement`),

  generateInvite: (id) =>
    api.post(`/api/group/${id}/invite`),

  updateGroup: (id, data) =>
    api.put(`/api/group/${id}`, data),

  removeMember: (groupId, userId) =>
    api.delete(`/api/group/${groupId}/members/${userId}`),

  deleteGroup: (id) =>
    api.delete(`/api/group/${id}`),

  leaveGroup: (id) =>
    api.post(`/api/group/${id}/leave`),

  promoteMember: (groupId, userId) =>
    api.put(`/api/group/${groupId}/members/${userId}/promote`),
}
