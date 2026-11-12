# Estructura del frontend

El código está organizado para que las vistas no dependan de detalles de transporte ni dupliquen reglas de negocio.

- `app/`: composición de la aplicación y carga diferida.
- `features/`: componentes con reglas de una función de negocio concreta (autenticación, accesos, iglesias y acontecimientos).
- `hooks/`: estado y efectos compartidos, como tema visual y carga de datos del panel.
- `services/http.js`: única configuración de Axios; gestiona credenciales, CSRF y normaliza errores.
- `services/*-service.js`: operaciones del backend agrupadas por dominio (autenticación, registros, iglesias, accesos y eventos).
- `data/`: opciones y catálogos estáticos del dominio.
- `lib/`: funciones puras reutilizables, como búsqueda y formato de miembros.
- `components/`: controles reutilizables; `components/forms/` contiene campos y `components/ui/` botones, alertas, buscador y marco de tabla.
- `views/`: pantallas o vistas completas del producto.
- `styles/`: estilos globales, de tema y específicos de cada vista.
- `tests/`: pruebas de las funciones puras con `node --test` (`npm test`).
- `.github/workflows/frontend-checks.yml`: validación continua de lint, pruebas y compilación.

Convenciones:

- Un componente por archivo cuando tenga estado, efectos o una responsabilidad propia.
- Las vistas nunca usan Axios ni URLs del backend: llaman a un servicio de `services/`.
- Las consultas del panel viven en `usePanelData`; una vista recibe datos y callbacks, no crea peticiones duplicadas.
- Errores visibles usan `role="alert"`; mensajes de éxito o carga usan `role="status"`.
- Los formularios conservan etiqueta visible para cada control y mensajes claros junto al campo o al inicio del formulario.
- `LoginView` y `GoogleLinkView` no conocen Axios ni el estado global: reciben callbacks explícitos desde la aplicación.
