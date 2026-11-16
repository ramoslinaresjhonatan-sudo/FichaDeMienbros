import http from './http.js'

export const churchService = {
  create: (payload) => http.post('/iglesias/', payload).then(({ data }) => data),
  update: (id, payload) => http.patch(`/iglesias/${id}/`, payload).then(({ data }) => data),
  annul: (id) => http.post(`/iglesias/${id}/anular/`).then(({ data }) => data),
  getPublicDirectory: () => http.get('/directorio-iglesias/').then(({ data }) => data),
  createPublic: (payload) => http.post('/directorio-iglesias/', payload).then(({ data }) => data),
}
