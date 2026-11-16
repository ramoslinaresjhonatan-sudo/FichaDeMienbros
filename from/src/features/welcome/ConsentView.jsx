import { useState } from 'react'
import churchLogo from '../../assets/iglesia-horizontal.png'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import '../../styles/welcome.css'

export default function ConsentView({ onAccept, onBack }) {
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState('')
  function continueRegistration() { if (!accepted) { setError('Debes aceptar el tratamiento de datos para continuar.'); return } onAccept() }
  return <main className="welcome-page"><section className="consent-card"><img src={churchLogo} alt="Adventista del Séptimo Día Movimiento de Reforma Bolivia" /><p className="consent-kicker">ANTES DE CONTINUAR</p><h1>Tratamiento de datos personales</h1><p>Para elaborar tu ficha se solicitarán datos de identificación, contacto, familia, vida religiosa y pertenencia eclesiástica.</p><div className="consent-details"><h2>¿Para qué se usarán?</h2><ul><li>Gestionar el registro interno de miembros y actividades de la iglesia.</li><li>Actualizar datos de contacto, pertenencia y acompañamiento pastoral.</li><li>Generar reportes internos sin publicar tu información personal.</li></ul><p>Tu información será accesible solo a personal autorizado según las funciones del sistema. Puedes solicitar corrección de tus datos a la administración de la iglesia.</p></div><label className="consent-check"><input type="checkbox" checked={accepted} onChange={(event) => { setAccepted(event.target.checked); setError('') }} /><span>He leído y acepto el tratamiento de mis datos personales para los fines indicados.</span></label><Alert>{error}</Alert><div className="consent-actions"><Button variant="secondary" onClick={onBack}>Volver</Button><Button onClick={continueRegistration}>Acepto y continuar</Button></div></section></main>
}
