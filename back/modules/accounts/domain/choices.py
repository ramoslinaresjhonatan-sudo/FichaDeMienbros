from django.db import models

class UserRole(models.TextChoices):
    ADMIN = 'administrador', 'Administrador'
    PASTOR = 'pastor', 'Pastor'
    MEMBER = 'miembro', 'Miembro'
