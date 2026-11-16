import { useState } from 'react'
import { arrowForwardOutline, eyeOffOutline, eyeOutline, lockClosedOutline, mailOutline } from 'ionicons/icons'
import churchLogo from '../../assets/iglesia-horizontal.png'
import Button from '../../components/ui/Button'
import { googleStartUrl } from '../../services/auth-service'
import '../../styles/login.css'

export default function LoginView({ error, onLogin, onBack }) {
  const [showPassword, setShowPassword] = useState(false)
  async function submit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    await onLogin({ username: form.get('email').trim(), password: form.get('password') })
  }
  return <main className="login-page"><div className="login-card"><Button variant="bare" className="login-return" onClick={onBack}>← Volver al inicio</Button><img className="login-church-logo" src={churchLogo} alt="Iglesia Adventista del Séptimo Día Movimiento de Reforma Bolivia" /><form className="login-form" aria-label="Acceso al panel" onSubmit={submit}><label className="admin-field"><span>Correo o carnet</span><span className="login-input"><ion-icon src={mailOutline} aria-hidden="true" /><input type="text" name="email" autoComplete="username" placeholder="Correo o número de carnet" required /></span></label><div className="admin-field"><label htmlFor="login-password">Contraseña</label><div className="login-input"><ion-icon src={lockClosedOutline} aria-hidden="true" /><input id="login-password" type={showPassword ? 'text' : 'password'} name="password" autoComplete="current-password" placeholder="Tu contraseña" required /><Button variant="bare" className="password-toggle" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}><ion-icon src={showPassword ? eyeOffOutline : eyeOutline} aria-hidden="true" /></Button></div></div><Button className="login-submit" type="submit">Acceder al panel <ion-icon src={arrowForwardOutline} aria-hidden="true" /></Button>{error && <p className="church-error" role="alert">{error}</p>}</form><div className="login-divider"><span>o</span></div><Button variant="bare" className="google-login" onClick={() => window.location.assign(googleStartUrl)}><svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.19 3.32v2.76h3.56c2.08-1.92 3.27-4.75 3.27-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.11A6.61 6.61 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18a11 11 0 0 0 0 9.9z"/><path fill="#EA4335" d="M12 5.36c1.62 0 3.06.56 4.2 1.64l3.15-3.15A10.57 10.57 0 0 0 12 1a11 11 0 0 0-9.82 6.05l3.66 2.84C6.71 7.29 9.14 5.36 12 5.36z"/></svg>Continuar con Google</Button></div></main>
}
