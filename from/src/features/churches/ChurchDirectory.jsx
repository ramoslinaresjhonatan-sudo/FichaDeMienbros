import { useState } from 'react'
import { churchService } from '../../services/church-service'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import SearchInput from '../../components/ui/SearchInput'
import TableFrame from '../../components/ui/TableFrame'

export default function ChurchDirectory({ churches, setChurches, departmentsData, canEdit = true }) {
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
    } catch (failure) { setError(failure.message) }
  }
  function edit(church) { setEditing(church.id); setName(church.name); setDepartment(church.department); setError(''); setFormOpen(true) }
  async function annul(church) {
    if (!window.confirm(`¿Anular la iglesia "${church.name}"?`)) return
    try {
      await churchService.annul(church.id)
      setChurches((previous) => previous.map((item) => item.id === church.id ? { ...item, active: false } : item))
      if (editing === church.id) closeForm()
    } catch (failure) { setError(failure.message) }
  }
  const filtered = churches.filter((church) => `${church.name} ${church.department}`.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es')))
  return <>
    <div className="church-actions">{canEdit && !formOpen && <Button onClick={() => setFormOpen(true)}>＋ Nueva iglesia</Button>}</div>
    {!formOpen && <Alert>{error}</Alert>}
    {formOpen && <form className="church-form" onSubmit={submit}><h3>{editing ? 'Editar iglesia' : 'Nueva iglesia'}</h3><div className="church-form-fields"><label className="admin-field"><span>Departamento</span><select value={department} onChange={(event) => setDepartment(event.target.value)} required><option value="">Seleccione un departamento</option>{departmentsData.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label><label className="admin-field"><span>Nombre de la iglesia</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre de la iglesia" required /></label></div><Alert>{error}</Alert><div className="church-form-actions"><Button variant="secondary" onClick={closeForm}>Cancelar</Button><Button type="submit">{editing ? 'Guardar cambios' : 'Crear iglesia'}</Button></div></form>}
    <section className="members-card church-directory" aria-label="Listado de iglesias"><div className="members-heading"><span className="member-count">{filtered.length} {filtered.length === 1 ? 'iglesia' : 'iglesias'}</span></div><SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre o departamento" label="Buscar iglesia por nombre o departamento" /><TableFrame><table className="church-table"><thead><tr><th>Nombre</th><th>Departamento</th><th>Estado</th>{canEdit && <th>Acciones</th>}</tr></thead><tbody>{filtered.map((church) => <tr key={church.id}><td>{church.name}</td><td>{church.department}</td><td><span className={`church-status ${church.active ? 'active' : 'inactive'}`}>{church.active ? 'Activa' : 'Anulada'}</span></td>{canEdit && <td><div className="church-row-actions">{church.active ? <><Button className="church-row-action" onClick={() => edit(church)}>Editar</Button><Button className="church-row-action annul-action" onClick={() => annul(church)}>Anular</Button></> : <span>—</span>}</div></td>}</tr>)}{filtered.length === 0 && <tr><td colSpan={canEdit ? 4 : 3} className="church-empty">{query ? 'No hay iglesias que coincidan con la búsqueda.' : 'Todavía no hay iglesias registradas.'}</td></tr>}</tbody></table></TableFrame></section>
  </>
}
