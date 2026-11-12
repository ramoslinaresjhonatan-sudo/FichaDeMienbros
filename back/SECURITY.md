# Despliegue seguro

Antes de publicar, cree variables de entorno desde `.env.example`; no copie ni suba el `.env` local.

## Obligatorio

- `DJANGO_DEBUG=false`.
- Una `DJANGO_SECRET_KEY` aleatoria, privada y de al menos 50 caracteres.
- Dominios explícitos y HTTPS en `DJANGO_ALLOWED_HOSTS`, `DJANGO_CORS_ORIGINS`, `FRONTEND_URL` y `GOOGLE_OAUTH_REDIRECT_URI`.
- `URL_DATABASE` con TLS (`sslmode=require`) y una contraseña exclusiva para la aplicación.
- En el frontend, `VITE_API_URL` y `VITE_GOOGLE_AUTH_START` deben ser HTTPS.
- Configurar en el proveedor de hosting las mismas cabeceras CSP para los archivos estáticos del frontend. Las cabeceras de Django protegen API y Admin; el hosting del frontend debe enviar su propia CSP.

## Operación

- Rote inmediatamente contraseñas, claves OAuth o URLs de base de datos que hayan aparecido en un chat, commit o captura.
- Revise periódicamente `npm audit`, dependencias Python y los registros de `ficha.audit`.
- Mantenga copias de seguridad de Neon y compruebe restauraciones.
- Si usa proxy inverso, configure correctamente la IP real del cliente y HTTPS antes de confiar en cabeceras reenviadas.
