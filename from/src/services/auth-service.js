import http from './http.js'

const configuredGoogleStartUrl = import.meta.env.VITE_GOOGLE_AUTH_START
if (import.meta.env.PROD && (!configuredGoogleStartUrl || !configuredGoogleStartUrl.startsWith('https://'))) {
  throw new Error('VITE_GOOGLE_AUTH_START debe usar HTTPS en producción.')
}
export const googleStartUrl = configuredGoogleStartUrl || 'http://localhost:8000/api/auth/google/start/'

export const authService = {
  getCurrentUser: () => http.get('/auth/me/').then(({ data }) => data),
  login: (credentials) => http.post('/auth/login/', credentials).then(({ data }) => data),
  logout: () => http.post('/auth/logout/'),
  beginGoogleLink: () => http.post('/auth/google/link/').then(({ data }) => data),
}
