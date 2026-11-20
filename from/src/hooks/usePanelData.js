import { useEffect, useState } from 'react'
import { registryService } from '../services/registry-service'

/** Carga y normaliza los datos compartidos por las vistas del panel. */
export default function usePanelData(view) {
  const [churches, setChurches] = useState([])
  const [departmentsData, setDepartmentsData] = useState([])
  const [membersData, setMembersData] = useState([])
  const [pastorsData, setPastorsData] = useState([])
  const [eventsData, setEventsData] = useState({ bautizos: [], fallecimientos: [], matrimonios: [] })
  const [panelError, setPanelError] = useState('')
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    if (view === 'admin') return
    const reloadOptions = () => setRefresh((value) => value + 1)
    window.addEventListener('focus', reloadOptions)
    return () => window.removeEventListener('focus', reloadOptions)
  }, [view])

  useEffect(() => {
    if (view === 'admin') return
    let active = true
    registryService.getRegistrationOptions().then((data) => {
      if (!active) return
      setDepartmentsData(data.departments)
      setChurches(data.churches.map((church) => ({ ...church, active: true })))
      setPanelError('')
    }).catch(() => { if (active) setPanelError('No se pudieron cargar las iglesias. Comprueba que el servidor esté activo.') })
    return () => { active = false }
  }, [view, refresh])

  useEffect(() => {
    if (view !== 'admin') return
    let active = true
    registryService.getPanelData().then(({ members, pastors, churches: allChurches, departments: allDepartments, events }) => {
      if (!active) return
      setMembersData(members)
      setPastorsData(pastors)
      setEventsData(events)
      setDepartmentsData(allDepartments)
      setChurches(allChurches.map((church) => ({ ...church, department: allDepartments.find((item) => item.id === church.department)?.name || '', active: church.status === 'activa' })))
      setPanelError('')
    }).catch((error) => { if (active) setPanelError(error.message) })
    return () => { active = false }
  }, [view, refresh])

  return { churches, setChurches, departmentsData, membersData, pastorsData, eventsData, panelError, setPanelError, refresh: () => setRefresh((value) => value + 1) }
}
