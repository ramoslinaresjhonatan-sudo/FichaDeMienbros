export function memberName(member) {
  return [member.names, member.paternal_surname, member.maternal_surname]
    .filter(Boolean)
    .join(' ')
}

export function calculateAge(date) {
  if (!date) return '—'
  const [year, month, day] = date.split('-').map(Number)
  const today = new Date()
  return today.getFullYear() - year - (
    today.getMonth() + 1 < month ||
    (today.getMonth() + 1 === month && today.getDate() < day)
      ? 1
      : 0
  )
}

export function findMember(members, value) {
  const normalize = (text) => text.trim().toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
  const query = normalize(value || '')
  if (!query) return { member: null, ambiguous: false }

  const exact = members.filter((member) => [
    member.identity_card,
    memberName(member),
    `${memberName(member)} — ${member.identity_card}`,
  ].some((candidate) => normalize(candidate || '') === query))
  const matches = exact.length
    ? exact
    : members.filter((member) => normalize(memberName(member)).includes(query))

  return { member: matches.length === 1 ? matches[0] : null, ambiguous: matches.length > 1 }
}
