from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import Note, User, NoteToken
from django.utils import timezone

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ['email']
    list_display = [
        'email', 'signup_provider', 'is_email_verified', 'is_frozen',
        'date_joined', 'last_activity', 'location',
        'is_staff', 'is_active',
    ]
    list_filter = BaseUserAdmin.list_filter + ('location',)
    readonly_fields = ['last_activity']
    actions = ['freeze_users', 'unfreeze_users']
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Email verification', {'fields': ('signup_provider', 'is_email_verified', 'email_verified_at')}),
        ('Activity', {'fields': ('date_joined', 'last_activity', 'location')}),
        ('Account status', {'fields': ('is_frozen', 'frozen_reason', 'frozen_at')}),
        ('Permissions', {'fields': ('is_staff', 'is_active', 'is_superuser', 'groups', 'user_permissions')}),
    )
    add_fieldsets = (
        (None, {
            'fields': ('email', 'password1', 'password2', 'is_staff', 'is_active'),
        }),
    )
    search_fields = ['email']

    def save_model(self, request, obj, form, change):
        if change and 'is_frozen' in form.changed_data:
            obj.frozen_at = timezone.now() if obj.is_frozen else None
        super().save_model(request, obj, form, change)

    @admin.action(description='Freeze selected users')
    def freeze_users(self, request, queryset):
        updated = queryset.exclude(is_frozen=True).update(
            is_frozen=True,
            frozen_at=timezone.now(),
        )
        self.message_user(request, f'{updated} user(s) frozen.')

    @admin.action(description='Unfreeze selected users')
    def unfreeze_users(self, request, queryset):
        updated = queryset.exclude(is_frozen=False).update(
            is_frozen=False,
            frozen_at=None,
        )
        self.message_user(request, f'{updated} user(s) unfrozen.')

admin.site.register(Note)
admin.site.register(NoteToken)