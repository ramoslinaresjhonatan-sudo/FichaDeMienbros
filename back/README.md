# Backend de ficha de miembro

API Django para miembros, iglesias, usuarios y acontecimientos. Usa PostgreSQL mediante la variable `URL_DATABASE`.

## Iniciar

Desde esta carpeta, en PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
# Complete URL_DATABASE en .env con tu conexión PostgreSQL
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

La API está en `http://127.0.0.1:8000/api/`. La migración incluye los nueve departamentos. El superusuario administra usuarios; los pastores se crean vinculando su cuenta a un miembro existente.

## Estructura

- `modules/churches`, `members`, `accounts` y `events`: reglas y modelos por módulo.
- `modules/shared/domain`: contrato del repositorio.
- `modules/shared/application`: servicio de validación y guardado.
- `modules/*/infrastructure`: persistencia con modelos Django.
- `core_api`: adaptación HTTP, serialización y migraciones.

## API y sesión

Rutas bajo `/api/`: `departamentos/`, `iglesias/`, `miembros/`, `usuarios/`, `pastores/`, `admisiones/`, `bautismos/`, `matrimonios/`, `fallecimientos/` y `separaciones/`. Las listas están paginadas. `registro/opciones/` y `registro/` permiten obtener las opciones y enviar una ficha pública. Los campos JSON utilizan los nombres de los modelos en inglés.

La API requiere sesión. Obtener primero `GET /api/auth/csrf/` con cookies y enviar `POST /api/auth/login/` con `username` y `password`, incluyendo la cabecera `X-CSRFToken` con el token recibido. El token se renueva al iniciar sesión: usar el devuelto por login para las siguientes escrituras. Usar credenciales en las peticiones. `POST /api/auth/logout/` cierra la sesión. Solo los administradores gestionan cuentas. Las iglesias se anulan con `POST /api/iglesias/{id}/anular/`.

El frontend se ejecuta desde la carpeta `../from` con `npm run dev`. El registro de pastor crea un miembro y una cuenta de pastor inactiva sin contraseña utilizable; un administrador debe establecerle una contraseña y activarla en `/admin/` antes de conceder acceso. El administrador se identifica en el frontend con el correo del superusuario y su contraseña. El enlace localhost solo funciona en la misma computadora.

El acceso con Google usa las credenciales del archivo local `.env`. En la consola de Google Cloud se debe autorizar exactamente `http://localhost:8000/api/auth/google/callback/` como URI de redirección. Solo pueden ingresar cuentas de Google cuyo correo coincida con un usuario activo existente; el acceso no crea administradores. La foto se obtiene del perfil de Google y se muestra junto al nombre de usuario de la aplicación. Para otro dominio, configurar `GOOGLE_OAUTH_REDIRECT_URI`, `FRONTEND_URL` y el inicio de Google del frontend con `VITE_GOOGLE_AUTH_START`.

Los administradores pueden habilitar o revocar el acceso de miembros y pastores en «Accesos». Se necesita un correo válido, que debe coincidir con la cuenta de Google verificada. Las nuevas cuentas no reciben contraseña: ingresan con Google. La migración 0010 invalida las contraseñas temporales antiguas basadas en carnet y cierra sus sesiones; no modifica las contraseñas permanentes. Si Google no funciona, hay que resolver su configuración antes de que esas cuentas puedan ingresar.

Política actual: administradores y pastores consultan y gestionan fichas y acontecimientos de todos los miembros; solo administradores gestionan usuarios y departamentos. Los miembros consultan únicamente su ficha y sus acontecimientos, además del catálogo de iglesias y departamentos. Estas restricciones se aplican en la API. Los enlaces públicos de registro siguen disponibles.

Los intentos de contraseña del panel y de Django admin se limitan conjuntamente a 10 por dirección de origen en 15 minutos, mediante la base de datos. Se cuentan tanto intentos correctos como incorrectos; usuarios de una misma red pueden compartir límite. Tras un proxy, `REMOTE_ADDR` debe identificar correctamente al cliente mediante infraestructura confiable; nunca se aceptan cabeceras enviadas arbitrariamente por el navegador. Complementar con limitación en el proxy para acceso distribuido y formularios públicos.

## Preparación para producción

Configurar `DJANGO_DEBUG=false`, una `DJANGO_SECRET_KEY` aleatoria de al menos 50 caracteres, `DJANGO_ALLOWED_HOSTS`, `DJANGO_CORS_ORIGINS`, `FRONTEND_URL` y `GOOGLE_OAUTH_REDIRECT_URI` con los dominios reales HTTPS. Configurar `VITE_API_URL` y `VITE_GOOGLE_AUTH_START` en el frontend antes de compilarlo y autorizar la redirección exacta en Google Cloud. Con DEBUG desactivado se activan redirección HTTPS, cookies seguras y HSTS; habilitar HSTS solo después de comprobar HTTPS. La aplicación no confía automáticamente en cabeceras de proxy: configurar `SECURE_PROXY_SSL_HEADER` únicamente si un proxy controlado las elimina y establece de forma segura, o terminar TLS en Django. Usar un servidor WSGI/ASGI de producción, no `runserver`. Esta configuración no instala ni configura el servidor, dominio, certificado o base de datos de producción.

## Auditoría

Se registran método, nombre de ruta, código de respuesta e identificador interno del usuario en `logs/auditoria.log`, y se advierten los bloqueos de acceso. No se registran contraseñas, contenido de formularios ni parámetros de URL. A medianoche se rota el archivo y se conservan hasta 59 copias más el archivo actual; la rotación y eliminación se efectúan cuando llega un nuevo evento. `DJANGO_LOG_DIR` permite cambiar el directorio. Protegerlo con permisos del sistema, supervisar espacio y hacer copias según la política de privacidad. El manejador estándar no sincroniza la rotación entre procesos: para varios trabajadores/instancias usar un recolector centralizado o un único proceso escritor con rotación externa coordinada.

Pruebas: `python manage.py test`.
