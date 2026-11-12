from django.db import models

class ChurchStatus(models.TextChoices):
    ACTIVE = 'activa', 'Activa'
    ANNULLED = 'anulada', 'Anulada'
