import churchLogo from '../../assets/iglesia-horizontal.png'
import Button from '../../components/ui/Button'
import { arrowForwardOutline } from 'ionicons/icons'
import '../../styles/welcome.css'

export default function WelcomeView({ error, onAdmin, onRecord, onRegister }) {
  return (
    <main className="welcome-page welcome-home welcome-focused">
      <section className="welcome-shell">
        <header className="welcome-header">
          <img src={churchLogo} alt="Iglesia Adventista del Séptimo Día Movimiento de Reforma Bolivia" />
          <Button variant="bare" className="welcome-admin-link" onClick={onAdmin}>Acceso administrativo <span aria-hidden="true">↗</span></Button>
        </header>
        <div className="welcome-intro">
          <h1>Bienvenido(a)</h1>
          <span>Este es el espacio de registro de miembros de nuestra iglesia. Completa tu ficha para mantener actualizada tu información y fortalecer nuestra comunidad.</span>
        </div>
        {error && <p className="welcome-auth-error" role="alert">{error}</p>}
        <div className="welcome-registration">
          <Button className="welcome-register-button" onClick={onRegister}>Completar ficha <ion-icon src={arrowForwardOutline} aria-hidden="true" /></Button>
          <div className="welcome-record-link"><Button variant="bare" onClick={onRecord}>Ver mi información</Button></div>
        </div>
      </section>
    </main>
  )
}
