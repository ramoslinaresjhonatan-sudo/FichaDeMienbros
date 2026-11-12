from django.db import models

class AdmissionMethod(models.TextChoices):
    BAPTISM = 'bautismo', 'Bautismo oficial'
    REBAPTISM = 'rebautismo', 'Rebautismo'
    CHURCH_VOTE = 'voto', 'Voto de la iglesia'
    TRANSFER = 'transferencia', 'Transferencia'

class SeparationType(models.TextChoices):
    RESIGNATION = 'renuncia', 'Renuncia'
    EXCLUSION = 'exclusion', 'Exclusión'
    TRANSFER = 'transferencia', 'Transferencia'
    ABROAD = 'exterior', 'Transferencia al exterior'
    OTHER = 'otro', 'Otro'
