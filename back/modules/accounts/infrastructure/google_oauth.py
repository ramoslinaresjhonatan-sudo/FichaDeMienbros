import base64
import hashlib
import secrets
import re
import time
from urllib.parse import urlencode, urlsplit

import requests
from django.conf import settings
from django.contrib.auth import login
from django.core import signing
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.shortcuts import redirect
from django.utils.crypto import constant_time_compare
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_POST
from google.auth.transport.requests import Request
from google.oauth2 import id_token
from google.auth.exceptions import GoogleAuthError

from core_api.models import User

AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
TOKEN_URL = 'https://oauth2.googleapis.com/token'
PUBLIC_REGISTRATION_PATHS = {'/', '/registro-miembro', '/registro-pastor'}


def failure(reason, destination='login'):
    """Vuelve a la vista de acceso y muestra un error seguro para el usuario."""
    return redirect(f'{settings.FRONTEND_URL}/?{urlencode({"google_error": reason, "auth": destination})}')


def registration_result_redirect(origin, path, result, channel, email='', proof='', popup=False):
    """Devuelve el resultado al formulario público que inició el flujo OAuth."""
    params = {'channel': channel}
    if email:
        params['email'] = email
    if proof:
        params['proof'] = proof
    popup_query = '&google_popup=1' if popup else ''
    return redirect(f'{origin}{path}?google_registration={result}{popup_query}#{urlencode(params)}')


def authorization_url(request, link_user_id=None, registration=False):
    if not settings.GOOGLE_OAUTH_CLIENT_ID or not settings.GOOGLE_OAUTH_CLIENT_SECRET:
        return None
    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode('ascii')).digest()).rstrip(b'=').decode('ascii')
    request.session['google_oauth'] = {'state': state, 'nonce': nonce, 'verifier': verifier, 'created': time.time(), 'link_user_id': link_user_id, 'registration': registration}
    params = {
        'client_id': settings.GOOGLE_OAUTH_CLIENT_ID,
        'redirect_uri': settings.GOOGLE_OAUTH_REDIRECT_URI,
        'response_type': 'code',
        'scope': 'openid email profile',
        'state': state,
        'nonce': nonce,
        'code_challenge': challenge,
        'code_challenge_method': 'S256',
        'prompt': 'select_account',
    }
    return f'{AUTHORIZE_URL}?{urlencode(params)}'


@require_GET
def google_start(request):
    url = authorization_url(request)
    if not url:
        return JsonResponse({'detail': 'El acceso con Google no está configurado.'}, status=503)
    return redirect(url)


@require_GET
def google_registration_start(request):
    origin = request.GET.get('origin', '')
    if origin not in settings.CORS_ALLOWED_ORIGINS:
        return JsonResponse({'detail': 'Origen no permitido.'}, status=403)
    channel = request.GET.get('channel', '')
    if not re.fullmatch(r'[a-f0-9]{32}', channel):
        return JsonResponse({'detail': 'Solicitud de registro inválida.'}, status=400)
    return_path = request.GET.get('return_path', '/')
    if return_path not in PUBLIC_REGISTRATION_PATHS:
        return JsonResponse({'detail': 'Ruta de retorno inválida.'}, status=400)
    url = authorization_url(request, registration=True)
    if not url:
        return registration_result_redirect(origin, return_path, 'error', channel)
    request.session['google_oauth']['return_origin'] = origin
    request.session['google_oauth']['return_path'] = return_path
    request.session['google_oauth']['channel'] = channel
    request.session['google_oauth']['popup'] = request.GET.get('popup') == '1'
    request.session.modified = True
    return redirect(url)


@csrf_protect
@require_POST
def google_link_start(request):
    if not request.user.is_authenticated or not request.user.is_active:
        return JsonResponse({'detail': 'Inicia sesión antes de vincular Google.'}, status=401)
    if not request.user.email:
        return JsonResponse({'detail': 'Un administrador debe registrar tu correo antes de vincular Google.'}, status=400)
    url = authorization_url(request, link_user_id=request.user.pk)
    if not url:
        return JsonResponse({'detail': 'El acceso con Google no está configurado.'}, status=503)
    return JsonResponse({'url': url})


def verified_identity(code, flow):
    response = requests.post(TOKEN_URL, data={
        'code': code,
        'client_id': settings.GOOGLE_OAUTH_CLIENT_ID,
        'client_secret': settings.GOOGLE_OAUTH_CLIENT_SECRET,
        'redirect_uri': settings.GOOGLE_OAUTH_REDIRECT_URI,
        'grant_type': 'authorization_code',
        'code_verifier': flow['verifier'],
    }, timeout=10)
    response.raise_for_status()
    token = response.json()['id_token']
    claims = id_token.verify_oauth2_token(token, Request(), settings.GOOGLE_OAUTH_CLIENT_ID)
    if not constant_time_compare(str(claims.get('nonce', '')), flow['nonce']):
        raise ValueError('Nonce inválido')
    if claims.get('email_verified') is not True or not isinstance(claims.get('email'), str) or not isinstance(claims.get('sub'), str) or not claims['sub']:
        raise ValueError('Identidad incompleta')
    return claims


@require_GET
def google_callback(request):
    flow = request.session.pop('google_oauth', None)
    state = request.GET.get('state', '')
    code = request.GET.get('code', '')
    registration = bool(flow and flow.get('registration'))
    failure_destination = 'link-google' if flow and flow.get('link_user_id') else 'login'
    return_origin = flow.get('return_origin', settings.FRONTEND_URL) if flow else settings.FRONTEND_URL
    return_path = flow.get('return_path', '/') if flow else '/'
    channel = flow.get('channel', '') if flow else ''
    popup = bool(flow and flow.get('popup'))
    if return_origin not in settings.CORS_ALLOWED_ORIGINS:
        return_origin = settings.FRONTEND_URL
    if return_path not in PUBLIC_REGISTRATION_PATHS:
        return_path = '/'
    if not flow or not state or not constant_time_compare(state, flow['state']) or time.time() - flow['created'] > 600 or not code:
        if registration:
            return registration_result_redirect(return_origin, return_path, 'error', channel, popup=popup)
        return failure('invalid', failure_destination)
    try:
        claims = verified_identity(code, flow)
        email = claims['email'].strip().lower()
        if registration:
            proof = signing.dumps({'email': email}, salt='member-registration-google-email')
            return registration_result_redirect(return_origin, return_path, 'success', channel, email, proof, popup)
        with transaction.atomic():
            link_user_id = flow.get('link_user_id')
            if link_user_id:
                if not request.user.is_authenticated or request.user.pk != link_user_id:
                    return failure('invalid', failure_destination)
                user = User.objects.select_for_update().filter(pk=link_user_id, is_active=True, email__iexact=email).first()
            else:
                user = User.objects.select_for_update().filter(email__iexact=email, is_active=True).first()
            if not user or (user.google_subject and user.google_subject != claims['sub']):
                return failure('unauthorized', failure_destination)
            picture = claims.get('picture', '')
            parsed = urlsplit(picture if isinstance(picture, str) else '')
            if parsed.scheme != 'https' or not parsed.hostname or not parsed.hostname.endswith('.googleusercontent.com'):
                picture = ''
            user.google_subject = claims['sub']
            user.profile_picture = picture
            fields = ['google_subject', 'profile_picture']
            if user.temporary_password:
                user.set_unusable_password()
                user.temporary_password = False
                fields += ['password', 'temporary_password']
            user.save(update_fields=fields)
        login(request, user, backend='django.contrib.auth.backends.ModelBackend')
    except (requests.RequestException, GoogleAuthError, ValueError, KeyError, IntegrityError):
        if registration:
            return registration_result_redirect(return_origin, return_path, 'error', channel, popup=popup)
        return failure('failed', failure_destination)
    return redirect(f'{settings.FRONTEND_URL}/?google_login=success')
