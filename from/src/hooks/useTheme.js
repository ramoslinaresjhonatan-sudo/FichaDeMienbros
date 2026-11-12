import { useState } from 'react'

const storageKey = 'ficha-theme'

function savedTheme() {
  try { return localStorage.getItem(storageKey) === 'dark' ? 'dark' : 'light' } catch { return 'light' }
}

export default function useTheme() {
  const [theme, setTheme] = useState(savedTheme)

  function changeTheme(nextTheme) {
    setTheme(nextTheme)
    try { localStorage.setItem(storageKey, nextTheme) } catch { /* La selección dura la sesión actual. */ }
  }

  return [theme, changeTheme]
}
