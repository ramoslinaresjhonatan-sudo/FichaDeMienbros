import http from './http.js'

export const accessService = {
  list: () => http.get('/accesos/').then(({ data }) => data),
  enable: (memberId) => http.post('/accesos/', { member: memberId }).then(({ data }) => data),
  revoke: (accessId) => http.post(`/accesos/${accessId}/revocar/`).then(({ data }) => data),
}
