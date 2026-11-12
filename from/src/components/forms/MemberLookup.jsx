import { useId } from 'react'
import { memberName } from '../../lib/members'

/**
 * Campo reutilizable para seleccionar un miembro sin duplicar el datalist.
 */
export default function MemberLookup({ name, label, members, required = true, placeholder = 'Buscar por nombre, apellido o carnet', ...props }) {
  const listId = useId()

  return <label className="admin-field"><span>{label}</span>
    <input name={name} type="text" list={listId} autoComplete="off" required={required} placeholder={placeholder} {...props} />
    <datalist id={listId}>{members.map((member) => <option key={member.id} value={`${memberName(member)} — ${member.identity_card}`} />)}</datalist>
  </label>
}
