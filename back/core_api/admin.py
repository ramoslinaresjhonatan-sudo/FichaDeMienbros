from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from core_api.models import User, MemberChange

@admin.register(User)
class AccountAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (('Perfil de miembro', {'fields': ('member', 'role')}),)
    list_display = ('username', 'email', 'role', 'is_active', 'is_staff')


@admin.register(MemberChange)
class MemberChangeAdmin(admin.ModelAdmin):
    list_display = ('member', 'actor', 'created_at')
    readonly_fields = ('member', 'actor', 'changes', 'created_at')
    def has_add_permission(self, request):
        return False
    def has_change_permission(self, request, obj=None):
        return False
    def has_delete_permission(self, request, obj=None):
        return False
