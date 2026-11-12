from django.http import JsonResponse


class RequireGoogleLinkMiddleware:
    """Las cuentas con carnet temporal no pueden consultar el panel sin vincular Google."""
    allowed = {
        '/api/auth/me/', '/api/auth/csrf/', '/api/auth/logout/',
        '/api/auth/google/link/', '/api/auth/google/callback/',
    }

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = request.user
        if (request.path.startswith('/api/') and request.path not in self.allowed
                and user.is_authenticated and user.temporary_password and not user.google_subject):
            return JsonResponse({'detail': 'Vincula tu cuenta de Google para acceder al panel.', 'code': 'google_link_required'}, status=403)
        return self.get_response(request)
