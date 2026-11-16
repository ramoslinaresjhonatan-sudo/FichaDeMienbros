import { useEffect, useState } from 'react'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import { registryService } from '../../services/registry-service'
import { admissionMethods, months, registrationSteps, years } from '../../data/registration'

const editable = ['names', 'paternal_surname', 'maternal_surname', 'gender', 'birth_place', 'marital_status', 'education_level', 'occupation', 'phone', 'address', 'previous_faith', 'father_name', 'father_identity_card', 'mother_name', 'mother_identity_card', 'spouse_name', 'spouse_identity_card']
const choices = {
  gender: ['hombre', 'mujer'],
  marital_status: ['Soltero(a)', 'Casado(a)', 'Unión libre', 'Divorciado(a)', 'Viudo(a)'],
  education_level: ['Sin educación formal', 'Primaria', 'Secundaria', 'Formación técnica', 'Universitaria', 'Licenciatura', 'Especialidad o diplomado', 'Maestría', 'Doctorado', 'Otro'],
}
const titles = { names: 'Nombres', paternal_surname: 'Apellido paterno', maternal_surname: 'Apellido materno', gender: 'Género', birth_place: 'Lugar de nacimiento', marital_status: 'Estado civil', education_level: 'Nivel de educación', occupation: 'Ocupación', phone: 'Teléfono', address: 'Dirección', department: 'Departamento', previous_faith: 'Fe anterior', father_name: 'Nombre del padre', father_identity_card: 'Carnet del padre', mother_name: 'Nombre de la madre', mother_identity_card: 'Carnet de la madre', spouse_name: 'Nombre del cónyuge', spouse_identity_card: 'Carnet del cónyuge', 'religion.church': 'Iglesia', 'religion.baptized': 'Bautizado(a)', 'religion.baptism_month': 'Mes de bautismo', 'religion.baptism_year': 'Año de bautismo', 'religion.pastor_name': 'Pastor oficiante', 'religion.admission_method': 'Forma de admisión' }

export default function OwnMemberRecord() {
  const [member, setMember] = useState(null)
  const [history, setHistory] = useState([])
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [options, setOptions] = useState({ churches: [], departments: [] })
  const [churchDepartment, setChurchDepartment] = useState('')
  const [originalReligion, setOriginalReligion] = useState(null)
  const [originalMember, setOriginalMember] = useState(null)
  async function load() { const data = await registryService.getOwnRecord(); setMember(data.member); setOriginalMember(data.member); setHistory(data.history); setOriginalReligion(data.member.religion); setChurchDepartment(data.member.church_department || '') }
  useEffect(() => { load().catch((failure) => setError(failure.message)) }, [])
  useEffect(() => { registryService.getRegistrationOptions().then(setOptions).catch(() => setError('No se pudieron cargar las iglesias. Intenta nuevamente.')) }, [])
  function update(field, value) { setMember((previous) => ({ ...previous, [field]: value })) }
  function updateReligion(field, value) { setMember((previous) => ({ ...previous, religion: { ...previous.religion, [field]: value } })) }
  async function save(event) {
    event.preventDefault()
    if (step < registrationSteps.length - 1) { setStep(step + 1); return }
    setBusy(true); setError(''); setNotice('')
    try {
      const payload = Object.fromEntries(editable.filter((key) => (member[key] || '') !== (originalMember[key] || '')).map((key) => [key, member[key] || '']))
      if (member.department !== originalMember.department) payload.department = member.department
      if (JSON.stringify(member.religion) !== JSON.stringify(originalReligion)) payload.religion = member.religion
      const result = await registryService.updateOwnRecord(payload)
      setMember(result.member); setOriginalMember(result.member); setHistory(result.history); setOriginalReligion(result.member.religion); setChurchDepartment(result.member.church_department || '')
      setNotice(result.changed ? 'Tus cambios se guardaron en el historial.' : 'No hay cambios para guardar.')
    } catch (failure) { setError(failure.message || 'No se pudieron guardar los cambios.') } finally { setBusy(false) }
  }
  function field(key, label = titles[key], readOnly = false, type = 'text') {
    const isIdentity = key.endsWith('_identity_card')
    return <label className="field" key={key}><span>{label}</span><input type={type} value={member[key] || ''} readOnly={readOnly} inputMode={isIdentity ? 'numeric' : undefined} pattern={isIdentity ? '[0-9]*' : undefined} required={key === 'names' || key === 'paternal_surname'} onChange={readOnly ? undefined : (event) => update(key, isIdentity ? event.target.value.replace(/[^0-9]/g, '') : event.target.value)} /></label>
  }
  function select(key) {
    return <label className="field" key={key}><span>{titles[key]}</span><select value={member[key] || ''} onChange={(event) => update(key, event.target.value)}><option value="">Seleccione una opción</option>{member[key] && !choices[key].includes(member[key]) && <option value={member[key]}>{member[key]}</option>}{choices[key].map((option) => <option key={option} value={option}>{key === 'gender' ? option[0].toUpperCase() + option.slice(1) : option}</option>)}</select></label>
  }
  function historyValue(key, value) {
    if (value === true) return 'Sí'
    if (value === false) return 'No'
    if (value === null || value === undefined || value === '') return 'Sin información'
    if (key === 'religion.church') return options.churches.find((church) => church.id === value)?.name || `Iglesia #${value}`
    if (key === 'department') return options.departments.find((department) => department.id === value)?.name || `Departamento #${value}`
    if (key === 'religion.baptism_month') return months[value - 1] || value
    if (key === 'religion.admission_method') return Object.entries(admissionMethods).find(([, code]) => code === value)?.[0] || value
    return value
  }
  const religion = member?.religion
  return <section className="members-card own-record">
    <p>Completa o corrige tu información. Los cambios se guardarán en el historial. Para modificar tu carnet, fecha de nacimiento o correo de acceso, contacta a administración.</p>
    <Alert>{error}</Alert>{notice && <p role="status">{notice}</p>}
    {member && <>
      <form className="own-record-form" onSubmit={save}>
        <div className="progress-track" role="progressbar" aria-label="Avance del formulario" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step + 1}><span style={{ width: `${(step + 1) * 25}%` }} /></div>
        <h2>{registrationSteps[step].title}</h2>
        {step === 0 && <div className="fields two-columns">{field('names')}{field('paternal_surname')}{field('maternal_surname')}{select('gender')}{field('identity_card', 'Carnet de identidad', true)}{field('birth_date', 'Fecha de nacimiento', true, 'date')}{field('birth_place')}{select('marital_status')}{select('education_level')}{field('occupation')}</div>}
        {step === 1 && <div className="fields two-columns">{field('phone')}{field('email', 'Correo electrónico', true, 'email')}{field('address')}<label className="field"><span>Departamento</span><select value={member.department || ''} onChange={(event) => update('department', event.target.value ? Number(event.target.value) : null)}><option value="">Seleccione un departamento</option>{options.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>{field('previous_faith')}</div>}
        {step === 2 && <div className="fields two-columns">{field('father_name')}{field('father_identity_card', 'Carnet del padre')}{field('mother_name')}{field('mother_identity_card', 'Carnet de la madre')}{field('spouse_name')}{field('spouse_identity_card', 'Carnet del cónyuge')}</div>}
        {step === 3 && <div className="fields two-columns">
          <label className="field"><span>Departamento de la iglesia</span><select value={churchDepartment} onChange={(event) => { setChurchDepartment(event.target.value); updateReligion('church', null) }}><option value="">Todos los departamentos</option>{options.departments.map((department) => <option key={department.id} value={department.name}>{department.name}</option>)}</select></label>
          <div className="field"><label htmlFor="own-record-church">Iglesia</label><select id="own-record-church" value={religion.church || ''} onChange={(event) => updateReligion('church', event.target.value ? Number(event.target.value) : null)}><option value="">Seleccione una iglesia</option>{religion.church && !options.churches.some((church) => church.id === religion.church) && <option value={religion.church}>{member.church_name} (inactiva)</option>}{options.churches.filter((church) => !churchDepartment || church.department === churchDepartment).map((church) => <option key={church.id} value={church.id}>{church.name} — {church.department}</option>)}</select><small className="church-registration-help">¿No aparece? <a href="/iglesias" target="_blank" rel="noopener noreferrer">Registra tu iglesia ↗</a> (abre otra pestaña)</small></div>
          <label className="baptism-check full"><input type="checkbox" checked={religion.baptized} onChange={(event) => setMember((previous) => ({ ...previous, religion: event.target.checked ? { ...previous.religion, baptized: true } : { ...previous.religion, baptized: false, baptism_month: null, baptism_year: null, pastor_name: '', admission_method: '' } }))} /><span>¿Es bautizado(a)?</span></label>
          <label className="field"><span>Mes de bautismo</span><select disabled={!religion.baptized} required={religion.baptized} value={religion.baptism_month || ''} onChange={(event) => updateReligion('baptism_month', event.target.value ? Number(event.target.value) : null)}><option value="">Seleccione el mes</option>{months.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select></label>
          <label className="field"><span>Año de bautismo</span><select disabled={!religion.baptized} required={religion.baptized} value={religion.baptism_year || ''} onChange={(event) => updateReligion('baptism_year', event.target.value ? Number(event.target.value) : null)}><option value="">Seleccione el año</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
          <label className="field full"><span>Forma de admisión</span><select disabled={!religion.baptized} value={religion.admission_method} onChange={(event) => updateReligion('admission_method', event.target.value)}><option value="">Seleccione una opción</option>{Object.entries(admissionMethods).map(([label, value]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="field full"><span>Pastor oficiante</span><input disabled={!religion.baptized} value={religion.pastor_name} onChange={(event) => updateReligion('pastor_name', event.target.value)} placeholder="Nombre completo" /></label>
        </div>}
        <div className="form-actions">{step > 0 ? <Button variant="secondary" onClick={() => setStep(step - 1)}>← Anterior</Button> : <span />}<Button type="submit" disabled={busy}>{step < 3 ? 'Continuar →' : busy ? 'Guardando…' : 'Guardar cambios'}</Button></div>
      </form>
      <section className="own-record-history"><h2>Historial de cambios</h2>{history.length ? history.map((item) => <article key={item.id}><strong>{new Date(item.date).toLocaleString('es-BO')} · {item.actor}</strong><ul>{Object.entries(item.changes).map(([fieldName, change]) => <li key={fieldName}>{titles[fieldName] || fieldName}: {historyValue(fieldName, change.before)} → {historyValue(fieldName, change.after)}</li>)}</ul></article>) : <p>Aún no hay cambios guardados desde esta ficha.</p>}</section>
    </>}
  </section>
}
