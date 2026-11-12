from django.conf import settings


class SecurityHeadersMiddleware:
    """Añade cabeceras defensivas a respuestas del backend, incluido Django Admin."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response.setdefault('X-Content-Type-Options', 'nosniff')
        response.setdefault('Referrer-Policy', 'same-origin')
        response.setdefault('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()')
        response.setdefault('Cross-Origin-Opener-Policy', 'same-origin')
        if not settings.DEBUG:
            response.setdefault('Cross-Origin-Resource-Policy', 'same-site')
            response.setdefault(
                'Content-Security-Policy',
                "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; "
                "object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: https://*.googleusercontent.com; connect-src 'self'",
            )
        return response
