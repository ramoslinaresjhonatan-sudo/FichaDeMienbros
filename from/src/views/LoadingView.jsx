import '../styles/loading-view.css'

export default function LoadingView({ theme }) {
  return (
    <main className="page-shell" data-theme={theme}>
      <section className="success-card" aria-label="Vista de carga">
        <div className="standalone-loader" role="status" aria-live="polite">
          <div className="standalone-loader__art" aria-hidden="true">
            <div className="standalone-loader__boxes">
              {['one', 'two', 'three', 'four', 'five', 'six'].map((box) => (
                <div className={`standalone-loader__box standalone-loader__box--${box}`} key={box} />
              ))}
            </div>
          </div>
          <span className="standalone-loader__label">Cargando información…</span>
        </div>
      </section>
    </main>
  )
}
