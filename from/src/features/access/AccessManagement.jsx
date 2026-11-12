import { useEffect, useState } from 'react'
import MemberLookup from '../../components/forms/MemberLookup'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import TableFrame from '../../components/ui/TableFrame'
import { findMember, memberName } from '../../lib/members'
import { accessService } from '../../services/access-service'

export default function AccessManagement({ members, onChanged }) {
  const [accounts, setAccounts] = useState([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const selected = findMember(members, query)
  useEffect(() => {
    let active = true
    accessService.list().then((data) => { if (active) setAccounts(data.results || data) }).catch((failure) => { if (active) setError(failure.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  async function changeAccess(member, revokeId) {
    setError(''); setMessage(''); setBusy(true)
    try {
      const result = revokeId ? await accessService.revoke(revokeId) : await accessService.enable(member.id)
      setAccounts((previous) => [...previous.filter((account) => account.id !== result.id), result])
      setQuery('')
      setMessage(revokeId ? 'Acceso revocado.' : 'Acceso habilitado. La persona puede ingresar con su cuenta de Google autorizada.')
      onChanged()
    } catch (failure) { setError(failure.message || 'No se pudo actualizar el acceso.') } finally { setBusy(false) }
  }
  return <><form className="church-form access-form" onSubmit={(event) => { event.preventDefault(); if (!selected.member) { setError(selected.ambiguous ? 'Hay varios miembros con ese nombre. Selecciona una sugerencia.' : 'Selecciona un miembro registrado.'); return } changeAccess(selected.member) }}><h3>Habilitar acceso</h3><p>La persona ingresará con Google usando su correo registrado; el carnet no es una contraseña.</p><MemberLookup name="miembro" label="Miembro o pastor" members={members} value={query} onChange={(event) => setQuery(event.target.value)} />{selected.member && <p className="access-form__email">{selected.member.email ? `Correo: ${selected.member.email}` : 'Este miembro no tiene correo registrado.'}</p>}<div className="church-form-actions"><Button type="submit" disabled={busy || !selected.member?.email}>Habilitar acceso</Button></div></form><Alert>{error}</Alert><Alert className="access-feedback" role="status">{message}</Alert><section className="members-card church-directory" aria-label="Accesos de usuarios"><TableFrame><table className="church-table"><thead><tr><th>Miembro</th><th>Correo</th><th>Tipo</th><th>Acceso</th><th>Acciones</th></tr></thead><tbody>{accounts.map((account) => <tr key={account.id}><td>{memberName(account.member)}</td><td>{account.email}</td><td>{account.role === 'pastor' ? 'Pastor' : 'Miembro'}</td><td>{account.is_active ? 'Activo' : 'Inactivo'}</td><td><div className="church-row-actions"><Button className="church-row-action" disabled={busy} onClick={() => changeAccess(account.member, account.is_active ? account.id : null)}>{account.is_active ? 'Revocar' : 'Habilitar'}</Button></div></td></tr>)}{!accounts.length && <tr><td colSpan="5" className="church-empty">{loading ? 'Cargando accesos…' : 'No hay accesos registrados.'}</td></tr>}</tbody></table></TableFrame></section></>
}
