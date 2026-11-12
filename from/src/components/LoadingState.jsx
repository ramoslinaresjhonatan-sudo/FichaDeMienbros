import './LoadingState.css'

/** variant: 'section' | 'page' | 'compact'. Inherits the surrounding theme. */
export default function LoadingState({ label = 'Cargando datos…', variant = 'section', theme }) {
  return (
    <div className={`data-loader data-loader--${variant}`} data-theme={theme} role="status" aria-live="polite" aria-atomic="true">
      <div className="data-loader__art" aria-hidden="true">
        <div className="data-loader__boxes">
          {['one', 'two', 'three', 'four', 'five', 'six'].map((box) => (
            <div className={`data-loader__box data-loader__box--${box}`} key={box} />
          ))}
        </div>
      </div>
      <span className="data-loader__label">{label}</span>
    </div>
  )
}

/** Keeps forms mounted while loading, preserving their local values. */
export function LoadingRegion({ loading, children, label, theme }) {
  return (
    <div className="loading-region" data-theme={theme}>
      {loading && <LoadingState label={label} />}
      <div hidden={loading} aria-busy={loading}>{children}</div>
    </div>
  )
}
