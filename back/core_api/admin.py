from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from core_api.models import User

@admin.register(User)
class AccountAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (('Perfil de miembro', {'fields': ('member', 'role')}),)
    list_display = ('username', 'email', 'role', 'is_active', 'is_staff')
