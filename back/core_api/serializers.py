from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from datetime import date
from rest_framework import serializers
from core_api.models import Department, Church, Member, User, Admission, Baptism, Marriage, Death, Separation
from modules.shared.application.services import CrudService
from modules.shared.infrastructure.repositories import DjangoRepository

def save_entity(entity):
    try:
        return CrudService(DjangoRepository()).save(entity)
    except DjangoValidationError as exc:
        raise serializers.ValidationError(getattr(exc, 'message_dict', exc.messages)) from exc

class ValidatedModelSerializer(serializers.ModelSerializer):
    def create(self, validated_data):
        return save_entity(self.Meta.model(**validated_data))

    def update(self, instance, validated_data):
        for field, value in validated_data.items():
            setattr(instance, field, value)
        return save_entity(instance)

def serializer_for(model):
    class AutoSerializer(ValidatedModelSerializer):
        class Meta:
            fields = '__all__'
    AutoSerializer.Meta.model = model
    return AutoSerializer

DepartmentSerializer = serializer_for(Department)
ChurchSerializer = serializer_for(Church)
MemberSerializer = serializer_for(Member)

class OwnMemberSerializer(serializers.ModelSerializer):
    church_name = serializers.CharField(source='church.name', read_only=True, default='')
    church_department = serializers.CharField(source='church.department.name', read_only=True, default='')
    department_name = serializers.CharField(source='department.name', read_only=True, default='')
    baptism_info = serializers.SerializerMethodField()
    religion = serializers.SerializerMethodField()

    def get_religion(self, member):
        baptism = member.baptisms.order_by('-id').first()
        admission = member.admissions.order_by('-id').first()
        return {'church': member.church_id, 'baptized': bool(baptism), 'baptism_month': baptism.month if baptism else None, 'baptism_year': baptism.year if baptism else None, 'pastor_name': baptism.pastor_name if baptism else '', 'admission_method': admission.method if admission else ''}

    def get_baptism_info(self, member):
        baptism = member.baptisms.order_by('-id').first()
        if not baptism:
            return None
        return {'month': baptism.month, 'year': baptism.year, 'pastor_name': baptism.pastor_name}

    class Meta:
        model = Member
        fields = ['names', 'paternal_surname', 'maternal_surname', 'identity_card', 'birth_date', 'birth_place', 'gender', 'marital_status', 'education_level', 'occupation', 'phone', 'email', 'address', 'department', 'previous_faith', 'father_name', 'father_identity_card', 'mother_name', 'mother_identity_card', 'spouse_name', 'spouse_identity_card', 'church_name', 'church_department', 'department_name', 'baptism_info', 'religion']
        read_only_fields = ['identity_card', 'birth_date', 'email', 'church_name', 'church_department', 'department_name', 'baptism_info', 'religion']

    def validate(self, attrs):
        allowed = set(self.fields) - set(self.Meta.read_only_fields)
        if set(self.initial_data) - allowed:
            raise serializers.ValidationError('Algunos campos no se pueden modificar desde esta vista.')
        for field in ('father_identity_card', 'mother_identity_card', 'spouse_identity_card'):
            value = attrs.get(field, '')
            if value and (not value.isascii() or not value.isdigit()):
                raise serializers.ValidationError({field: 'Ingrese solo números.'})
        member = self.instance
        father = attrs.get('father_identity_card', member.father_identity_card)
        mother = attrs.get('mother_identity_card', member.mother_identity_card)
        spouse = attrs.get('spouse_identity_card', member.spouse_identity_card)
        if member.identity_card and member.identity_card in (father, mother, spouse):
            raise serializers.ValidationError('El carnet del miembro debe ser diferente al de sus familiares.')
        if father and father == mother:
            raise serializers.ValidationError({'mother_identity_card': 'Los carnets del padre y de la madre deben ser distintos.'})
        for field in ('names', 'paternal_surname'):
            if field in attrs and not attrs[field].strip():
                raise serializers.ValidationError({field: 'Este campo no puede quedar vacío.'})
        return attrs


class OwnReligionSerializer(serializers.Serializer):
    church = serializers.PrimaryKeyRelatedField(queryset=Church.objects.all(), allow_null=True)
    baptized = serializers.BooleanField()
    baptism_month = serializers.IntegerField(min_value=1, max_value=12, allow_null=True)
    baptism_year = serializers.IntegerField(min_value=1900, max_value=9999, allow_null=True)
    pastor_name = serializers.CharField(max_length=200, allow_blank=True)
    admission_method = serializers.ChoiceField(choices=['bautismo', 'rebautismo', 'voto', 'transferencia'], allow_blank=True)

    def validate(self, data):
        member = self.context['member']
        church = data['church']
        if church and church.status != 'activa' and church.pk != member.church_id:
            raise serializers.ValidationError({'church': 'Seleccione una iglesia activa.'})
        if data['baptized']:
            month, year = data['baptism_month'], data['baptism_year']
            if not month or not year:
                raise serializers.ValidationError({'baptism_year': 'Seleccione el mes y año de bautismo.'})
            today = timezone.localdate()
            if date(year, month, 1) > today.replace(day=1):
                raise serializers.ValidationError({'baptism_year': 'El bautismo no puede estar en el futuro.'})
            if member.birth_date and (year, month) < (member.birth_date.year, member.birth_date.month):
                raise serializers.ValidationError({'baptism_year': 'El bautismo no puede ser anterior al nacimiento.'})
        elif data['baptism_month'] or data['baptism_year'] or data['pastor_name'] or data['admission_method']:
            raise serializers.ValidationError('Los datos de bautismo y admisión requieren marcar que está bautizado(a).')
        if data['admission_method'] and not church:
            raise serializers.ValidationError({'church': 'Seleccione la iglesia para registrar la admisión.'})
        return data

AdmissionSerializer = serializer_for(Admission)
SeparationSerializer = serializer_for(Separation)


class PublicChurchRegistrationSerializer(serializers.ModelSerializer):
    name = serializers.CharField(max_length=180, trim_whitespace=True)

    class Meta:
        model = Church
        fields = ['name', 'department']

    def validate_name(self, value):
        if not value:
            raise serializers.ValidationError('Ingrese el nombre de la iglesia.')
        return value

    def validate(self, attrs):
        if Church.objects.filter(department=attrs['department'], name__iexact=attrs['name']).exists():
            raise serializers.ValidationError({'name': 'Ya existe una iglesia con ese nombre en este departamento.'})
        return attrs

class EventSerializer(ValidatedModelSerializer):
    def validate(self, attrs):
        event_date = attrs.get('date', getattr(self.instance, 'date', None))
        member = attrs.get('member', getattr(self.instance, 'member', None))
        church = attrs.get('church', getattr(self.instance, 'church', None))
        if not event_date:
            raise serializers.ValidationError({'date': 'Indique la fecha.'})
        if event_date > timezone.localdate():
            raise serializers.ValidationError({'date': 'La fecha no puede ser futura.'})
        if member and member.birth_date and event_date < member.birth_date:
            raise serializers.ValidationError({'date': 'La fecha no puede ser anterior al nacimiento.'})
        if church and church.status != 'activa':
            raise serializers.ValidationError({'church': 'Seleccione una iglesia activa.'})
        return attrs

class BaptismSerializer(EventSerializer):
    class Meta:
        model = Baptism
        fields = '__all__'
    def create(self, data):
        if not data.get('pastor'):
            raise serializers.ValidationError({'pastor': 'Seleccione un pastor.'})
        data['month'] = data['date'].month
        data['year'] = data['date'].year
        return super().create(data)
    def update(self, instance, data):
        if data.get('date'):
            data['month'], data['year'] = data['date'].month, data['date'].year
        return super().update(instance, data)

class MarriageSerializer(EventSerializer):
    class Meta:
        model = Marriage
        fields = '__all__'
    def validate(self, attrs):
        attrs = super().validate(attrs)
        member = attrs.get('member', getattr(self.instance, 'member', None))
        spouse = attrs.get('spouse_member', getattr(self.instance, 'spouse_member', None))
        event_date = attrs.get('date', getattr(self.instance, 'date', None))
        if not spouse:
            raise serializers.ValidationError({'spouse_member': 'Seleccione la segunda persona.'})
        if member and member.pk == spouse.pk:
            raise serializers.ValidationError({'spouse_member': 'Seleccione dos personas diferentes.'})
        if spouse.birth_date and event_date < spouse.birth_date:
            raise serializers.ValidationError({'date': 'La fecha no puede ser anterior al nacimiento de la segunda persona.'})
        duplicate = Marriage.objects.filter(Q(member=member, spouse_member=spouse) | Q(member=spouse, spouse_member=member), date=event_date)
        if self.instance:
            duplicate = duplicate.exclude(pk=self.instance.pk)
        if duplicate.exists():
            raise serializers.ValidationError({'date': 'Este matrimonio ya está registrado en esa fecha.'})
        return attrs

class DeathSerializer(EventSerializer):
    class Meta:
        model = Death
        fields = '__all__'
    @transaction.atomic
    def create(self, data):
        death = super().create(data)
        death.member.status = 'fallecido'
        death.member.save(update_fields=['status'])
        return death

class RegistrationSerializer(ValidatedModelSerializer):
    is_pastor = serializers.BooleanField(default=False, write_only=True)
    baptized = serializers.BooleanField(default=False, write_only=True)
    baptism_month = serializers.IntegerField(min_value=1, max_value=12, required=False, allow_null=True, write_only=True)
    baptism_year = serializers.IntegerField(min_value=1900, required=False, allow_null=True, write_only=True)
    pastor_name = serializers.CharField(required=False, allow_blank=True, max_length=200, write_only=True)
    admission_method = serializers.ChoiceField(choices=['bautismo', 'rebautismo', 'voto', 'transferencia'], required=False, allow_blank=True, write_only=True)
    privacy_consent = serializers.BooleanField(write_only=True)
    names = serializers.CharField(max_length=150, trim_whitespace=True)
    paternal_surname = serializers.CharField(max_length=100, trim_whitespace=True)
    identity_card = serializers.RegexField(r'^[0-9]+$', max_length=40)
    birth_date = serializers.DateField()
    gender = serializers.ChoiceField(choices=['hombre', 'mujer'])

    class Meta:
        model = Member
        fields = ['id', 'names', 'paternal_surname', 'maternal_surname', 'identity_card', 'birth_date', 'birth_place', 'gender', 'marital_status', 'education_level', 'occupation', 'phone', 'email', 'address', 'department', 'previous_faith', 'father_name', 'father_identity_card', 'mother_name', 'mother_identity_card', 'spouse_name', 'spouse_identity_card', 'church', 'is_pastor', 'baptized', 'baptism_month', 'baptism_year', 'pastor_name', 'admission_method', 'privacy_consent']
        read_only_fields = ['id']

    def validate(self, attrs):
        today = timezone.localdate()
        born = attrs['birth_date']
        if not attrs.get('privacy_consent'):
            raise serializers.ValidationError({'privacy_consent': 'Debe aceptar el tratamiento de datos para registrar una ficha.'})
        if (today.year - born.year - ((today.month, today.day) < (born.month, born.day))) < 1:
            raise serializers.ValidationError({'birth_date': 'La persona debe tener al menos un año de edad.'})
        if Member.objects.filter(identity_card=attrs['identity_card']).exists():
            raise serializers.ValidationError({'identity_card': 'Ya existe un miembro con este carnet.'})
        for key in ('father_identity_card', 'mother_identity_card', 'spouse_identity_card'):
            if attrs.get(key) and not attrs[key].isascii() or attrs.get(key) and not attrs[key].isdigit():
                raise serializers.ValidationError({key: 'Ingrese solo números.'})
        if attrs.get('identity_card') in (attrs.get('father_identity_card'), attrs.get('mother_identity_card'), attrs.get('spouse_identity_card')):
            raise serializers.ValidationError({'identity_card': 'El carnet del miembro debe ser diferente al de sus familiares.'})
        if attrs.get('father_identity_card') and attrs['father_identity_card'] == attrs.get('mother_identity_card'):
            raise serializers.ValidationError({'mother_identity_card': 'Los carnets del padre y de la madre deben ser distintos.'})
        if attrs.get('is_pastor') and not attrs.get('email'):
            raise serializers.ValidationError({'email': 'El correo es necesario para registrar a un pastor.'})
        if attrs.get('is_pastor') and User.objects.filter(email__iexact=attrs.get('email', '')).exists():
            raise serializers.ValidationError({'email': 'Este correo ya está asociado a una cuenta.'})
        if attrs.get('church') and attrs['church'].status != 'activa':
            raise serializers.ValidationError({'church': 'Seleccione una iglesia activa.'})
        if attrs.get('baptized') and (not attrs.get('baptism_month') or not attrs.get('baptism_year')):
            raise serializers.ValidationError({'baptism_year': 'Seleccione el mes y año de bautismo.'})
        if attrs.get('baptized') and attrs['baptism_year'] > today.year:
            raise serializers.ValidationError({'baptism_year': 'El año de bautismo no puede ser futuro.'})
        if attrs.get('baptized') and date(attrs['baptism_year'], attrs['baptism_month'], 1) > today.replace(day=1):
            raise serializers.ValidationError({'baptism_month': 'El mes de bautismo no puede ser futuro.'})
        if attrs.get('baptized') and (attrs['baptism_year'], attrs['baptism_month']) < (born.year, born.month):
            raise serializers.ValidationError({'baptism_year': 'El bautismo no puede ser anterior al nacimiento.'})
        if not attrs.get('baptized') and attrs.get('pastor_name'):
            raise serializers.ValidationError({'pastor_name': 'El pastor oficiante solo se registra cuando la persona fue bautizada.'})
        if attrs.get('admission_method') and not attrs.get('church'):
            raise serializers.ValidationError({'church': 'Seleccione la iglesia para registrar la admisión.'})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        validated_data.pop('privacy_consent', None)
        is_pastor = validated_data.pop('is_pastor', False)
        baptized = validated_data.pop('baptized', False)
        month = validated_data.pop('baptism_month', None)
        year = validated_data.pop('baptism_year', None)
        pastor_name = validated_data.pop('pastor_name', '')
        admission_method = validated_data.pop('admission_method', '')
        member = save_entity(Member(**validated_data, privacy_consent_at=timezone.now(), privacy_consent_version='2026-11'))
        for relation in ('father', 'mother'):
            identity = getattr(member, f'{relation}_identity_card')
            if identity:
                parent = Member.objects.filter(identity_card=identity).exclude(pk=member.pk).first()
                if parent:
                    setattr(member, relation, parent)
            Member.objects.filter(**{f'{relation}_identity_card': member.identity_card, f'{relation}__isnull': True}).exclude(pk=member.pk).update(**{relation: member})
        member.save(update_fields=['father', 'mother'])
        if baptized:
            save_entity(Baptism(member=member, month=month, year=year, pastor_name=pastor_name))
        if admission_method:
            save_entity(Admission(member=member, church=member.church, method=admission_method))
        if is_pastor:
            user = User(username=member.email, email=member.email, member=member, role='pastor', is_active=False)
            user.set_unusable_password()
            save_entity(user)
        return member

class UserSerializer(ValidatedModelSerializer):
    password = serializers.CharField(write_only=True, required=False, trim_whitespace=False)
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'member', 'role', 'is_active', 'password']
        read_only_fields = ['id']

    def validate(self, attrs):
        if not self.instance and not attrs.get('password'):
            raise serializers.ValidationError({'password': 'Este campo es obligatorio.'})
        password = attrs.get('password')
        if password:
            try:
                password_validation.validate_password(password, user=self.instance)
            except DjangoValidationError as exc:
                raise serializers.ValidationError({'password': exc.messages}) from exc
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        return save_entity(user)

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if password:
            instance.set_password(password)
        return save_entity(instance)

class PastorListSerializer(serializers.ModelSerializer):
    member = MemberSerializer(read_only=True)
    class Meta:
        model = User
        fields = ['id', 'member', 'is_active']

class AccessSerializer(serializers.ModelSerializer):
    member = MemberSerializer(read_only=True)
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'is_active', 'member', 'temporary_password']
        read_only_fields = fields
