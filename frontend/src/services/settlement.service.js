import api from '../api/axios'

export const settlementService = {
  createSettlement: (data) =>
    api.post('/api/settlements', data),

  getGroupSettlements: (groupId) =>
    api.get(`/api/settlements?groupId=${groupId}`)
}
