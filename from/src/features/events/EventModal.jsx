import { useEffect, useRef, useState } from 'react'
import MemberLookup from '../../components/forms/MemberLookup'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import { findMember } from '../../lib/members'
import { eventService } from '../../services/event-service'

function EventEntry({ category, members, pastors, churches, onClose, onSaved }) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const title = { bautizos: 'Bautizo', matrimonios: 'Matrimonio', fallecimientos: 'Fallecimiento' }[category]
  async function saveEvent(event) {
    event.preventDefault()
    const data = Object.fromEntries(new FormData(event.currentTarget))
    const match = findMember(members, data.persona)
    const member = match.member
    if (!member) { setError(match.ambiguous ? 'Hay varios miembros con ese nombre. Selecciona una sugerencia para identificarlos.' : 'No se encontró el miembro. Busca por nombre, apellido o carnet.'); return }
    const spouseMatch = category === 'matrimonios' ? findMember(members, data.conyuge) : null
    const spouse = spouseMatch?.member
    if (category === 'matrimonios' && !spouse) { setError(spouseMatch.ambiguous ? 'Hay varias personas con ese nombre. Selecciona una sugerencia para el cónyuge.' : 'No se encontró la segunda persona. Busca por nombre, apellido o carnet.'); return }
    if (spouse && spouse.id === member.id) { setError('Selecciona dos personas diferentes.'); return }
    const pastorMembers = pastors.map((item) => item.member).filter(Boolean)
    const pastorMatch = data.pastor?.trim() ? findMember(pastorMembers, data.pastor) : null
    if (data.pastor?.trim() && !pastorMatch.member) { setError(pastorMatch.ambiguous ? 'Hay varios pastores con ese nombre. Selecciona una sugerencia.' : 'No se encontró el pastor. Selecciona uno de los registrados.'); return }
    const pastor = pastorMatch?.member ? pastors.find((item) => item.member?.id === pastorMatch.member.id) : null
    const payload = { member: member.id, date: data.fecha, notes: data.observaciones || '' }
    if (category !== 'fallecimientos') { payload.church = data.iglesia ? Number(data.iglesia) : null; payload.pastor = pastor?.id || null }
    if (category === 'matrimonios') payload.spouse_member = spouse.id
    if (category === 'bautizos') payload.place = data.lugar || ''
    setError(''); setSaving(true)
    try { await eventService.create(category, payload); onSaved() } catch (failure) { setError(failure.message || 'No se pudo guardar el registro.'); setSaving(false) }
  }
  const pastorMembers = pastors.map((pastor) => pastor.member).filter(Boolean)
  return <form className="church-form event-entry" onSubmit={saveEvent}><div className="event-entry__heading"><h3>{title}</h3><Button variant="bare" className="event-entry__close" onClick={onClose} aria-label="Cerrar formulario">×</Button></div><p className="event-entry__note">Selecciona a las personas registradas y completa los datos del acontecimiento.</p><div className="church-form-fields"><MemberLookup label={category === 'matrimonios' ? 'Primera persona' : 'Miembro'} name="persona" members={members} />{category === 'matrimonios' && <MemberLookup label="Segunda persona" name="conyuge" members={members} />}{category === 'bautizos' && <MemberLookup label="Pastor oficiante" name="pastor" members={pastorMembers} placeholder="Buscar pastor por nombre o carnet" />}<label className="admin-field"><span>Fecha</span><input type="date" name="fecha" required /></label>{category !== 'fallecimientos' && <label className="admin-field"><span>Iglesia (opcional)</span><select name="iglesia" defaultValue=""><option value="">Seleccione una iglesia</option>{churches.filter((church) => church.active).map((church) => <option key={church.id} value={church.id}>{church.name} — {church.department}</option>)}</select></label>}{category === 'bautizos' && <label className="admin-field"><span>Lugar (opcional)</span><input name="lugar" placeholder="Lugar o localidad" /></label>}{category === 'matrimonios' && <MemberLookup label="Pastor oficiante (opcional)" name="pastor" members={pastorMembers} required={false} placeholder="Buscar pastor por nombre o carnet" />}<label className="admin-field event-entry__full"><span>Observaciones (opcional)</span><textarea name="observaciones" rows="3" placeholder="Información adicional" /></label></div><Alert>{error}</Alert><div className="church-form-actions"><Button variant="secondary" onClick={onClose} disabled={saving}>Cerrar</Button><Button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar registro'}</Button></div></form>
}

export default function EventModal({ onClose, ...props }) {
  const dialogRef = useRef(null)
  useEffect(() => { const dialog = dialogRef.current; if (!dialog.open) dialog.showModal(); return () => { if (dialog.open) dialog.close() } }, [])
  return <dialog ref={dialogRef} className="event-modal" aria-label="Formulario de acontecimiento" onCancel={(event) => { event.preventDefault(); onClose() }} onClick={(event) => { if (event.target === event.currentTarget) onClose() }}><EventEntry {...props} onClose={onClose} /></dialog>
}
