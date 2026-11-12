from django.contrib.auth.models import AbstractUser, UserManager
from django.db import models
from django.core.exceptions import ValidationError
from modules.accounts.domain.choices import UserRole

class AccountManager(UserManager):
    def create_superuser(self, username, email=None, password=None, **extra_fields):
        extra_fields['role'] = UserRole.ADMIN
        return super().create_superuser(username, email, password, **extra_fields)

class LoginAttemptWindow(models.Model):
    key = models.CharField(max_length=64, primary_key=True)
    started_at = models.DateTimeField()
    attempts = models.PositiveIntegerField(default=0)

    class Meta:
        app_label = 'core_api'

class User(AbstractUser):
    member = models.OneToOneField('core_api.Member', on_delete=models.PROTECT, null=True, blank=True, related_name='account')
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=UserRole.choices, default=UserRole.PASTOR)
    google_subject = models.CharField(max_length=255, unique=True, null=True, blank=True)
    profile_picture = models.URLField(max_length=1000, blank=True)
    temporary_password = models.BooleanField(default=False)
    REQUIRED_FIELDS = ['email']
    objects = AccountManager()
    class Meta:
        app_label = 'core_api'
    def clean(self):
        super().clean()
        if self.role in (UserRole.PASTOR, UserRole.MEMBER) and not self.member_id:
            raise ValidationError({'member': 'La cuenta debe estar vinculada a un miembro.'})
