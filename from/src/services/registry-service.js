import http, { listAll } from './http.js'

export const registryService = {
  createMember: (payload) => http.post('/registro/', payload).then(({ data }) => data),
  lookupMemberRecord: (payload) => http.post('/consulta-ficha/', payload).then(({ data }) => data),
  getOwnRecord: () => http.get('/mi-ficha/').then(({ data }) => data),
  updateOwnRecord: (payload) => http.patch('/mi-ficha/', payload).then(({ data }) => data),
  getRegistrationOptions: () => http.get('/registro/opciones/').then(({ data }) => data),
  getPanelData: async () => {
    const [members, pastors, churches, departments, baptisms, deaths, marriages] = await Promise.all([
      listAll('/miembros/'), listAll('/pastores/'), listAll('/iglesias/'), listAll('/departamentos/'),
      listAll('/bautismos/'), listAll('/fallecimientos/'), listAll('/matrimonios/'),
    ])
    return { members, pastors, churches, departments, events: { bautizos: baptisms, fallecimientos: deaths, matrimonios: marriages } }
  },
}
