import http from './http.js'

export const churchService = {
  create: (payload) => http.post('/iglesias/', payload).then(({ data }) => data),
  update: (id, payload) => http.patch(`/iglesias/${id}/`, payload).then(({ data }) => data),
  annul: (id) => http.post(`/iglesias/${id}/anular/`).then(({ data }) => data),
}
