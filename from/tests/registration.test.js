import assert from 'node:assert/strict'
import test from 'node:test'
import { admissionMethods, departments, months, registrationSteps } from '../src/data/registration.js'

test('el formulario conserva sus cuatro pasos ordenados', () => {
  assert.equal(registrationSteps.length, 4)
  assert.deepEqual(registrationSteps.map((step) => step.title), ['Datos personales', 'Contacto y domicilio', 'Familia', 'Vida religiosa'])
})

test('los catálogos de registro contienen los valores esperados', () => {
  assert.equal(months.length, 12)
  assert.ok(departments.includes('La Paz'))
  assert.equal(admissionMethods.Rebautismo, 'rebautismo')
})
