from django.conf import settings
from django.db import models
from modules.members.domain.choices import Gender, MemberStatus

class Member(models.Model):
    church = models.ForeignKey('core_api.Church', on_delete=models.PROTECT, null=True, blank=True, related_name='members')
    department = models.ForeignKey('core_api.Department', on_delete=models.PROTECT, null=True, blank=True, related_name='members')
    names = models.CharField(max_length=150, blank=True)
    paternal_surname = models.CharField(max_length=100, blank=True)
    maternal_surname = models.CharField(max_length=100, blank=True)
    gender = models.CharField(max_length=10, choices=Gender.choices, blank=True)
    identity_card = models.CharField(max_length=40, blank=True)
    birth_date = models.DateField(null=True, blank=True)
    birth_place = models.CharField(max_length=200, blank=True)
    marital_status = models.CharField(max_length=40, blank=True)
    occupation = models.CharField(max_length=150, blank=True)
    education_level = models.CharField(max_length=80, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    address = models.CharField(max_length=255, blank=True)
    previous_faith = models.CharField(max_length=150, blank=True)
    father_name = models.CharField(max_length=200, blank=True)
    father_identity_card = models.CharField(max_length=40, blank=True)
    father = models.ForeignKey('self', on_delete=models.PROTECT, null=True, blank=True, related_name='children_as_father')
    mother_name = models.CharField(max_length=200, blank=True)
    mother_identity_card = models.CharField(max_length=40, blank=True)
    mother = models.ForeignKey('self', on_delete=models.PROTECT, null=True, blank=True, related_name='children_as_mother')
    spouse_name = models.CharField(max_length=200, blank=True)
    spouse_identity_card = models.CharField(max_length=40, blank=True)
    status = models.CharField(max_length=12, choices=MemberStatus.choices, default=MemberStatus.ACTIVE)
    privacy_consent_at = models.DateTimeField(null=True, blank=True)
    privacy_consent_version = models.CharField(max_length=30, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        app_label = 'core_api'
        ordering = ['paternal_surname', 'names', 'id']
        constraints = [models.UniqueConstraint(fields=['identity_card'], condition=~models.Q(identity_card=''), name='unique_nonempty_member_identity')]
    def __str__(self):
        return ' '.join(filter(None, [self.names, self.paternal_surname, self.maternal_surname])) or f'Miembro {self.pk}'


class MemberChange(models.Model):
    member = models.ForeignKey(Member, on_delete=models.PROTECT, related_name='change_history')
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='member_changes', null=True, blank=True)
    changes = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'core_api'
        ordering = ['-created_at', '-id']
