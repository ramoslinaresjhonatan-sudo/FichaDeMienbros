import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import LoadingState from './components/LoadingState.jsx'
import App from './app/LazyApp.jsx'

let initialTheme = 'light'
try { initialTheme = localStorage.getItem('ficha-theme') === 'dark' ? 'dark' : 'light' } catch { /* Use the default theme when storage is unavailable. */ }

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Suspense fallback={<LoadingState variant="page" label="Preparando el panel…" theme={initialTheme} />}>
      <App />
    </Suspense>
  </StrictMode>,
)
