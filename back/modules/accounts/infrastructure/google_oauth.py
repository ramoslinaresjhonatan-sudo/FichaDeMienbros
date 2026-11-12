import base64
import hashlib
import secrets
import time
from urllib.parse import urlencode, urlsplit

import requests
from django.conf import settings
from django.contrib.auth import login
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


def failure(reason):
    return redirect(f'{settings.FRONTEND_URL}/?google_error={reason}')


def authorization_url(request, link_user_id=None):
    if not settings.GOOGLE_OAUTH_CLIENT_ID or not settings.GOOGLE_OAUTH_CLIENT_SECRET:
        return None
    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode('ascii')).digest()).rstrip(b'=').decode('ascii')
    request.session['google_oauth'] = {'state': state, 'nonce': nonce, 'verifier': verifier, 'created': time.time(), 'link_user_id': link_user_id}
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
    if not flow or not state or not constant_time_compare(state, flow['state']) or time.time() - flow['created'] > 600 or not code:
        return failure('invalid')
    try:
        claims = verified_identity(code, flow)
        email = claims['email'].strip().lower()
        with transaction.atomic():
            link_user_id = flow.get('link_user_id')
            if link_user_id:
                if not request.user.is_authenticated or request.user.pk != link_user_id:
                    return failure('invalid')
                user = User.objects.select_for_update().filter(pk=link_user_id, is_active=True, email__iexact=email).first()
            else:
                user = User.objects.select_for_update().filter(email__iexact=email, is_active=True).first()
            if not user or (user.google_subject and user.google_subject != claims['sub']):
                return failure('unauthorized')
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
        return failure('failed')
    return redirect(f'{settings.FRONTEND_URL}/?google_login=success')
