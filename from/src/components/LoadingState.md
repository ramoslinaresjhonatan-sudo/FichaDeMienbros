# Indicador de carga

Basado en **blocks-shuffle-3 de SVG Spinners**, con su animación en CSS sin dependencias.

- Código original: https://github.com/n3r4zzurr0/svg-spinners/blob/main/svg-css/blocks-shuffle-3.svg
- Autor: Utkarsh Verma; licencia MIT incluida en `SVG-SPINNERS-LICENSE.txt`.
- Adaptaciones: clases aisladas, colores del panel, tamaño compacto y movimiento reducido.

Hereda `data-theme` del panel o recibe `theme="dark"`. Incluye un mensaje para lectores de pantalla y una versión estática cuando se solicita reducir movimiento. La ruta `/carga` permite previsualizar el componente usado durante la carga de la aplicación y al guardar el registro.

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

Activar `loading` antes de la petición, gestionar el error en `catch` y desactivarlo en `finally`. Si la respuesta no es correcta (`!response.ok`), tratarla como error. Una lista vacía se muestra solo después de terminar la carga. No se añaden retardos artificiales ni se simula un porcentaje de avance. La ruta de demostración `/carga` mantiene la animación visible.
