import { useState } from 'react'
import '../styles/statistics.css'

function ageOn(date, today) {
  if (!date) return null
  const [year, month, day] = date.split('-').map(Number)
  const age = today.getFullYear() - year - (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day) ? 1 : 0)
  return Number.isFinite(age) && age >= 0 ? age : null
}

function percentage(value, total) { return total ? Math.round(value * 100 / total) : 0 }

function Breakdown({ title, values, total }) {
  const counts = values.reduce((result, value) => { const key = value || 'Sin información'; result[key] = (result[key] || 0) + 1; return result }, {})
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  return <section className="statistics-card"><h2>{title}</h2>{entries.map(([label, count]) => <div className="statistics-row" key={label}><div><span>{label}</span><strong>{count} <small>({percentage(count, total)} %)</small></strong></div><div className="statistics-track" aria-hidden="true"><span style={{ width: `${percentage(count, total)}%` }} /></div></div>)}{!total && <p>No hay datos todavía.</p>}</section>
}

function Donut({ active, deceased, separated, total }) {
  const activePercent = percentage(active, total)
  const deceasedPercent = percentage(deceased, total)
  const separatedPercent = percentage(separated, total)
  const background = total ? `conic-gradient(#3b7d5a 0 ${activePercent}%, #ca6f45 ${activePercent}% ${activePercent + deceasedPercent}%, #8f6db1 ${activePercent + deceasedPercent}% ${activePercent + deceasedPercent + separatedPercent}%, #dce5ef ${activePercent + deceasedPercent + separatedPercent}% 100%)` : undefined
  return <section className="statistics-card statistics-card--composition"><div><p className="statistics-kicker">COMPOSICIÓN</p><h2>Estado de los miembros</h2><p className="statistics-card-copy">Una vista rápida de la comunidad seleccionada.</p><div className="statistics-legend"><span><i className="legend-dot legend-dot--active" />Activos <b>{active}</b></span><span><i className="legend-dot legend-dot--deceased" />Fallecidos <b>{deceased}</b></span><span><i className="legend-dot legend-dot--separated" />Separados <b>{separated}</b></span></div></div><div className="statistics-donut" style={{ background }} aria-label={`${total} miembros en total`}><div><strong>{total}</strong><span>miembros</span></div></div></section>
}

function dateFromEvent(event) {
  if (event.date) return new Date(`${event.date}T12:00:00`)
  if (event.year && event.month) return new Date(event.year, event.month - 1, 1)
  return null
}

function ActivityTrend({ events, memberIds, today }) {
  const months = Array.from({ length: 6 }, (_, index) => new Date(today.getFullYear(), today.getMonth() - 5 + index, 1))
  const allEvents = Object.values(events).flat().filter((event) => memberIds.has(event.member) || (event.spouse_member && memberIds.has(event.spouse_member)))
  const values = months.map((month) => allEvents.filter((event) => { const date = dateFromEvent(event); return date && date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth() }).length)
  const maximum = Math.max(...values, 1)
  const total = values.reduce((sum, value) => sum + value, 0)
  const labels = months.map((month) => new Intl.DateTimeFormat('es-BO', { month: 'short' }).format(month).replace('.', ''))
  return <section className="statistics-card statistics-card--trend"><div className="statistics-trend-heading"><div><p className="statistics-kicker">TENDENCIA</p><h2>Actividad reciente</h2><p>{total ? `${total} acontecimiento${total === 1 ? '' : 's'} en los últimos 6 meses.` : 'Los acontecimientos aparecerán aquí al registrarlos.'}</p></div><strong>{total}</strong></div><div className="statistics-bars" aria-label="Acontecimientos registrados en los últimos seis meses">{values.map((value, index) => <div className="statistics-bar" key={`${months[index].getFullYear()}-${months[index].getMonth()}`}><span className="statistics-bar-value">{value || ''}</span><i style={{ height: `${value ? Math.max(12, value * 100 / maximum) : 4}%` }} /><small>{labels[index]}</small></div>)}</div></section>
}

export default function StatisticsView({ members, departments, pastors, events }) {
  const [department, setDepartment] = useState('')
  const [today] = useState(() => new Date())
  const filtered = members.filter((member) => !department || String(member.department) === department)
  const ids = new Set(filtered.map((member) => member.id))
  const departmentName = (id) => departments.find((item) => item.id === id)?.name || 'Sin información'
  const ageGroup = (date) => { const age = ageOn(date, today); return age === null ? 'Sin información' : age < 18 ? '1–17 años' : age < 30 ? '18–29 años' : age < 45 ? '30–44 años' : age < 60 ? '45–59 años' : '60 años o más' }
  const eventCount = (items) => items.filter((event) => ids.has(event.member) || (event.spouse_member && ids.has(event.spouse_member))).length
  const active = filtered.filter((member) => !member.status || member.status === 'activo').length
  const deceased = filtered.filter((member) => member.status === 'fallecido').length
  const separated = filtered.filter((member) => member.status === 'separado').length
  const cards = [['Miembros', filtered.length, 'personas registradas'], ['Pastores', pastors.filter((pastor) => ids.has(pastor.member?.id)).length, 'liderazgo activo'], ['Bautizos', eventCount(events.bautizos), 'registros'], ['Matrimonios', eventCount(events.matrimonios), 'registros'], ['Fallecimientos', eventCount(events.fallecimientos), 'registros']]
  const hasData = filtered.length > 0
  return <div className="statistics-view"><div className="statistics-toolbar"><div><p className="statistics-eyebrow">PANEL DE ANÁLISIS</p><h1>Estadísticas</h1><p>Datos que ayudan a conocer y acompañar mejor a la congregación{department ? ' del departamento seleccionado' : ''}.</p></div><label>Departamento <select value={department} onChange={(event) => setDepartment(event.target.value)}><option value="">Todos los departamentos</option>{departments.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label></div><div className="statistics-totals">{cards.map(([label, value, detail], index) => <div className={`statistics-total statistics-total--${index + 1}`} key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>)}</div>{hasData ? <><div className="statistics-feature-grid"><Donut active={active} deceased={deceased} separated={separated} total={filtered.length} /><ActivityTrend events={events} memberIds={ids} today={today} /></div><p className="statistics-note">Los porcentajes se calculan sobre los miembros seleccionados. Las edades se calculan a la fecha actual y los acontecimientos son registros, no personas únicas.</p><div className="statistics-grid"><Breakdown title="Género" total={filtered.length} values={filtered.map((member) => ({ hombre: 'Hombres', mujer: 'Mujeres' }[member.gender]))} /><Breakdown title="Grupos de edad" total={filtered.length} values={filtered.map((member) => ageGroup(member.birth_date))} /><Breakdown title="Departamento de residencia" total={filtered.length} values={filtered.map((member) => departmentName(member.department))} /><Breakdown title="Estado civil" total={filtered.length} values={filtered.map((member) => member.marital_status)} /><Breakdown title="Nivel de educación" total={filtered.length} values={filtered.map((member) => member.education_level)} /><Breakdown title="Estado del miembro" total={filtered.length} values={filtered.map((member) => ({ activo: 'Activo', fallecido: 'Fallecido', separado: 'Separado' }[member.status] || member.status))} /></div></> : <section className="statistics-empty"><div className="statistics-empty__icon" aria-hidden="true">↗</div><div><p className="statistics-kicker">AÚN NO HAY DATOS</p><h2>Las tendencias aparecerán aquí</h2><p>Cuando registres miembros y acontecimientos, verás su composición, evolución mensual y distribuciones principales.</p></div></section>}</div>
}
