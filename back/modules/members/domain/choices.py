from django.db import models

class Gender(models.TextChoices):
    MALE = 'hombre', 'Hombre'
    FEMALE = 'mujer', 'Mujer'

class MemberStatus(models.TextChoices):
    ACTIVE = 'activo', 'Activo'
    SEPARATED = 'separado', 'Separado'
    DECEASED = 'fallecido', 'Fallecido'
