import hashlib
import json
import os
import time
from django.contrib.auth import authenticate, login, logout
from django.db.models.deletion import ProtectedError
from django.db.models import Q
from django.db import IntegrityError, transaction
from django.core.exceptions import ValidationError
from django.core import signing
from django.core.validators import validate_email
from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.middleware.csrf import CsrfViewMiddleware, get_token
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_protect
from django.views.decorators.http import require_GET, require_POST
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny, IsAuthenticated, BasePermission, SAFE_METHODS
from rest_framework.response import Response
from core_api.models import Department, Church, ChurchRegistrationOrigin, Member, MemberChange, User, Admission, Baptism, Marriage, Death, Separation
from core_api import serializers

class IsAdministrator(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (request.user.is_superuser or request.user.role == 'administrador'))

class PanelAccess(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and (request.method in SAFE_METHODS or user.is_superuser or user.role in ('administrador', 'pastor')))


class CanManagePanel(BasePermission):
    """Las mutaciones administrativas nunca se autorizan desde el navegador."""
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and (user.is_superuser or user.role in ('administrador', 'pastor')))

class ProtectedViewSet(viewsets.ModelViewSet):
    permission_classes = [PanelAccess]
    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response({'detail': 'No se puede eliminar porque tiene registros relacionados.'}, status=status.HTTP_409_CONFLICT)

class DepartmentViewSet(ProtectedViewSet):
    queryset = Department.objects.all()
    serializer_class = serializers.DepartmentSerializer
    def get_permissions(self):
        return [(IsAuthenticated if self.action in ('list', 'retrieve') else IsAdministrator)()]

class ChurchViewSet(ProtectedViewSet):
    queryset = Church.objects.select_related('department').all()
    serializer_class = serializers.ChurchSerializer
    def get_permissions(self):
        return [(IsAuthenticated if self.action in ('list', 'retrieve') else IsAdministrator)()]
    def destroy(self, request, *args, **kwargs):
        return Response({'detail': 'Use la acción anular para conservar el historial.'}, status=status.HTTP_405_METHOD_NOT_ALLOWED)
    @action(detail=True, methods=['post'], url_path='anular')
    def annul(self, request, pk=None):
        church = self.get_object()
        church.status = 'anulada'
        church.save(update_fields=['status'])
        return Response(self.get_serializer(church).data)


def public_client_ip(request):
    """Render termina TLS; el proxy debe ser habilitado explícitamente por entorno."""
    if os.getenv('DJANGO_TRUST_PROXY', 'false').lower() == 'true':
        forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
        if forwarded:
            return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '')


def public_ip_hash(request):
    value = public_client_ip(request)
    salt = os.getenv('DJANGO_IP_HASH_SALT') or os.getenv('DJANGO_SECRET_KEY', '')
    return hashlib.sha256(f'{salt}:{value}'.encode('utf-8')).hexdigest()


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def public_church_directory(request):
    if request.method == 'GET':
        churches = Church.objects.filter(status='activa').select_related('department')
        return Response({
            'departments': [{'id': item.id, 'name': item.name} for item in Department.objects.all()],
            'churches': [{'id': item.id, 'name': item.name, 'department': item.department.name} for item in churches],
        })

    serializer = serializers.PublicChurchRegistrationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    try:
        with transaction.atomic():
            if ChurchRegistrationOrigin.objects.select_for_update().filter(ip_hash=public_ip_hash(request)).exists():
                return Response({'detail': 'Desde esta conexión ya se registró una iglesia. Para corregir datos, contacte a un administrador.'}, status=status.HTTP_429_TOO_MANY_REQUESTS)
            church = serializer.save()
            ChurchRegistrationOrigin.objects.create(ip_hash=public_ip_hash(request), church=church)
    except IntegrityError:
        return Response({'detail': 'Desde esta conexión ya se registró una iglesia. Para corregir datos, contacte a un administrador.'}, status=status.HTTP_429_TOO_MANY_REQUESTS)
    return Response({'id': church.id, 'name': church.name, 'department': church.department.name}, status=status.HTTP_201_CREATED)

class MemberViewSet(ProtectedViewSet):
    queryset = Member.objects.select_related('church', 'department').all()
    serializer_class = serializers.MemberSerializer
    def get_permissions(self):
        return [(IsAuthenticated if self.action in ('list', 'retrieve') else CanManagePanel)()]
    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        return queryset.filter(pk=user.member_id) if user.role == 'miembro' and not user.is_superuser else queryset

class UserViewSet(ProtectedViewSet):
    queryset = User.objects.select_related('member').all()
    serializer_class = serializers.UserSerializer
    permission_classes = [IsAdministrator]

class AccessViewSet(viewsets.ViewSet):
    permission_classes = [IsAdministrator]

    def list(self, request):
        accounts = User.objects.filter(member__isnull=False).exclude(role='administrador').select_related('member').order_by('member__names', 'id')
        return Response(serializers.AccessSerializer(accounts, many=True).data)

    @transaction.atomic
    def create(self, request):
        member_id = request.data.get('member')
        if not isinstance(member_id, int) or isinstance(member_id, bool):
            return Response({'detail': 'Seleccione un miembro válido.'}, status=400)
        member = get_object_or_404(Member.objects.select_for_update(), pk=member_id)
        email = member.email.strip().lower()
        try:
            validate_email(email)
        except ValidationError:
            return Response({'detail': 'El miembro debe tener un correo válido registrado.'}, status=400)
        account = User.objects.filter(member=member).first()
        conflict = User.objects.filter(email__iexact=email).exclude(pk=account.pk if account else None).exists()
        if conflict:
            return Response({'detail': 'Ese correo ya pertenece a otra cuenta.'}, status=409)
        if account and (account.is_superuser or account.role == 'administrador'):
            return Response({'detail': 'No se puede modificar una cuenta administradora desde esta sección.'}, status=403)
        if account and account.email.lower() != email:
            return Response({'detail': 'El correo de la cuenta no coincide con el del miembro. Actualícelo primero en administración.'}, status=409)
        if not account:
            account = User(username=f'miembro-{member.pk}', email=email, member=member, role='miembro', is_active=True)
            account.set_unusable_password()
            if User.objects.filter(username=account.username).exists():
                return Response({'detail': 'No se pudo generar un nombre de usuario único.'}, status=409)
        else:
            account.is_active = True
        if account.temporary_password:
            account.set_unusable_password()
            account.temporary_password = False
        try:
            account.full_clean()
            account.save()
        except (ValidationError, IntegrityError):
            return Response({'detail': 'No se pudo habilitar el acceso. Verifique los datos del usuario.'}, status=400)
        return Response(serializers.AccessSerializer(account).data)

    @action(detail=True, methods=['post'])
    def revocar(self, request, pk=None):
        account = get_object_or_404(User, pk=pk, member__isnull=False)
        if account.is_superuser or account.role == 'administrador' or account.pk == request.user.pk:
            return Response({'detail': 'No se puede revocar esta cuenta desde esta sección.'}, status=403)
        account.is_active = False
        account.save(update_fields=['is_active'])
        return Response(serializers.AccessSerializer(account).data)

class PastorViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = User.objects.filter(role='pastor', member__isnull=False).select_related('member').order_by('id')
    serializer_class = serializers.PastorListSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        return queryset.filter(member_id=user.member_id) if user.role == 'miembro' and not user.is_superuser else queryset

class MemberEventViewSet(ProtectedViewSet):
    def get_permissions(self):
        return [(IsAuthenticated if self.action in ('list', 'retrieve') else CanManagePanel)()]
    def get_queryset(self):
        queryset = super().get_queryset()
        if not queryset.ordered:
            queryset = queryset.order_by('pk')
        user = self.request.user
        if user.role == 'miembro' and not user.is_superuser:
            if not user.member_id:
                return queryset.none()
            condition = Q(member_id=user.member_id)
            if self.queryset.model is Marriage:
                condition |= Q(spouse_member_id=user.member_id)
            return queryset.filter(condition)
        return queryset

class AdmissionViewSet(MemberEventViewSet):
    queryset = Admission.objects.all()
    serializer_class = serializers.AdmissionSerializer
class BaptismViewSet(MemberEventViewSet):
    queryset = Baptism.objects.all()
    serializer_class = serializers.BaptismSerializer
class MarriageViewSet(MemberEventViewSet):
    queryset = Marriage.objects.all()
    serializer_class = serializers.MarriageSerializer
class DeathViewSet(MemberEventViewSet):
    queryset = Death.objects.all()
    serializer_class = serializers.DeathSerializer
    http_method_names = ['get', 'post', 'head', 'options']
class SeparationViewSet(MemberEventViewSet):
    queryset = Separation.objects.all()
    serializer_class = serializers.SeparationSerializer

@ensure_csrf_cookie
@require_GET
def csrf_token(request):
    return JsonResponse({'csrfToken': get_token(request)})


def account_display_name(user):
    if not user.member_id:
        return user.username
    member = user.member
    initials = ' '.join(f'{surname.strip()[0].upper()}.' for surname in (member.paternal_surname, member.maternal_surname) if surname and surname.strip())
    return ' '.join(part for part in (member.names.strip(), initials) if part) or user.username


@csrf_protect
@require_POST
def sign_in(request):
    try:
        data = json.loads(request.body)
        if not isinstance(data, dict):
            raise ValueError
    except (ValueError, UnicodeDecodeError):
        return JsonResponse({'detail': 'JSON inválido.'}, status=400)
    username = data.get('username')
    password = data.get('password')
    if not isinstance(username, str) or not isinstance(password, str):
        return JsonResponse({'detail': 'Se requieren usuario y contraseña.'}, status=400)
    username = username.strip()
    account = User.objects.filter(email__iexact=username).first()
    if not account and username.isascii() and username.isdigit():
        account = User.objects.filter(member__identity_card=username).first()
    user = authenticate(request, username=account.username if account else username, password=password)
    if user is None or user.temporary_password:
        return JsonResponse({'detail': 'Credenciales inválidas.'}, status=401)
    login(request, user)
    return JsonResponse({'id': user.id, 'username': user.username, 'display_name': account_display_name(user), 'email': user.email, 'picture': user.profile_picture, 'role': user.role, 'member': user.member_id, 'must_link_google': user.temporary_password and not user.google_subject, 'csrfToken': get_token(request)})

@require_GET
def session_user(request):
    if not request.user.is_authenticated:
        return JsonResponse({'detail': 'No hay una sesión activa.'}, status=401)
    user = request.user
    return JsonResponse({'id': user.id, 'username': user.username, 'display_name': account_display_name(user), 'email': user.email, 'picture': user.profile_picture, 'role': user.role, 'member': user.member_id, 'can_register_pastors': user.is_superuser or user.role == 'administrador', 'must_link_google': user.temporary_password and not user.google_subject, 'csrfToken': get_token(request)})

@csrf_protect
@require_POST
def sign_out(request):
    logout(request)
    return JsonResponse({'detail': 'Sesión cerrada.'})

@api_view(['GET'])
@authentication_classes([])
@permission_classes([])
def registration_options(request):
    return Response({
        'departments': [{'id': d.id, 'name': d.name} for d in Department.objects.all()],
        'churches': [{'id': c.id, 'name': c.name, 'department': c.department.name} for c in Church.objects.filter(status='activa').select_related('department')],
    })

@csrf_protect
@api_view(['POST'])
@permission_classes([AllowAny])
def register_member(request):
    # El formulario público puede registrar miembros, pero nunca elevar privilegios creando pastores.
    if request.data.get('is_pastor') and not (
        request.user.is_authenticated and (request.user.is_superuser or request.user.role == 'administrador')
    ):
        return Response({'detail': 'No tiene permiso para registrar pastores.'}, status=status.HTTP_403_FORBIDDEN)
    may_manage_members = request.user.is_authenticated and (
        request.user.is_superuser or request.user.role in ('administrador', 'pastor')
    )
    if not may_manage_members:
        proof_input = request.data.get('google_email_proof', '')
        if not isinstance(proof_input, str):
            proof_input = ''
        try:
            proof = signing.loads(proof_input, salt='member-registration-google-email', max_age=3600)
        except (signing.BadSignature, signing.SignatureExpired, TypeError):
            return Response({'email': 'Verifica tu correo con Google antes de enviar el registro.'}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(proof, dict) or proof.get('email') != str(request.data.get('email', '')).strip().lower():
            return Response({'email': 'El correo no coincide con la cuenta verificada de Google.'}, status=status.HTTP_400_BAD_REQUEST)
    serializer = serializers.RegistrationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    member = serializer.save()
    return Response({'id': member.id}, status=status.HTTP_201_CREATED)


@csrf_protect
@api_view(['POST'])
@permission_classes([AllowAny])
def lookup_member_record(request):
    request.session.pop('member_lookup_grant', None)
    identity_card = str(request.data.get('identity_card', '')).strip()
    birth_date = request.data.get('birth_date')
    member = Member.objects.filter(identity_card=identity_card, birth_date=birth_date).select_related('church', 'department').first()
    if not member:
        return Response({'detail': 'No se encontró una ficha con esos datos.'}, status=status.HTTP_404_NOT_FOUND)
    request.session['member_lookup_grant'] = {'member_id': member.pk, 'expires': time.time() + 15 * 60}
    return Response({
        'names': member.names,
        'paternal_surname': member.paternal_surname,
        'maternal_surname': member.maternal_surname,
        'birth_date': member.birth_date,
        'birth_place': member.birth_place,
        'gender': member.gender,
        'marital_status': member.marital_status,
        'education_level': member.education_level,
        'occupation': member.occupation,
        'church': member.church.name if member.church else '',
        'department': member.department.name if member.department else '',
        'status': member.status,
    })


@csrf_protect
@api_view(['GET', 'PATCH'])
@permission_classes([AllowAny])
def own_member_record(request):
    if request.method == 'PATCH':
        csrf_failure = CsrfViewMiddleware(lambda req: None).process_view(request._request, lambda req: None, (), {})
        if csrf_failure:
            return Response({'detail': 'La verificación de seguridad falló. Recarga la página.'}, status=403)
    grant = request.session.get('member_lookup_grant', {})
    member_id = grant.get('member_id') if grant.get('expires', 0) > time.time() else None
    if not member_id and request.user.is_authenticated:
        member_id = request.user.member_id
    if not member_id:
        return Response({'detail': 'Consulta tu ficha nuevamente para continuar.'}, status=403)
    if request.method == 'GET':
        member = get_object_or_404(Member, pk=member_id)
        history = member.change_history.select_related('actor')[:50]
        return Response({'member': serializers.OwnMemberSerializer(member).data, 'history': [{'id': item.id, 'date': item.created_at, 'actor': account_display_name(item.actor) if item.actor_id else 'Consulta con carnet y fecha de nacimiento', 'changes': item.changes} for item in history]})
    with transaction.atomic():
        member = get_object_or_404(Member.objects.select_for_update(), pk=member_id)
        payload = request.data.copy()
        religion_data = payload.pop('religion', None)
        serializer = serializers.OwnMemberSerializer(member, data=payload, partial=True)
        serializer.is_valid(raise_exception=True)
        changes = {}
        for field, value in serializer.validated_data.items():
            before = getattr(member, field)
            if before != value:
                changes[field] = {'before': before.pk if field == 'department' and before else before, 'after': value.pk if field == 'department' and value else value}
        if religion_data is not None:
            religion = serializers.OwnReligionSerializer(data=religion_data, context={'member': member})
            religion.is_valid(raise_exception=True)
            updated = religion.validated_data
            before = serializers.OwnMemberSerializer(member).data['religion']
            after = {**updated, 'church': updated['church'].pk if updated['church'] else None}
            if before != after:
                baptisms = list(member.baptisms.select_for_update().order_by('-id'))
                admissions = list(member.admissions.select_for_update().order_by('-id'))
                if len(baptisms) > 1 or len(admissions) > 1:
                    return Response({'detail': 'Hay varios registros religiosos. Solicita a administración que realice el cambio.'}, status=400)
                baptism = baptisms[0] if baptisms else None
                admission = admissions[0] if admissions else None
                if baptism and not updated['baptized'] and (baptism.date or baptism.pastor_id or baptism.church_id or baptism.place or baptism.notes):
                    return Response({'detail': 'El bautismo contiene información adicional; solicita a administración su corrección.'}, status=400)
                if admission and not updated['admission_method'] and admission.date:
                    return Response({'detail': 'La admisión tiene fecha registrada; solicita a administración su corrección.'}, status=400)
                if updated['baptized']:
                    if baptism is None:
                        baptism = Baptism(member=member)
                    baptism.month, baptism.year, baptism.pastor_name = updated['baptism_month'], updated['baptism_year'], updated['pastor_name']
                    baptism.save()
                elif baptism:
                    baptism.delete()
                if updated['admission_method']:
                    if admission is None:
                        admission = Admission(member=member, church=updated['church'])
                    admission.method = updated['admission_method']
                    admission.save()
                elif admission:
                    admission.delete()
                member.church = updated['church']
                member.save(update_fields=['church'])
                for key in before:
                    if before[key] != after[key]:
                        changes['religion.' + key] = {'before': before[key], 'after': after[key]}
        if changes:
            serializer.save()
            for relation in ('father', 'mother'):
                if relation + '_identity_card' in changes:
                    identity = getattr(member, relation + '_identity_card')
                    setattr(member, relation, Member.objects.filter(identity_card=identity).exclude(pk=member.pk).first() if identity else None)
                    member.save(update_fields=[relation])
            actor = request.user if request.user.is_authenticated and request.user.member_id == member.pk else None
            MemberChange.objects.create(member=member, actor=actor, changes=changes)
    history = member.change_history.select_related('actor')[:50]
    return Response({'member': serializers.OwnMemberSerializer(member).data, 'changed': bool(changes), 'history': [{'id': item.id, 'date': item.created_at, 'actor': account_display_name(item.actor) if item.actor_id else 'Consulta con carnet y fecha de nacimiento', 'changes': item.changes} for item in history]})
