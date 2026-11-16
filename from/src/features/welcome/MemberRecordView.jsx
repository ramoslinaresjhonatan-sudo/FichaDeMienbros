import { useState } from 'react'
import churchLogo from '../../assets/iglesia-horizontal.png'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import { registryService } from '../../services/registry-service'
import { months, years } from '../../data/registration'
import OwnMemberRecord from './OwnMemberRecord'
import '../../styles/welcome.css'

export default function MemberRecordView({ onBack }) {
  const [record, setRecord] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [birthDate, setBirthDate] = useState({ day: '', month: '', year: '' })
  const daysInMonth = birthDate.month ? new Date(Number(birthDate.year) || 2000, Number(birthDate.month), 0).getDate() : 31
  function updateBirthDate(part, value) {
    setBirthDate((previous) => {
      const next = { ...previous, [part]: value }
      const maxDay = next.month ? new Date(Number(next.year) || 2000, Number(next.month), 0).getDate() : 31
      if (Number(next.day) > maxDay) next.day = ''
      return next
    })
  }
  async function submit(event) { event.preventDefault(); const form = new FormData(event.currentTarget); const date = `${birthDate.year}-${birthDate.month.padStart(2, '0')}-${birthDate.day.padStart(2, '0')}`; setError(''); setRecord(null); setLoading(true); try { setRecord(await registryService.lookupMemberRecord({ identity_card: form.get('identity_card').trim(), birth_date: date })) } catch (failure) { setError(failure.message || 'No se pudo consultar la ficha.') } finally { setLoading(false) } }
  if (record) return <main className="welcome-page"><section className="record-card"><Button variant="secondary" onClick={() => setRecord(null)}>← Volver a la consulta</Button><h1>Completar datos</h1><OwnMemberRecord /></section></main>
  return <main className="welcome-page"><section className="record-card"><img src={churchLogo} alt="Adventista del Séptimo Día Movimiento de Reforma Bolivia" /><p className="consent-kicker">CONSULTA PERSONAL</p><h1>Ver mi ficha</h1><p>Ingresa los datos tal como fueron registrados. Por seguridad, los intentos son limitados.</p><form className="record-form" onSubmit={submit}><label><span>Carnet de identidad</span><input name="identity_card" inputMode="numeric" pattern="[0-9]+" placeholder="Solo números" required /></label><div className="record-birth-date"><span id="record-birth-label">Fecha de nacimiento</span><div className="birth-date-selects" role="group" aria-labelledby="record-birth-label"><select aria-label="Día de nacimiento" required value={birthDate.day} onChange={(event) => updateBirthDate('day', event.target.value)}><option value="">Día</option>{Array.from({ length: daysInMonth }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select><select aria-label="Mes de nacimiento" required value={birthDate.month} onChange={(event) => updateBirthDate('month', event.target.value)}><option value="">Mes</option>{months.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select><select aria-label="Año de nacimiento" required value={birthDate.year} onChange={(event) => updateBirthDate('year', event.target.value)}><option value="">Año</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></div></div><Button type="submit" disabled={loading}>{loading ? 'Consultando…' : 'Consultar ficha'}</Button></form><Alert>{error}</Alert><Button variant="secondary" className="record-back" onClick={onBack}>← Volver al inicio</Button></section></main>
}
