import api from '../api/axios'

export const chatService = {
  getMessages: (groupId) => api.get(`/api/group/${groupId}/messages`),
}
