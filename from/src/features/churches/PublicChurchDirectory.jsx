import { useEffect, useState } from 'react'
import churchLogo from '../../assets/iglesia-horizontal.png'
import { churchService } from '../../services/church-service'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import SearchInput from '../../components/ui/SearchInput'
import TableFrame from '../../components/ui/TableFrame'
import '../../styles/public-church-directory.css'

export default function PublicChurchDirectory() {
  const [churches, setChurches] = useState([])
  const [departments, setDepartments] = useState([])
  const [department, setDepartment] = useState('')
  const [name, setName] = useState('')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    churchService.getPublicDirectory().then(({ churches: items, departments: areas }) => {
      setChurches(items)
      setDepartments(areas)
    }).catch((failure) => setError(failure.message || 'No se pudo cargar el directorio de iglesias.'))
  }, [])

  const filtered = churches.filter((church) => `${church.name} ${church.department}`.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es')))
  async function submit(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    if (!department || !name.trim()) { setError('Selecciona un departamento e ingresa el nombre de la iglesia.'); return }
    setSaving(true)
    try {
      const church = await churchService.createPublic({ department: Number(department), name: name.trim() })
      setChurches((items) => [...items, church].sort((a, b) => a.name.localeCompare(b.name, 'es')))
      setName('')
      setDepartment('')
      setNotice('Iglesia registrada. Un administrador podrá revisar o corregir sus datos desde el panel.')
    } catch (failure) { setError(failure.message || 'No se pudo registrar la iglesia.') } finally { setSaving(false) }
  }

  return <main className="public-church-page"><header className="public-church-header"><a href="/" aria-label="Volver al inicio"><img src={churchLogo} alt="Adventista del Séptimo Día Movimiento de Reforma Bolivia" /></a><a className="public-church-login" href="/">Acceso administrativo →</a></header><section className="public-church-hero"><p>DIRECTORIO NACIONAL</p><h1>Iglesias registradas</h1><span>Consulta las congregaciones creadas o registra una nueva. La edición y anulación se realizan únicamente desde administración.</span></section><div className="public-church-layout"><section className="public-church-form-card"><p className="public-church-kicker">REGISTRO PÚBLICO</p><h2>Registrar una iglesia</h2><p>Por seguridad, cada conexión puede enviar un solo registro.</p><form onSubmit={submit}><label><span>Departamento</span><select value={department} onChange={(event) => setDepartment(event.target.value)} required><option value="">Seleccione un departamento</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>Nombre de la iglesia</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength="180" placeholder="Nombre de la iglesia" required /></label><Alert>{error}</Alert>{notice && <p className="public-church-notice" role="status">{notice}</p>}<Button type="submit" disabled={saving}>{saving ? 'Registrando…' : 'Registrar iglesia'}</Button></form></section><section className="public-church-list-card"><div className="public-church-list-heading"><div><p className="public-church-kicker">DIRECTORIO</p><h2>{churches.length} {churches.length === 1 ? 'iglesia disponible' : 'iglesias disponibles'}</h2></div></div><SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por iglesia o departamento" label="Buscar iglesia por nombre o departamento" /><TableFrame><table className="church-table"><thead><tr><th>Iglesia</th><th>Departamento</th></tr></thead><tbody>{filtered.map((church) => <tr key={church.id}><td>{church.name}</td><td>{church.department}</td></tr>)}{!filtered.length && <tr><td colSpan="2" className="church-empty">{query ? 'No hay iglesias que coincidan con la búsqueda.' : 'Todavía no hay iglesias registradas.'}</td></tr>}</tbody></table></TableFrame></section></div></main>
}
