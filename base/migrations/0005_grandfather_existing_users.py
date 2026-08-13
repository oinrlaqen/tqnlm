from django.db import migrations
from django.utils import timezone

def grandfather_existing_users(apps, schema_editor):
    User = apps.get_model('base', 'User')
    now = timezone.now()
    # Every account that already existed before this feature shipped should
    # never have been subject to email verification in the first place —
    # mark them all verified so `is_frozen` can never retroactively apply.
    User.objects.filter(is_email_verified=False).update(
        is_email_verified=True,
        email_verified_at=now,
    )

def reverse_noop(apps, schema_editor):
    pass  # deliberately not reversible — don't re-freeze real accounts on rollback

class Migration(migrations.Migration):
    dependencies = [
        ('base', '0004_user_email_verified_at_user_is_email_verified_and_more'),  # ← set this to whatever migration added the new fields
    ]
    operations = [
        migrations.RunPython(grandfather_existing_users, reverse_noop),
    ]