from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from modules.events.domain.choices import AdmissionMethod, SeparationType

class Admission(models.Model):
    member = models.ForeignKey('core_api.Member', on_delete=models.PROTECT, related_name='admissions')
    church = models.ForeignKey('core_api.Church', on_delete=models.PROTECT, related_name='admissions')
    origin_church = models.ForeignKey('core_api.Church', on_delete=models.PROTECT, null=True, blank=True, related_name='outgoing_admissions')
    method = models.CharField(max_length=20, choices=AdmissionMethod.choices)
    date = models.DateField(null=True, blank=True)
    class Meta: app_label = 'core_api'

class Baptism(models.Model):
    member = models.ForeignKey('core_api.Member', on_delete=models.PROTECT, related_name='baptisms')
    pastor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name='officiated_baptisms')
    pastor_name = models.CharField(max_length=200, blank=True)
    month = models.PositiveSmallIntegerField(null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(12)])
    year = models.PositiveSmallIntegerField(null=True, blank=True, validators=[MinValueValidator(1900), MaxValueValidator(9999)])
    date = models.DateField(null=True, blank=True)
    church = models.ForeignKey('core_api.Church', on_delete=models.PROTECT, null=True, blank=True, related_name='baptisms')
    place = models.CharField(max_length=200, blank=True)
    notes = models.TextField(blank=True)
    class Meta: app_label = 'core_api'
    def clean(self):
        super().clean()
        if self.pastor_id and self.pastor.role != 'pastor':
            raise ValidationError({'pastor': 'El oficiante debe tener el rol de pastor.'})

class Marriage(models.Model):
    member = models.ForeignKey('core_api.Member', on_delete=models.PROTECT, related_name='marriages')
    spouse_member = models.ForeignKey('core_api.Member', on_delete=models.PROTECT, null=True, blank=True, related_name='spouse_marriages')
    spouse_name = models.CharField(max_length=200, blank=True)
    date = models.DateField(null=True, blank=True)
    place = models.CharField(max_length=200, blank=True)
    pastor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name='officiated_marriages')
    church = models.ForeignKey('core_api.Church', on_delete=models.PROTECT, null=True, blank=True, related_name='marriages')
    notes = models.TextField(blank=True)
    class Meta: app_label = 'core_api'
    def clean(self):
        super().clean()
        if self.member_id and self.member_id == self.spouse_member_id:
            raise ValidationError({'spouse_member': 'El cónyuge debe ser una persona diferente.'})
        if self.pastor_id and self.pastor.role != 'pastor':
            raise ValidationError({'pastor': 'El oficiante debe tener el rol de pastor.'})

class Death(models.Model):
    member = models.OneToOneField('core_api.Member', on_delete=models.PROTECT, related_name='death')
    date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    class Meta: app_label = 'core_api'

class Separation(models.Model):
    member = models.ForeignKey('core_api.Member', on_delete=models.PROTECT, related_name='separations')
    destination_church = models.ForeignKey('core_api.Church', on_delete=models.PROTECT, null=True, blank=True, related_name='incoming_separations')
    type = models.CharField(max_length=20, choices=SeparationType.choices)
    date = models.DateField(null=True, blank=True)
    responsible = models.CharField(max_length=200, blank=True)
    notes = models.TextField(blank=True)
    class Meta: app_label = 'core_api'
