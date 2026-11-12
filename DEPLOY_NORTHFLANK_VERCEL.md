# Despliegue: Northflank + Vercel

## 1. Base de datos y API en Northflank

1. Cree una base de datos PostgreSQL y un servicio desde el repositorio.
2. En el servicio, use **Dockerfile** como método de construcción y seleccione `FichaRegsitro/back` como directorio raíz. El Dockerfile instala dependencias, migra la base, recopila los estáticos y arranca Gunicorn en el puerto recibido en `PORT`.
3. Exponga el puerto HTTP `8000` y cree un dominio público HTTPS, por ejemplo `https://api-tu-proyecto.northflank.app`.
4. Configure el health check HTTP como `/healthz/`.
5. Agregue estas variables de entorno; reemplace ambos dominios por los definitivos:

```env
DJANGO_DEBUG=false
DJANGO_SECRET_KEY=<cadena-aleatoria-de-al-menos-50-caracteres>
DJANGO_ALLOWED_HOSTS=api-tu-proyecto.northflank.app
DJANGO_CORS_ORIGINS=https://tu-proyecto.vercel.app
FRONTEND_URL=https://tu-proyecto.vercel.app
GOOGLE_OAUTH_REDIRECT_URI=https://api-tu-proyecto.northflank.app/api/auth/google/callback/
GOOGLE_OAUTH_CLIENT_ID=<id-de-google>
GOOGLE_OAUTH_CLIENT_SECRET=<secreto-de-google>
URL_DATABASE=<connection-string-de-la-base-de-datos-de-northflank>
```

No agregue comillas ni una barra final a `DJANGO_CORS_ORIGINS` y `FRONTEND_URL`. Si agrega un dominio personalizado de Vercel, inclúyalo también en `DJANGO_CORS_ORIGINS` separado por coma y úselo como `FRONTEND_URL`.

## 2. Frontend en Vercel

1. Importe el mismo repositorio en Vercel.
2. Establezca **Root Directory** en `FichaRegsitro/from`.
3. Configure estas variables de entorno para Production, Preview y Development, con la URL pública HTTPS de Northflank:

```env
VITE_API_URL=https://api-tu-proyecto.northflank.app/api
VITE_GOOGLE_AUTH_START=https://api-tu-proyecto.northflank.app/api/auth/google/start/
```

4. Despliegue. `vercel.json` compila Vite y reescribe rutas al `index.html`, por lo que abrir o recargar cualquier pantalla no devuelve 404.

## 3. Google OAuth

En Google Cloud, agregue exactamente la URL configurada en `GOOGLE_OAUTH_REDIRECT_URI` a los URI de redirección autorizados. Después de cambiar dominios o variables, redespliegue el backend y el frontend.

## Verificación posterior

- Abrir `https://api-tu-proyecto.northflank.app/healthz/`: debe devolver `{"status":"ok"}`.
- Abrir la URL de Vercel y comprobar registro e inicio de sesión.
- Confirmar que una recarga en una ruta interna del frontend sigue mostrando la aplicación.
