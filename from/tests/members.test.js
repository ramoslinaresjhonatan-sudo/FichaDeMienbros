import assert from 'node:assert/strict'
import test from 'node:test'
import { findMember, memberName } from '../src/lib/members.js'

const members = [
  { id: 1, names: 'María', paternal_surname: 'Quispe', maternal_surname: 'Mamani', identity_card: '123' },
  { id: 2, names: 'Mario', paternal_surname: 'Quispe', maternal_surname: '', identity_card: '456' },
]

test('memberName omite apellidos que no fueron registrados', () => {
  assert.equal(memberName(members[1]), 'Mario Quispe')
})

test('findMember encuentra por carnet y por nombre normalizado', () => {
  assert.equal(findMember(members, '123').member.id, 1)
  assert.equal(findMember(members, 'maria quispe mamani').member.id, 1)
})

test('findMember informa una búsqueda ambigua sin escoger un miembro', () => {
  const result = findMember(members, 'quispe')
  assert.equal(result.member, null)
  assert.equal(result.ambiguous, true)
})
