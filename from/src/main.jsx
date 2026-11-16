import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import LoadingState from './components/LoadingState.jsx'
import App from './app/LazyApp.jsx'

let initialTheme = 'light'
try { initialTheme = localStorage.getItem('ficha-theme') === 'dark' ? 'dark' : 'light' } catch { /* Use the default theme when storage is unavailable. */ }

const registrationResult = new URLSearchParams(window.location.search).get('google_registration')
if (registrationResult) {
  const params = new URLSearchParams(window.location.hash.slice(1))
  const email = params.get('email') || ''
  const channel = params.get('channel') || ''
  window.history.replaceState(null, '', window.location.pathname)
  const message = { type: 'ficha-google-email', result: registrationResult, email, channel }
  if (window.opener) window.opener.postMessage(message, window.location.origin)
  if (/^[a-f0-9]{32}$/.test(channel)) {
    try {
      const key = `ficha-google-email-${channel}`
      localStorage.setItem(key, JSON.stringify(message))
      localStorage.removeItem(key)
    } catch { /* The original window may still receive postMessage. */ }
  }
  window.close()
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Suspense fallback={<LoadingState variant="page" label="Preparando el panel…" theme={initialTheme} />}>
      <App />
    </Suspense>
  </StrictMode>,
)
