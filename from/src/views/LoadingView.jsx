import LoadingState from '../components/LoadingState.jsx'

export default function LoadingView({ theme }) {
  return (
    <main className="page-shell" data-theme={theme}>
      <section className="success-card" aria-label="Vista de carga">
        <LoadingState label="Cargando información…" />
      </section>
    </main>
  )
}
