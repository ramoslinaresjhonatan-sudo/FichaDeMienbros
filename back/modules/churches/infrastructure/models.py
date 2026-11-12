from django.db import models
from modules.churches.domain.choices import ChurchStatus

class Department(models.Model):
    name = models.CharField(max_length=80, unique=True)
    class Meta:
        app_label = 'core_api'
        ordering = ['name']
    def __str__(self):
        return self.name

class Church(models.Model):
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name='churches')
    name = models.CharField(max_length=180)
    status = models.CharField(max_length=10, choices=ChurchStatus.choices, default=ChurchStatus.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        app_label = 'core_api'
        ordering = ['name']
        constraints = [models.UniqueConstraint(fields=['department', 'name'], name='unique_church_department_name')]
    def __str__(self):
        return self.name
