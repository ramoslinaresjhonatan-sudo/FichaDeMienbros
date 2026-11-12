export const registrationSteps = [
  { title: 'Datos personales', hint: 'Comencemos con la identidad del miembro.' },
  { title: 'Contacto y domicilio', hint: '¿Cómo podemos localizarlo?' },
  { title: 'Familia', hint: 'Información de sus vínculos familiares.' },
  { title: 'Vida religiosa', hint: 'Complete su registro dentro de la iglesia.' },
]

export const months = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export const departments = [
  'Beni', 'Chuquisaca', 'Cochabamba', 'La Paz', 'Oruro',
  'Pando', 'Potosí', 'Santa Cruz', 'Tarija',
]

export const years = Array.from(
  { length: new Date().getFullYear() - 1899 },
  (_, index) => new Date().getFullYear() - index,
)

export const admissionMethods = {
  'Bautismo oficial': 'bautismo',
  Rebautismo: 'rebautismo',
  'Voto de la Iglesia': 'voto',
  'Transferencia emitida por otra iglesia': 'transferencia',
}
