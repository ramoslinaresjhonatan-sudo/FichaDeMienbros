# Indicador de carga

Animación de seis bloques basada en la referencia. Hereda `data-theme` del panel o recibe `theme="dark"`. Incluye un mensaje para lectores de pantalla y una versión estática cuando se solicita reducir movimiento.

```jsx
import LoadingState, { LoadingRegion } from './components/LoadingState.jsx'

// Página completa (ya utilizada por Suspense al cargar la aplicación).
<LoadingState variant="page" label="Preparando el panel…" theme="dark" />

// Tabla o formulario: conserva los componentes montados y oculta su contenido
// durante la consulta. El mensaje de carga queda fuera de aria-busy para anunciarse.
<LoadingRegion loading={loading} label="Cargando iglesias…">
  {error ? <p role="alert">{error}</p> : <Tabla iglesias={iglesias} />}
</LoadingRegion>

// Acción: deshabilitar el botón mientras la petición está pendiente.
<button disabled={saving}>
  {saving ? <LoadingState variant="compact" label="Guardando…" /> : 'Guardar'}
</button>
```

Al conectar el backend, activar `loading` antes de la petición, gestionar el error en `catch` y desactivarlo en `finally`. Si la respuesta no es correcta (`!response.ok`), tratarla como error. Una lista vacía se muestra solo después de terminar la carga. No se añaden temporizadores ni retardos artificiales: actualmente los registros se gestionan en memoria y no hay consultas al backend.
