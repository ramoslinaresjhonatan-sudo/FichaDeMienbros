import json
from django.contrib.auth import authenticate, login, logout
from django.db.models.deletion import ProtectedError
from django.db.models import Q
from django.db import IntegrityError, transaction
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_protect
from django.views.decorators.http import require_GET, require_POST
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny, IsAuthenticated, BasePermission, SAFE_METHODS
from rest_framework.response import Response
from core_api.models import Department, Church, Member, User, Admission, Baptism, Marriage, Death, Separation
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
        return [(IsAuthenticated if self.action in ('list', 'retrieve') else CanManagePanel)()]
    def destroy(self, request, *args, **kwargs):
        return Response({'detail': 'Use la acción anular para conservar el historial.'}, status=status.HTTP_405_METHOD_NOT_ALLOWED)
    @action(detail=True, methods=['post'], url_path='anular')
    def annul(self, request, pk=None):
        church = self.get_object()
        church.status = 'anulada'
        church.save(update_fields=['status'])
        return Response(self.get_serializer(church).data)

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
    return JsonResponse({'id': user.id, 'username': user.username, 'email': user.email, 'picture': user.profile_picture, 'role': user.role, 'member': user.member_id, 'must_link_google': user.temporary_password and not user.google_subject, 'csrfToken': get_token(request)})

@require_GET
def session_user(request):
    if not request.user.is_authenticated:
        return JsonResponse({'detail': 'No hay una sesión activa.'}, status=401)
    user = request.user
    return JsonResponse({'id': user.id, 'username': user.username, 'email': user.email, 'picture': user.profile_picture, 'role': user.role, 'must_link_google': user.temporary_password and not user.google_subject, 'csrfToken': get_token(request)})

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
    serializer = serializers.RegistrationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    member = serializer.save()
    return Response({'id': member.id}, status=status.HTTP_201_CREATED)
