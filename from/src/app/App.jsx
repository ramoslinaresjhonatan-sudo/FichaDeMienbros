import { useEffect, useId, useRef, useState } from 'react'
import { defineCustomElement } from 'ionicons/components/ion-icon.js'
import { peopleOutline, personOutline, homeOutline, mailOutline, lockClosedOutline, eyeOutline, eyeOffOutline, arrowForwardOutline, documentTextOutline, shieldCheckmarkOutline, statsChartOutline } from 'ionicons/icons'
import churchLogo from '../assets/iglesia-horizontal.png'
import churchSymbol from '../assets/simbolo-iglesia.png'
import churchSymbolDark from '../assets/simbolo-iglesia-noche.png'
import '../styles/registration.css'
import '../styles/admin.css'
import '../styles/theme.css'
import '../styles/login.css'
import ThemeSwitch from '../components/ThemeSwitch.jsx'
import LoadingState from '../components/LoadingState.jsx'
import LoadingView from '../views/LoadingView.jsx'
import Statistics from '../views/StatisticsView.jsx'
import { accessService } from '../services/access-service.js'
import { authService, googleStartUrl } from '../services/auth-service.js'
import { churchService } from '../services/church-service.js'
import { eventService } from '../services/event-service.js'
import { registryService } from '../services/registry-service.js'
import { admissionMethods, departments, months, registrationSteps, years } from '../data/registration.js'
import { calculateAge, findMember, memberName } from '../lib/members.js'
import { Field, IdentityField, NameField } from '../components/forms/Field.jsx'
import Alert from '../components/ui/Alert.jsx'
import Button from '../components/ui/Button.jsx'
import SearchInput from '../components/ui/SearchInput.jsx'
import TableFrame from '../components/ui/TableFrame.jsx'
import useTheme from '../hooks/useTheme.js'
import usePanelData from '../hooks/usePanelData.js'
import ChurchDirectoryFeature from '../features/churches/ChurchDirectory.jsx'
import PublicChurchDirectory from '../features/churches/PublicChurchDirectory.jsx'
import AccessManagementFeature from '../features/access/AccessManagement.jsx'
import EventModalFeature from '../features/events/EventModal.jsx'
import LoginView from '../features/auth/LoginView.jsx'
import GoogleLinkView from '../features/auth/GoogleLinkView.jsx'
import WelcomeView from '../features/welcome/WelcomeView.jsx'
import ConsentView from '../features/welcome/ConsentView.jsx'
import MemberRecordView from '../features/welcome/MemberRecordView.jsx'
import OwnMemberRecord from '../features/welcome/OwnMemberRecord.jsx'
import '../styles/public-pages.css'
import '../styles/form-feedback.css'
import '../styles/own-record.css'

defineCustomElement()

const sectionIcons = { miembros: peopleOutline, mificha: documentTextOutline, pastores: personOutline, iglesias: homeOutline, accesos: shieldCheckmarkOutline, estadisticas: statsChartOutline }

function Registration({ onBack, backLabel, churches, departmentsData, theme, accountEmail, isPastor = false, onRegistered, privacyConsent = false }) {
  const [step, setStep] = useState(0)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [birthDate, setBirthDate] = useState({ day: '', month: '', year: '' })
  const [phone, setPhone] = useState('')
  const [emailUser, setEmailUser] = useState('')
  const [emailMode, setEmailMode] = useState('manual')
  const [googleEmail, setGoogleEmail] = useState('')
  const [googleError, setGoogleError] = useState('')
  const googlePopupRef = useRef(null)
  const googleChannelRef = useRef('')
  const [baptized, setBaptized] = useState(false)
  const [hasSpouse, setHasSpouse] = useState(false)
  const [churchDepartment, setChurchDepartment] = useState('')
  const [selectedChurch, setSelectedChurch] = useState('')
  const formRef = useRef(null)
  const isLastStep = step === registrationSteps.length - 1
  const daysInMonth = birthDate.month ? new Date(Number(birthDate.year) || 2000, Number(birthDate.month), 0).getDate() : 31

  useEffect(() => {
    function applyGoogleEmail(data) {
      if (data?.type !== 'ficha-google-email' || !googleChannelRef.current || data.channel !== googleChannelRef.current) return
      googleChannelRef.current = ''
      googlePopupRef.current = null
      if (data.result === 'success' && typeof data.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        setGoogleEmail(data.email)
        setEmailMode('google')
        setGoogleError('')
      } else setGoogleError('No se pudo obtener el correo de Google. Intenta otra vez o escríbelo manualmente.')
    }
    function receiveGoogleEmail(event) {
      if (event.origin !== window.location.origin || event.source !== googlePopupRef.current || event.data?.type !== 'ficha-google-email') return
      applyGoogleEmail(event.data)
    }
    function receiveStoredEmail(event) {
      if (event.key !== `ficha-google-email-${googleChannelRef.current}` || !event.newValue) return
      try { applyGoogleEmail(JSON.parse(event.newValue)) } catch { /* Ignore invalid messages. */ }
    }
    window.addEventListener('message', receiveGoogleEmail)
    window.addEventListener('storage', receiveStoredEmail)
    return () => { window.removeEventListener('message', receiveGoogleEmail); window.removeEventListener('storage', receiveStoredEmail); googlePopupRef.current?.close() }
  }, [])

  function chooseGoogleEmail() {
    setGoogleError('')
    const url = new URL(googleStartUrl)
    url.pathname = url.pathname.replace(/\/start\/?$/, '/registration/')
    url.searchParams.set('origin', window.location.origin)
    const channel = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')
    googleChannelRef.current = channel
    url.searchParams.set('channel', channel)
    const popup = window.open(url.toString(), 'ficha-google-email', 'popup,width=520,height=680')
    if (!popup) { setGoogleError('El navegador bloqueó la ventana de Google. Permite ventanas emergentes o escribe tu correo.'); return }
    googlePopupRef.current = popup
  }

  function updateBirthDate(part, value) {
    formRef.current?.elements.anioNacimiento.setCustomValidity('')
    setBirthDate((previous) => {
      const next = { ...previous, [part]: value }
      const maxDay = next.month ? new Date(Number(next.year) || 2000, Number(next.month), 0).getDate() : 31
      if (Number(next.day) > maxDay) next.day = ''
      return next
    })
  }

  function updateBaptized(checked) {
    setBaptized(checked)
    if (!checked) {
      ;['mesBautismo', 'anioBautismo', 'formaAdmision', 'pastorOficiante'].forEach((name) => {
        const field = formRef.current?.elements.namedItem(name)
        if (field) field.value = ''
      })
    }
  }

  function nextStep() {
    if (!validateStep()) return
    setStep((current) => current + 1)
  }

  function validateStep() {
    formRef.current.querySelectorAll('fieldset:not([disabled]) [data-person-name]').forEach((input) => {
      input.setCustomValidity(input.value && !input.value.trim() ? 'Ingrese un nombre válido.' : '')
    })
    if (step === 0 && birthDate.day && birthDate.month && birthDate.year) {
      const today = new Date()
      const firstBirthday = new Date(Number(birthDate.year) + 1, Number(birthDate.month) - 1, Number(birthDate.day))
      formRef.current.elements.anioNacimiento.setCustomValidity(
        firstBirthday > today ? 'La persona debe tener al menos un año de edad.' : '',
      )
    }
    return formRef.current.reportValidity()
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!isLastStep) { nextStep(); return }
    if (!validateStep()) return
    if (loading) return
    const form = formRef.current
    const value = (name) => form.elements.namedItem(name)?.value?.trim() || ''
    const department = departmentsData.find((item) => item.name === value('departamento'))
    const payload = {
      names: value('nombres'), paternal_surname: value('apellidoPaterno'), maternal_surname: value('apellidoMaterno'),
      identity_card: value('carnet'), gender: value('genero').toLowerCase(),
      birth_date: `${birthDate.year}-${birthDate.month.padStart(2, '0')}-${birthDate.day.padStart(2, '0')}`,
      birth_place: value('lugarNacimiento'), marital_status: value('estadoCivil'), education_level: value('nivelEducacion'), occupation: value('ocupacion'),
      phone: phone ? `+591${phone}` : '', email: value('correo'), address: value('direccion'), department: department?.id || null,
      previous_faith: value('feAnterior'), father_name: value('padre'), father_identity_card: value('carnetPadre'),
      mother_name: value('madre'), mother_identity_card: value('carnetMadre'), spouse_name: hasSpouse ? value('conyuge') : '', spouse_identity_card: hasSpouse ? value('carnetConyuge') : '',
      church: value('iglesia') ? Number(value('iglesia')) : null, is_pastor: isPastor, baptized,
      baptism_month: baptized && value('mesBautismo') ? Number(value('mesBautismo')) : null,
      baptism_year: baptized && value('anioBautismo') ? Number(value('anioBautismo')) : null,
      pastor_name: baptized ? value('pastorOficiante') : '', admission_method: baptized ? admissionMethods[value('formaAdmision')] || '' : '', privacy_consent: privacyConsent,
    }
    if (isPastor && !payload.email) { setSubmitError('El correo es obligatorio para registrar un pastor.'); setStep(1); return }
    setSubmitError('')
    setLoading(true)
    try {
      await registryService.createMember(payload)
      onRegistered?.()
      setSaved(true)
    } catch (error) {
      setSubmitError(error.message || 'No se pudo guardar la ficha. Intenta nuevamente.')
    } finally { setLoading(false) }
  }

  const content = [
    <div className="fields two-columns personal-fields" key="personal">
      <NameField label="Nombres" name="nombres" className="full" autoFocus required placeholder="Ej. María Elena" />
      <NameField label="Apellido paterno" name="apellidoPaterno" required placeholder="Ej. Quispe" />
      <NameField label="Apellido materno" name="apellidoMaterno" placeholder="Ej. Mamani" />
      <label className="field"><span>Género <small className="field-required-note">(obligatorio)</small></span><select name="genero" defaultValue="" required><option value="">Seleccione una opción</option><option>Hombre</option><option>Mujer</option></select></label>
      <IdentityField label="Carnet de identidad" name="carnet" required placeholder="Ej. 1234567" />
      <div className="field birth-date">
        <span id="birth-date-label">Fecha de nacimiento <small className="field-required-note">(obligatorio)</small></span>
        <div className="birth-date-selects" role="group" aria-labelledby="birth-date-label">
          <select aria-label="Día de nacimiento" name="diaNacimiento" required value={birthDate.day} onChange={(event) => updateBirthDate('day', event.target.value)}>
            <option value="">Día</option>
            {Array.from({ length: daysInMonth }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
          </select>
          <select aria-label="Mes de nacimiento" name="mesNacimiento" required value={birthDate.month} onChange={(event) => updateBirthDate('month', event.target.value)}>
            <option value="">Mes</option>
            {months.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
          </select>
          <select aria-label="Año de nacimiento" name="anioNacimiento" required value={birthDate.year} onChange={(event) => updateBirthDate('year', event.target.value)}>
            <option value="">Año</option>
            {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
      </div>
      <Field label="Lugar de nacimiento" name="lugarNacimiento" className="birth-place" placeholder="Ciudad, departamento o país" />
      <label className="field"><span>Estado civil</span><select name="estadoCivil" defaultValue="" onChange={(event) => setHasSpouse(event.target.value === 'Casado(a)')}><option value="">Seleccione una opción</option><option>Soltero(a)</option><option>Casado(a)</option><option>Unión libre</option><option>Divorciado(a)</option><option>Viudo(a)</option></select></label>
      <label className="field"><span>Nivel de educación</span><select name="nivelEducacion" defaultValue=""><option value="">Seleccione una opción</option><option>Sin educación formal</option><option>Primaria</option><option>Secundaria</option><option>Formación técnica</option><option>Universitaria</option><option>Licenciatura</option><option>Especialidad o diplomado</option><option>Maestría</option><option>Doctorado</option><option>Otro</option></select></label>
      <Field label="Ocupación / profesión" name="ocupacion" className="full" placeholder="Ej. Docente" />
    </div>,
    <div className="fields two-columns" key="contacto">
      <label className="field"><span>Teléfono o celular</span><div className="input-affix"><span aria-hidden="true">+591</span><input aria-label="Teléfono o celular, prefijo +591" type="tel" inputMode="numeric" placeholder="70000000" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, ''))} /></div><input type="hidden" name="telefono" value={phone ? `+591${phone}` : ''} /></label>
      <div className="field email-field"><span>Correo electrónico</span>
        <div className="email-options" aria-label="Opciones de correo">
          <Button variant="bare" className={emailMode === 'manual' ? 'is-active' : ''} aria-pressed={emailMode === 'manual'} onClick={() => setEmailMode('manual')}>Escribir Gmail</Button>
          <Button variant="bare" className={`email-google-button ${emailMode === 'google' ? 'is-active' : ''}`} aria-pressed={emailMode === 'google'} onClick={chooseGoogleEmail}><svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.19 3.32v2.76h3.56c2.08-1.92 3.27-4.75 3.27-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.11A6.61 6.61 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18a11 11 0 0 0 0 9.9z"/><path fill="#EA4335" d="M12 5.36c1.62 0 3.06.56 4.2 1.64l3.15-3.15A10.57 10.57 0 0 0 12 1a11 11 0 0 0-9.82 6.05l3.66 2.84C6.71 7.29 9.14 5.36 12 5.36z"/></svg>Continuar con Google</Button>
          {accountEmail && <Button variant="bare" className={emailMode === 'account' ? 'is-active' : ''} aria-pressed={emailMode === 'account'} onClick={() => setEmailMode('account')}>Usar correo de sesión</Button>}
        </div>
        {emailMode === 'manual' ? <><div className="input-affix"><input aria-label="Parte del correo antes de arroba Gmail" type="text" autoComplete="off" placeholder="Ej. juan.perez" pattern="[A-Za-z0-9]+([.][A-Za-z0-9]+)*" title="Escribe la parte anterior a @gmail.com, usando letras, números y puntos entre caracteres." value={emailUser} onChange={(event) => setEmailUser(event.target.value.split('@')[0].replace(/\s/g, ''))} /><span aria-hidden="true">@gmail.com</span></div><small className="field-note">Escribe solo la parte anterior a @gmail.com.</small></> : <input aria-label="Correo seleccionado" type="email" value={emailMode === 'google' ? googleEmail : accountEmail} readOnly />}
        <input type="hidden" name="correo" value={emailMode === 'google' ? googleEmail : emailMode === 'account' ? accountEmail : emailUser ? `${emailUser}@gmail.com` : ''} />
        {googleError && <small className="church-error" role="alert">{googleError}</small>}
      </div>
      <Field label="Dirección de domicilio" name="direccion" className="full" placeholder="Zona, calle, número y referencia" />
      <label className="field"><span>Departamento</span><select name="departamento" defaultValue=""><option value="">Seleccione un departamento</option>{departments.map((department) => <option key={department} value={department}>{department}</option>)}</select></label>
      <Field label="Fe anterior" name="feAnterior" placeholder="Si corresponde" />
    </div>,
    <div className="family-groups" key="familia">
      <div className="family-group" role="group" aria-labelledby="family-father">
        <h3 id="family-father">Padre</h3>
        <div className="family-group__fields">
          <NameField label="Nombre completo" name="padre" placeholder="Nombre del padre" />
          <IdentityField label="Carnet (opcional)" name="carnetPadre" placeholder="Solo números" />
        </div>
      </div>
      <div className="family-group" role="group" aria-labelledby="family-mother">
        <h3 id="family-mother">Madre</h3>
        <div className="family-group__fields">
          <NameField label="Nombre completo" name="madre" placeholder="Nombre de la madre" />
          <IdentityField label="Carnet (opcional)" name="carnetMadre" placeholder="Solo números" />
        </div>
      </div>
      <div className="family-group" role="group" aria-labelledby="family-spouse">
        <label className="spouse-check" id="family-spouse"><input type="checkbox" checked={hasSpouse} onChange={(event) => setHasSpouse(event.target.checked)} aria-controls="spouse-fields" /><span>Agregar datos del cónyuge</span></label>
        <fieldset id="spouse-fields" className="family-group__fields spouse-fields" hidden={!hasSpouse} disabled={!hasSpouse}>
          <NameField label="Nombre completo" name="conyuge" placeholder="Nombre del cónyuge" />
          <IdentityField label="Carnet (opcional)" name="carnetConyuge" placeholder="Solo números" />
        </fieldset>
      </div>
    </div>,
    <div className="fields two-columns" key="religiosa">
      <label className="field"><span>Departamento de la iglesia</span><select value={churchDepartment} onChange={(event) => { setChurchDepartment(event.target.value); setSelectedChurch('') }}><option value="">Todos los departamentos</option>{departmentsData.map((department) => <option key={department.id} value={department.name}>{department.name}</option>)}</select></label>
      <div className="field"><label htmlFor="registration-church">Iglesia</label><select id="registration-church" name="iglesia" value={selectedChurch} onChange={(event) => setSelectedChurch(event.target.value)}><option value="">Seleccione una iglesia</option>{churches.filter((church) => church.active && (!churchDepartment || church.department === churchDepartment)).map((church) => <option key={church.id} value={church.id}>{church.name} — {church.department}</option>)}</select><small className="church-registration-help">¿No aparece? <a href="/iglesias" target="_blank" rel="noopener noreferrer">Registra tu iglesia ↗</a> (abre otra pestaña)</small></div>
      <label className="baptism-check full"><input type="checkbox" name="bautizado" checked={baptized} onChange={(event) => updateBaptized(event.target.checked)} /><span>¿Es bautizado(a)?</span></label>
      <label className="field"><span>Mes de bautismo</span><select name="mesBautismo" required={baptized} disabled={!baptized} defaultValue=""><option value="">Seleccione el mes</option>{months.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select></label>
      <label className="field"><span>Año de bautismo</span><select name="anioBautismo" required={baptized} disabled={!baptized} defaultValue=""><option value="">Seleccione el año</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
      <label className="field full"><span>Forma de admisión</span><select name="formaAdmision" disabled={!baptized} defaultValue=""><option value="">Seleccione una opción</option><option>Bautismo oficial</option><option>Rebautismo</option><option>Voto de la Iglesia</option><option>Transferencia emitida por otra iglesia</option></select></label>
      <Field label="Pastor oficiante" name="pastorOficiante" className="full" placeholder="Nombre completo" disabled={!baptized} />
    </div>,
  ]

  if (saved) return (
    <main className="page-shell" data-theme={theme}><section className="success-card registration-transition registration-transition--success">
      <div className="check">✓</div><p className="eyebrow">REGISTRO COMPLETADO</p><h1>Información lista</h1>
      <p>La ficha de {isPastor ? 'pastor' : 'miembro'} se guardó correctamente.{isPastor && ' La cuenta de acceso requiere activación por un administrador.'}</p>
      <div className="completion-actions"><Button variant="bare" onClick={() => { setSaved(false); setStep(0); setBirthDate({ day: '', month: '', year: '' }); setPhone(''); setEmailUser(''); setEmailMode('manual'); setBaptized(false); setHasSpouse(false); setChurchDepartment(''); setSelectedChurch(''); formRef.current?.reset() }}>Registrar {isPastor ? 'otro pastor' : 'otro miembro'}</Button><Button variant="secondary" onClick={onBack}>{backLabel}</Button></div>
    </section></main>
  )

  return (
    <main className="page-shell" data-theme={theme}>
      {loading && <section className="success-card registration-transition" aria-label="Guardando registro"><LoadingState label="Guardando información…" /></section>}
      <form className="wizard" ref={formRef} onSubmit={handleSubmit} hidden={loading}>
        <input type="hidden" name="tipoRegistro" value={isPastor ? 'pastor' : 'miembro'} />
        <div className="wizard-main">
        <div className="topline"><span className="form-brand"><img src={churchSymbol} alt="" />Ficha de {isPastor ? 'pastor' : 'miembro'}</span><Button variant="bare" className="back-link" onClick={onBack}>← {backLabel}</Button></div>
        <div className="progress-track" role="progressbar" aria-label="Avance del registro" aria-valuemin={0} aria-valuemax={4} aria-valuenow={step + 1}><span style={{ width: `${(step + 1) * 25}%` }} /></div>
        <section className="step-content">
          <h2 className="step-title" key={step}>{registrationSteps[step].title}</h2>
          {content.map((panel, index) => <fieldset className="step-panel" key={index} hidden={step !== index} disabled={step !== index} aria-label={registrationSteps[index].title}>{panel}</fieldset>)}
        </section>
        <Alert>{submitError}</Alert>
        <footer className="form-actions">
          {step > 0 ? <Button variant="secondary" onClick={() => setStep((current) => current - 1)}>← Anterior</Button> : <span />}
          {isLastStep ? <Button key="finalizar" variant="bare" type="submit">Finalizar registro →</Button> : <Button key="continuar" variant="bare" onClick={nextStep}>Continuar →</Button>}
        </footer>
        </div>
      </form>
    </main>
  )
}

// Deprecated transitional implementations: the active panel imports the feature modules below.
// They are retained temporarily only to preserve a small, reversible migration boundary.
// oxlint-disable-next-line no-unused-vars
function ChurchDirectory({ churches, setChurches, departmentsData, canEdit = true }) {
  const [editing, setEditing] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [department, setDepartment] = useState('')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')

  function closeForm() { setFormOpen(false); setEditing(null); setName(''); setDepartment(''); setError('') }
  async function submit(event) {
    event.preventDefault()
    const cleanName = name.trim()
    if (!cleanName || !department) { setError('Selecciona un departamento e ingresa el nombre de la iglesia.'); return }
    if (churches.some((church) => church.id !== editing && church.department === department && church.name.toLocaleLowerCase('es') === cleanName.toLocaleLowerCase('es'))) { setError('Ya existe una iglesia con ese nombre en este departamento.'); return }
    const selectedDepartment = departmentsData.find((item) => item.name === department)
    if (!selectedDepartment) { setError('No se pudo encontrar el departamento.'); return }
    try {
      const payload = { name: cleanName, department: selectedDepartment.id }
      const result = editing ? await churchService.update(editing, payload) : await churchService.create(payload)
      const church = { id: result.id, name: result.name, department, active: result.status === 'activa' }
      setChurches((previous) => editing ? previous.map((item) => item.id === editing ? church : item) : [...previous, church])
      closeForm()
    } catch (error) { setError(error.message) }
  }
  function edit(church) { setEditing(church.id); setName(church.name); setDepartment(church.department); setError(''); setFormOpen(true) }
  async function annul(church) {
    if (window.confirm(`¿Anular la iglesia "${church.name}"?`)) {
      try {
        await churchService.annul(church.id)
        setChurches((previous) => previous.map((item) => item.id === church.id ? { ...item, active: false } : item))
        if (editing === church.id) closeForm()
      } catch (error) { setError(error.message) }
    }
  }
  const filtered = churches.filter((church) => `${church.name} ${church.department}`.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es')))
  return <>
    <div className="church-actions">{canEdit && !formOpen && <Button onClick={() => setFormOpen(true)}>＋ Nueva iglesia</Button>}</div>
    {!formOpen && <Alert>{error}</Alert>}
    {formOpen && <form className="church-form" onSubmit={submit}>
      <h3>{editing ? 'Editar iglesia' : 'Nueva iglesia'}</h3>
      <div className="church-form-fields"><label className="admin-field"><span>Departamento</span><select value={department} onChange={(event) => setDepartment(event.target.value)} required><option value="">Seleccione un departamento</option>{departments.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="admin-field"><span>Nombre de la iglesia</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre de la iglesia" required /></label></div>
      <Alert>{error}</Alert>
      <div className="church-form-actions"><Button variant="secondary" onClick={closeForm}>Cancelar</Button><Button type="submit">{editing ? 'Guardar cambios' : 'Crear iglesia'}</Button></div>
    </form>}
    <section className="members-card church-directory" aria-label="Listado de iglesias"><div className="members-heading"><span className="member-count">{filtered.length} {filtered.length === 1 ? 'iglesia' : 'iglesias'}</span></div>
      <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre o departamento" label="Buscar iglesia por nombre o departamento" />
      <TableFrame><table className="church-table"><thead><tr><th>Nombre</th><th>Departamento</th><th>Estado</th>{canEdit && <th>Acciones</th>}</tr></thead><tbody>{filtered.map((church) => <tr key={church.id}><td>{church.name}</td><td>{church.department}</td><td><span className={`church-status ${church.active ? 'active' : 'inactive'}`}>{church.active ? 'Activa' : 'Anulada'}</span></td>{canEdit && <td><div className="church-row-actions">{church.active ? <><Button className="church-row-action" onClick={() => edit(church)}>Editar</Button><Button className="church-row-action annul-action" onClick={() => annul(church)}>Anular</Button></> : <span>—</span>}</div></td>}</tr>)}{filtered.length === 0 && <tr><td colSpan={canEdit ? 4 : 3} className="church-empty">{query ? 'No hay iglesias que coincidan con la búsqueda.' : 'Todavía no hay iglesias registradas.'}</td></tr>}</tbody></table></TableFrame>
    </section>
  </>
}

function MemberLookup({ name, label, members, required = true, placeholder = 'Buscar por nombre, apellido o carnet', ...props }) {
  const listId = useId()
  return <label className="admin-field"><span>{label}</span>
    <input name={name} type="text" list={listId} autoComplete="off" required={required} placeholder={placeholder} {...props} />
    <datalist id={listId}>{members.map((member) => <option key={member.id} value={`${memberName(member)} — ${member.identity_card}`} />)}</datalist>
  </label>
}


// oxlint-disable-next-line no-unused-vars
function AccessManagement({ members, onChanged }) {
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
    setError('')
    setMessage('')
    setBusy(true)
    try {
      const result = revokeId ? await accessService.revoke(revokeId) : await accessService.enable(member.id)
      setAccounts((previous) => [...previous.filter((account) => account.id !== result.id), result])
      setQuery('')
      setMessage(revokeId ? 'Acceso revocado.' : 'Acceso habilitado. La persona puede ingresar con su cuenta de Google autorizada.')
      onChanged()
    } catch (failure) { setError(failure.message || 'No se pudo actualizar el acceso.') }
    finally { setBusy(false) }
  }

  return <>
    <form className="church-form access-form" onSubmit={(event) => { event.preventDefault(); if (!selected.member) { setError(selected.ambiguous ? 'Hay varios miembros con ese nombre. Selecciona una sugerencia.' : 'Selecciona un miembro registrado.'); return } changeAccess(selected.member) }}>
      <h3>Habilitar acceso</h3>
      <p>La persona ingresará con Google usando su correo registrado; el carnet no es una contraseña.</p>
      <MemberLookup name="miembro" label="Miembro o pastor" members={members} value={query} onChange={(event) => setQuery(event.target.value)} />
      {selected.member && <p className="access-form__email">{selected.member.email ? `Correo: ${selected.member.email}` : 'Este miembro no tiene correo registrado.'}</p>}
      <div className="church-form-actions"><Button type="submit" disabled={busy || !selected.member?.email}>Habilitar acceso</Button></div>
    </form>
    <Alert>{error}</Alert>
    <Alert className="access-feedback" role="status">{message}</Alert>
    <section className="members-card church-directory" aria-label="Accesos de usuarios">
      <TableFrame><table className="church-table"><thead><tr><th>Miembro</th><th>Correo</th><th>Tipo</th><th>Acceso</th><th>Acciones</th></tr></thead><tbody>
        {accounts.map((account) => <tr key={account.id}><td>{memberName(account.member)}</td><td>{account.email}</td><td>{account.role === 'pastor' ? 'Pastor' : 'Miembro'}</td><td>{account.is_active ? 'Activo' : 'Inactivo'}</td><td><div className="church-row-actions"><Button className="church-row-action" disabled={busy} onClick={() => changeAccess(account.member, account.is_active ? account.id : null)}>{account.is_active ? 'Revocar' : 'Habilitar'}</Button></div></td></tr>)}
        {!accounts.length && <tr><td colSpan="5" className="church-empty">{loading ? 'Cargando accesos…' : 'No hay accesos registrados.'}</td></tr>}
      </tbody></table></TableFrame>
    </section>
  </>
}

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
    setError('')
    const payload = { member: member.id, date: data.fecha, notes: data.observaciones || '' }
    if (category !== 'fallecimientos') {
      payload.church = data.iglesia ? Number(data.iglesia) : null
      payload.pastor = pastor?.id || null
    }
    if (category === 'matrimonios') payload.spouse_member = spouse.id
    if (category === 'bautizos') payload.place = data.lugar || ''
    setSaving(true)
    try {
      await eventService.create(category, payload)
      onSaved()
    } catch (failure) {
      setError(failure.message || 'No se pudo guardar el registro.')
      setSaving(false)
    }
  }

  return <form className="church-form event-entry" onSubmit={saveEvent}>
    <div className="event-entry__heading"><h3>{title}</h3><Button variant="bare" className="event-entry__close" onClick={onClose} aria-label="Cerrar formulario">×</Button></div>
    <p className="event-entry__note">Selecciona a las personas registradas y completa los datos del acontecimiento.</p>
    <div className="church-form-fields">
      <MemberLookup label={category === 'matrimonios' ? 'Primera persona' : 'Miembro'} name="persona" members={members} />
      {category === 'matrimonios' && <MemberLookup label="Segunda persona" name="conyuge" members={members} />}
      {category === 'bautizos' && <MemberLookup label="Pastor oficiante" name="pastor" members={pastors.map((pastor) => pastor.member).filter(Boolean)} placeholder="Buscar pastor por nombre o carnet" />}
      <label className="admin-field"><span>Fecha</span><input type="date" name="fecha" required /></label>
      {category !== 'fallecimientos' && <label className="admin-field"><span>Iglesia (opcional)</span><select name="iglesia" defaultValue=""><option value="">Seleccione una iglesia</option>{churches.filter((church) => church.active).map((church) => <option key={church.id} value={church.id}>{church.name} — {church.department}</option>)}</select></label>}
      {category === 'bautizos' && <label className="admin-field"><span>Lugar (opcional)</span><input name="lugar" placeholder="Lugar o localidad" /></label>}
      {category === 'matrimonios' && <MemberLookup label="Pastor oficiante (opcional)" name="pastor" members={pastors.map((pastor) => pastor.member).filter(Boolean)} required={false} placeholder="Buscar pastor por nombre o carnet" />}
      <label className="admin-field event-entry__full"><span>Observaciones (opcional)</span><textarea name="observaciones" rows="3" placeholder="Información adicional" /></label>
    </div>
    <Alert>{error}</Alert>
    <div className="church-form-actions"><Button variant="secondary" onClick={onClose} disabled={saving}>Cerrar</Button><Button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar registro'}</Button></div>
  </form>
}

// oxlint-disable-next-line no-unused-vars
function EventModal({ onClose, ...props }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog.open) dialog.showModal()
    return () => { if (dialog.open) dialog.close() }
  }, [])

  return <dialog ref={dialogRef} className="event-modal" aria-label="Formulario de acontecimiento" onCancel={(event) => { event.preventDefault(); onClose() }} onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <EventEntry {...props} onClose={onClose} />
  </dialog>
}

function App() {
  const [view, setView] = useState('welcome')
  const [registrationOrigin, setRegistrationOrigin] = useState('admin')
  const [accountEmail, setAccountEmail] = useState('')
  const [accountName, setAccountName] = useState('')
  const [accountPicture, setAccountPicture] = useState('')
  const [accountRole, setAccountRole] = useState('')
  const [accountMember, setAccountMember] = useState(null)
  const [theme, setTheme] = useTheme()
  const [sidebarExpanded, setSidebarExpanded] = useState(() => !window.matchMedia('(max-width: 760px)').matches)
  const [sidebarHidden, setSidebarHidden] = useState(false)
  const sidebarBubbleRef = useRef(null)
  const sidebarHideRef = useRef(null)
  const sidebarWasHidden = useRef(false)
  const [query, setQuery] = useState('')
  const [section, setSection] = useState('miembros')
  const [memberCategory, setMemberCategory] = useState('miembros')
  const [eventFormOpen, setEventFormOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loginError, setLoginError] = useState(() => {
    const error = new URLSearchParams(window.location.search).get('google_error')
    return error ? (error === 'unauthorized' ? 'La cuenta de Google no coincide con el correo autorizado para tu usuario.' : 'No se pudo vincular o iniciar sesión con Google. Inténtalo de nuevo.') : ''
  })
  const [linkBusy, setLinkBusy] = useState(false)
  const [directRegistrationConsent, setDirectRegistrationConsent] = useState(false)
  useEffect(() => {
    function updateField(event) {
      const field = event.target
      if (!field.matches('form input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), form select, form textarea')) return
      const form = field.form
      requestAnimationFrame(() => {
        if (!form) return
        form.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), select, textarea').forEach((input) => {
          const filled = input.value.trim().length > 0
          input.classList.toggle('field-filled', filled && input.validity.valid)
          input.classList.toggle('field-needs-attention', filled && !input.validity.valid)
        })
      })
    }
    document.addEventListener('input', updateField)
    document.addEventListener('change', updateField)
    return () => { document.removeEventListener('input', updateField); document.removeEventListener('change', updateField) }
  }, [])
  const { churches, setChurches, departmentsData, membersData, pastorsData, eventsData, panelError, setPanelError, refresh: refreshPanel } = usePanelData(view)
  const [copyMessage, setCopyMessage] = useState('')
  const [showPastorLink, setShowPastorLink] = useState(false)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const googleError = params.get('google_error')
    if (params.has('google_login') || googleError) window.history.replaceState(null, '', window.location.pathname)
    authService.getCurrentUser().then((user) => {
      if (sessionStorage.getItem('ficha-completar-datos') && user.member) {
        setSection('mificha')
        sessionStorage.removeItem('ficha-completar-datos')
      }
      setAccountEmail(user.email)
      setAccountName(user.display_name || user.username)
      setAccountPicture(user.picture || '')
      setAccountRole(user.role)
      setAccountMember(user.member || null)
      setView((current) => (current === 'login' || current === 'welcome') && window.location.pathname === '/' ? (user.must_link_google ? 'link-google' : 'admin') : current)
    }).catch(() => {})
  }, [])
  useEffect(() => {
    if (sidebarHidden) {
      sidebarWasHidden.current = true
      sidebarBubbleRef.current?.focus()
    } else if (sidebarWasHidden.current) {
      sidebarHideRef.current?.focus()
      sidebarWasHidden.current = false
    }
  }, [sidebarHidden])
  const memberCategories = { miembros: 'Todos', bautizos: 'Bautizos', fallecimientos: 'Fallecimientos', matrimonios: 'Matrimonios' }
  const sections = {
    miembros: { label: 'Miembros', heading: 'Miembros de la iglesia', title: 'Registros de miembros', description: 'Información de las personas registradas', search: 'Buscar por nombre o carnet' },
    ...(accountMember ? { mificha: { label: 'Mi ficha', heading: 'Mi ficha', title: 'Mi ficha' } } : {}),
    pastores: { label: 'Pastores', heading: 'Pastores', title: 'Directorio de pastores', description: 'Información de los pastores', search: 'Buscar pastor' },
    iglesias: { label: 'Iglesias', heading: 'Iglesias', title: 'Directorio de iglesias', description: 'Información de las iglesias', search: 'Buscar iglesia' },
    estadisticas: { label: 'Estadísticas', heading: 'Estadísticas', title: 'Estadísticas' },
    ...(accountRole === 'administrador' ? { accesos: { label: 'Accesos', heading: 'Accesos', title: 'Accesos', search: 'Buscar usuario' } } : {}),
  }
  const activeSection = sections[section]
  const categoryTitle = memberCategory === 'miembros' ? activeSection.title : `Registros de ${memberCategory}`

  if (window.location.pathname.replace(/\/+$/, '') === '/carga') return <LoadingView theme={theme} />

  if (window.location.pathname.replace(/\/+$/, '') === '/registro-miembro') return directRegistrationConsent ? <Registration churches={churches} departmentsData={departmentsData} theme="light" accountEmail={accountEmail} privacyConsent onBack={() => window.location.assign('/')} backLabel="Volver al inicio" /> : <ConsentView onAccept={() => setDirectRegistrationConsent(true)} onBack={() => window.location.assign('/')} />

  if (window.location.pathname.replace(/\/+$/, '') === '/registro-pastor') return directRegistrationConsent ? <Registration churches={churches} departmentsData={departmentsData} theme="light" accountEmail={accountEmail} isPastor privacyConsent onBack={() => window.location.assign('/')} backLabel="Volver al inicio" /> : <ConsentView onAccept={() => setDirectRegistrationConsent(true)} onBack={() => window.location.assign('/')} />

  if (window.location.pathname.replace(/\/+$/, '') === '/iglesias') return <PublicChurchDirectory />

  if (view === 'registro') return <Registration churches={churches} departmentsData={departmentsData} theme={registrationOrigin === 'admin' ? theme : 'light'} accountEmail={accountEmail} privacyConsent onRegistered={refreshPanel} onBack={() => setView(registrationOrigin)} backLabel={registrationOrigin === 'admin' ? 'Volver al panel' : 'Volver al inicio'} />

  if (view === 'consent') return <ConsentView onAccept={() => setView('registro')} onBack={() => setView('welcome')} />

  if (view === 'record') return <MemberRecordView onBack={() => setView('welcome')} />

  if (view === 'welcome') return <WelcomeView onAdmin={() => setView('login')} onRecord={() => setView('record')} onRegister={() => { setRegistrationOrigin('welcome'); setView('consent') }} />

  if (view === 'link-google') return <GoogleLinkView error={loginError} busy={linkBusy} onLink={async () => { setLoginError(''); setLinkBusy(true); try { const result = await authService.beginGoogleLink(); window.location.assign(result.url) } catch (error) { setLoginError(error.message || 'No se pudo iniciar la vinculación.'); setLinkBusy(false) } }} onLogout={async () => { try { await authService.logout(); setAccountEmail(''); setAccountName(''); setAccountPicture(''); setAccountRole(''); setLoginError(''); setView('login') } catch (error) { setLoginError(error.message || 'No se pudo cerrar sesión.') } }} />

  /* Legacy inline markup retained below as a migration reference. */
  if (view === '__legacy-link-google') return (
    <main className="login-page"><div className="login-card google-link-card">
      <img className="login-church-logo" src={churchLogo} alt="Iglesia Adventista del Séptimo Día Movimiento de Reforma Bolivia" />
      <h1>Vincula tu cuenta de Google</h1>
      <p>Para continuar, usa la cuenta de Google correspondiente al correo registrado para tu usuario.</p>
      <Button disabled={linkBusy} onClick={async () => { setLoginError(''); setLinkBusy(true); try { const result = await authService.beginGoogleLink(); window.location.assign(result.url) } catch (error) { setLoginError(error.message || 'No se pudo iniciar la vinculación.'); setLinkBusy(false) } }}>{linkBusy ? 'Conectando…' : 'Vincular con Google'}</Button>
      {loginError && <p className="church-error" role="alert">{loginError}</p>}
      <Button variant="bare" className="registration-link" onClick={async () => { try { await authService.logout(); setAccountEmail(''); setAccountName(''); setAccountPicture(''); setAccountRole(''); setLoginError(''); setView('login') } catch (error) { setLoginError(error.message || 'No se pudo cerrar sesión.') } }}>Cerrar sesión</Button>
    </div></main>
  )

  if (view === 'login') return <LoginView onBack={() => setView('welcome')} error={loginError} onLogin={async (credentials) => { setLoginError(''); try { const user = await authService.login(credentials); setAccountEmail(user.email); setAccountName(user.display_name || user.username); setAccountPicture(user.picture || ''); setAccountRole(user.role); setAccountMember(user.member || null); if (sessionStorage.getItem('ficha-completar-datos') && user.member) { setSection('mificha'); sessionStorage.removeItem('ficha-completar-datos') } setView(user.must_link_google ? 'link-google' : 'admin') } catch (error) { setLoginError(error.message || 'No se pudo iniciar sesión.') } }} />

  if (view === '__legacy-login') return (
    <main className="login-page">
      <div className="login-card">
        <img className="login-church-logo" src={churchLogo} alt="Iglesia Adventista del Séptimo Día Movimiento de Reforma Bolivia" />
        <form className="login-form" aria-label="Acceso al panel" onSubmit={async (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const email = data.get('email').trim(); setLoginError(''); try { const user = await authService.login({ username: email, password: data.get('password') }); setAccountEmail(user.email); setAccountName(user.username); setAccountPicture(user.picture || ''); setAccountRole(user.role); setView(user.must_link_google ? 'link-google' : 'admin') } catch (error) { setLoginError(error.message || 'No se pudo iniciar sesión.') } }}>
          <label className="admin-field"><span>Correo o carnet</span><span className="login-input"><ion-icon src={mailOutline} aria-hidden="true" /><input type="text" name="email" autoComplete="username" placeholder="Correo o número de carnet" required /></span></label>
          <div className="admin-field"><label htmlFor="login-password">Contraseña</label><div className="login-input"><ion-icon src={lockClosedOutline} aria-hidden="true" /><input id="login-password" type={showPassword ? 'text' : 'password'} name="password" autoComplete="current-password" placeholder="Tu contraseña" required /><Button variant="bare" className="password-toggle" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}><ion-icon src={showPassword ? eyeOffOutline : eyeOutline} aria-hidden="true" /></Button></div></div>
          <Button className="login-submit" type="submit">Acceder al panel <ion-icon src={arrowForwardOutline} aria-hidden="true" /></Button>
          {loginError && <p className="church-error" role="alert">{loginError}</p>}
        </form>
        <div className="login-divider"><span>o</span></div>
        <Button variant="bare" className="google-login" onClick={() => window.location.assign(googleStartUrl)}><svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.19 3.32v2.76h3.56c2.08-1.92 3.27-4.75 3.27-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.11A6.61 6.61 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18a11 11 0 0 0 0 9.9z"/><path fill="#EA4335" d="M12 5.36c1.62 0 3.06.56 4.2 1.64l3.15-3.15A10.57 10.57 0 0 0 12 1a11 11 0 0 0-9.82 6.05l3.66 2.84C6.71 7.29 9.14 5.36 12 5.36z"/></svg>Continuar con Google</Button>
        <div className="registration-access"><span>¿Necesitas completar una ficha?</span><Button variant="bare" className="registration-link" onClick={() => { setRegistrationOrigin('login'); setView('registro') }}><ion-icon src={documentTextOutline} aria-hidden="true" /><span>Completar ficha de miembro</span><ion-icon src={arrowForwardOutline} aria-hidden="true" /></Button></div>
      </div>
    </main>
  )

  return (
    <main className={`admin-shell ${sidebarExpanded ? 'sidebar-expanded' : 'sidebar-collapsed'} ${sidebarHidden ? 'sidebar-hidden' : ''}`} data-theme={theme}>
      {sidebarHidden && <Button ref={sidebarBubbleRef} variant="bare" className="sidebar-bubble" aria-label="Mostrar menú lateral" title="Mostrar menú lateral" onClick={() => { setSidebarExpanded(true); setSidebarHidden(false) }}><img src={theme === 'dark' ? churchSymbolDark : churchSymbol} alt="" /></Button>}
      {!sidebarHidden && <aside className="admin-sidebar" aria-label="Menú de administración">
        <div className="sidebar-top"><Button ref={sidebarHideRef} variant="bare" className="sidebar-toggle" aria-label={sidebarExpanded ? 'Contraer menú' : 'Ocultar menú lateral'} title={sidebarExpanded ? 'Contraer menú' : 'Ocultar menú lateral'} aria-controls="admin-navigation" onClick={() => { if (sidebarExpanded) setSidebarExpanded(false); else setSidebarHidden(true) }}><img src={theme === 'dark' ? churchSymbolDark : churchSymbol} alt="" /></Button><div className="sidebar-brand"><strong>Administración</strong></div></div>
        <nav id="admin-navigation" className="sidebar-nav" aria-label="Secciones">
          {Object.entries(sections).map(([key, item]) => <Button key={key} variant="bare" className={`sidebar-item ${section === key ? 'is-active' : ''}`} aria-current={section === key ? 'page' : undefined} aria-label={item.label} title={item.label} onClick={() => { setSection(key); setQuery('') }}><span className="sidebar-item-icon" aria-hidden="true"><ion-icon src={sectionIcons[key]} /></span><span className="sidebar-item-label">{item.label}</span></Button>)}
        </nav>
        <ThemeSwitch theme={theme} onChange={setTheme} />
        <div className="sidebar-account"><span className="account-avatar" aria-hidden="true">{accountPicture ? <img src={accountPicture} alt="" onError={() => setAccountPicture('')} /> : (accountName || accountEmail).charAt(0).toUpperCase()}</span><div className="account-details"><strong title={accountName}>{accountName || 'Usuario'}</strong><span title={accountEmail}>{accountEmail}</span></div></div>
        <Button variant="bare" className="sidebar-logout" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={async () => { try { await authService.logout(); setQuery(''); setAccountEmail(''); setAccountName(''); setAccountPicture(''); setAccountRole(''); setSection('miembros'); setView('login') } catch (error) { setPanelError(error.message || 'No se pudo cerrar sesión.') } }}><span className="sidebar-logout-icon" aria-hidden="true">↪</span><span className="sidebar-logout-label">Cerrar sesión</span></Button>
      </aside>}
      <div className="admin-main">
      <div className="admin-content">
        {panelError && <p className="church-error" role="alert">{panelError}</p>}
        <div className="admin-welcome"><div>{section !== 'pastores' && <h1>{activeSection.heading}</h1>}</div>{section === 'pastores' && <Button className="add-button" onClick={async () => { const url = new URL('/registro-pastor', window.location.origin).href; setShowPastorLink(true); try { await navigator.clipboard.writeText(url); setCopyMessage('Enlace copiado.') } catch { setCopyMessage('No se pudo copiar automáticamente. Selecciona el enlace para copiarlo.') } }}>Copiar enlace de registro</Button>}</div>
        {section === 'pastores' && showPastorLink && <div className="pastor-link-box"><label className="field"><span>Enlace para pastores</span><input value={new URL('/registro-pastor', window.location.origin).href} readOnly onFocus={(event) => event.target.select()} /></label><p role="status">{copyMessage}</p></div>}
        {section === 'mificha' ? <OwnMemberRecord /> : section === 'estadisticas' ? <Statistics members={membersData} departments={departmentsData} pastors={pastorsData} events={eventsData} /> : section === 'accesos' && accountRole === 'administrador' ? <AccessManagementFeature members={membersData} onChanged={refreshPanel} /> : section === 'iglesias' ? <ChurchDirectoryFeature churches={churches} setChurches={setChurches} departmentsData={departmentsData} canEdit={accountRole === 'administrador'} /> : section === 'pastores' ? <section className="members-card church-directory">
          <div className="church-table-wrap"><table className="church-table pastors-table"><thead><tr><th scope="col">Nombre</th><th scope="col">Apellido</th><th scope="col">Edad</th></tr></thead><tbody>{pastorsData.map(({ id, member }) => <tr key={id}><td>{member.names}</td><td>{[member.paternal_surname, member.maternal_surname].filter(Boolean).join(' ')}</td><td>{calculateAge(member.birth_date)}</td></tr>)}{!pastorsData.length && <tr><td colSpan="3" className="church-empty">No hay pastores disponibles.</td></tr>}</tbody></table></div>
        </section> : <>
        {section === 'miembros' && <nav className="member-categories" aria-label="Tipos de registro de miembros">{Object.entries(memberCategories).map(([key, label]) => <Button key={key} variant="bare" className={`category-button ${memberCategory === key ? 'is-active' : ''}`} aria-pressed={memberCategory === key} onClick={() => { setMemberCategory(key); setQuery(''); setEventFormOpen(false) }}>{label}</Button>)}</nav>}
        {accountRole !== 'miembro' && memberCategory !== 'miembros' && <div className="event-entry-actions"><Button onClick={() => setEventFormOpen((open) => !open)} aria-expanded={eventFormOpen}>{eventFormOpen ? 'Cerrar formulario' : `＋ Nuevo ${{ bautizos: 'bautizo', matrimonios: 'matrimonio', fallecimientos: 'fallecimiento' }[memberCategory]}`}</Button></div>}
        {accountRole !== 'miembro' && memberCategory !== 'miembros' && eventFormOpen && <EventModalFeature key={memberCategory} category={memberCategory} members={membersData} pastors={pastorsData} churches={churches} onClose={() => setEventFormOpen(false)} onSaved={() => { setEventFormOpen(false); refreshPanel() }} />}
        <section className="members-card" aria-label={categoryTitle}>
          <label className="search-box"><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={activeSection.search} aria-label={activeSection.search} /></label>
          {memberCategory === 'miembros' ? <div className="church-table-wrap"><table className="church-table"><thead><tr><th>Nombre</th><th>Carnet</th><th>Edad</th></tr></thead><tbody>{membersData.filter((member) => `${member.names} ${member.paternal_surname} ${member.maternal_surname} ${member.identity_card}`.toLowerCase().includes(query.toLowerCase().trim())).map((member) => <tr key={member.id}><td>{[member.names, member.paternal_surname, member.maternal_surname].filter(Boolean).join(' ')}</td><td>{member.identity_card}</td><td>{calculateAge(member.birth_date)}</td></tr>)}</tbody></table></div> : <div className="church-table-wrap"><table className="church-table"><thead><tr><th>Miembro</th><th>Fecha</th></tr></thead><tbody>{eventsData[memberCategory].map((event) => { const member = membersData.find((item) => item.id === event.member); const spouse = memberCategory === 'matrimonios' ? membersData.find((item) => item.id === event.spouse_member) : null; const name = member ? [memberName(member), spouse && memberName(spouse)].filter(Boolean).join(' y ') : '—'; if (!name.toLowerCase().includes(query.toLowerCase().trim())) return null; return <tr key={event.id}><td>{name}</td><td>{memberCategory === 'bautizos' ? event.date || [months[event.month - 1], event.year].filter(Boolean).join(' ') || '—' : event.date || '—'}</td></tr> })}</tbody></table></div>}
        </section>
        </>}
        <p className="admin-footer">Registro de miembros · Panel de administración</p>
      </div>
      </div>
    </main>
  )
}
export default App
