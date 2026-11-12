import churchLogo from '../../assets/iglesia-horizontal.png'
import Button from '../../components/ui/Button'

export default function GoogleLinkView({ error, busy, onLink, onLogout }) {
  return <main className="login-page"><div className="login-card google-link-card"><img className="login-church-logo" src={churchLogo} alt="Iglesia Adventista del Séptimo Día Movimiento de Reforma Bolivia" /><h1>Vincula tu cuenta de Google</h1><p>Para continuar, usa la cuenta de Google correspondiente al correo registrado para tu usuario.</p><Button disabled={busy} onClick={onLink}>{busy ? 'Conectando…' : 'Vincular con Google'}</Button>{error && <p className="church-error" role="alert">{error}</p>}<Button variant="bare" className="registration-link" onClick={onLogout}>Cerrar sesión</Button></div></main>
}
