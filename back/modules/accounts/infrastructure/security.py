import hashlib
import hmac
import logging
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone

from core_api.models import LoginAttemptWindow

audit = logging.getLogger('ficha.audit')


class SecurityAuditMiddleware:
    """Registra metadatos mínimos, sin cuerpos, parámetros ni credenciales."""
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            response = self.get_response(request)
        except Exception:
            audit.error('request_error method=%s', request.method)
            raise
        if request.path.startswith(('/api/', '/admin/')):
            route = request.resolver_match.view_name if request.resolver_match else 'unknown'
            actor = request.user.pk if request.user.is_authenticated else '-'
            audit.info('request method=%s route=%s status=%s actor=%s', request.method, route, response.status_code, actor)
        return response


class LoginRateLimitMiddleware:
    """Límite compartido por base de datos para intentos de autenticación por IP."""
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method == 'POST' and request.path in ('/api/auth/login/', '/admin/login/'):
            address = request.META.get('REMOTE_ADDR', '')
            key = hmac.new(settings.SECRET_KEY.encode(), address.encode(), hashlib.sha256).hexdigest()
            now = timezone.now()
            with transaction.atomic():
                entry, _ = LoginAttemptWindow.objects.select_for_update().get_or_create(key=key, defaults={'started_at': now})
                if now - entry.started_at >= timedelta(seconds=settings.LOGIN_RATE_WINDOW):
                    entry.started_at, entry.attempts = now, 0
                entry.attempts += 1
                entry.save(update_fields=['started_at', 'attempts'])
                blocked = entry.attempts > settings.LOGIN_RATE_LIMIT
            if blocked:
                audit.warning('login_rate_limited')
                response = JsonResponse({'detail': 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.'}, status=429)
                response['Retry-After'] = str(max(1, settings.LOGIN_RATE_WINDOW - int((now - entry.started_at).total_seconds())))
                return response
        return self.get_response(request)


class PublicRegistrationRateLimitMiddleware:
    """Reduce automatización y spam en el único formulario anónimo del sistema."""
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if (request.method == 'POST' and request.path in ('/api/registro/', '/api/consulta-ficha/')) or (request.method == 'PATCH' and request.path == '/api/mi-ficha/' and not request.user.is_authenticated):
            address = request.META.get('REMOTE_ADDR', '')
            action = 'lookup' if request.path == '/api/consulta-ficha/' else 'edit' if request.path == '/api/mi-ficha/' else 'registration'
            key_material = f'{action}:{address}'
            key = hmac.new(settings.SECRET_KEY.encode(), key_material.encode(), hashlib.sha256).hexdigest()
            now = timezone.now()
            with transaction.atomic():
                entry, _ = LoginAttemptWindow.objects.select_for_update().get_or_create(key=key, defaults={'started_at': now})
                if now - entry.started_at >= timedelta(seconds=settings.PUBLIC_REGISTRATION_RATE_WINDOW):
                    entry.started_at, entry.attempts = now, 0
                entry.attempts += 1
                entry.save(update_fields=['started_at', 'attempts'])
                limit = 8 if action == 'lookup' else 30 if action == 'edit' else settings.PUBLIC_REGISTRATION_RATE_LIMIT
                blocked = entry.attempts > limit
            if blocked:
                audit.warning('public_%s_rate_limited', action)
                response = JsonResponse({'detail': 'Demasiados intentos desde esta conexión. Intenta más tarde.'}, status=429)
                response['Retry-After'] = str(max(1, settings.PUBLIC_REGISTRATION_RATE_WINDOW - int((now - entry.started_at).total_seconds())))
                return response
        return self.get_response(request)
