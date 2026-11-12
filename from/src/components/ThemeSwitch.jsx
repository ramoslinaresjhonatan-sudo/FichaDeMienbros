import './ThemeSwitch.css'

export default function ThemeSwitch({ theme, onChange }) {
  const dark = theme === 'dark'
  return (
    <div className="theme-control">
      <button
        type="button"
        className="face-theme-switch"
        role="switch"
        aria-checked={dark}
        aria-label="Modo oscuro"
        title={dark ? 'Activar modo claro' : 'Activar modo oscuro'}
        onClick={() => onChange(dark ? 'light' : 'dark')}
      >
        <span className="face-theme-switch__track" aria-hidden="true">
          <span className="face-theme-switch__background" />
          <span className="face-theme-switch__face" />
        </span>
      </button>
      <span className="theme-control__label" aria-hidden="true">Modo {dark ? 'oscuro' : 'claro'}</span>
    </div>
  )
}
