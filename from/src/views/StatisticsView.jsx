import { useState } from 'react'
import '../styles/statistics.css'

function ageOn(date, today) {
  if (!date) return null
  const [year, month, day] = date.split('-').map(Number)
  const age = today.getFullYear() - year - (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day) ? 1 : 0)
  return Number.isFinite(age) && age >= 0 ? age : null
}

function Breakdown({ title, values, total }) {
  const counts = values.reduce((result, value) => { const key = value || 'Sin información'; result[key] = (result[key] || 0) + 1; return result }, {})
  return <section className="statistics-card"><h2>{title}</h2>{Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([label, count]) => <div className="statistics-row" key={label}><div><span>{label}</span><strong>{count} <small>({total ? Math.round(count * 100 / total) : 0} %)</small></strong></div><div className="statistics-track" aria-hidden="true"><span style={{ width: `${total ? count * 100 / total : 0}%` }} /></div></div>)}{!total && <p>No hay datos para mostrar.</p>}</section>
}

export default function StatisticsView({ members, departments, pastors, events }) {
  const [department, setDepartment] = useState('')
  const [today] = useState(() => new Date())
  const filtered = members.filter((member) => !department || String(member.department) === department)
  const ids = new Set(filtered.map((member) => member.id))
  const departmentName = (id) => departments.find((item) => item.id === id)?.name || 'Sin información'
  const ageGroup = (date) => { const age = ageOn(date, today); return age === null ? 'Sin información' : age < 18 ? '1–17 años' : age < 30 ? '18–29 años' : age < 45 ? '30–44 años' : age < 60 ? '45–59 años' : '60 años o más' }
  const eventCount = (items) => items.filter((event) => ids.has(event.member) || (event.spouse_member && ids.has(event.spouse_member))).length
  const cards = [['Miembros', filtered.length], ['Pastores', pastors.filter((pastor) => ids.has(pastor.member?.id)).length], ['Bautizos', eventCount(events.bautizos)], ['Matrimonios', eventCount(events.matrimonios)], ['Fallecimientos', eventCount(events.fallecimientos)]]
  return <div className="statistics-view"><div className="statistics-toolbar"><p>Resumen de los datos registrados{department ? ' en el departamento seleccionado' : ''}.</p><label>Departamento <select value={department} onChange={(event) => setDepartment(event.target.value)}><option value="">Todos los departamentos</option>{departments.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label></div><div className="statistics-totals">{cards.map(([label, value]) => <div className="statistics-total" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><p className="statistics-note">Los porcentajes se calculan sobre todos los miembros seleccionados, incluidos los fallecidos. Las edades se calculan a la fecha actual; los eventos se cuentan como registros.</p><div className="statistics-grid"><Breakdown title="Género" total={filtered.length} values={filtered.map((member) => ({ hombre: 'Hombres', mujer: 'Mujeres' }[member.gender]))} /><Breakdown title="Grupos de edad" total={filtered.length} values={filtered.map((member) => ageGroup(member.birth_date))} /><Breakdown title="Departamento de residencia" total={filtered.length} values={filtered.map((member) => departmentName(member.department))} /><Breakdown title="Estado civil" total={filtered.length} values={filtered.map((member) => member.marital_status)} /><Breakdown title="Nivel de educación" total={filtered.length} values={filtered.map((member) => member.education_level)} /><Breakdown title="Estado del miembro" total={filtered.length} values={filtered.map((member) => ({ activo: 'Activo', fallecido: 'Fallecido', separado: 'Separado' }[member.status] || member.status))} /></div></div>
}
