import axios from 'axios'

let csrfToken = ''
const safeMethods = new Set(['get', 'head', 'options'])
const configuredApiUrl = import.meta.env.VITE_API_URL
const fallbackApiUrl = `${window.location.protocol}//${window.location.hostname}:8000/api`

if (import.meta.env.PROD && (!configuredApiUrl || !configuredApiUrl.startsWith('https://'))) {
  throw new Error('VITE_API_URL debe usar HTTPS en producción.')
}

const http = axios.create({
  baseURL: configuredApiUrl || fallbackApiUrl,
  withCredentials: true,
  timeout: 15_000,
})

async function ensureCsrfToken() {
  if (csrfToken) return csrfToken
  const { data } = await http.get('/auth/csrf/', { skipCsrf: true })
  csrfToken = data.csrfToken
  return csrfToken
}

http.interceptors.request.use(async (config) => {
  if (!safeMethods.has((config.method || 'get').toLowerCase()) && !config.skipCsrf) {
    config.headers['X-CSRFToken'] = await ensureCsrfToken()
  }
  return config
})

http.interceptors.response.use(
  (response) => {
    if (response.data?.csrfToken) csrfToken = response.data.csrfToken
    return response
  },
  (error) => {
    if (!error.response) return Promise.reject(new Error('No se pudo conectar con el servidor. Intenta nuevamente.'))
    if (error.response.status >= 500) return Promise.reject(new Error('Ocurrió un error del servidor. Intenta más tarde.'))
    const data = error.response?.data
    const message = data?.detail || Object.values(data || {}).flat().join(' ') || 'No se pudo completar la solicitud.'
    return Promise.reject(new Error(message))
  },
)

export async function listAll(url) {
  const results = []
  let next = url
  while (next) {
    const { data } = await http.get(next)
    if (Array.isArray(data)) return data
    results.push(...data.results)
    next = data.next ? new URL(data.next).pathname.replace(/^\/api/, '') + new URL(data.next).search : null
  }
  return results
}

export default http
