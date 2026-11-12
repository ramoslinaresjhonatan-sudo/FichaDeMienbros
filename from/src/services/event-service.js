import http from './http.js'

export const eventService = {
  create: (category, payload) => http.post(`/${category === 'bautizos' ? 'bautismos' : category}/`, payload).then(({ data }) => data),
}
